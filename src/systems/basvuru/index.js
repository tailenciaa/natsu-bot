// Yetkili alım sistemi: yetkili alım kanalındaki panelden "Başvuru Yap" ile form doldurulur, başvuru başvurular
// kanalına gider. Panel bot açılınca kanala kendiliğinden gönderilir. İnceleyen rol Görüşmeye Çağır / Reddet ile karar verir.
// Görüşmeye çağıran yetkili başvuruyu üstlenir, sonraki kararları sadece o (ya da yöneticiler) verebilir.
// Görüşmeye çağrılan başvurana görüşme ses kanallarının kilidi açılır (voice.js), görüşmeden çıkınca tekrar kilitlenir.
// Başvuran ve yetkili aynı görüşme kanalına girince görüşme başlar ve kanalın sohbetine karar paneli gelir: Devam Et ile
// başvuru onaylanır, oryantasyonu kimin vereceği sorulur (oryantasyon sistemi); İptal Et ile reddedilir ve kanallar kilitlenir.
// Yetkili ya da başvuran kanala diğerinden önce girerse kanalın sohbetine, başvurular kanalına ve karşı tarafın DM'ine
// "bekleniyor" bildirimi gider.
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const orientation = require('../oryantasyon');
const config = require('./config');
const log = require('./log');
const store = require('./store');
const ui = require('./ui');
const voice = require('./voice');

const DAY = 24 * 60 * 60 * 1000;
const submitting = new Set();

// Başvuru sayısı arttıkça kanalda mesaj aramak yerine numarayla bulmak için: bekleyen başvuruları listeler,
// "reddet" doğrudan numarayla ret formunu açar (karar hâlâ sadece ilgili yetkilide/yöneticide kalır).
const commands = [
  new SlashCommandBuilder()
    .setName('basvuru')
    .setDescription('Bekleyen yetkili başvurularını yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('liste').setDescription('Henüz sonuçlanmamış tüm başvuruları, mesaj bağlantılarıyla listeler.'))
    .addSubcommand((s) =>
      s
        .setName('reddet')
        .setDescription('Bekleyen bir başvuruyu, mesajını aramadan numarasıyla reddeder.')
        .addIntegerOption((o) => o.setName('no').setDescription('Başvuru numarasını girer.').setMinValue(1).setRequired(true)),
    ),
];

const hasRole = (member, roleId) =>
  Array.isArray(member?.roles) ? member.roles.includes(roleId) : Boolean(member?.roles?.cache.has(roleId));

// Son başvurusu reddedilen kişi bekleme süresi dolmadan tekrar başvuramaz; dolacağı zamanı döner
function reapplyAt(guildId, userId) {
  const days = config.reapplyCooldownDays;
  if (!days) return null;
  const lastRejected = store.applicationsOf(guildId, userId).find((a) => a.status === 'rejected');
  const until = lastRejected ? lastRejected.reviewedAt + days * DAY : 0;
  return until > Date.now() ? until : null;
}

// Başvuru yapılamıyorsa [mesaj, açıklama] döner
function applyError(interaction) {
  if (config.roles.accept && hasRole(interaction.member, config.roles.accept)) return ['Zaten ekibimizdesin.'];

  const applications = store.applicationsOf(interaction.guildId, interaction.user.id);
  const penalty = applications.find((a) => a.penaltyUntil > Date.now());
  if (penalty) {
    return [
      'Başvuru cezan devam ediyor.',
      `Oryantasyon sırasında defalarca kanaldan ayrıldığın için <t:${Math.floor(penalty.penaltyUntil / 1000)}:D> tarihine kadar başvuru yapamazsın.`,
    ];
  }
  if (applications.some((a) => a.status === 'pending')) {
    return ['İncelenmeyi bekleyen bir başvurun zaten var.', 'Sonuç sana DM üzerinden iletilecek.'];
  }
  if (applications.some(voice.inOrientation)) {
    return ['Başvurun onaylandı ve oryantasyonun devam ediyor.', 'Oryantasyon bilgileri sana DM üzerinden iletildi.'];
  }

  const until = reapplyAt(interaction.guildId, interaction.user.id);
  if (until) {
    return [
      'Son başvurun reddedildiği için şu an tekrar başvuramazsın.',
      `<t:${Math.floor(until / 1000)}:D> tarihinden sonra tekrar başvurabilirsin.`,
    ];
  }
  return null;
}

// Karar butonlarını ve formlarını kullanma kontrolü; sorun yoksa null döner
function reviewError(interaction, app) {
  if (!app) return 'Bu başvuru bulunamadı.';
  const reviewerRoles = [app.reviewerRoleId, ...config.roles.reviewerExtra].filter(Boolean);
  if (!isStaff(interaction, reviewerRoles)) {
    return reviewerRoles.length
      ? `Başvuruları sadece ${reviewerRoles.map((id) => `<@&${id}>`).join(', ')} rolündekiler inceleyebilir.`
      : 'Başvuruları sadece yöneticiler inceleyebilir.';
  }
  if (app.status !== 'pending') return 'Bu başvuru zaten sonuçlandırıldı.';
  // Görüşmeye çağıran yetkili başvuruyu üstlenir, kararı da o verir
  if (app.ownerId && app.ownerId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return `Bu başvuruyla <@${app.ownerId}> ilgileniyor, kararı sadece o verebilir.`;
  }
  return null;
}

// Bekleyen başvurunun kısa durumu: /basvuru liste ve sonuç mesajlarında kullanılır
function pendingStatus(app) {
  if (app.onHold) return `Görüşme beklemede - <@${app.onHold.by}> ayrıldı`;
  if (app.meetingBy) return `Görüşmede - <@${app.meetingBy}>`;
  return 'İnceleniyor';
}

// /basvuru liste: henüz karara bağlanmamış tüm başvuruları numara, başvuran, durum ve mesaj bağlantısıyla listeler
async function handleList(interaction) {
  const pending = store.pendingApplications(interaction.guildId);
  if (!pending.length) return respond(interaction, core.alert('Bekleyen başvuru yok.', 'Tüm başvurular sonuçlandırılmış.', 'success'));

  const lines = pending.map(
    (a) => `**#${core.pad(a.number)}** <@${a.userId}> - ${pendingStatus(a)} · [Mesaja git](${core.messageUrl(a.guildId, a.channelId, a.messageId)})`,
  );
  return respond(
    interaction,
    core.page({
      title: 'Bekleyen Başvurular',
      sub: 'Henüz sonuçlanmamış tüm başvurular burada listelenir; bir başvuruyu bulmak için kanalda aramak yerine **Mesaja git** bağlantısını kullanabilir, reddetmek için `/basvuru reddet` komutuna numarasını yazabilirsin.',
      blocks: [lines.join('\n')],
    }),
  );
}

// /basvuru reddet no:<numara>: kararı sadece ilgili yetkili (ya da yönetici) verebilir, karar modalı normal akışla aynıdır
async function handleRejectCommand(interaction) {
  const app = store.getApplication(`${interaction.guildId}-${interaction.options.getInteger('no', true)}`);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);
  return interaction.showModal(ui.reviewModal(app));
}

async function handleCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'liste') return handleList(interaction);
  return handleRejectCommand(interaction);
}

// Bot açılınca paneli yetkili alım kanalına gönderir (değişmediyse dokunmaz) ve süresi dolan ses erişimlerini kapatmaya başlar
function handleReady(client) {
  voice.startSweeper(client);
  // Bot kapalıyken ikisi de aynı kanala girdiyse görüşme (ve karar paneli) açılışta başlatılır
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    for (const app of store.inMeeting()) {
      startMeeting(guild, app).catch((err) => console.error('[basvuru] Görüşme başlatılamadı:', err.message));
    }
    for (const app of store.heldMeetings()) scheduleMeetingHold(guild, app);
  }
  return syncPanel(client, {
    key: 'basvuru',
    label: 'Yetkili alım',
    channelId: config.channels.panel,
    buttonId: ui.IDS.apply,
    build: ui.panel,
    image: '',
  });
}

// Paneldeki "Başvur" butonu
async function handleApplyButton(interaction) {
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);

  return interaction.showModal(ui.applicationModal());
}

// Form gönderilince başvuruyu kaydeder ve başvurular kanalına gönderir
async function handleApplySubmit(interaction) {
  const { guild, user } = interaction;
  const error = applyError(interaction);
  if (error) return replyError(interaction, ...error);

  const lockKey = `${guild.id}:${user.id}`;
  if (submitting.has(lockKey)) return replyError(interaction, 'Başvurun zaten gönderiliyor.', 'Lütfen bekle.');

  submitting.add(lockKey);
  try {
    await interaction.deferReply({ flags: core.EPHEMERAL });

    const channel = await fetchTextChannel(guild, config.channels.applications);
    if (!channel) return replyError(interaction, 'Başvurular kanalı bulunamadı.', 'Lütfen sunucu yöneticilerine bildir.');

    const answers = config.questions
      .map((question) => ({
        title: question.title,
        answer: interaction.fields.getTextInputValue(`${ui.IDS.applyQuestion}:${question.id}`).trim(),
      }))
      .filter(({ answer }) => answer);
    const previous = store.applicationsOf(guild.id, user.id);
    const number = store.nextApplicationNumber(guild.id);
    const id = `${guild.id}-${number}`;

    const app = store.setApplication(id, {
      id,
      guildId: guild.id,
      number,
      userId: user.id,
      username: user.username,
      accountCreatedAt: user.createdTimestamp,
      joinedAt: interaction.member?.joinedTimestamp ?? null,
      previous: { total: previous.length, rejected: previous.filter((a) => a.status === 'rejected').length },
      answers,
      reviewerRoleId: config.roles.reviewer,
      acceptRoleId: config.roles.accept,
      status: 'pending',
      createdAt: Date.now(),
      channelId: channel.id,
      messageId: null,
      meetingBy: null,
      meetingAt: null,
      reviewedBy: null,
      reviewedAt: null,
      note: null,
      roleGiven: null,
    });

    // İnceleyen rol etiketlenir, haberleri olur
    const message = await channel
      .send({
        components: [ui.applicationNotice(app, user)],
        flags: core.CV2,
        allowedMentions: { roles: config.roles.reviewer ? [config.roles.reviewer] : [] },
      })
      .catch((err) => {
        console.error('[basvuru] Başvuru kanala gönderilemedi:', err.message);
        return null;
      });
    // Gönderilemeyen başvuru kayıtta bekleyen kalıp kullanıcıyı kilitlemesin
    if (!message) {
      store.removeApplication(id);
      return replyError(interaction, 'Başvurun gönderilemedi.', 'Birkaç dakika sonra yeniden dene; sorun sürerse bir yetkiliye haber ver.');
    }
    store.updateApplication(id, { messageId: message.id });

    await respond(
      interaction,
      core.alert('Başvurun alındı.', 'İnceleme tamamlanınca sonucu sana DM üzerinden ileteceğiz.', 'success'),
    );
  } finally {
    submitting.delete(lockKey);
  }
}

// Başvurular kanalındaki Görüşmeye Çağır / Reddet (form açar) butonları ile görüşme kanalının sohbetindeki karar paneli
// (Devam Et / İptal Et). Eski mesajlardaki Onayla butonu, başvuran çağrılmadıysa görüşmeye çağırır, çağrıldıysa Devam Et gibi çalışır.
async function handleReviewButton(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const app = store.getApplication(id);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);

  if (action === 'red') return interaction.showModal(ui.reviewModal(app));
  if (action === 'bekle') {
    if (!app.meetingBy) return replyError(interaction, 'Başvuran henüz görüşmeye çağrılmadı.');
    await interaction.deferUpdate();
    await releaseMeeting(interaction.guild, app, { byId: interaction.user.id });
    return null;
  }
  if (action === 'devam' || (action === 'onay' && app.meetingBy)) return approve(interaction, app);
  return callToMeeting(interaction, app);
}

// Beklemeye alan yetkinin geri alma süresi sürüyorsa başkası görüşmeyi doğrudan üstlenemez, devir isteyebilir
const holdGuard = (app, interaction) =>
  Boolean(app.onHold && !app.onHold.pinged && app.onHold.until > Date.now() && interaction.user.id !== app.onHold.by && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));

// Başvuranı görüşmeye çağırır: başvuruyu üstlenir, ses kanallarının kilidini açar, başvurana DM atar. Hem butondan hem onaylanan
// devirden çağrılır; user: görüşmeyi yürüyecek yetkili. Beklemedeki görüşme üstlenildiyse eski bildirim ve panel güncellenir.
async function beginMeetingFor(guild, app, user) {
  const hold = app.onHold;
  clearTimeout(meetingHoldTimers.get(app.id));
  meetingHoldTimers.delete(app.id);
  // Kayıt await'ten önce yapılır, aynı anda basan ikinci kişi çağıran tarafın kontrolüne takılır
  store.updateApplication(app.id, {
    ownerId: user.id,
    meetingBy: user.id,
    meetingAt: Date.now(),
    meetingChannelId: voice.staffVoiceChannel(guild, user.id),
    onHold: null,
  });

  const applicant = await guild.client.users.fetch(app.userId).catch(() => null);
  // Buton başvuru mesajından ya da beklemedeki görüşmenin bildiriminden gelmiş olabilir; ikisi de kanaldan güncellenir
  await editMessage(guild, app.channelId, app.messageId, ui.applicationNotice(app, applicant));
  if (hold?.noticeId) await editMessage(guild, app.channelId, hold.noticeId, ui.meetingHoldNotice(app, 'taken'));
  if (hold?.panelMessageId) await editMessage(guild, hold.panelChannelId, hold.panelMessageId, ui.decisionPanel(app, 'resumed'));

  const until = await voice.grantAccess(guild, app, `Yetkili başvurusu #${core.pad(app.number)} görüşmesi`);
  const access = until ? { staffId: user.id, waitingIn: voice.staffVoiceChannel(guild, user.id), until } : null;
  const sent = await applicant?.send({ components: [ui.meetingDm(app, guild.name, access)], flags: core.CV2 }).catch(() => null);
  // İkisi zaten aynı görüşme kanalındaysa ses olayı gelmeyeceği için görüşme burada başlatılır
  await startMeeting(guild, app);
  return { access, sent };
}

// "Görüşmeye Çağır"
async function callToMeeting(interaction, app) {
  if (app.meetingBy) return replyError(interaction, 'Başvuran zaten görüşmeye çağrıldı.');
  if (holdGuard(app, interaction)) {
    return replyError(
      interaction,
      `Bu görüşmeyi <@${app.onHold.by}> beklemeye aldı, <t:${Math.floor(app.onHold.until / 1000)}:R> kadar yalnızca o geri alabilir.`,
      'Devralmak için bildirimdeki **Devralma İste** butonuyla ondan devir isteyebilirsin; süre dolunca herkes üstlenebilir.',
    );
  }
  await interaction.deferUpdate();
  const { access, sent } = await beginMeetingFor(interaction.guild, app, interaction.user);
  return respond(interaction, staffReport('Başvuran görüşmeye çağrıldı.', access, sent));
}

// "Devam Et": başvuru onaylanır, görüşme biter ve oryantasyonu kimin vereceği sorulur
async function approve(interaction, app) {
  if (!app.meetingBy) return replyError(interaction, 'Önce başvuranı görüşmeye çağırmalısın.');
  await interaction.deferUpdate();
  await endMeeting(interaction.guild, app);
  return orientation.askWhoOrients(interaction, app);
}

// Butona basan yetkiliye ses kanalı ve DM durumunu özetler
function staffReport(title, access, sent) {
  const lines = [
    access
      ? access.waitingIn
        ? `Ses kanallarının kilidi açıldı, başvurana seni <#${access.waitingIn}> kanalında beklediğin söylendi.`
        : 'Ses kanallarının kilidi açıldı. Bir görüşme kanalında olmadığın için başvurana kanallardan birine geçmesi söylendi.'
      : 'Ses kanallarının kilidi açılamadı, başvuran sunucuda olmayabilir.',
    sent ? 'Başvurana DM üzerinden haber verildi.' : "Başvuranın DM'si kapalı, kendisine ayrıca ulaşman gerekiyor.",
  ];
  return core.alert(title, lines.join('\n'), access && sent ? 'success' : 'warning');
}

// Aynı başvuru için kanal değiştirdikçe bildirim yağmasın diye son bildirim zamanları: başvuru:aşama -> zaman
const waitingNotified = new Map();
const WAITING_NOTIFY_COOLDOWN = 5 * 60 * 1000;
const cooledDown = (key) => {
  if (Date.now() - (waitingNotified.get(key) ?? 0) < WAITING_NOTIFY_COOLDOWN) return false;
  waitingNotified.set(key, Date.now());
  return true;
};

// Başvuran bir görüşme kanalına girince, görüşmeye çağıran ya da oryantasyonu verecek yetkili aynı kanalda değilse:
// kanalın sohbetine "yetkili bekleniyor" mesajı, başvurular kanalına başvuranın aşamasını söyleyen kayıt (oryantasyonu
// üstlenen yoksa yetkilileri etiketleyen bildirim) ve yetkiliye DM gider. Görüşme başladıysa bildirim yapılmaz.
async function notifyWaiting(newState) {
  const { guild, channelId } = newState;
  const waiting = store
    .applicationsOf(guild.id, newState.id)
    .filter(
      (a) =>
        (a.status === 'pending' && a.meetingBy && !a.meeting) ||
        (a.status === 'approved' && ['unassigned', 'waiting'].includes(a.orientation?.status)),
    );

  for (const app of waiting) {
    const stage = app.status === 'pending' ? 'meeting' : app.orientation.status === 'unassigned' ? 'unassigned' : 'orientation';
    const staffId = stage === 'meeting' ? app.meetingBy : stage === 'orientation' ? app.orientation.staffId : null;
    if (staffId && guild.voiceStates.cache.get(staffId)?.channelId === channelId) continue;
    if (!cooledDown(`${app.id}:${stage}`)) continue;

    // Üstlenen yokken kanalda tek bir bekleme mesajı durur (yetkili girince güncellenir); aynı kanalda yeniden gönderilmez
    if (!(stage === 'unassigned' && app.orientation.waitChat?.channelId === channelId)) {
      const chat = await fetchTextChannel(guild, channelId);
      const message = await chat
        ?.send({ components: [ui.waitingChat(app, stage)], flags: core.CV2, allowedMentions: { users: [app.userId, staffId].filter(Boolean) } })
        .catch(() => null);
      if (message && stage === 'unassigned') orientation.trackWaitChat(app, channelId, message.id);
      else if (message) store.updateApplication(app.id, { waitingChat: { channelId, messageId: message.id, stage } });
    }

    if (stage === 'unassigned') {
      // Beklemeye alan yetkinin geri alma süresinde yetkililer etiketlenmez
      if (!orientation.isGuarded(app)) await orientation.postPending(guild, app, channelId, 'waiting');
      continue;
    }
    await log.send(guild, app, ui.waitingLog(app, stage, channelId), [], [staffId]);
    const staff = await guild.client.users.fetch(staffId).catch(() => null);
    await staff
      ?.send({ components: [ui.applicantWaitingDm(app, guild.name, channelId, stage === 'orientation')], flags: core.CV2 })
      .catch(() => {});
  }
}

// Görüşmeye çağıran yetkili başvurandan önce bir görüşme kanalına girince başvurana "yetkilin seni bekliyor" DM'i gider
// (oryantasyon sırasındaki karşılığı oryantasyon sisteminde)
async function notifyApplicantOfStaff(newState) {
  const { guild, channelId } = newState;
  for (const app of store.inMeeting().filter((a) => a.meetingBy === newState.id && !a.meeting)) {
    if (guild.voiceStates.cache.get(app.userId)?.channelId === channelId) continue;
    if (!cooledDown(`${app.id}:staff-meeting`)) continue;
    const applicant = await guild.client.users.fetch(app.userId).catch(() => null);
    await applicant?.send({ components: [ui.meetingStaffWaitingDm(app, guild.name, channelId)], flags: core.CV2 }).catch(() => {});
  }
}

// Görüşmeyi bitmiş sayar ve kayıt kanalındaki mesajını günceller (başvuran çıkınca ya da karar verilince)
async function endMeeting(guild, app) {
  clearAwayTimer(app);
  clearApplicantTimers(app);
  for (const key of [...waitingNotified.keys()]) if (key.startsWith(`${app.id}:`)) waitingNotified.delete(key);
  if (!app.meeting?.startedAt || app.meeting.endedAt) return;
  store.updateApplication(app.id, { meeting: { ...app.meeting, endedAt: Date.now() } });
  await log.edit(guild, app.meeting.messageId, ui.meetingLog(app));
}

// Görüşmeye çağıran yetkili ve başvuran aynı görüşme kanalındaysa görüşmeyi başlatır: kayıt kanalına "Görüşme Başladı"
// yazılır ve kanalın sohbetine karar paneli (Devam Et / İptal Et) atılır. Her başvuru için bir görüşme kaydı tutulur.
async function startMeeting(guild, app) {
  if (app.meeting || app.status !== 'pending' || !app.meetingBy) return false;
  const applicantChannel = guild.voiceStates.cache.get(app.userId)?.channelId;
  if (!voice.isRecruitmentChannel(applicantChannel) || guild.voiceStates.cache.get(app.meetingBy)?.channelId !== applicantChannel) {
    return false;
  }
  // Kayıt await'ten önce yapılır, art arda gelen olaylarda iki kez başlatılmaz
  store.updateApplication(app.id, {
    meeting: { channelId: applicantChannel, startedAt: Date.now(), endedAt: null, messageId: null, panelMessageId: null, applicantLeaves: 0, applicantAwaySince: null, staffAwaySince: null },
  });
  const message = await log.send(guild, app, ui.meetingLog(app));
  if (message) {
    store.updateApplication(app.id, { meeting: { ...app.meeting, messageId: message.id } });
    // Mesaj gönderilirken başvuran çıktıysa (görüşme bitti) mesaj "Görüşme Başladı" halinde kalmasın
    if (app.meeting.endedAt) await log.edit(guild, message.id, ui.meetingLog(app));
  }

  await log.closeWaiting(guild, app);
  const chat = await fetchTextChannel(guild, applicantChannel);
  const panel = await chat
    ?.send({ components: [ui.decisionPanel(app)], flags: core.CV2, allowedMentions: { users: [app.meetingBy, app.userId] } })
    .catch((err) => console.error('[basvuru] Karar paneli gönderilemedi:', err.message));
  if (panel) {
    store.updateApplication(app.id, { meeting: { ...app.meeting, panelChannelId: applicantChannel, panelMessageId: panel.id } });
  }
  return true;
}

// Görüşmeyi beklemeye alır. Elle bırakıldıysa beklemeye alan yetkinin geri alma süresi (holdProtectMinutes) başlar: bu sürede
// kimse etiketlenmez, başkaları devir isteyebilir, süre dolunca inceleyen rol etiketlenir ve herkes üstlenebilir. Yetkili kanaldan
// uzun süre ayrıldığı için (auto) bırakıldıysa süre zaten dolmuştur, inceleyen rol hemen etiketlenir. Başvuru yeniden sahipsiz olur,
// görüşme kaydı kapanır, karar paneli "beklemede"ye döner.
const meetingHoldTimers = new Map();
async function releaseMeeting(guild, app, { byId, auto = false }) {
  if (app.status !== 'pending' || !app.meetingBy) return false;
  const panel = { channelId: app.meeting?.panelChannelId, messageId: app.meeting?.panelMessageId };
  await endMeeting(guild, app);
  const now = Date.now();
  store.updateApplication(app.id, {
    ownerId: null,
    meetingBy: null,
    meetingAt: null,
    meetingChannelId: null,
    meeting: null,
    onHold: {
      by: byId,
      auto,
      at: now,
      until: auto ? now : now + config.holdProtectMinutes * 60 * 1000,
      pinged: auto,
      panelChannelId: panel.channelId,
      panelMessageId: panel.messageId,
      requests: [],
    },
  });

  await editMessage(guild, panel.channelId, panel.messageId, ui.decisionPanel(app, 'hold'));
  const applicant = await guild.client.users.fetch(app.userId).catch(() => null);
  await editMessage(guild, app.channelId, app.messageId, ui.applicationNotice(app, applicant));
  const notice = await log.send(
    guild,
    app,
    ui.meetingHoldNotice(app, auto ? 'open' : 'protected'),
    auto && app.reviewerRoleId ? [app.reviewerRoleId] : [],
    [],
    { reply: false },
  );
  if (notice) store.updateApplication(app.id, { onHold: { ...app.onHold, noticeId: notice.id } });
  if (!auto) scheduleMeetingHold(guild, app);
  return true;
}

function scheduleMeetingHold(guild, app) {
  clearTimeout(meetingHoldTimers.get(app.id));
  meetingHoldTimers.set(
    app.id,
    setTimeout(
      () => {
        meetingHoldTimers.delete(app.id);
        expireMeetingHold(guild, app.id).catch((err) => console.error('[basvuru] Bekleme süresi işlenemedi:', err.message));
      },
      Math.max(0, app.onHold.until - Date.now()),
    ),
  );
}

// Geri alma süresi dolunca: eski bildirim kayıt olur, inceleyen rolü etiketleyen yeni bildirim gider, panel "yetkili bekleniyor"a döner
async function expireMeetingHold(guild, appId) {
  const app = store.getApplication(appId);
  if (!app || app.status !== 'pending' || app.meetingBy || !app.onHold || app.onHold.pinged) return;
  store.updateApplication(app.id, { onHold: { ...app.onHold, pinged: true } });
  await editMessage(guild, app.channelId, app.onHold.noticeId, ui.meetingHoldNotice(app, 'superseded'));
  const notice = await log.send(guild, app, ui.meetingHoldNotice(app, 'open'), app.reviewerRoleId ? [app.reviewerRoleId] : [], [], { reply: false });
  if (notice) store.updateApplication(app.id, { onHold: { ...app.onHold, noticeId: notice.id } });
  await editMessage(guild, app.onHold.panelChannelId, app.onHold.panelMessageId, ui.decisionPanel(app, 'hold'));
}

// Görüşmeyi yürüten yetkili görüşme kanallarından ayrılınca süre başlar (bildirim gitmez, kararın paneli süreyi gösterir);
// süre içinde dönmezse görüşme beklemeye alınır ve başka bir yetkili çağrılır
const awayTimers = new Map();
function clearAwayTimer(app) {
  clearTimeout(awayTimers.get(app.id));
  awayTimers.delete(app.id);
}

async function staffAway(guild, app) {
  if (app.meeting.staffAwaySince) return;
  store.updateApplication(app.id, { meeting: { ...app.meeting, staffAwaySince: Date.now() } });
  await editMessage(guild, app.meeting.panelChannelId, app.meeting.panelMessageId, ui.decisionPanel(app));
  clearAwayTimer(app);
  awayTimers.set(
    app.id,
    setTimeout(() => {
      awayTimers.delete(app.id);
      const fresh = store.getApplication(app.id);
      if (!fresh?.meeting?.staffAwaySince || fresh.meetingBy !== app.meetingBy) return;
      if (voice.isRecruitmentChannel(guild.voiceStates.cache.get(fresh.meetingBy)?.channelId)) return;
      releaseMeeting(guild, fresh, { byId: fresh.meetingBy, auto: true }).catch((err) => console.error('[basvuru] Görüşme beklemeye alınamadı:', err.message));
    }, config.meetingStaffGraceMinutes * 60 * 1000),
  );
}

async function staffBack(guild, app) {
  clearAwayTimer(app);
  if (!app.meeting?.staffAwaySince) return;
  store.updateApplication(app.id, { meeting: { ...app.meeting, staffAwaySince: null } });
  await editMessage(guild, app.meeting.panelChannelId, app.meeting.panelMessageId, ui.decisionPanel(app));
}

// Görüşme sırasında başvuran kanaldan ayrılırsa (kısa kopmalar sayılmaz) ayrılma hakkı düşer; süre içinde dönmezse ya da hakkı
// bitince başvuru otomatik reddedilir ve sebep başvuruya (ve siciline) yazılır
const applicantTimers = new Map();
function clearApplicantTimers(app) {
  for (const key of [...applicantTimers.keys()]) {
    if (key.startsWith(`${app.id}:`)) {
      clearTimeout(applicantTimers.get(key));
      applicantTimers.delete(key);
    }
  }
}
function setApplicantTimer(key, ms, fn) {
  clearTimeout(applicantTimers.get(key));
  applicantTimers.set(
    key,
    setTimeout(() => {
      applicantTimers.delete(key);
      Promise.resolve(fn()).catch((err) => console.error('[basvuru] Başvuran ayrılma işlemi hatası:', err.message));
    }, ms),
  );
}

async function autoRejectMeeting(guild, appId, reason) {
  const app = store.getApplication(appId);
  if (!app || app.status !== 'pending') return;
  // Karar await'ten önce kaydedilir
  store.updateApplication(app.id, { status: 'rejected', reviewedBy: null, reviewedAt: Date.now(), note: reason, autoRejected: true });
  await endMeeting(guild, app);

  const applicant = await guild.client.users.fetch(app.userId).catch(() => null);
  await editMessage(guild, app.channelId, app.messageId, ui.applicationNotice(app, applicant));
  await editMessage(guild, app.meeting?.panelChannelId, app.meeting?.panelMessageId, ui.decisionPanel(app, 'rejected'));
  await voice.lockAfterLeave(guild, app, `Yetkili başvurusu #${core.pad(app.number)} otomatik reddedildi`);
  await applicant?.send({ components: [ui.resultDm(app, guild.name, reapplyAt(app.guildId, app.userId))], flags: core.CV2 }).catch(() => {});
  await log.send(guild, app, ui.decisionPanel(app, 'rejected'));
}

async function applicantLeft(guild, appId) {
  const app = store.getApplication(appId);
  const m = app?.meeting;
  if (!m || m.endedAt || app.status !== 'pending' || m.applicantAwaySince) return;
  if (voice.isRecruitmentChannel(guild.voiceStates.cache.get(app.userId)?.channelId)) return;

  const leaves = (m.applicantLeaves ?? 0) + 1;
  store.updateApplication(app.id, { meeting: { ...m, applicantLeaves: leaves, applicantAwaySince: Date.now() } });
  if (leaves >= config.meetingMaxApplicantLeaves) {
    return autoRejectMeeting(guild, app.id, `Başvuran görüşme sırasında ${leaves} kez kanaldan ayrıldı.`);
  }
  await editMessage(guild, m.panelChannelId, m.panelMessageId, ui.decisionPanel(app));
  setApplicantTimer(`${app.id}:deadline`, config.meetingApplicantGraceMinutes * 60 * 1000, () => {
    const fresh = store.getApplication(app.id);
    if (!fresh?.meeting?.applicantAwaySince || voice.isRecruitmentChannel(guild.voiceStates.cache.get(fresh.userId)?.channelId)) return;
    return autoRejectMeeting(guild, app.id, `Başvuran görüşme sırasında kanaldan ayrıldı ve ${config.meetingApplicantGraceMinutes} dakika içinde geri dönmedi.`);
  });
}

async function applicantBack(guild, app) {
  clearApplicantTimers(app);
  if (!app.meeting?.applicantAwaySince) return;
  store.updateApplication(app.id, { meeting: { ...app.meeting, applicantAwaySince: null } });
  await editMessage(guild, app.meeting.panelChannelId, app.meeting.panelMessageId, ui.decisionPanel(app));
}

// Görüşme kanallarındaki girişlerde görüşmeyi başlatır; görüşme sırasında başvuran ayrılıp dönünce süre başlatılır / durdurulur;
// görüşmeyi yürüten yetkili ayrılıp dönünce de süre başlatılır / durdurulur
async function trackMeeting(oldState, newState) {
  const { guild } = newState;
  const related = store.inMeeting().filter((a) => a.userId === newState.id || a.meetingBy === newState.id);

  for (const app of related) {
    if (!app.meeting) {
      await startMeeting(guild, app);
    } else if (app.meeting.endedAt) {
      continue;
    } else if (newState.id === app.userId) {
      if (voice.isRecruitmentChannel(newState.channelId)) {
        clearTimeout(applicantTimers.get(`${app.id}:confirm`));
        applicantTimers.delete(`${app.id}:confirm`);
        await applicantBack(guild, app);
      } else {
        setApplicantTimer(`${app.id}:confirm`, config.meetingConfirmSeconds * 1000, () => applicantLeft(guild, app.id));
      }
    } else if (newState.id === app.meetingBy) {
      const applicantHere = voice.isRecruitmentChannel(guild.voiceStates.cache.get(app.userId)?.channelId);
      if (voice.isRecruitmentChannel(newState.channelId)) await staffBack(guild, app);
      else if (applicantHere) await staffAway(guild, app);
    }
  }
}

// Görüşme kanallarındaki giriş çıkışlar: kilitleme zamanlayıcıları, görüşme kaydı ve "bekleniyor" bildirimleri
async function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;
  voice.handleVoiceUpdate(oldState, newState);
  if (oldState.channelId === newState.channelId) return;
  if (!voice.isRecruitmentChannel(oldState.channelId) && !voice.isRecruitmentChannel(newState.channelId)) return;

  await trackMeeting(oldState, newState);
  if (voice.isRecruitmentChannel(newState.channelId)) {
    await notifyWaiting(newState);
    await notifyApplicantOfStaff(newState);
  }
}

// Mesajı kanalından bulup günceller (karar paneli gibi, etkileşimin bağlı olmadığı mesajlar için)
async function editMessage(guild, channelId, messageId, container) {
  if (!channelId || !messageId) return;
  const channel = await fetchTextChannel(guild, channelId);
  await channel?.messages.edit(messageId, { components: [container], allowedMentions: { parse: [] } }).catch(() => {});
}

// Başvuranın "Hatırlat" butonu: görüşme / oryantasyon yetkilisini beklerken 5 dakikada bir yetkililere "bekliyorum" bildirimi gönderir.
// Oryantasyonu üstlenen yoksa yetkili rolü etiketlenir, varsa yetkili etiketlenir ve DM alır.
const REMIND_COOLDOWN = 5 * 60 * 1000;
// Hatırlat butonunu süre dolana kadar pasif gösterir, sonra kanaldaki mesajı yeniden düzenleyip açar (başvuru hâlâ aynı aşamadaysa)
const remindReenableTimers = new Map();
function scheduleRemindReenable(guild, app, stage) {
  clearTimeout(remindReenableTimers.get(app.id));
  remindReenableTimers.set(
    app.id,
    setTimeout(async () => {
      remindReenableTimers.delete(app.id);
      const fresh = store.getApplication(app.id);
      const chat = fresh?.waitChatMessage;
      if (!chat || !stillWaiting(fresh, stage)) return;
      const channel = await fetchTextChannel(guild, chat.channelId);
      const container = stage === 'hold' ? ui.decisionPanel(fresh, 'hold') : ui.waitingChat(fresh, stage);
      await channel?.messages.edit(chat.messageId, { components: [container], allowedMentions: { parse: [] } }).catch(() => {});
    }, REMIND_COOLDOWN),
  );
}
const stillWaiting = (app, stage) =>
  stage === 'meeting'
    ? app.status === 'pending' && app.meetingBy && !app.meeting
    : stage === 'hold'
      ? app.status === 'pending' && !app.meetingBy && app.onHold
      : stage === 'unassigned'
      ? app.status === 'approved' && app.orientation?.status === 'unassigned'
      : app.status === 'approved' && app.orientation?.status === 'waiting';

async function handleRemind(interaction) {
  const app = store.getApplication(interaction.customId.split(':')[1]);
  if (!app) return replyError(interaction, 'Bu başvuru bulunamadı.');
  if (interaction.user.id !== app.userId) return replyError(interaction, 'Bu butonu sadece başvuran kullanabilir.');

  const stage =
    app.status === 'pending' && app.meetingBy && !app.meeting
      ? 'meeting'
      : app.status === 'pending' && !app.meetingBy && app.onHold
        ? 'hold'
        : app.status === 'approved' && app.orientation?.status === 'unassigned'
          ? 'unassigned'
          : app.status === 'approved' && app.orientation?.status === 'waiting'
            ? 'orientation'
            : null;
  if (!stage) return replyError(interaction, 'Şu an yetkili beklenen bir işlemin yok.');

  const { guild } = interaction;
  const channelId = guild.voiceStates.cache.get(app.userId)?.channelId;
  if (!voice.isRecruitmentChannel(channelId)) return replyError(interaction, 'Önce bir görüşme kanalına girmelisin.');
  const holdUntil = stage === 'hold' ? app.onHold.until : stage === 'unassigned' && orientation.isGuarded(app) ? app.orientation.holdUntil : 0;
  if (holdUntil > Date.now()) {
    return replyError(interaction, 'Yetkili işlemi geri alabilir.', `Geri alma süresi <t:${Math.floor(holdUntil / 1000)}:R> dolunca yetkililere haber verilir; o zaman buradan hatırlatabilirsin.`);
  }
  const staffId = stage === 'meeting' ? app.meetingBy : stage === 'orientation' ? app.orientation.staffId : null;
  if (staffId && guild.voiceStates.cache.get(staffId)?.channelId === channelId) return replyError(interaction, 'Yetkilin zaten kanalda.');

  const next = (app.remindedAt ?? 0) + REMIND_COOLDOWN;
  if (next > Date.now()) {
    return replyError(interaction, 'Çok sık hatırlatıyorsun.', `<t:${Math.floor(next / 1000)}:R> tekrar hatırlatabilirsin.`);
  }
  store.updateApplication(app.id, { remindedAt: Date.now(), waitChatMessage: { channelId, messageId: interaction.message.id } });

  // Buton süre dolana kadar pasifleşir, süre dolunca aynı mesaj yeniden düzenlenip açılır
  await interaction.update({ components: [stage === 'hold' ? ui.decisionPanel(app, 'hold', true) : ui.waitingChat(app, stage, undefined, true)], allowedMentions: { parse: [] } });
  scheduleRemindReenable(guild, app, stage);

  if (stage === 'hold') {
    await log.send(guild, app, ui.meetingHoldNotice(app, 'remind'), app.reviewerRoleId ? [app.reviewerRoleId] : [], [], { reply: false });
  } else if (stage === 'unassigned') {
    await orientation.postPending(guild, app, channelId, 'waiting', true);
  } else {
    await log.send(guild, app, ui.waitingLog(app, stage, channelId, true), [], [staffId]);
    const staff = await guild.client.users.fetch(staffId).catch(() => null);
    await staff?.send({ components: [ui.applicantWaitingDm(app, guild.name, channelId, stage === 'orientation', true)], flags: core.CV2 }).catch(() => {});
  }
  return interaction.followUp({
    components: [core.alert('Yetkililere hatırlatıldı.', `<t:${Math.floor((Date.now() + REMIND_COOLDOWN) / 1000)}:R> tekrar hatırlatabilirsin.`, 'success')],
    flags: core.EPHEMERAL_CV2,
    allowedMentions: { parse: [] },
  });
}

// ── Devir isteği ──────────────────────────────────────────────────────────────
// Beklemeye alınmış bir işlemin geri alma süresinde başka bir yetkili "Devralma İste" ile beklemeye alan yetkiden devir isteyebilir.
// İstek ona DM ile gider (DM kapalıysa başvurular kanalına): onaylarsa işlem isteyene geçer, reddederse süre devam eder.
const holdStageOf = (app) =>
  app.status === 'pending' && !app.meetingBy && app.onHold
    ? 'meeting'
    : app.status === 'approved' && app.orientation?.status === 'unassigned' && app.orientation.holdBy
      ? 'orientation'
      : null;
const holdInfo = (app, stage) =>
  stage === 'meeting'
    ? { by: app.onHold.by, until: app.onHold.until, pinged: app.onHold.pinged, requests: (app.onHold.requests ??= []) }
    : { by: app.orientation.holdBy, until: app.orientation.holdUntil, pinged: app.orientation.holdPinged, requests: (app.orientation.holdRequests ??= []) };

async function handleTransfer(interaction) {
  const [, id, action, requesterId] = interaction.customId.split(':');
  const app = store.getApplication(id);
  if (!app) return replyError(interaction, 'Bu başvuru bulunamadı.');
  const { client } = interaction;
  const guild = client.guilds.cache.get(guildId);
  const stage = holdStageOf(app);

  if (action === 'iste') {
    if (!stage) return replyError(interaction, 'Bu işlem artık beklemede değil.', 'Başvuru mesajından doğrudan üstlenebilirsin.');
    const hold = holdInfo(app, stage);
    const roles = stage === 'meeting' ? [app.reviewerRoleId, ...config.roles.reviewerExtra] : orientation.orienterRoles(app);
    if (!isStaff(interaction, roles)) return replyError(interaction, 'Bu işlemi devralmak için yetkin yok.', `Gerekli roller: ${roles.filter(Boolean).map((r) => `<@&${r}>`).join(', ')}`);
    if (interaction.user.id === hold.by) return replyError(interaction, 'Bu işlemi sen beklemeye aldın.', 'Doğrudan üstlenebilirsin.');
    if (hold.pinged || hold.until <= Date.now()) return replyError(interaction, 'Geri alma süresi doldu.', 'Artık doğrudan üstlenebilirsin.');
    if (hold.requests.some((r) => r.by === interaction.user.id && r.status === 'pending')) {
      return replyError(interaction, 'Zaten bir devir isteğin var.', `<@${hold.by}> yanıtlayana ya da süre dolana kadar bekle.`);
    }
    hold.requests.push({ by: interaction.user.id, at: Date.now(), status: 'pending' });
    store.updateApplication(app.id, {});

    const container = ui.transferRequestDm(app, interaction.user.id, stage);
    const holder = await client.users.fetch(hold.by).catch(() => null);
    const sent = await holder?.send({ components: [container], flags: core.CV2 }).then(() => true, () => false);
    // DM kapalıysa istek başvurular kanalına düşer, beklemeye alan yetkili etiketlenir
    if (!sent) await log.send(guild, app, container, [], [hold.by], { reply: false });
    return respond(
      interaction,
      core.alert(
        'Devir isteği gönderildi.',
        `<@${hold.by}> onaylarsa işlem sana geçer; reddederse ya da cevap vermezse <t:${Math.floor(hold.until / 1000)}:R> süre dolunca herhangi bir yetkili üstlenebilir.`,
        'success',
      ),
    );
  }

  // Onay / ret: sadece beklemeye alan yetkili (ya da yönetici) yanıtlar
  if (!stage) {
    return interaction.update({ components: [ui.transferRequestDm(app, requesterId, app.status === 'pending' ? 'meeting' : 'orientation', 'stale')], allowedMentions: { parse: [] } });
  }
  const hold = holdInfo(app, stage);
  if (interaction.user.id !== hold.by && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return replyError(interaction, 'Bu isteği sadece işlemi beklemeye alan yetkili yanıtlayabilir.');
  }
  const request = hold.requests.find((r) => r.by === requesterId && r.status === 'pending');
  if (request) request.status = action === 'evet' ? 'approved' : 'rejected';
  store.updateApplication(app.id, {});
  const requester = await client.users.fetch(requesterId).catch(() => null);

  if (action === 'hayir') {
    await interaction.update({ components: [ui.transferRequestDm(app, requesterId, stage, 'rejected')], allowedMentions: { parse: [] } });
    await requester?.send({ components: [ui.transferResultDm(app, hold.by, stage, 'rejected')], flags: core.CV2 }).catch(() => {});
    return null;
  }

  if (!requester || hold.pinged || hold.until <= Date.now()) {
    return interaction.update({ components: [ui.transferRequestDm(app, requesterId, stage, 'stale')], allowedMentions: { parse: [] } });
  }
  await interaction.deferUpdate();
  if (stage === 'meeting') await beginMeetingFor(guild, app, requester);
  else await orientation.claimFor(guild, app, requester);
  await interaction.editReply({ components: [ui.transferRequestDm(app, requesterId, stage, 'approved')], allowedMentions: { parse: [] } });
  await requester.send({ components: [ui.transferResultDm(app, hold.by, stage, 'approved')], flags: core.CV2 }).catch(() => {});
  return null;
}

// Reddet formu gönderilince başvuruyu reddeder: başvuru mesajı ve (varsa) görüşme kanalındaki karar paneli güncellenir,
// başvurana sebep DM ile iletilir ve görüşme kanalları kilitlenir. Form başvurular kanalındaki mesajdan ya da karar panelinden açılmış olabilir.
async function handleReviewSubmit(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const app = store.getApplication(id);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);
  if (action !== 'red') return replyError(interaction, 'Bu işlem artık kullanılmıyor.', 'Başvuruyu görüşme sırasında gelen panelden onaylayabilirsin.');

  // Karar await'ten önce kaydedilir, aynı anda karar veren ikinci kişi yukarıdaki kontrole takılır
  store.updateApplication(id, {
    status: 'rejected',
    reviewedBy: interaction.user.id,
    reviewedAt: Date.now(),
    note: interaction.fields.getTextInputValue(ui.IDS.reviewNote).trim() || null,
  });
  await interaction.deferUpdate();
  await endMeeting(interaction.guild, app);

  const applicant = await interaction.client.users.fetch(app.userId).catch(() => null);
  await editMessage(interaction.guild, app.channelId, app.messageId, ui.applicationNotice(app, applicant));
  const panelId = app.meeting?.panelMessageId;
  if (panelId) {
    const closed = ui.decisionPanel(app, 'rejected');
    if (interaction.message?.id === panelId) await interaction.editReply({ components: [closed], allowedMentions: { parse: [] } });
    else await editMessage(interaction.guild, app.meeting.panelChannelId, panelId, closed);
  }
  await voice.lockAfterLeave(interaction.guild, app, `Yetkili başvurusu #${core.pad(app.number)} reddedildi`);

  const sent = await applicant
    ?.send({ components: [ui.resultDm(app, interaction.guild.name, reapplyAt(app.guildId, app.userId))], flags: core.CV2 })
    .catch(() => null);
  if (!sent) {
    await respond(
      interaction,
      core.alert('Başvurana DM gönderilemedi.', "DM'si kapalı olabilir, sonucu kendisine ayrıca iletmen gerekiyor.", 'warning'),
    );
  }
}

module.exports = {
  name: 'basvuru',
  buttons: { [ui.IDS.apply]: handleApplyButton },
  modals: { [ui.IDS.applyModal]: handleApplySubmit },
  prefixed: [
    [ui.IDS.review, handleReviewButton],
    [ui.IDS.reviewModal, handleReviewSubmit],
    [ui.IDS.remind, handleRemind],
    [ui.IDS.transfer, handleTransfer],
  ],
  events: {
    [Events.ClientReady]: handleReady,
    // Başvuran kanala girince yetkiliye haber verir, görüşmeden sonra ayrılınca kanalları tekrar kilitler
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
  },
};
