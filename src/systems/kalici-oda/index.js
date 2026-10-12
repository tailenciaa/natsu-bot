// Kalıcı oda sistemi: üye başvuru panelinden başvurusunu açar, odasını kullanacak üyeleri üye seçme menüsünden seçer,
// sonra formu doldurur; başvurular inceleme kanalına düşer ve kararı yalnızca yöneticiler verir. Onaylanan oda
// config.categoryId kategorisinin içine tek bir ses kanalı olarak açılır — ayrı yazı kanalı yoktur, odanın yazısı
// ses kanalının kendi sohbetidir. Herkes odayı kanal listesinde görür ama bağlanamaz ve sohbetini okuyamaz; bu
// erişim yalnızca odadakilerdedir. Sahibine teslim kartı DM olarak gider, odası olan üye oda sahibi rolünü alır ve
// oda ayarlarını **/kalici-oda** komutuyla yönetir (isim, kişi limiti, üye ekle/çıkar, sahiplik devri) — panel
// odanın kanalına düşmez. Yöneticinin oda işleri (listeleme, kapatma, devir) komut değil: başvuru panelindeki
// **Odaları Yönet** düğmesinden açılan sayfada oda menüden seçilir, numara yazılmaz. Oda kalıcıdır ama ay sonu
// şartına bağlıdır: odadakilerin ses süresi her hafta ölçülüp odaya yazılır, hedefin altındaki hafta sahibine
// hatırlatılır ve ay başında geçen ay şartı karşılamayan oda "şart yetersizliği" ile kapatılır. Açılış ve kapanış
// duyuru kanalında herkese açık kart olarak görünür, sahibi ayrılmış odayı yönetici bir üyeye devreder. Odanın ses
// kanalı elle silinirse oda kaydı ve sahip rolü temizlenir.
const { ChannelType, Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const { weekKey, previousWeekKey } = require('../aktif/week');
const siralama = require('../siralama/store');
const logSystem = require('../log');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const DAY = 24 * 60 * 60 * 1000;
// Şart denetimleri 15 dakikada bir dönem anahtarıyla kontrol edilir; dönem işlendiyse tekrar çalışmaz
const CHECK_INTERVAL = 15 * 60 * 1000;
const submitting = new Set();

// Başvurunun üye seçimi ile formu iki adımdır: Discord modallerinde menü olmadığı için üyeler formdan önce seçilir.
// Menüden seçilenler burada bekletilir; bot yeniden başlarsa taslak düşer ve başvuru baştan başlatılır.
const DRAFT_TTL = 30 * 60 * 1000;
const drafts = new Map(); // `${sunucu}:${üye}` -> { members: [üye ID], at }

function getDraft(key) {
  const draft = drafts.get(key);
  if (!draft) return null;
  if (Date.now() - draft.at > DRAFT_TTL) {
    drafts.delete(key);
    return null;
  }
  return draft;
}

// Menüde bırakılan liste neyse taslak odur: başvuranın kendisi sayılmaz, sınır aşılırsa kesilir
function setDraft(key, ownerId, picked) {
  const members = [...new Set(picked)].filter((id) => id !== ownerId).slice(0, config.maxExtraMembers);
  drafts.set(key, { members, at: Date.now() });
  return members;
}

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

// Oda erişiminin kuralı: kanal herkesin gözünde açık, ama bağlanmak ve sohbeti okumak yalnız odadakilerin işi.
// Kanal açılırken allow/deny listesi, sonradan düzenlenirken { izin: true/false } gerekir; asFlags ikisini kurar.
const GUEST = { allow: ['ViewChannel'], deny: ['Connect', 'SendMessages', 'ReadMessageHistory'] };
const MEMBER = { allow: ['ViewChannel', 'Connect', 'SendMessages', 'ReadMessageHistory'], deny: [] };
const asFlags = ({ allow, deny }) => Object.fromEntries([...allow.map((p) => [p, true]), ...deny.map((p) => [p, false])]);

// Oda sahibi rolü: odası olan üyede durur, odası kapanınca ya da sahipliği devredince geri alınır. Komut sahipliğe
// baktığı için rol bir şekilde verilemezse oda yönetimi yine çalışır; rol, üyeliğin sunucudaki gözüdür.
async function giveOwnerRole(guild, userId) {
  if (!config.roles.owner) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || member.roles.cache.has(config.roles.owner)) return;
  await member.roles.add(config.roles.owner, 'Kalıcı oda sahibi').catch(hata('Oda sahibi rolü verilemedi'));
}

async function takeOwnerRole(guild, userId) {
  if (!config.roles.owner) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member?.roles.cache.has(config.roles.owner)) return;
  await member.roles.remove(config.roles.owner, 'Kalıcı odası kapandı ya da devredildi').catch(hata('Oda sahibi rolü alınamadı'));
}

// Komut tek bir işe iner: üyenin kendi odasının paneli. Yöneticinin oda işleri komut değil panel düğmesidir,
// bu yüzden komutta alt komut katmanı yok. Yetki kontrolü komut tanımında değil handler içinde yapılır.
const commands = [
  new SlashCommandBuilder()
    .setName('kalici-oda')
    .setDescription('Kendi kalıcı odanın kontrol panelini açar: isim, kişi limiti, üye ve devir işlemleri.')
    .setContexts(InteractionContextType.Guild),
];

// ── Başvuru ───────────────────────────────────────────────────────────────────

// Başvuru yapılamıyorsa [mesaj, açıklama] döner, yoksa null
function applyError(interaction) {
  if (!config.channels.applications) {
    return ['Kalıcı oda başvuruları şu an açık değil.', 'Yöneticiler başvuru kanalını ayarladığında tekrar deneyebilirsin.'];
  }
  if (store.roomsOwned(interaction.guildId, interaction.user.id).length >= config.maxRoomsPerOwner) {
    return ['Zaten bir kalıcı odan var.', 'Yeni bir oda için mevcut odanı devret ya da bir yöneticiden kapatmasını iste.'];
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

// Odayı kullanacakların son 7 gündeki toplam sesi (saniye); sıralama sisteminin ses istatistiklerinden okunur
function weeklyVoiceSeconds(ids) {
  const totals = siralama.totals('voice', 7);
  return ids.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0);
}

const draftKey = (interaction) => `${interaction.guildId}:${interaction.user.id}`;

// Paneldeki "Başvuru Yap": başvurunun ilk adımı açılır, üyeler burada menüyle seçilir. Buton kalıcı panelde olduğu
// için kanala dönen cevap birikeceğinden adım gizli açılır (SABİT PANEL KURALI); görünürlük cevap anında kilitlenir.
async function handleApplyButton(interaction) {
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);
  return respond(interaction, ui.memberPicker(), { ephemeral: true });
}

// Üye seçme menüsü: mesajın içeriği değişmediği için işlem sadece onaylanır; seçtiklerinin dökümü Formu Aç
// adımında denetlenir, eksikse üye sayısı söylenerek düzeltmesi istenir
async function handleMemberPick(interaction) {
  setDraft(draftKey(interaction), interaction.user.id, interaction.values);
  return interaction.deferUpdate();
}

// "Formu Aç": üye sayısı yeterliyse oda adı ve amacın sorulduğu form açılır
async function handleOpenForm(interaction) {
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);
  const members = getDraft(draftKey(interaction))?.members ?? [];
  if (!members.length) {
    return replyError(interaction, 'Önce odada olacak üyeleri seç.', 'Menüden üyeleri seçtikten sonra tekrar **Formu Aç** butonuna bas.');
  }
  if (members.length + 1 < config.minMembers) {
    return replyError(
      interaction,
      `Odayı en az ${config.minMembers} kişinin kullanması gerekiyor.`,
      `Menüden ${config.minMembers - 1} üye seç, sonra **Formu Aç**'a bas. Seçimi tek seferde yap: yeni seçim öncekinin yerini alır.`,
    );
  }
  return interaction.showModal(ui.applicationModal());
}

async function handleApplySubmit(interaction) {
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);

  const answer = (id) => interaction.fields.getTextInputValue(`${ui.IDS.question}:${id}`).trim();
  const roomName = answer('ad').replace(/\s+/g, ' ').slice(0, 30);
  if (roomName.length < 2) return replyError(interaction, 'Oda adı çok kısa.', 'En az iki karakterlik bir ad yaz.');

  const members = getDraft(draftKey(interaction))?.members ?? [];
  if (members.length + 1 < config.minMembers) {
    return replyError(
      interaction,
      `Odayı en az ${config.minMembers} kişinin kullanması gerekiyor.`,
      'Üye seçimi yenilenmiş görünüyor; **Başvuru Yap** ile üyeleri tekrar seç.',
    );
  }
  const purpose = answer('amac');
  if (purpose.length < 15) return replyError(interaction, 'Amaç alanı çok kısa.', 'Odanın ne için kullanılacağını bir cümleyle yaz.');

  const lockKey = `${interaction.guildId}:${interaction.user.id}`;
  if (submitting.has(lockKey)) return replyError(interaction, 'Başvurun zaten gönderiliyor.', 'Lütfen bekle.');
  submitting.add(lockKey);

  try {
    // SABİT PANEL KURALI: başvuru butonu kalıcı panelde, her üye basabilir. Başvurunun asıl kartı inceleme
    // kanalına düşer; panel kanalına dönen cevap birikeceği için gizlidir. Görünürlük defer anında kilitlenir.
    await interaction.deferReply({ flags: core.EPHEMERAL_CV2 });
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
      return replyError(interaction, 'Başvurun gönderilemedi.', 'Birkaç dakika sonra yeniden dene; sorun sürerse bir yöneticiye haber ver.');
    }
    store.updateApplication(id, { messageId: message.id });
    drafts.delete(draftKey(interaction)); // başvuru kanala düştü: üye seçimi taslağı bitti

    return respond(interaction, ui.submitted({ user: interaction.user, app, memberCount: members.length + 1 }), { ephemeral: true });
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
      ? `Başvuruları yalnızca <@&${config.roles.reviewer}> rolündekiler ve yöneticiler onaylayabilir.`
      : 'Başvuruları yalnızca yöneticiler onaylayabilir.';
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

// Onaylanan başvuruda oda açılır: config.categoryId kategorisinin içine tek bir ses kanalı. Odaya özel kategori ya da
// ayrı yazı kanalı yoktur; odanın yazısı ses kanalının kendi sohbetidir. Kanal herkesin gözünde durur, bağlanmak ve
// sohbeti okumak yalnız odadakilerin iznidir.
async function openRoom(guild, app) {
  const memberIds = [app.userId, ...app.members].slice(0, config.maxExtraMembers + 1);
  const overwrites = [
    { id: guild.roles.everyone.id, ...GUEST },
    { id: guild.members.me?.id ?? guild.client.user.id, allow: ['ViewChannel', 'ReadMessageHistory', 'SendMessages', 'ManageChannels'], deny: [] },
    config.roles.team && { id: config.roles.team, ...MEMBER },
    ...memberIds.map((id) => ({ id, ...MEMBER })),
  ].filter(Boolean);
  const reason = `Kalıcı oda başvurusu #${core.pad(app.number)} onaylandı`;

  const voice = await guild.channels
    .create({
      name: app.roomName,
      type: ChannelType.GuildVoice,
      parent: config.categoryId || undefined,
      userLimit: config.defaultUserLimit,
      permissionOverwrites: overwrites,
      reason,
    })
    .catch(hata('Odanın ses kanalı açılamadı'));
  if (!voice) return null;

  const no = store.nextRoomNumber(guild.id);
  const room = store.setRoom(`${guild.id}-${no}`, {
    id: `${guild.id}-${no}`,
    no,
    guildId: guild.id,
    ownerId: app.userId,
    name: app.roomName,
    members: app.members.filter((id) => id !== app.userId).slice(0, config.maxExtraMembers),
    limit: config.defaultUserLimit,
    categoryId: config.categoryId ?? null,
    voiceChannelId: voice.id,
    textChannelId: null, // eski odalarda ayrı yazı kanalı var; yenilerinde ses kanalının kendi sohbeti kullanılır
    applicationId: app.id,
    approvedBy: null,
    guestSyncedAt: Date.now(), // açılışta @everyone kuralı kanala zaten yazılıyor, tamir gereksiz
    weeks: {}, // biten haftaların odadaki toplam sesi; ay sonu şart denetimi bundan okunur
    createdAt: Date.now(),
  });

  return room;
}

// Odanın botun yönettiği kanalları: yeni odalar tek ses kanalıdır. Eski kayıtlarda oda başına açılmış kategori ve
// ayrı yazı kanalı da olabilir; ikisi bu listeyle taşınır. Paylaşılan kategori (config.categoryId) asla listeye
// girmez, yoksa bir odaya yapılan işlem diğer odalara ya da tüm sunucuya uygulanır.
function roomChannelKeys(room) {
  const keys = [];
  if (room.categoryId && room.categoryId !== config.categoryId) keys.push('categoryId');
  keys.push('voiceChannelId');
  if (room.textChannelId) keys.push('textChannelId');
  return keys;
}

// Oda olayı duyuru kanalına herkese açık kart olarak düşer; kanal ayarlanmamışsa sessizce geçilir (log ayrı durur)
async function announce(guild, container) {
  if (!config.channels.notifications) return;
  const channel = await fetchTextChannel(guild, config.channels.notifications);
  await channel?.send({ components: [container], flags: core.CV2, allowedMentions: { parse: [] } }).catch(hata('Oda bildirimi gönderilemedi'));
}

// Sahibine teslim kartını gönderir, oda sahibi rolünü verir, odayı duyurur ve loglar
async function deliver(guild, room) {
  await giveOwnerRole(guild, room.ownerId);
  const owner = await guild.client.users.fetch(room.ownerId).catch(() => null);
  await owner?.send({ components: [ui.readyCard(room)], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => {});
  await announce(guild, ui.openedNotice(room));
  return logSystem
    .write(guild.client, 'bot', {
      color: 'success',
      title: 'Kalıcı Oda Açıldı',
      lines: [
        `**Oda:** #${core.pad(room.no)} ${room.name}`,
        `**Sahip:** <@${room.ownerId}>`,
        `**Kanal:** <#${room.voiceChannelId}>`,
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
// Panel odanın kanalında değil, /kalici-oda komutunda durur. Oda bu yüzden kanaldan değil
// paneli kullanan kişinin sahipliğinden bulunur: devredilen ya da kapanan odanın eski paneli işlem yapamaz.

const roomOf = (interaction) => store.roomsOwned(interaction.guildId, interaction.user.id)[0] ?? null;

const noRoomError = (interaction) =>
  replyError(interaction, 'Bu paneli sadece oda sahibi kullanabilir.', 'Odan devredilmiş ya da kapatılmış olabilir; kendi odan için komutu yeniden kullan.');

// Üye menüleri isimlerle dolsun diye odadakilerin görünen adları toplanır; ID yazmak ya da aramak gerekmez
async function rosterOf(guild, room) {
  if (!room.members.length) return [];
  const fetched = await guild.members.fetch({ user: room.members }).catch(() => null);
  return room.members.map((id) => ({ id, name: fetched?.get(id)?.displayName ?? guild.members.cache.get(id)?.displayName ?? 'Üye' }));
}

async function redraw(interaction, room) {
  const panel = ui.roomPanel(room, statusOf(room), await rosterOf(interaction.guild, room));
  return interaction.editReply({ components: [panel], allowedMentions: { parse: [] } }).catch(hata('Oda paneli güncellenemedi'));
}

// Odanın kanallarında erişimi açar ya da kapatır (kategori erişimi taşır, kanal erişimi sohbeti ve bağlanmayı)
async function setAccess(guild, room, targetId, allow) {
  for (const key of roomChannelKeys(room)) {
    const channel = await guild.channels.fetch(room[key]).catch(() => null);
    if (!channel) continue;
    if (allow) {
      await channel.permissionOverwrites.edit(targetId, key === 'categoryId' ? { ViewChannel: true } : asFlags(MEMBER)).catch(hata('Oda erişimi verilemedi'));
    } else {
      await channel.permissionOverwrites.delete(targetId).catch(hata('Oda erişimi kaldırılamadı'));
    }
  }
}

// Üye menülerinin ortak ön kontrolü: oda, hız sınırı ve guard. Hata varsa { noRoom }, { error } ya da { wait },
// değilse { room } döner
function memberAction(interaction, action, guard) {
  const room = roomOf(interaction);
  if (!room) return { noRoom: true };
  const blocked = guard(room);
  if (blocked) return { error: blocked };
  const wait = takeCooldown(room.id, action);
  if (wait) return { wait };
  return { room };
}

// Üç menü işleminde de aynı sırayla kontrol edilir: önce panelin sahibi, sonra üye, sonra bekleme
const memberGuardFail = (interaction, step, hint) => {
  if (step.noRoom) return noRoomError(interaction);
  if (step.error) return replyError(interaction, step.error, hint);
  return slowDown(interaction, step.wait);
};

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
  if (step.noRoom || step.error || step.wait) return memberGuardFail(interaction, step, 'Üye listesini kontrol edip tekrar dene.');

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
  if (step.noRoom || step.error || step.wait) return memberGuardFail(interaction, step, 'Üye listesini kontrol edip tekrar dene.');

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
  if (step.noRoom || step.error || step.wait) return memberGuardFail(interaction, step, 'Önce üyeyi odaya ekle.');

  await interaction.deferUpdate();
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot) return replyError(interaction, 'Üye bulunamadı.', 'Sunucuda olan bir üye seç.');

  // Eski sahip sıradan üye olarak odada kalır, yeni sahibin erişimi ayrıcalıklı hale gelir
  await setAccess(interaction.guild, step.room, targetId, true);
  const previousOwnerId = step.room.ownerId;
  const updated = store.updateRoom(step.room.id, {
    ownerId: targetId,
    members: [...step.room.members.filter((id) => id !== targetId), previousOwnerId],
  });
  await takeOwnerRole(interaction.guild, previousOwnerId);
  await giveOwnerRole(interaction.guild, targetId);
  return redraw(interaction, updated);
}

async function handleLimitButton(interaction) {
  const room = roomOf(interaction);
  if (!room) return noRoomError(interaction);
  const channel = await interaction.guild.channels.fetch(room.voiceChannelId).catch(() => null);
  return interaction.showModal(ui.limitModal(channel?.userLimit ?? room.limit));
}

async function handleLimitSubmit(interaction) {
  const room = roomOf(interaction);
  if (!room) return noRoomError(interaction);

  const raw = interaction.fields.getTextInputValue(ui.IDS.limitInput).trim();
  const limit = /^\d{1,2}$/.test(raw) ? Number(raw) : -1;
  if (limit < 0) return replyError(interaction, 'Geçerli bir sayı gir.', '0-99 arası olmalı, 0 sınırsız demektir.');
  const wait = takeCooldown(room.id, ui.IDS.limit);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const channel = await interaction.guild.channels.fetch(room.voiceChannelId).catch(() => null);
  if (!channel) return replyError(interaction, 'Odanın ses kanalı bulunamadı.', 'Oda kapatılmış olabilir; bir yöneticiye haber ver.');
  const changed = await channel.setUserLimit(limit).then(() => true, hata('Kişi limiti değiştirilemedi'));
  if (!changed) return replyError(interaction, 'Kişi limiti değiştirilemedi.', 'Botun bu kanalı yönetme izni olmalı.');
  const updated = store.updateRoom(room.id, { limit });
  return redraw(interaction, updated);
}

async function handleRenameButton(interaction) {
  const room = roomOf(interaction);
  if (!room) return noRoomError(interaction);
  return interaction.showModal(ui.renameModal(room.name));
}

async function handleRenameSubmit(interaction) {
  const room = roomOf(interaction);
  if (!room) return noRoomError(interaction);

  const name = interaction.fields.getTextInputValue(ui.IDS.renameInput).trim().replace(/\s+/g, ' ').slice(0, 30);
  if (name.length < 2) return replyError(interaction, 'Oda ismi çok kısa.', 'En az iki karakterlik bir isim yaz.');
  const wait = takeCooldown(room.id, ui.IDS.rename);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  let changed = false;
  for (const key of roomChannelKeys(room)) {
    const channel = await interaction.guild.channels.fetch(room[key]).catch(() => null);
    if (!channel) continue;
    changed = (await channel.setName(name, `Kalıcı oda #${core.pad(room.no)} yeniden adlandırıldı`).then(() => true, hata('Oda ismi değiştirilemedi'))) || changed;
  }
  if (!changed) return replyError(interaction, 'Oda ismi değiştirilemedi.', 'Discord kanal adını kısa aralıklarla en fazla iki kez değiştirmeye izin verir; biraz sonra tekrar dene.');

  const updated = store.updateRoom(room.id, { name });
  return redraw(interaction, updated);
}

// /kalici-oda: üyenin kendi odasının panelini komutun kullanıldığı kanalda açar.
// Komutla açılan sayfa kalıcı ve herkese açıktır; panel bir odanın ayarıdır, gizli tutulacak kişi kaydı değildir.
async function handleMyRoom(interaction) {
  const room = store.roomsOwned(interaction.guildId, interaction.user.id)[0];
  if (!room) {
    return replyError(interaction, 'Senin bir kalıcı odan yok.', 'Başvuru panelinden oda isteyebilirsin; odası olan üye bu komutla panelini açar.');
  }
  await interaction.deferReply({ flags: core.CV2 });
  return respond(interaction, ui.roomPanel(room, statusOf(room), await rosterOf(interaction.guild, room)));
}

// ── Odayı açık tutan şart ───────────────────────────────────────────────────────
// Haftalık ölçüm + ay sonu denetimi. Hafta biterken odadakilerin (sahip dahil) son 7 gündeki toplam sesi odanın
// kaydına yazılır; hedefin altındaysa sahibine uyarı gider. Ay başında geçen ayın kayıtlarına bakılır: kaçırılan
// hafta ya da ay hedefinin altında kalan toplam varsa oda "şart yetersizliği" ile kapatılır.

// İstanbul takviminde ay anahtarı (YYYY-AA) ve bir önceki ayın anahtarı
const monthKey = (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 7);
const previousMonthKey = (ms = Date.now()) => monthKey(new Date(`${monthKey(ms)}-01T12:00:00Z`).getTime() - DAY);

// Sıradaki ay sonu kontrolü, değerlendirilecek ayın ilk günüdür; panelde "sonraki kontrol" olarak gösterilir
function nextReviewAt(now = Date.now()) {
  const [year, month] = monthKey(now).split('-').map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  return new Date(`${next}-01T00:00:00+03:00`).getTime();
}

// Odanın bir ay içindeki haftalık kayıtları: [pazartesi anahtarı, saniye], eskiden yeniye
const monthWeeks = (room, month) =>
  Object.entries(room.weeks ?? {})
    .filter(([week]) => week.startsWith(month))
    .sort(([a], [b]) => a.localeCompare(b));

// Panele ve uyarılara yazılacak güncel durum
function activityStats(room, weekSeconds, now = Date.now()) {
  const weeks = monthWeeks(room, monthKey(now));
  const weeklyTarget = config.activity.weeklyHours * 3600;
  const recorded = Object.entries(room.weeks ?? {}).sort(([a], [b]) => a.localeCompare(b)).at(-1);
  return {
    weekSeconds,
    lastWeekSeconds: recorded?.[1] ?? null,
    missedWeeks: weeks.filter(([, seconds]) => seconds < weeklyTarget).length,
    monthSeconds: weeks.reduce((sum, [, seconds]) => sum + seconds, 0),
    reviewAt: nextReviewAt(now),
  };
}

// Panel her açıldığında ve her işlem sonrası canlı ölçümle yeniden çizilir
const statusOf = (room) => activityStats(room, weeklyVoiceSeconds([room.ownerId, ...room.members]));

// Haftalık şart kaçınca gönderilen bilgilendirme: bir başarısızlık bildirimi olduğu için kanala değil kişiye düşer
async function warnMissedWeek(guild, room, week, seconds) {
  const owner = await guild.client.users.fetch(room.ownerId).catch(() => null);
  await owner?.send({ components: [ui.weekMissedCard(room, week, seconds)], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => {});
  return logSystem
    .write(guild.client, 'bot', {
      color: 'warning',
      title: 'Kalıcı Oda Şartı Kaçtı',
      lines: [
        `**Oda:** #${core.pad(room.no)} ${room.name}`,
        `**Sahip:** <@${room.ownerId}>`,
        `**Hafta:** ${ui.monthLabel(week)}`,
        `**Odadakilerin sesi:** ${ui.hoursLabel(seconds)} / ${config.activity.weeklyHours} saat`,
      ],
    })
    .catch(() => {});
}

// Hafta biterken ölçüm. Odanın açıldığı eksik hafta sayılmaz; bot uzun süre kapalı kalıysa bir hafta denetimsiz
// geçer (oda lehine), dönem anahtarı sayesinde her hafta yalnızca bir kez işlenir.
async function checkWeeklyActivity(guild) {
  if (!config.activity.enabled) return;
  const week = previousWeekKey();
  if (store.lastAudit(guild.id, 'week') === week) return;

  for (const room of store.roomsOf(guild.id)) {
    if (weekKey(room.createdAt) === week) continue;
    const seconds = weeklyVoiceSeconds([room.ownerId, ...room.members]);
    store.recordWeek(room.id, week, seconds);
    if (seconds < config.activity.weeklyHours * 3600) await warnMissedWeek(guild, room, week, seconds);
  }
  store.setLastAudit(guild.id, 'week', week);
}

// Geçen ayın kayıtları: şartı karşılamayan oda kapatılır. Ay hedefi sayılan hafta kadarına bölünür ki ayın
// ortasında açılan oda ilk ayda tam hedefle ölçülmesin.
async function evaluateMonth(guild, room, month) {
  const weeks = monthWeeks(room, month);
  if (!weeks.length) return; // oda o ay hiç ölçülmemiş: kapatma sebebi sayılmaz

  const weeklyTarget = config.activity.weeklyHours * 3600;
  const stat = {
    month,
    weeks: weeks.length,
    missed: weeks.filter(([, seconds]) => seconds < weeklyTarget).length,
    total: weeks.reduce((sum, [, seconds]) => sum + seconds, 0),
    required: Math.round((config.activity.monthlyHours * 3600 * weeks.length) / 4),
  };
  if (!stat.missed && stat.total >= stat.required) return;

  const reason =
    `Şart yetersizliği: ${ui.monthLabel(month)} ayında ${stat.missed} hafta haftalık ${config.activity.weeklyHours} saat hedefinin altında kaldı, ` +
    `ay toplamı ${ui.hoursLabel(stat.total)} / ${ui.hoursLabel(stat.required)}.`;
  await closeRoom(guild, room, reason, ui.inactivityCard(room, stat));
}

async function checkMonthlyActivity(guild) {
  if (!config.activity.enabled) return;
  const month = previousMonthKey();
  if (store.lastAudit(guild.id, 'month') === month) return;

  for (const room of store.roomsOf(guild.id)) await evaluateMonth(guild, room, month);
  store.setLastAudit(guild.id, 'month', month);
}

// Denetimler 15 dakikada bir dönem anahtarına bakar; her hafta ve her ay bir kez işlenir
function startActivityChecks(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const run = () =>
    checkWeeklyActivity(guild)
      .then(() => checkMonthlyActivity(guild))
      .catch((err) => console.error('[kalıcı-oda] Şart denetimi hatası:', err.message));
  setInterval(run, CHECK_INTERVAL).unref();
  run();
}

// ── Yönetici komutları ─────────────────────────────────────────────────────────

// /kalici-oda kapat ve devret için oda numarasından kayıt; bulunamazsa null
function roomByNumber(interaction) {
  const no = interaction.options.getInteger('no', true);
  const room = store.roomsOf(interaction.guildId).find((r) => r.no === no);
  if (!room) replyError(interaction, 'Bu numarada bir kalıcı oda bulunamadı.', 'Odaları **/kalici-oda liste** ile görebilirsin.');
  return room ?? null;
}

// Odayı kapatır: kaydı ve sahip rolünü kaldırır, kalan kanalları siler, sahibine haber verir, duyurur ve loglar.
// dm verilirse sahibine genel uyarı yerine o kart gider (ay sonu denetiminde rakamlı kart kullanılır).
async function closeRoom(guild, room, reason, dm) {
  store.deleteRoom(room.id);
  clearCooldowns(room.id);
  await takeOwnerRole(guild, room.ownerId);

  for (const key of roomChannelKeys(room)) {
    const channel = await guild.channels.fetch(room[key]).catch(() => null);
    if (channel) await channel.delete().catch(() => {});
  }

  const owner = await guild.client.users.fetch(room.ownerId).catch(() => null);
  await owner
    ?.send({
      components: [dm ?? core.alert('Kalıcı odan kapatıldı.', reason ? `**Sebep:** ${reason}` : 'Bir yönetici tarafından kapatıldı.', 'danger')],
      flags: core.CV2,
      allowedMentions: { parse: [] },
    })
    .catch(() => {});

  await announce(guild, ui.closedNotice(room, reason));

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
  await interaction.deferReply({ flags: core.CV2 });
  await closeRoom(interaction.guild, room, interaction.options.getString('sebep'));
  return respond(interaction, core.alert(`Kalıcı oda #${core.pad(room.no)} kapatıldı.`, 'Kanallar silindi, sahibine haber verildi.', 'success'));
}

// Sahibi sunucudan ayrılmış odaları yönetici başka bir üyeye teslim eder
async function handleAssign(interaction) {
  const room = roomByNumber(interaction);
  if (!room) return;
  const target = interaction.options.getMember('kullanici');
  if (!target) return replyError(interaction, 'Üye sunucuda değil.', 'Sunucudaki bir üyeyi seç.');
  if (target.user.id === room.ownerId) return replyError(interaction, 'Oda zaten bu üyenin.');
  if (target.user.bot) return replyError(interaction, 'Oda sahipliği bir bota verilemez.', 'Bir üye seç.');

  await interaction.deferReply({ flags: core.CV2 });
  const previousId = room.ownerId;
  const previous = await interaction.guild.members.fetch(previousId).catch(() => null);
  await setAccess(interaction.guild, room, target.id, true);
  // Eski sahip hâlâ sunucudaysa odada sıradan üye olarak kalmaya devam eder
  const updated = store.updateRoom(room.id, {
    ownerId: target.id,
    members: [...room.members.filter((id) => id !== target.id && id !== previousId), ...(previous ? [previousId] : [])].slice(0, config.maxExtraMembers),
  });

  await takeOwnerRole(interaction.guild, previousId);
  await giveOwnerRole(interaction.guild, target.id);

  const exOwner = await interaction.client.users.fetch(previousId).catch(() => null);
  await exOwner
    ?.send({ components: [core.alert('Kalıcı odanın sahipliği devredildi.', `<@${target.id}> artık <#${updated.voiceChannelId}> odasının sahibi.`, 'warning')], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch(() => {});
  const newOwner = await interaction.client.users.fetch(target.id).catch(() => null);
  await newOwner
    ?.send({ components: [ui.readyCard(updated)], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch(() => {});
  return respond(interaction, core.alert(`Oda #${core.pad(updated.no)} <@${target.id}> üyesine devredildi.`, 'Yeni sahibine odası ve **/kalici-oda odam** komutu bildirildi.', 'success'));
}

// Komut herkese açık tanımlı: `odam` kendi odasını yöneten üyeye, diğer alt komutlar yalnızca yöneticilere çalışır
async function handleCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'odam') return handleMyRoom(interaction);
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return replyError(interaction, 'Bu alt komutu yalnızca yöneticiler kullanabilir.', 'Kendi odan için **/kalici-oda odam** komutunu kullan.');
  }
  if (sub === 'liste') return handleList(interaction);
  if (sub === 'kapat') return handleClose(interaction);
  return handleAssign(interaction);
}

// ── Açılış ve kanal olayları ───────────────────────────────────────────────────

// Odaların açılacağı kategori @everyone'a kapalıysa odalar kimseye görünmez (kanal izni olsa bile kategori
// görünürlüğü ön koşuldur); yönetici logdan anlasın
async function checkCategoryVisibility(guild) {
  if (!config.categoryId) return;
  const category = await guild.channels.fetch(config.categoryId).catch(() => null);
  if (!category) return console.error(`[kalıcı-oda] config.categoryId (${config.categoryId}) sunucuda bulunamadı, odalar sunucu köküne açılır.`);
  if (!category.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel)) {
    console.error(`[kalıcı-oda] "${category.name}" kategorisinde @everyone için Kanalı Görüntüle kapalı: kalıcı odalar kimseye görünmez.`);
  }
}

// Odanın ses kanalarında @everyone kuralını yeniler: kanal görünür, bağlanmak ve sohbeti okumak kapalı
async function syncGuestVisibility(guild, room) {
  const channel = await guild.channels.fetch(room.voiceChannelId).catch(() => null);
  if (!channel) return;
  await channel.permissionOverwrites
    .edit(guild.roles.everyone.id, asFlags(GUEST), { reason: 'Kalıcı oda: herkes görsün, bağlanamasın' })
    .catch(hata('Odanın görünürlüğü güncellenemedi'));
}

// Bot kapalıyken silinmiş kanalların kayıtlarını temizler, sahip rollerini ve oda görünürlüğünü günceller, şart
// denetimlerini başlatır ve başvuru panelini bilgi kanalına yerleştirir
async function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    await checkCategoryVisibility(guild);
    for (const room of store.roomsOf(guild.id)) {
      const still = await guild.channels.fetch(room.voiceChannelId).then(() => true, () => false);
      if (!still) {
        store.deleteRoom(room.id);
        clearCooldowns(room.id);
        continue;
      }
      // Eski odalar @everyone'a tamamen kapalı açılmıştı; kural değiştiği için kanal bir kez düzeltilir
      if (!room.guestSyncedAt) {
        await syncGuestVisibility(guild, room);
        store.updateRoom(room.id, { guestSyncedAt: Date.now() });
      }
      // Oda hâlâ var ama sahibi rolü bir şekilde düşmüşse (bot kapalıyken alınmış gibi) tamamlanır
      await giveOwnerRole(guild, room.ownerId);
    }
    startActivityChecks(client);
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

// Odanın ses kanalı elle silinirse oda kapanmış sayılır: kalan kanallar temizlenir, kayıt ve sahip rolü düşürülür.
// Eski kayıtlarda kalan ayrı yazı kanalı silinirse oda kapanmaz, odanın kendisi duruyordur.
async function handleChannelDelete(channel) {
  const room = store.roomOfChannel(channel.id);
  if (!room) return;
  clearCooldowns(room.id);
  store.deleteRoom(room.id);
  await takeOwnerRole(channel.guild, room.ownerId);
  for (const key of roomChannelKeys(room)) {
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
      'kalici-oda odam': 'Oda sahipleri',
      'kalici-oda liste': 'Yöneticiler',
      'kalici-oda kapat': 'Yöneticiler',
      'kalici-oda devret': 'Yöneticiler',
    },
    // `odam` herkesin kullanabildiği bir komut değil (yalnızca odası olan üye), bu yüzden üye yardım
    // menüsünde listelenmez; üyeye komutu teslim kartı ve başvuru panelindeki kurallar söylüyor.
  },
  slash: { 'kalici-oda': handleCommand },
  buttons: {
    [ui.IDS.apply]: handleApplyButton,
    [ui.IDS.openForm]: handleOpenForm,
    [ui.IDS.limit]: handleLimitButton,
    [ui.IDS.rename]: handleRenameButton,
  },
  modals: {
    [ui.IDS.form]: handleApplySubmit,
    [ui.IDS.limitForm]: handleLimitSubmit,
    [ui.IDS.renameForm]: handleRenameSubmit,
  },
  prefixed: [
    [ui.IDS.pickMembers, handleMemberPick],
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
  // Zamanlayıcının çağırdığı denetimler; yerel duman testi ve önizleme case'leri için dışarı açık
  // (çerçeve bu alanı okumaz). Paneldeki şart durumu da aynı activityStats'ten gelir, iki ayrı hesap olmasın.
  denetim: { checkWeeklyActivity, checkMonthlyActivity, activityStats, statusOf, weeklyVoiceSeconds, monthKey, nextReviewAt },
};
