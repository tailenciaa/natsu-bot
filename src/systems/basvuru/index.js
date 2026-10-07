// Yetkili alım sistemi: yetkili alım kanalındaki panelden "Başvuru Yap" ile form doldurulur, başvuru başvurular
// kanalına gider. Panel bot açılınca kanala kendiliğinden gönderilir. İnceleyen rol Görüşmeye Çağır / Reddet ile karar verir.
// Görüşmeye çağıran yetkili başvuruyu üstlenir, sonraki kararları sadece o (ya da yöneticiler) verebilir.
// Görüşmeye çağrılan başvurana görüşme ses kanallarının kilidi açılır (voice.js), görüşmeden çıkınca tekrar kilitlenir.
// Başvuran ve yetkili aynı görüşme kanalına girince görüşme başlar ve kanalın sohbetine karar paneli gelir: Devam Et ile
// başvuru onaylanır, oryantasyonu kimin vereceği sorulur (oryantasyon sistemi); İptal Et ile reddedilir ve kanallar kilitlenir.
// Yetkili ya da başvuran kanala diğerinden önce girerse kanalın sohbetine, başvurular kanalına ve karşı tarafın DM'ine
// "bekleniyor" bildirimi gider.
const { Events, PermissionFlagsBits } = require('discord.js');
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

// Bot açılınca paneli yetkili alım kanalına gönderir (değişmediyse dokunmaz) ve süresi dolan ses erişimlerini kapatmaya başlar
function handleReady(client) {
  voice.startSweeper(client);
  // Bot kapalıyken ikisi de aynı kanala girdiyse görüşme (ve karar paneli) açılışta başlatılır
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    for (const app of store.inMeeting()) {
      startMeeting(guild, app).catch((err) => console.error('[basvuru] Görüşme başlatılamadı:', err.message));
    }
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

// "Görüşmeye Çağır": başvuruyu üstlenir, ses kanallarının kilidini açar, başvurana DM atar
async function callToMeeting(interaction, app) {
  if (app.meetingBy) return replyError(interaction, 'Başvuran zaten görüşmeye çağrıldı.');
  // Kayıt await'ten önce yapılır, aynı anda basan ikinci kişi yukarıdaki kontrole takılır
  store.updateApplication(app.id, {
    ownerId: interaction.user.id,
    meetingBy: interaction.user.id,
    meetingAt: Date.now(),
    meetingChannelId: voice.staffVoiceChannel(interaction.guild, interaction.user.id),
    onHold: null,
  });

  await interaction.deferUpdate();
  const applicant = await interaction.client.users.fetch(app.userId).catch(() => null);
  await interaction.editReply({ components: [ui.applicationNotice(app, applicant)], allowedMentions: { parse: [] } });

  const access = await openVoice(interaction, app, `Yetkili başvurusu #${core.pad(app.number)} görüşmesi`);
  const sent = await applicant
    ?.send({ components: [ui.meetingDm(app, interaction.guild.name, access)], flags: core.CV2 })
    .catch(() => null);
  // İkisi zaten aynı görüşme kanalındaysa ses olayı gelmeyeceği için görüşme burada başlatılır
  await startMeeting(interaction.guild, app);
  return respond(interaction, staffReport('Başvuran görüşmeye çağrıldı.', access, sent));
}

// "Devam Et": başvuru onaylanır, görüşme biter ve oryantasyonu kimin vereceği sorulur
async function approve(interaction, app) {
  if (!app.meetingBy) return replyError(interaction, 'Önce başvuranı görüşmeye çağırmalısın.');
  await interaction.deferUpdate();
  await endMeeting(interaction.guild, app);
  return orientation.askWhoOrients(interaction, app);
}

// Başvurana görüşme ses kanallarını açar; DM'e eklenecek ses bölümü bilgisini döner (açılamazsa null)
async function openVoice(interaction, app, reason) {
  const until = await voice.grantAccess(interaction.guild, app, reason);
  if (!until) return null;
  return { staffId: interaction.user.id, waitingIn: voice.staffVoiceChannel(interaction.guild, interaction.user.id), until };
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
    }

    if (stage === 'unassigned') {
      await orientation.postPending(guild, app, channelId, 'waiting');
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
    meeting: { channelId: applicantChannel, startedAt: Date.now(), endedAt: null, messageId: null, panelMessageId: null },
  });
  const message = await log.send(guild, app, ui.meetingLog(app));
  if (message) {
    store.updateApplication(app.id, { meeting: { ...app.meeting, messageId: message.id } });
    // Mesaj gönderilirken başvuran çıktıysa (görüşme bitti) mesaj "Görüşme Başladı" halinde kalmasın
    if (app.meeting.endedAt) await log.edit(guild, message.id, ui.meetingLog(app));
  }

  const chat = await fetchTextChannel(guild, applicantChannel);
  const panel = await chat
    ?.send({ components: [ui.decisionPanel(app)], flags: core.CV2, allowedMentions: { users: [app.meetingBy, app.userId] } })
    .catch((err) => console.error('[basvuru] Karar paneli gönderilemedi:', err.message));
  if (panel) {
    store.updateApplication(app.id, { meeting: { ...app.meeting, panelChannelId: applicantChannel, panelMessageId: panel.id } });
  }
  return true;
}

// Görüşmeyi beklemeye alır (yetkili elle bıraktıysa ya da kanaldan uzun süre ayrıldıysa): başvuru yeniden sahipsiz olur, görüşme
// kaydı kapanır, karar paneli "beklemede"ye döner ve başvurular kanalına inceleyen rolü etiketleyen bildirim gider.
// Başvuru mesajındaki Görüşmeye Çağır butonuna ilk basan yetkili görüşmeyi sürdürür.
async function releaseMeeting(guild, app, { byId, auto = false }) {
  if (app.status !== 'pending' || !app.meetingBy) return false;
  const panel = { channelId: app.meeting?.panelChannelId, messageId: app.meeting?.panelMessageId };
  await endMeeting(guild, app);
  store.updateApplication(app.id, {
    ownerId: null,
    meetingBy: null,
    meetingAt: null,
    meetingChannelId: null,
    meeting: null,
    onHold: { by: byId, auto, at: Date.now() },
  });

  await editMessage(guild, panel.channelId, panel.messageId, ui.decisionPanel(app, 'hold'));
  const applicant = await guild.client.users.fetch(app.userId).catch(() => null);
  await editMessage(guild, app.channelId, app.messageId, ui.applicationNotice(app, applicant));
  await log.send(guild, app, ui.meetingHoldNotice(app), app.reviewerRoleId ? [app.reviewerRoleId] : []);
  return true;
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

// Görüşme kanallarındaki girişlerde görüşmeyi başlatır; başvuran görüşme kanallarından çıkınca görüşme bitmiş sayılır;
// görüşmeyi yürüten yetkili ayrılıp dönünce süre başlatılır / durdurulur
async function trackMeeting(oldState, newState) {
  const { guild } = newState;
  const related = store.inMeeting().filter((a) => a.userId === newState.id || a.meetingBy === newState.id);

  for (const app of related) {
    if (!app.meeting) {
      await startMeeting(guild, app);
    } else if (newState.id === app.userId && !voice.isRecruitmentChannel(newState.channelId)) {
      await endMeeting(guild, app);
    } else if (newState.id === app.meetingBy && !app.meeting.endedAt) {
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
async function handleRemind(interaction) {
  const app = store.getApplication(interaction.customId.split(':')[1]);
  if (!app) return replyError(interaction, 'Bu başvuru bulunamadı.');
  if (interaction.user.id !== app.userId) return replyError(interaction, 'Bu butonu sadece başvuran kullanabilir.');

  const stage =
    app.status === 'pending' && app.meetingBy && !app.meeting
      ? 'meeting'
      : app.status === 'approved' && app.orientation?.status === 'unassigned'
        ? 'unassigned'
        : app.status === 'approved' && app.orientation?.status === 'waiting'
          ? 'orientation'
          : null;
  if (!stage) return replyError(interaction, 'Şu an yetkili beklenen bir işlemin yok.');

  const { guild } = interaction;
  const channelId = guild.voiceStates.cache.get(app.userId)?.channelId;
  if (!voice.isRecruitmentChannel(channelId)) return replyError(interaction, 'Önce bir görüşme kanalına girmelisin.');
  const staffId = stage === 'meeting' ? app.meetingBy : stage === 'orientation' ? app.orientation.staffId : null;
  if (staffId && guild.voiceStates.cache.get(staffId)?.channelId === channelId) return replyError(interaction, 'Yetkilin zaten kanalda.');

  const next = (app.remindedAt ?? 0) + REMIND_COOLDOWN;
  if (next > Date.now()) {
    return replyError(interaction, 'Çok sık hatırlatıyorsun.', `<t:${Math.floor(next / 1000)}:R> tekrar hatırlatabilirsin.`);
  }
  store.updateApplication(app.id, { remindedAt: Date.now() });

  if (stage === 'unassigned') {
    await orientation.postPending(guild, app, channelId, 'waiting');
  } else {
    await log.send(guild, app, ui.waitingLog(app, stage, channelId), [], [staffId]);
    const staff = await guild.client.users.fetch(staffId).catch(() => null);
    await staff?.send({ components: [ui.applicantWaitingDm(app, guild.name, channelId, stage === 'orientation')], flags: core.CV2 }).catch(() => {});
  }
  return respond(interaction, core.alert('Yetkililere hatırlatıldı.', 'Bir yetkili ilgilenene kadar kanalda beklemeye devam et.', 'success'));
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
  ],
  events: {
    [Events.ClientReady]: handleReady,
    // Başvuran kanala girince yetkiliye haber verir, görüşmeden sonra ayrılınca kanalları tekrar kilitler
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
  },
};
