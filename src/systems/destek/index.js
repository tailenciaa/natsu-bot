// Destek sistemi: #destek-talebi kanalındaki panelden talep açılır, talep o kanalın altında özel alt başlık olur.
// Panel bot açılınca kanala kendiliğinden gönderilir. Yetkililere #destek-talepleri kanalına "Yeni Destek Talebi"
// mesajı gider, butona ilk basan talebi üstlenir. Talep kapanınca değerlendirme sistemi üyeye DM'den yetkiliyi puanlatır.
const {
  AttachmentBuilder,
  ChannelType,
  Events,
  InteractionContextType,
  MessageType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
} = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError, isStaff, fetchTextChannel, userName } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const ratings = require('../degerlendirme');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { buildTranscript } = require('./transcript');

const creating = new Set();
const closing = new Set();
const UNKNOWN_MESSAGE = 10008;

// Durum panelinin güncel hali (bileşenler + kart eki). Kart çizilemezse metinli liste gösterilir.
// Mesaj her güncellemede yeniden düzenlendiği için kart dosya adı eşsiz üretilir; eski ekler temizlenir
async function statusPanelView(client, gid, page = 0) {
  const tickets = store.openTicketsAll(gid);
  const guild = client.guilds.cache.get(gid);
  // Kart çizimi eşzamanlı olduğundan görünecek sayfadaki adlar önceden çözülür
  const names = new Map();
  for (const ticket of ui.statusPage(tickets, page).shown) {
    for (const id of [ticket.ownerId, ticket.claimedBy]) {
      if (id && !names.has(id)) names.set(id, await userName(guild, id));
    }
  }
  let card = null;
  try {
    card = require('./card').buildStatusCard(tickets, page, `destek-durum-${Date.now().toString(36)}.png`, (id) => names.get(id) ?? null);
  } catch (err) {
    console.error('[destek] Durum paneli kartı çizilemedi, metinli panel gösterilecek:', err.message);
  }
  return {
    components: [ui.statusPanel(tickets, page, card?.name ?? null)],
    files: card ? [new AttachmentBuilder(card.buffer, { name: card.name })] : [],
  };
}

// Durum kanalındaki panel mesajını açık taleplere göre günceller; mesaj silinmişse yeniden gönderilir
async function refreshStatusPanel(client, gid) {
  if (!config.channels.statusPanel) return;
  const guild = client.guilds.cache.get(gid);
  const channel = guild && (await fetchTextChannel(guild, config.channels.statusPanel));
  if (!channel) return;
  const view = await statusPanelView(client, gid);
  const messageId = store.statusPanelMessageId(gid);
  let missing = !messageId;
  if (messageId) {
    const edited = await channel.messages
      .edit(messageId, { components: view.components, files: view.files, attachments: [], allowedMentions: { parse: [] } })
      .catch((err) => {
        if (err.code === UNKNOWN_MESSAGE) missing = true;
        else console.error('[destek] Durum paneli düzenlenemedi:', err.message);
        return null;
      });
    if (edited) return;
  }
  if (!missing) return;
  const message = await channel
    .send({ components: view.components, files: view.files, flags: core.CV2, allowedMentions: { parse: [] } })
    .catch((err) => console.error('[destek] Durum paneli gönderilemedi:', err.message));
  if (message) store.setStatusPanelMessageId(gid, message.id);
}

// ── Komutlar ─────────────────────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('destek')
    .setDescription('Destek talebindeki üyeleri yönetir.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName('ekle')
        .setDescription('Bulunduğun destek talebine bir kullanıcı ekler.')
        .addUserOption((o) => o.setName('kullanici').setDescription('Talebe eklenecek üyeyi seç.').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('cikar')
        .setDescription('Bulunduğun destek talebinden bir kullanıcıyı çıkarır.')
        .addUserOption((o) => o.setName('kullanici').setDescription('Talepten çıkarılacak üyeyi seç.').setRequired(true)),
    ),
];

// ── Yardımcılar ──────────────────────────────────────────────────────────────

const slug = (value) =>
  value
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

// Alt başlık adı: konu-kullaniciadi-0008 (Discord'un 100 karakter sınırı için konu kelime sınırından kısaltılır)
function threadName(user, number, reason) {
  const tail = `${slug(user.username) || user.id}-${core.pad(number)}`;
  let topic = slug(reason);
  if (topic.length > 40) {
    const cut = topic.lastIndexOf('-', 40);
    topic = topic.slice(0, cut > 0 ? cut : 40);
  }
  return topic ? `${topic}-${tail}` : tail;
}

// Kullanıcının açık talebi varsa ID'sini döner, silinmiş talepleri kayıttan temizler
async function findOpenTicket(guild, userId) {
  for (const threadId of store.openTicketsOf(guild.id, userId)) {
    const channel = await guild.channels.fetch(threadId).catch((err) => (err.code === 10003 ? null : undefined));
    if (channel !== null) return threadId;
    store.deleteTicket(threadId);
  }
  return null;
}

// Alt başlık açılınca panel kanalına düşen "alt başlık başlattı" sistem mesajını siler
async function removeThreadNotice(parent, threadId) {
  const recent = await parent.messages.fetch({ limit: 10 }).catch(() => null);
  const notice = recent?.find((m) => m.type === MessageType.ThreadCreated && m.reference?.channelId === threadId);
  await notice?.delete().catch(() => {});
}

// Talep kanalındaki üstlenme mesajını talebin son durumuna göre günceller (hatırlatmalar sabit kalır)
async function refreshClaimMessage(guild, ticket, skipMessageId) {
  const messageId = ticket.claimMessages?.main;
  if (!messageId || messageId === skipMessageId) return;
  const channel = await fetchTextChannel(guild, ticket.claimChannelId);
  await channel?.messages
    .edit(messageId, { components: [ui.claimRequest(ticket)], allowedMentions: { parse: [] } })
    .catch(() => {});
}

// Alt başlıktaki üye mesajını talebin son durumuna göre günceller
async function refreshTicketPanel(thread, ticket) {
  if (!ticket.panelMessageId) return;
  await thread.messages
    .edit(ticket.panelMessageId, { components: [ui.ticketPanel(ticket)], allowedMentions: { parse: [] } })
    .catch(() => {});
}

// Alt başlıkları yönetme yetkisi olmayan herkesi (talep sahibi, yetkili, eklenen üyeler) alt başlıktan çıkarır.
// Üye listesi Discord'da "Server Members Intent" ister; kapalıysa botun kendi eklediği kişiler kullanılır.
async function removeRegularMembers(thread, ticket) {
  const listed = await thread.members.fetch().catch(() => null);
  const ids = new Set(listed ? listed.keys() : [ticket.ownerId, ticket.claimedBy, ...(ticket.addedIds ?? [])]);
  ids.delete(thread.client.user.id);

  for (const id of ids) {
    if (!id) continue;
    const member = await thread.guild.members.fetch(id).catch(() => null);
    if (member && thread.permissionsFor(member).has(PermissionFlagsBits.ManageThreads)) continue;
    await thread.members.remove(id).catch(() => {});
  }
}

// ── Panel ────────────────────────────────────────────────────────────────────

// Bot açılınca paneli destek kanalına gönderir (değişmediyse dokunmaz)
function sendPanel(client) {
  const { guildId } = require('../../core/config');
  refreshStatusPanel(client, guildId).catch((err) => console.error('[destek] Durum paneli güncellenemedi:', err.message));
  return syncPanel(client, {
    key: 'destek',
    label: 'Destek',
    channelId: config.channels.panel,
    buttonId: ui.IDS.create,
    build: ui.panel,
    image: '',
  });
}

// ── Talep açma ───────────────────────────────────────────────────────────────

// "Talep Oluştur" butonu. Form 3 saniye içinde açılmak zorunda olduğu için burada Discord'a istek atılmaz,
// sadece önbellekteki açık talepler kontrol edilir; kesin kontrol form gönderilince yapılır.
async function handleCreateButton(interaction) {
  const existing = store
    .openTicketsOf(interaction.guildId, interaction.user.id)
    .find((threadId) => interaction.guild.channels.cache.has(threadId));
  if (existing) return replyError(interaction, `Zaten açık bir destek talebin var: <#${existing}>`);

  return interaction.showModal(ui.ticketModal());
}

// Talep açar: destek kanalının altında sadece üyenin göreceği özel alt başlık. Hem kendi formundan (handleModalSubmit)
// hem başka sistemlerden (ör. cezalarım paneli itiraz akışı) doğrudan bir sebep metniyle çağrılabilir.
// afterCreate(thread, ticket): alt başlık açılıp panel mesajı gönderildikten sonra çalışır, çağıran sistem
// kendine özel ek bir mesaj (ör. ceza itirazında ceza bilgisi ve onay/red butonları) gönderebilir.
async function createTicket(interaction, reason, afterCreate) {
  const { guild, user } = interaction;

  const lockKey = `${guild.id}:${user.id}`;
  if (creating.has(lockKey)) return replyError(interaction, 'Talebin şu an oluşturuluyor.', 'Birkaç saniye bekle.');

  creating.add(lockKey);
  try {
    await interaction.deferReply({ flags: core.CV2 });

    const existing = await findOpenTicket(guild, user.id);
    if (existing) return replyError(interaction, `Zaten açık bir destek talebin var: <#${existing}>`);

    const parent = await fetchTextChannel(guild, config.channels.panel);
    const claimChannel = await fetchTextChannel(guild, config.channels.claim);
    if (parent?.type !== ChannelType.GuildText || !claimChannel) {
      return replyError(interaction, 'Destek kanalları bulunamadı.', 'Lütfen sunucu yöneticilerine bildir.');
    }

    const number = store.nextTicketNumber(guild.id);

    const thread = await parent.threads.create({
      name: threadName(user, number, reason),
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Destek talebi #${core.pad(number)} - ${user.username}`,
    });
    let ticket;
    try {
      await thread.members.add(user.id);
      await removeThreadNotice(parent, thread.id);

      ticket = store.setTicket(thread.id, {
        guildId: guild.id,
        threadId: thread.id,
        ownerId: user.id,
        staffRoleId: config.roles.staff,
        claimChannelId: claimChannel.id,
        number,
        reason,
        createdAt: Date.now(),
        notified: false,
        greeted: false,
        claimedBy: null,
        closedBy: null,
        panelMessageId: null,
        claimMessages: { main: null, reminder: null },
      });

      const panelMessage = await thread.send({
        components: [ui.ticketPanel(ticket)],
        flags: core.CV2,
        allowedMentions: { parse: [] },
      });
      const claimMessage = await claimChannel.send({
        components: [ui.claimRequest(ticket)],
        flags: core.CV2,
        allowedMentions: { roles: [config.roles.staff] },
      });
      store.updateTicket(thread.id, {
        panelMessageId: panelMessage.id,
        claimMessages: { main: claimMessage.id, reminder: null },
      });

      if (afterCreate) await afterCreate(thread, store.getTicket(thread.id));
      refreshStatusPanel(interaction.client, guild.id).catch(() => {});
    } catch (err) {
      // Yarım kalan talep ortada kalmasın: alt başlık ve kayıt temizlenir, üye yeniden deneyebilir
      console.error('[destek] Talep oluşturulurken hata, talep geri alındı:', err);
      store.deleteTicket(thread.id);
      await thread.delete('Talep oluşturulamadı').catch(() => {});
      return replyError(interaction, 'Talebin oluşturulamadı.', 'Birkaç dakika sonra yeniden dene.');
    }

    await respond(interaction, ui.ticketCreated(thread));

    const logChannel = await fetchTextChannel(guild, config.channels.log);
    await logChannel
      ?.send({ components: [ui.openLog(ticket, thread, user)], flags: core.CV2, allowedMentions: { parse: [] } })
      .catch((err) => console.error('[destek] Açılış logu gönderilemedi:', err.message));
  } finally {
    creating.delete(lockKey);
  }
}

// Form gönderildiğinde destek kanalının altında sadece üyenin göreceği özel alt başlık açar
function handleModalSubmit(interaction) {
  return createTicket(interaction, interaction.fields.getTextInputValue(ui.IDS.reason).trim());
}

// ── Talep içi butonlar ───────────────────────────────────────────────────────

// Talep kanalındaki "Talebi Üstlen" butonu: ilk basan yetkili talebi alır
async function handleClaim(interaction) {
  const threadId = interaction.customId.slice(ui.IDS.claim.length + 1);
  const ticket = store.getTicket(threadId);
  if (!ticket) return replyError(interaction, 'Bu talep artık mevcut değil.');
  if (!isStaff(interaction, ticket.staffRoleId)) {
    return replyError(interaction, 'Talepleri sadece destek ekibi üstlenebilir.');
  }
  if (interaction.user.id === ticket.ownerId) {
    return replyError(interaction, 'Kendi açtığın talebi üstlenemezsin.', 'Talebini başka bir yetkilinin üstlenmesi gerekiyor.');
  }
  if (ticket.claimedBy) {
    return replyError(interaction, `Bu talep zaten <@${ticket.claimedBy}> tarafından üstlenildi.`);
  }

  // Kayıt await'ten önce yapılır, aynı anda basan diğer yetkililer yukarıdaki kontrole takılır
  store.updateTicket(threadId, { claimedBy: interaction.user.id });
  await interaction.deferUpdate();

  const thread = await interaction.guild.channels.fetch(threadId).catch(() => null);
  if (!thread) {
    store.deleteTicket(threadId);
    return replyError(interaction, 'Bu talep silinmiş.');
  }
  try {
    if (thread.archived) await thread.setArchived(false);
    await thread.members.add(interaction.user.id);
  } catch (err) {
    store.updateTicket(threadId, { claimedBy: null });
    console.error('[destek] Yetkili alt başlığa eklenemedi:', err.message);
    return replyError(interaction, 'Talebe eklenemedin.', 'Destek kanalını görebildiğinden emin ol.');
  }

  await interaction.editReply({ components: [ui.claimRequest(ticket)], allowedMentions: { parse: [] } });
  await refreshClaimMessage(interaction.guild, ticket, interaction.message.id);
  await refreshTicketPanel(thread, ticket);
  refreshStatusPanel(interaction.client, interaction.guildId).catch(() => {});

  await thread.send({
    components: [ui.claimedNotice(ticket)],
    flags: core.CV2,
    allowedMentions: { users: [ticket.ownerId] },
  });
}

// "Selam Ver" butonu: üye talebi üstlenen yetkiliyi bir kez selamlayabilir
async function handleGreet(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) return replyError(interaction, 'Burası açık bir destek talebi değil.');
  if (interaction.user.id !== ticket.ownerId) {
    return replyError(interaction, 'Bu butonu sadece talep sahibi kullanabilir.');
  }
  if (!ticket.claimedBy) return replyError(interaction, 'Talebin henüz bir yetkili tarafından üstlenilmedi.');
  if (ticket.greeted) return replyError(interaction, 'Yetkiliye zaten selam verdin.');

  store.updateTicket(interaction.channelId, { greeted: true });
  await interaction.update({ components: [ui.claimedNotice(ticket)], allowedMentions: { parse: [] } });

  // Selam mesajı bilerek CV2 değil, düz mesaj olarak gönderilir
  await interaction.channel.send({
    content: `**<@${ticket.claimedBy}>, <@${ticket.ownerId}> sana selam gönderdi!**`,
    allowedMentions: { users: [ticket.claimedBy] },
  });
}

// Alt başlıktaki "Hatırlat" butonu: talep kanalına bir kez hatırlatma gönderir
async function handleNotify(interaction) {
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) return replyError(interaction, 'Burası açık bir destek talebi değil.');
  if (interaction.user.id !== ticket.ownerId) {
    return replyError(interaction, 'Bu butonu sadece talep sahibi kullanabilir.');
  }
  if (ticket.claimedBy) return replyError(interaction, 'Talebin zaten bir yetkili tarafından üstlenildi.');
  if (ticket.notified) {
    return replyError(interaction, 'Ekibe zaten bir kez hatırlatma gönderdin.', 'Bir yetkili kısa süre içinde seninle ilgilenecek.');
  }

  store.updateTicket(interaction.channelId, { notified: true });
  await interaction.deferUpdate();

  const claimChannel = await fetchTextChannel(interaction.guild, ticket.claimChannelId);
  if (!claimChannel) {
    store.updateTicket(interaction.channelId, { notified: false });
    return replyError(interaction, 'Talep kanalı bulunamadı.', 'Lütfen sunucu yöneticilerine bildir.');
  }

  let reminder;
  try {
    reminder = await claimChannel.send({
      components: [ui.claimReminder(ticket)],
      flags: core.CV2,
      reply: { messageReference: ticket.claimMessages.main, failIfNotExists: false },
      allowedMentions: { roles: [ticket.staffRoleId], repliedUser: false },
    });
  } catch (err) {
    console.error('[destek] Hatırlatma gönderilemedi:', err.message);
    store.updateTicket(interaction.channelId, { notified: false });
    return replyError(interaction, 'Hatırlatma gönderilemedi.', 'Birkaç saniye sonra yeniden dene.');
  }
  store.updateTicket(interaction.channelId, { claimMessages: { ...ticket.claimMessages, reminder: reminder.id } });

  await interaction.editReply({ components: [ui.ticketPanel(ticket)], allowedMentions: { parse: [] } });
  await respond(
    interaction,
    core.alert('Ekibe hatırlatma gönderildi.', 'Bir yetkili kısa süre içinde talebini üstlenecek.', 'success'),
  );
}

// ── Talep kapatma ────────────────────────────────────────────────────────────

// Kapatma yetkisi ve durum kontrolü; sorun yoksa null, varsa hata mesajı döner
function closeError(interaction, ticket) {
  if (!ticket) return 'Burası açık bir destek talebi değil.';
  if (interaction.user.id !== ticket.ownerId && !isStaff(interaction, ticket.staffRoleId)) {
    return 'Bu talebi sadece talep sahibi veya yetkililer kapatabilir.';
  }
  if (closing.has(interaction.channelId)) return 'Bu talep zaten kapatılıyor.';
  return null;
}

// "Talebi Kapat" butonu: kapatma sebebini soran formu açar
async function handleCloseRequest(interaction) {
  const error = closeError(interaction, store.getTicket(interaction.channelId));
  if (error) return replyError(interaction, error);

  return interaction.showModal(ui.closeModal());
}

// Kapatma formu gönderilince talebi seçilen sebeple kapatır
async function handleCloseSubmit(interaction) {
  const error = closeError(interaction, store.getTicket(interaction.channelId));
  if (error) return replyError(interaction, error);

  const [value] = interaction.fields.getStringSelectValues(ui.IDS.closeReason);
  const closeReason = {
    label: config.closeReasons.find((reason) => reason.value === value)?.label ?? 'Belirtilmedi',
    note: interaction.fields.getTextInputValue(ui.IDS.closeNote).trim(),
  };

  // closeTicket kilidini (closing) ilk await'ten önce eşzamanlı alır; aynı anda gelen ikinci form kapatmayı tekrarlamaz
  const closed = closeTicket(interaction.channel, interaction.user, closeReason);
  await interaction.deferReply({ flags: core.CV2 });
  await closed;
  await interaction.editReply({
    components: [core.alert('Talep kapatıldı.', 'Alt başlık kilitlendi ve arşivlendi.', 'success')],
    flags: core.CV2,
    allowedMentions: { parse: [] },
  });
}

// Talep silinmez: kayıt alınır, yönetici olmayan herkes çıkarılır, alt başlık kilitlenip arşivlenir.
// Böylece kenar çubuğundan kalkar, sadece "Alt Başlıkları Yönet" yetkisi olanlar alt başlıklar listesinden görebilir.
async function closeTicket(channel, closedBy, closeReason) {
  const ticket = store.getTicket(channel.id);
  if (!ticket || closing.has(channel.id)) return;
  closing.add(channel.id);

  // Her adım kendi hatasını yakalar: biri (ör. konuşma kaydı ya da DM) başarısız olsa da talep kilitlenip arşivlenir
  const step = async (name, run) => {
    try {
      return await run();
    } catch (err) {
      console.error(`[destek] Talep #${core.pad(ticket.number)} kapanışında "${name}" adımı başarısız:`, err.message);
      return null;
    }
  };

  try {
    store.updateTicket(channel.id, { closedBy: closedBy.id, closeReason });
    await step('talep mesajları', async () => {
      await refreshClaimMessage(channel.guild, ticket);
      await refreshTicketPanel(channel, ticket);
    });
    await step('kapanış mesajı', () =>
      channel.send({ components: [ui.ticketClosed(ticket)], flags: core.CV2, allowedMentions: { parse: [] } }),
    );

    const owner = await step('talep sahibi', () => channel.client.users.fetch(ticket.ownerId));

    // Log kanalı ayarlıysa kapanış logu ve konuşma kaydı oraya gider
    const logChannel = await fetchTextChannel(channel.guild, config.channels.log);
    if (logChannel) {
      await step('kapanış logu', async () => {
        const transcript = await buildTranscript(channel, ticket, owner);
        const fileName = `destek-${core.pad(ticket.number)}.txt`;
        await logChannel.send({
          components: [ui.closeLog(ticket, closedBy, fileName, owner)],
          files: [new AttachmentBuilder(transcript, { name: fileName })],
          flags: core.CV2,
          allowedMentions: { parse: [] },
        });
      });
    }

    // Talep sahibine kısa bilgi ve yetkiliyi değerlendirme isteği gider (DM'si kapalıysa kayda geçip devam edilir)
    const rating = await step('değerlendirme', () => ratings.createPending(channel.client, ticket));
    await owner
      ?.send({ components: [ui.closeDm(ticket.number, channel.guild.name, rating)], flags: core.CV2 })
      .catch((err) =>
        console.error(`[destek] Talep #${core.pad(ticket.number)} sahibine DM gönderilemedi (DM kapalı olabilir):`, err.message),
      );

    await step('üyeleri çıkarma', () => removeRegularMembers(channel, ticket));
    await step('kilitleme', () =>
      channel.edit({ locked: true, archived: true, reason: `Destek talebi kapatıldı (${closedBy.username})` }),
    );
  } finally {
    // Kapanan talep silinmez, sicilde görünmesi için geçmişe taşınır
    store.archiveTicket(channel.id);
    closing.delete(channel.id);
    const { guildId } = require('../../core/config');
    refreshStatusPanel(channel.client, guildId).catch(() => {});
  }
}

// Kapanmış talebe (botun açtığı, kilitli ve artık açık olmayan alt başlık) yazılan mesajı siler, alt başlığı tekrar arşivler.
// Discord, "Alt Başlıkları Yönet" yetkisi olanların kilitli alt başlığa yazmasını engellemediği için kontrol bot tarafında yapılır.
async function guardClosedTicket(message) {
  const { channel, client } = message;
  if (!channel.isThread() || message.author.id === client.user.id) return;
  if (channel.ownerId !== client.user.id || !channel.locked || store.getTicket(channel.id)) return;

  await message.delete().catch(() => {});
  if (!channel.archived) await channel.setArchived(true).catch(() => {});
}

// ── /destek ekle | cikar ─────────────────────────────────────────────────────

async function handleMemberCommand(interaction) {
  const action = interaction.options.getSubcommand();
  const ticket = store.getTicket(interaction.channelId);
  if (!ticket) return replyError(interaction, 'Bu komutu sadece açık bir destek talebinin içinde kullanabilirsin.');
  if (!isStaff(interaction, ticket.staffRoleId)) return replyError(interaction, 'Bu komutu sadece yetkililer kullanabilir.');

  const { channel } = interaction;
  const target = interaction.options.getUser('kullanici', true);
  if (target.bot) return replyError(interaction, 'Botlar talebe eklenemez veya çıkarılamaz.');

  const addedIds = new Set(ticket.addedIds ?? []);
  if (action === 'ekle') {
    try {
      await channel.members.add(target.id);
    } catch (err) {
      console.error('[destek] Üye talebe eklenemedi:', err.message);
      return replyError(interaction, 'Üye talebe eklenemedi.', 'Üyenin sunucuda olduğundan emin ol.');
    }
    store.updateTicket(channel.id, { addedIds: [...addedIds.add(target.id)] });
    return respond(interaction, core.alert(`<@${target.id}> bu destek talebine eklendi.`, null, 'success'), {
      allowedMentions: { users: [target.id] },
    });
  }

  if (target.id === ticket.ownerId) return replyError(interaction, 'Talep sahibi talepten çıkarılamaz.');
  try {
    await channel.members.remove(target.id);
  } catch (err) {
    console.error('[destek] Üye talepten çıkarılamadı:', err.message);
    return replyError(interaction, 'Üye talepten çıkarılamadı.', 'Üyenin bu talepte olduğundan emin ol.');
  }
  addedIds.delete(target.id);
  store.updateTicket(channel.id, { addedIds: [...addedIds] });
  return respond(interaction, core.alert(`<@${target.id}> bu destek talebinden çıkarıldı.`, null, 'danger'), {
  });
}

async function handleStatusDetail(interaction) {
  const threadId = interaction.customId.slice(ui.IDS.statusDetail.length + 1);
  const ticket = store.getTicket(threadId);
  if (!ticket) return replyError(interaction, 'Bu talep artık mevcut değil.');
  await interaction.deferReply({ flags: core.CV2 });
  await interaction.editReply({ components: [ui.claimRequest(ticket)], flags: core.CV2, allowedMentions: { parse: [] } });
}

// Durum panelindeki sayfa butonları: aynı mesaj yeni sayfanın kartıyla yeniden çizilir
async function handleStatusPage(interaction) {
  const page = Number(interaction.customId.split(':')[1]) || 0;
  const view = await statusPanelView(interaction.client, interaction.guildId, page);
  return interaction.update({ components: view.components, files: view.files, attachments: [], allowedMentions: { parse: [] } });
}

module.exports = {
  name: 'destek',
  createTicket,
  commands,
  help: {
    category: ['destek', 'Destek Talepleri'],
    access: { 'destek ekle': `<@&${config.roles.staff}> rolü`, 'destek cikar': `<@&${config.roles.staff}> rolü` },
    need: { 'destek ekle': `<@&${config.roles.staff}> rolü`, 'destek cikar': `<@&${config.roles.staff}> rolü` },
  },
  slash: { destek: handleMemberCommand },
  buttons: {
    [ui.IDS.create]: handleCreateButton,
    [ui.IDS.notify]: handleNotify,
    [ui.IDS.greet]: handleGreet,
    [ui.IDS.close]: handleCloseRequest,
  },
  modals: { [ui.IDS.modal]: handleModalSubmit, [ui.IDS.closeModal]: handleCloseSubmit },
  prefixed: [[ui.IDS.claim, handleClaim], [ui.IDS.statusDetail, handleStatusDetail], [ui.IDS.statusPage, handleStatusPage]],
  events: {
    [Events.ClientReady]: sendPanel,
    // Kapanmış taleplere yazılmasını engelle
    [Events.MessageCreate]: guardClosedTicket,
    // Talep elle silinirse kayıttan da temizle
    [Events.ThreadDelete]: (thread) => store.deleteTicket(thread.id),
  },
};
