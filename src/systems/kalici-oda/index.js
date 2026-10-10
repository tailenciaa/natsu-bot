// Kalıcı oda sistemi: üye başvuru panelinden form doldurur, yetkililer karar verir. Onaylanan başvuruda odanın
// kategorisi, ses ve yazı kanalları açılır; erişim yalnızca odayı kullanacak kişilere verilir, @everyone kanalı göremez.
// Oda sahibine teslim kartı DM olarak gider, odanın kendi yazı kanalına sadece sahibinin kullanabildiği kontrol paneli
// düşer (isim, kişi limiti, üye ekle/çıkar, sahiplik devri). Odalar kalıcıdır: içinde kimse olmasa bile kapanmaz,
// yalnızca yetkililer /kalici-oda kapat ile kapatır. Kanallar elle silinirse oda kaydı kendiliğinden temizlenir.
const { ChannelType, Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const siralama = require('../siralama/store');
const logSystem = require('../log');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const DAY = 24 * 60 * 60 * 1000;
const submitting = new Set();

// Panel işlemlerine art arda basıp oda yönetimini kilitlemeyi engelleyen kısa beklemeler
const COOLDOWN_MS = {
  [ui.IDS.rename]: 15000,
  [ui.IDS.limit]: 15000,
  [ui.IDS.add]: 5000,
  [ui.IDS.remove]: 5000,
  [ui.IDS.transfer]: 5000,
};
const cooldowns = new Map(); // `${oda}:${işlem}` -> bir sonraki kullanılabileceği zaman

function takeCooldown(roomId, action) {
  const key = `${roomId}:${action}`;
  const until = cooldowns.get(key) ?? 0;
  if (Date.now() < until) return Math.ceil((until - Date.now()) / 1000);
  cooldowns.set(key, Date.now() + (COOLDOWN_MS[action] ?? 3000));
  return null;
}

function clearCooldowns(roomId) {
  for (const key of cooldowns.keys()) if (key.startsWith(`${roomId}:`)) cooldowns.delete(key);
}

const slowDown = (interaction, wait) => replyError(interaction, 'Biraz yavaş ol.', `${wait} saniye sonra tekrar deneyebilirsin.`);

// İzin ve kanal işlemlerinin hatası kayda geçer, akışı kesmez
const hata = (what) => (err) => {
  console.error(`[kalıcı-oda] ${what}:`, err.message);
  return null;
};

const commands = [
  new SlashCommandBuilder()
    .setName('kalici-oda')
    .setDescription('Kalıcı odaları ve başvurularını yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('liste').setDescription('Sunucudaki tüm kalıcı odaları ve bekleyen başvuruları listeler.'))
    .addSubcommand((s) =>
      s
        .setName('kapat')
        .setDescription('Bir kalıcı odayı kapatır ve kanallarını siler.')
        .addIntegerOption((o) => o.setName('no').setDescription('Oda numarasını girer.').setMinValue(1).setRequired(true))
        .addStringOption((o) => o.setName('sebep').setDescription('Oda sahibine yazılacak kapatma sebebini girer.').setMaxLength(300)),
    )
    .addSubcommand((s) =>
      s
        .setName('devret')
        .setDescription('Sahibi sunucudan ayrılmış bir odanın sahipliğini başka bir üyeye verir.')
        .addIntegerOption((o) => o.setName('no').setDescription('Oda numarasını girer.').setMinValue(1).setRequired(true))
        .addUserOption((o) => o.setName('kullanici').setDescription('Odanın yeni sahibini seçer.').setRequired(true)),
    ),
];

// ── Başvuru ───────────────────────────────────────────────────────────────────

// Başvuru yapılamıyorsa [mesaj, açıklama] döner, yoksa null
function applyError(interaction) {
  if (!config.channels.applications) {
    return ['Kalıcı oda başvuruları şu an açık değil.', 'Yetkililer başvuru kanalını ayarladığında tekrar deneyebilirsin.'];
  }
  if (store.roomsOwned(interaction.guildId, interaction.user.id).length >= config.maxRoomsPerOwner) {
    return ['Zaten bir kalıcı odan var.', 'Yeni bir oda için mevcut odanı devret ya da bir yetkiliden kapatmasını iste.'];
  }
  if (store.pendingApplications(interaction.guildId).some((a) => a.userId === interaction.user.id)) {
    return ['Bekleyen bir başvurun zaten var.', 'İnceleme bitince sonucu sana DM üzerinden iletilecek.'];
  }
  const since = store.daysSinceRejection(interaction.guildId, interaction.user.id);
  if (config.reapplyCooldownDays && since !== null && since < config.reapplyCooldownDays) {
    const at = Date.now() + (config.reapplyCooldownDays - since) * DAY;
    return ['Son başvurun reddedildiği için şu an tekrar başvuramazsın.', `<t:${core.unix(at)}:D> tarihinden sonra tekrar başvurabilirsin.`];
  }
  return null;
}

// Form cevabındaki üyeler: <@id> / <@!id> etiketleri ya da çıplak üye ID'leri; başvuranın kendisi sayılmaz
function parseMembers(raw, ownerId) {
  const ids = new Set();
  for (const match of raw.matchAll(/<@!?(\d+)>|\b(\d{17,20})\b/g)) if (match[1] ?? match[2]) ids.add(match[1] ?? match[2]);
  ids.delete(ownerId);
  return [...ids];
}

// Odayı kullanacakların son 7 gündeki toplam sesi (saniye); sıralama sisteminin ses istatistiklerinden okunur
function weeklyVoiceSeconds(ids) {
  const totals = siralama.totals('voice', 7);
  return ids.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0);
}

// Paneldeki "Başvuru Yap": form açılır, öncesinde yavaş iş yapılmaz
async function handleApplyButton(interaction) {
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);
  return interaction.showModal(ui.applicationModal());
}

async function handleApplySubmit(interaction) {
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);

  const answer = (id) => interaction.fields.getTextInputValue(`${ui.IDS.question}:${id}`).trim();
  const roomName = answer('ad').replace(/\s+/g, ' ').slice(0, 30);
  if (roomName.length < 2) return replyError(interaction, 'Oda adı çok kısa.', 'En az iki karakterlik bir ad yaz.');

  const members = parseMembers(answer('kisiler'), interaction.user.id);
  if (members.length + 1 < config.minMembers) {
    return replyError(
      interaction,
      `Odayı en az ${config.minMembers} kişinin kullanması gerekiyor.`,
      'Üyeleri **Odada kimler olacak** alanına etiketleyerek yaz.',
    );
  }
  if (members.length > config.maxExtraMembers) {
    return replyError(interaction, `En fazla ${config.maxExtraMembers} üye yazabilirsin.`, 'Fazla etiketleri silip tekrar gönder.');
  }
  const purpose = answer('amac');
  if (purpose.length < 15) return replyError(interaction, 'Amaç alanı çok kısa.', 'Odanın ne için kullanılacağını bir cümleyle yaz.');

  const lockKey = `${interaction.guildId}:${interaction.user.id}`;
  if (submitting.has(lockKey)) return replyError(interaction, 'Başvurun zaten gönderiliyor.', 'Lütfen bekle.');
  submitting.add(lockKey);

  try {
    await interaction.deferReply({ flags: core.EPHEMERAL });
    const channel = await fetchTextChannel(interaction.guild, config.channels.applications);
    if (!channel) return replyError(interaction, 'Başvurular kanalı bulunamadı.', 'Lütfen sunucu yöneticilerine bildir.');

    const number = store.nextApplicationNumber(interaction.guildId);
    const id = `${interaction.guildId}-${number}`;
    const voiceSeconds = weeklyVoiceSeconds([interaction.user.id, ...members]);
    const app = store.setApplication(id, {
      id,
      guildId: interaction.guildId,
      number,
      userId: interaction.user.id,
      username: interaction.user.username,
      roomName,
      purpose,
      members,
      voiceSeconds,
      voiceOk: voiceSeconds >= config.minWeeklyVoiceHours * 3600,
      status: 'pending',
      createdAt: Date.now(),
      channelId: channel.id,
      messageId: null,
      reviewedBy: null,
      reviewedAt: null,
      note: null,
      roomId: null,
    });

    // İnceleyen rol etiketlenir, başvuran kendisi zaten kartta görünüyor diye etiketlenmez
    const message = await channel
      .send({
        components: [ui.applicationCard(app)],
        flags: core.CV2,
        allowedMentions: { parse: ['roles'], roles: config.roles.reviewer ? [config.roles.reviewer] : [] },
      })
      .catch(hata('Başvuru kanala gönderilemedi'));
    if (!message) {
      store.removeApplication(id);
      return replyError(interaction, 'Başvurun gönderilemedi.', 'Birkaç dakika sonra yeniden dene; sorun sürerse bir yetkiliye haber ver.');
    }
    store.updateApplication(id, { messageId: message.id });

    return respond(interaction, ui.submitted({ user: interaction.user, app, memberCount: members.length + 1 }));
  } finally {
    submitting.delete(lockKey);
  }
}

// ── Karar ─────────────────────────────────────────────────────────────────────

// Onaylama / retme butonlarını ve formunu kullanma kontrolü; sorun yoksa null
function reviewError(interaction, app) {
  if (!app) return 'Bu başvuru bulunamadı.';
  if (!isStaff(interaction, config.roles.reviewer)) {
    return config.roles.reviewer
      ? `Başvuruları sadece <@&${config.roles.reviewer}> rolündekiler ve yöneticiler inceleyebilir.`
      : 'Başvuruları sadece yöneticiler inceleyebilir.';
  }
  if (app.status !== 'pending') return 'Bu başvuru zaten sonuçlandırıldı.';
  return null;
}

// Başvuru kartını kanaldaki güncel haliyle yeniden çizer
async function refreshCard(guild, app, room) {
  if (!app.messageId) return;
  const channel = await fetchTextChannel(guild, app.channelId);
  await channel?.messages
    .edit(app.messageId, { components: [ui.applicationCard(app, room)], allowedMentions: { parse: [] } })
    .catch(hata('Başvuru kartı güncellenemedi'));
}

// Onaylanan başvuruda oda kanallarını açar, kaydı yazar ve paneli odanın yazı kanalına düşürür
async function openRoom(guild, app) {
  const memberIds = [app.userId, ...app.members].slice(0, config.maxExtraMembers + 1);
  const overwrites = [
    { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
    { id: guild.members.me?.id ?? guild.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] },
    config.roles.team && { id: config.roles.team, allow: ['ViewChannel', 'Connect', 'SendMessages'] },
    ...memberIds.map((id) => ({ id, allow: ['ViewChannel', 'Connect', 'SendMessages'] })),
  ].filter(Boolean);
  const reason = `Kalıcı oda başvurusu #${core.pad(app.number)} onaylandı`;

  const category = await guild.channels
    .create({ name: app.roomName, type: ChannelType.GuildCategory, parent: config.categoryId || undefined, permissionOverwrites: overwrites, reason })
    .catch(hata('Oda kategorisi açılamadı'));
  if (!category) return null;

  const voice = await guild.channels
    .create({ name: app.roomName, type: ChannelType.GuildVoice, parent: category.id, userLimit: config.defaultUserLimit, permissionOverwrites: overwrites, reason })
    .catch(hata('Odanın ses kanalı açılamadı'));
  const text = await guild.channels
    .create({
      name: app.roomName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: overwrites,
      topic: `Kalıcı oda · Sahibi: ${app.username} · Başvuru #${core.pad(app.number)}`,
      reason,
    })
    .catch(hata('Odanın yazı kanalı açılamadı'));

  if (!voice || !text) {
    await category.delete().catch(() => {});
    return null;
  }

  const no = store.nextRoomNumber(guild.id);
  const room = store.setRoom(`${guild.id}-${no}`, {
    id: `${guild.id}-${no}`,
    no,
    guildId: guild.id,
    ownerId: app.userId,
    name: app.roomName,
    members: app.members.filter((id) => id !== app.userId).slice(0, config.maxExtraMembers),
    limit: config.defaultUserLimit,
    categoryId: category.id,
    voiceChannelId: voice.id,
    textChannelId: text.id,
    applicationId: app.id,
    approvedBy: null,
    panelMessageId: null,
    createdAt: Date.now(),
  });

  const panel = await text
    .send({ components: [ui.roomPanel(room)], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch(hata('Oda kontrol paneli gönderilemedi'));
  if (panel) store.updateRoom(room.id, { panelMessageId: panel.id });

  return room;
}

// Sahibine teslim kartını gönderir ve odayı loglar
async function deliver(guild, room) {
  const owner = await guild.client.users.fetch(room.ownerId).catch(() => null);
  await owner?.send({ components: [ui.readyCard(room)], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => {});
  return logSystem
    .write(guild.client, 'bot', {
      color: 'success',
      title: 'Kalıcı Oda Açıldı',
      lines: [
        `**Oda:** #${core.pad(room.no)} ${room.name}`,
        `**Sahip:** <@${room.ownerId}>`,
        `**Kanallar:** <#${room.voiceChannelId}> · <#${room.textChannelId}>`,
        `**Üye sayısı:** ${room.members.length + 1}`,
      ],
    })
    .catch(() => {});
}

// Onayla: oda açılır, kart "Onaylandı"ya döner, sahibine teslim kartı gider
async function handleApprove(interaction, app) {
  await interaction.deferUpdate();
  const room = await openRoom(interaction.guild, app);
  if (!room) {
    return respond(
      interaction,
      core.alert('Oda açılamadı.', 'Botun kanal yönetme izni olmayabilir ya da kategori/kanal sınırı dolmuş olabilir; bir sunucu yöneticisine bildir.', 'danger'),
      { followUp: true, ephemeral: true },
    );
  }
  const updated = store.updateApplication(app.id, { status: 'approved', reviewedBy: interaction.user.id, reviewedAt: Date.now(), roomId: room.id });
  store.updateRoom(room.id, { approvedBy: interaction.user.id });
  await interaction.editReply({ components: [ui.applicationCard(updated, room)], allowedMentions: { parse: [] } });
  await deliver(interaction.guild, room);
  return null;
}

// Reddet formu: sebep kartı ve başvurana DM olarak gider
async function handleRejectSubmit(interaction) {
  const [, id] = interaction.customId.split(':');
  const app = store.getApplication(id);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);

  const updated = store.updateApplication(id, {
    status: 'rejected',
    reviewedBy: interaction.user.id,
    reviewedAt: Date.now(),
    note: interaction.fields.getTextInputValue(ui.IDS.rejectInput).trim() || 'Ek bir gerekçe yazılmadı.',
  });

  await interaction.deferUpdate();
  await refreshCard(interaction.guild, updated);
  const applicant = await interaction.client.users.fetch(app.userId).catch(() => null);
  await applicant?.send({ components: [ui.rejectedCard(updated)], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => {});
  return null;
}

// Onayla / Reddet butonları; ret formu burada açılır
async function handleDecision(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const app = store.getApplication(id);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);
  if (action === 'ret') return interaction.showModal(ui.rejectModal(app));
  if (action !== 'onayla') return replyError(interaction, 'Bu buton artık kullanılmıyor.', 'Bekleyen başvuruda **Onayla** ve **Reddet** butonlarını kullan.');
  return handleApprove(interaction, app);
}

// ── Oda kontrol paneli ─────────────────────────────────────────────────────────

// Hata varsa mesajı, yoksa null döner
function ownerError(interaction, room) {
  if (!room) return 'Burası bir kalıcı oda değil.';
  if (interaction.user.id !== room.ownerId) return 'Bu paneli sadece oda sahibi kullanabilir.';
  return null;
}

const roomOf = (interaction) => store.roomOfChannel(interaction.channelId);
const redraw = (interaction, room) =>
  interaction.editReply({ components: [ui.roomPanel(room)], allowedMentions: { parse: [] } }).catch(hata('Oda paneli güncellenemedi'));

// Odanın üç kanalında da erişimi açar ya da kapatır (kategori görünürlüğü, kanallar erişimi taşır)
async function setAccess(guild, room, targetId, allow) {
  for (const key of ['categoryId', 'voiceChannelId', 'textChannelId']) {
    const channel = await guild.channels.fetch(room[key]).catch(() => null);
    if (!channel) continue;
    if (allow) {
      const perms = key === 'categoryId' ? { ViewChannel: true } : { ViewChannel: true, Connect: true, SendMessages: true };
      await channel.permissionOverwrites.edit(targetId, perms).catch(hata('Oda erişimi verilemedi'));
    } else {
      await channel.permissionOverwrites.delete(targetId).catch(hata('Oda erişimi kaldırılamadı'));
    }
  }
}

// Üye menülerinin ortak ön kontrolü: oda, sahip, hız sınırı. Hata varsa { error } ya da { wait }, değilse { room } döner
function memberAction(interaction, action, guard) {
  const room = roomOf(interaction);
  const error = ownerError(interaction, room);
  if (error) return { error };
  const blocked = guard(room);
  if (blocked) return { error: blocked };
  const wait = takeCooldown(room.id, action);
  if (wait) return { wait };
  return { room };
}

async function handleAddMember(interaction) {
  const targetId = interaction.values[0];
  const step = memberAction(
    interaction,
    ui.IDS.add,
    (room) =>
      targetId === room.ownerId
        ? 'Bu üye zaten odanın sahibi.'
        : room.members.includes(targetId)
          ? 'Bu üye zaten odada.'
          : room.members.length >= config.maxExtraMembers
            ? `Odaya en fazla ${config.maxExtraMembers} üye ekleyebilirsin.`
            : null,
  );
  if (step.error) return replyError(interaction, step.error, 'Üye listesini kontrol edip tekrar dene.');
  if (step.wait) return slowDown(interaction, step.wait);

  await interaction.deferUpdate();
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot) return replyError(interaction, 'Üye bulunamadı.', 'Sunucuda olan bir üye seç.');

  await setAccess(interaction.guild, step.room, targetId, true);
  const updated = store.updateRoom(step.room.id, { members: [...step.room.members, targetId] });
  return redraw(interaction, updated);
}

async function handleRemoveMember(interaction) {
  const targetId = interaction.values[0];
  const step = memberAction(
    interaction,
    ui.IDS.remove,
    (room) => (room.ownerId === targetId ? 'Sahipliği devretmeden kendin odadan çıkaramazsın.' : room.members.includes(targetId) ? null : 'Bu üye odanın üyelerinden değil.'),
  );
  if (step.error) return replyError(interaction, step.error, 'Üye listesini kontrol edip tekrar dene.');
  if (step.wait) return slowDown(interaction, step.wait);

  await interaction.deferUpdate();
  await setAccess(interaction.guild, step.room, targetId, false);
  const inRoom = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (inRoom?.voice.channelId === step.room.voiceChannelId) await inRoom.voice.disconnect().catch(hata('Üye odadan atılamadı'));
  const updated = store.updateRoom(step.room.id, { members: step.room.members.filter((id) => id !== targetId) });
  return redraw(interaction, updated);
}

async function handleTransfer(interaction) {
  const targetId = interaction.values[0];
  const step = memberAction(
    interaction,
    ui.IDS.transfer,
    (room) => (targetId === room.ownerId ? 'Oda zaten senin.' : room.members.includes(targetId) ? null : 'Sahipliği sadece odanda bulunan bir üyeye devredebilirsin.'),
  );
  if (step.error) return replyError(interaction, step.error, 'Önce üyeyi odaya ekle.');
  if (step.wait) return slowDown(interaction, step.wait);

  await interaction.deferUpdate();
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot) return replyError(interaction, 'Üye bulunamadı.', 'Sunucuda olan bir üye seç.');

  // Eski sahip sıradan üye olarak odada kalır, yeni sahibin erişimi ayrıcalıklı hale gelir
  await setAccess(interaction.guild, step.room, targetId, true);
  const updated = store.updateRoom(step.room.id, {
    ownerId: targetId,
    members: [...step.room.members.filter((id) => id !== targetId), step.room.ownerId],
  });
  return redraw(interaction, updated);
}

async function handleLimitButton(interaction) {
  const room = roomOf(interaction);
  const error = ownerError(interaction, room);
  if (error) return replyError(interaction, error);
  const channel = await interaction.guild.channels.fetch(room.voiceChannelId).catch(() => null);
  return interaction.showModal(ui.limitModal(channel?.userLimit ?? room.limit));
}

async function handleLimitSubmit(interaction) {
  const room = roomOf(interaction);
  const error = ownerError(interaction, room);
  if (error) return replyError(interaction, error);

  const raw = interaction.fields.getTextInputValue(ui.IDS.limitInput).trim();
  const limit = /^\d{1,2}$/.test(raw) ? Number(raw) : -1;
  if (limit < 0) return replyError(interaction, 'Geçerli bir sayı gir.', '0-99 arası olmalı, 0 sınırsız demektir.');
  const wait = takeCooldown(room.id, ui.IDS.limit);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const channel = await interaction.guild.channels.fetch(room.voiceChannelId).catch(() => null);
  if (!channel) return replyError(interaction, 'Odanın ses kanalı bulunamadı.', 'Oda kapatılmış olabilir; bir yetkiliye haber ver.');
  const changed = await channel.setUserLimit(limit).then(() => true, hata('Kişi limiti değiştirilemedi'));
  if (!changed) return replyError(interaction, 'Kişi limiti değiştirilemedi.', 'Botun bu kanalı yönetme izni olmalı.');
  const updated = store.updateRoom(room.id, { limit });
  return redraw(interaction, updated);
}

async function handleRenameButton(interaction) {
  const room = roomOf(interaction);
  const error = ownerError(interaction, room);
  if (error) return replyError(interaction, error);
  return interaction.showModal(ui.renameModal(room.name));
}

async function handleRenameSubmit(interaction) {
  const room = roomOf(interaction);
  const error = ownerError(interaction, room);
  if (error) return replyError(interaction, error);

  const name = interaction.fields.getTextInputValue(ui.IDS.renameInput).trim().replace(/\s+/g, ' ').slice(0, 30);
  if (name.length < 2) return replyError(interaction, 'Oda ismi çok kısa.', 'En az iki karakterlik bir isim yaz.');
  const wait = takeCooldown(room.id, ui.IDS.rename);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  let changed = false;
  for (const key of ['categoryId', 'voiceChannelId', 'textChannelId']) {
    const channel = await interaction.guild.channels.fetch(room[key]).catch(() => null);
    if (!channel) continue;
    changed = (await channel.setName(name, `Kalıcı oda #${core.pad(room.no)} yeniden adlandırıldı`).then(() => true, hata('Oda ismi değiştirilemedi'))) || changed;
  }
  if (!changed) return replyError(interaction, 'Oda ismi değiştirilemedi.', 'Discord kanal adını kısa aralıklarla en fazla iki kez değiştirmeye izin verir; biraz sonra tekrar dene.');

  const updated = store.updateRoom(room.id, { name });
  return redraw(interaction, updated);
}

// ── Yetkili komutları ──────────────────────────────────────────────────────────

// /kalici-oda kapat ve devret için oda numarasından kayıt; bulunamazsa null
function roomByNumber(interaction) {
  const no = interaction.options.getInteger('no', true);
  const room = store.roomsOf(interaction.guildId).find((r) => r.no === no);
  if (!room) replyError(interaction, 'Bu numarada bir kalıcı oda bulunamadı.', 'Odaları **/kalici-oda liste** ile görebilirsin.');
  return room ?? null;
}

// Odayı kapatır: kalan kanalları siler, kaydı temizler, sahibine haber verir
async function closeRoom(guild, room, reason) {
  store.deleteRoom(room.id);
  clearCooldowns(room.id);

  for (const key of ['categoryId', 'voiceChannelId', 'textChannelId']) {
    const channel = await guild.channels.fetch(room[key]).catch(() => null);
    if (channel) await channel.delete().catch(() => {});
  }

  const owner = await guild.client.users.fetch(room.ownerId).catch(() => null);
  await owner
    ?.send({
      components: [core.alert('Kalıcı odan kapatıldı.', reason ? `**Sebep:** ${reason}` : 'Bir yetkili tarafından kapatıldı.', 'danger')],
      flags: core.CV2,
      allowedMentions: { parse: [] },
    })
    .catch(() => {});

  return logSystem
    .write(guild.client, 'bot', {
      color: 'danger',
      title: 'Kalıcı Oda Kapatıldı',
      lines: [`**Oda:** #${core.pad(room.no)} ${room.name}`, `**Sahip:** <@${room.ownerId}>`, reason ? `**Sebep:** ${reason}` : null].filter(Boolean),
    })
    .catch(() => {});
}

async function handleList(interaction) {
  const rooms = store.roomsOf(interaction.guildId).sort((a, b) => a.no - b.no);
  return respond(interaction, ui.roomList(rooms, store.pendingApplications(interaction.guildId).length));
}

async function handleClose(interaction) {
  const room = roomByNumber(interaction);
  if (!room) return;
  await interaction.deferReply({ flags: core.EPHEMERAL });
  await closeRoom(interaction.guild, room, interaction.options.getString('sebep'));
  return respond(interaction, core.alert(`Kalıcı oda #${core.pad(room.no)} kapatıldı.`, 'Kanallar silindi, sahibine haber verildi.', 'success'));
}

// Sahibi sunucudan ayrılmış odaları yetkili başka bir üyeye teslim eder
async function handleAssign(interaction) {
  const room = roomByNumber(interaction);
  if (!room) return;
  const target = interaction.options.getMember('kullanici');
  if (!target) return replyError(interaction, 'Üye sunucuda değil.', 'Sunucudaki bir üyeyi seç.');
  if (target.user.id === room.ownerId) return replyError(interaction, 'Oda zaten bu üyenin.');
  if (target.user.bot) return replyError(interaction, 'Oda sahipliği bir bota verilemez.', 'Bir üye seç.');

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const previousId = room.ownerId;
  const previous = await interaction.guild.members.fetch(previousId).catch(() => null);
  await setAccess(interaction.guild, room, target.id, true);
  // Eski sahip hâlâ sunucudaysa odada sıradan üye olarak kalmaya devam eder
  const updated = store.updateRoom(room.id, {
    ownerId: target.id,
    members: [...room.members.filter((id) => id !== target.id && id !== previousId), ...(previous ? [previousId] : [])].slice(0, config.maxExtraMembers),
  });

  const channel = await fetchTextChannel(interaction.guild, room.textChannelId);
  if (channel && updated.panelMessageId) {
    await channel.messages
      .edit(updated.panelMessageId, { components: [ui.roomPanel(updated)], allowedMentions: { parse: [] } })
      .catch(hata('Oda paneli güncellenemedi'));
  }
  const exOwner = await interaction.client.users.fetch(previousId).catch(() => null);
  await exOwner
    ?.send({ components: [core.alert('Kalıcı odanın sahipliği devredildi.', `<@${target.id}> artık <#${updated.voiceChannelId}> odasının sahibi.`, 'warning')], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch(() => {});
  return respond(interaction, core.alert(`Oda #${core.pad(updated.no)} <@${target.id}> üyesine devredildi.`, undefined, 'success'));
}

async function handleCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'liste') return handleList(interaction);
  if (sub === 'kapat') return handleClose(interaction);
  return handleAssign(interaction);
}

// ── Açılış ve kanal olayları ───────────────────────────────────────────────────

// Bot kapalıyken silinmiş kanalların kayıtlarını temizler, paneli kanala gönderir
async function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    for (const room of store.roomsOf(guild.id)) {
      const still = await guild.channels.fetch(room.categoryId).then(() => true, () => false);
      if (!still) {
        store.deleteRoom(room.id);
        clearCooldowns(room.id);
      }
    }
  }
  if (!config.channels.panel) return;
  return syncPanel(client, {
    key: 'kalici-oda',
    label: 'Kalıcı oda başvurusu',
    channelId: config.channels.panel,
    buttonId: ui.IDS.apply,
    build: () => ui.applyPanel(),
    image: '',
  });
}

// Bir kanal elle silinirse oda kapanmış sayılır: kalan kanallar temizlenir, kayıt silinir
async function handleChannelDelete(channel) {
  const room = store.roomOfChannel(channel.id);
  if (!room) return;
  clearCooldowns(room.id);
  store.deleteRoom(room.id);
  for (const key of ['categoryId', 'voiceChannelId', 'textChannelId']) {
    if (room[key] === channel.id) continue;
    const leftover = await channel.guild.channels.fetch(room[key]).catch(() => null);
    if (leftover) await leftover.delete().catch(() => {});
  }
}

module.exports = {
  name: 'kalici-oda',
  commands,
  help: {
    category: ['oda', 'Odalar'],
    access: {
      'kalici-oda liste': 'Yöneticiler',
      'kalici-oda kapat': 'Yöneticiler',
      'kalici-oda devret': 'Yöneticiler',
    },
    need: {
      'kalici-oda liste': 'Yöneticiler',
      'kalici-oda kapat': 'Yöneticiler',
      'kalici-oda devret': 'Yöneticiler',
    },
  },
  slash: { 'kalici-oda': handleCommand },
  buttons: {
    [ui.IDS.apply]: handleApplyButton,
    [ui.IDS.limit]: handleLimitButton,
    [ui.IDS.rename]: handleRenameButton,
  },
  modals: {
    [ui.IDS.form]: handleApplySubmit,
    [ui.IDS.limitForm]: handleLimitSubmit,
    [ui.IDS.renameForm]: handleRenameSubmit,
  },
  prefixed: [
    [ui.IDS.decide, handleDecision],
    [ui.IDS.rejectForm, handleRejectSubmit],
    [ui.IDS.add, handleAddMember],
    [ui.IDS.remove, handleRemoveMember],
    [ui.IDS.transfer, handleTransfer],
  ],
  events: {
    [Events.ClientReady]: handleReady,
    [Events.ChannelDelete]: handleChannelDelete,
  },
};
