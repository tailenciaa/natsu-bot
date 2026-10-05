// Yetkili alım sistemi: yetkili alım kanalındaki panelden "Başvuru Yap" ile form doldurulur, başvuru başvurular
// kanalına gider. Panel bot açılınca kanala kendiliğinden gönderilir. İnceleyen rol Onayla / Reddet / Görüşmeye Çağır
// ile karar verir. Görüşmeye çağıran ya da onaylayan yetkili başvuruyu üstlenir, sonraki kararları sadece o
// (ya da yöneticiler) verebilir.
// Görüşmeye çağrılan başvurana görüşme ses kanallarının kilidi açılır (voice.js), görüşmeden çıkınca tekrar kilitlenir.
// Onaylanan başvuru oryantasyona geçer (oryantasyon sistemi), reddedilenin kanalları kilitlenir.
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

// Başvurular kanalındaki Onayla / Reddet (form açar) ve Görüşmeye Çağır butonları
async function handleReviewButton(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const app = store.getApplication(id);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);

  if (action !== 'gorusme') return interaction.showModal(ui.reviewModal(app, action));

  if (app.meetingBy) return replyError(interaction, 'Başvuran zaten görüşmeye çağrıldı.');
  // Kayıt await'ten önce yapılır, aynı anda basan ikinci kişi yukarıdaki kontrole takılır
  store.updateApplication(id, {
    ownerId: interaction.user.id,
    meetingBy: interaction.user.id,
    meetingAt: Date.now(),
    meetingChannelId: voice.staffVoiceChannel(interaction.guild, interaction.user.id),
  });

  await interaction.deferUpdate();
  const applicant = await interaction.client.users.fetch(app.userId).catch(() => null);
  await interaction.editReply({ components: [ui.applicationNotice(app, applicant)], allowedMentions: { parse: [] } });

  const access = await openVoice(interaction, app, `Yetkili başvurusu #${core.pad(app.number)} görüşmesi`);
  const sent = await applicant
    ?.send({ components: [ui.meetingDm(app, interaction.guild.name, access)], flags: core.CV2 })
    .catch(() => null);
  return respond(interaction, staffReport('Başvuran görüşmeye çağrıldı.', access, sent));
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

// Aynı başvuru için kanal değiştirdikçe yetkiliye DM yağmasın diye son bildirim zamanları: başvuru -> zaman
const waitingNotified = new Map();
const WAITING_NOTIFY_COOLDOWN = 5 * 60 * 1000;

// Başvuran bir görüşme kanalına girince, görüşmeye çağıran ya da oryantasyonu verecek yetkili aynı kanalda değilse
// yetkiliye DM ile "başvuran seni bekliyor" bildirimi gider
async function notifyStaff(newState) {
  const { guild, channelId } = newState;
  const waiting = store
    .applicationsOf(guild.id, newState.id)
    .filter((a) => (a.status === 'pending' && a.meetingBy) || a.orientation?.status === 'waiting');

  for (const app of waiting) {
    const orienting = app.status === 'approved';
    const staffId = orienting ? app.orientation.staffId : app.meetingBy;
    if (guild.voiceStates.cache.get(staffId)?.channelId === channelId) continue;
    if (Date.now() - (waitingNotified.get(app.id) ?? 0) < WAITING_NOTIFY_COOLDOWN) continue;
    waitingNotified.set(app.id, Date.now());

    const staff = await guild.client.users.fetch(staffId).catch(() => null);
    await staff
      ?.send({ components: [ui.applicantWaitingDm(app, guild.name, channelId, orienting)], flags: core.CV2 })
      .catch(() => {});
  }
}

// Görüşmeyi bitmiş sayar ve kayıt kanalındaki mesajını günceller (başvuran çıkınca ya da karar verilince)
async function endMeeting(guild, app) {
  waitingNotified.delete(app.id);
  if (!app.meeting?.startedAt || app.meeting.endedAt) return;
  store.updateApplication(app.id, { meeting: { ...app.meeting, endedAt: Date.now() } });
  await log.edit(guild, app.meeting.messageId, ui.meetingLog(app));
}

// Görüşmeye çağıran yetkili ve başvuran aynı görüşme kanalına girince görüşme başlamış sayılır ve kayıt kanalına yazılır;
// başvuran görüşme kanallarından çıkınca görüşme bitmiş sayılır. Her başvuru için bir görüşme kaydı tutulur.
async function trackMeeting(oldState, newState) {
  const { guild } = newState;
  const related = store.inMeeting().filter((a) => a.userId === newState.id || a.meetingBy === newState.id);

  for (const app of related) {
    if (!app.meeting) {
      const applicantChannel = guild.voiceStates.cache.get(app.userId)?.channelId;
      if (!voice.isRecruitmentChannel(applicantChannel) || guild.voiceStates.cache.get(app.meetingBy)?.channelId !== applicantChannel) {
        continue;
      }
      // Kayıt await'ten önce yapılır, art arda gelen olaylarda iki kez başlatılmaz
      store.updateApplication(app.id, { meeting: { channelId: applicantChannel, startedAt: Date.now(), endedAt: null, messageId: null } });
      const message = await log.send(guild, app, ui.meetingLog(app));
      if (message) {
        store.updateApplication(app.id, { meeting: { ...app.meeting, messageId: message.id } });
        // Mesaj gönderilirken başvuran çıktıysa (görüşme bitti) mesaj "Görüşme Başladı" halinde kalmasın
        if (app.meeting.endedAt) await log.edit(guild, message.id, ui.meetingLog(app));
      }
    } else if (newState.id === app.userId && !voice.isRecruitmentChannel(newState.channelId)) {
      await endMeeting(guild, app);
    }
  }
}

// Görüşme kanallarındaki giriş çıkışlar: kilitleme zamanlayıcıları, görüşme kaydı ve yetkiliye "başvuran seni bekliyor" bildirimi
async function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;
  voice.handleVoiceUpdate(oldState, newState);
  if (oldState.channelId === newState.channelId) return;
  if (!voice.isRecruitmentChannel(oldState.channelId) && !voice.isRecruitmentChannel(newState.channelId)) return;

  await trackMeeting(oldState, newState);
  if (voice.isRecruitmentChannel(newState.channelId)) await notifyStaff(newState);
}

// Onay / red formu gönderilince başvuruyu sonuçlandırır. Onaylanan başvuru onaylayan yetkiliye atanıp oryantasyona
// geçer (roller oryantasyon sonunda verilir); reddedilene DM gider ve görüşme kanalları kilitlenir.
async function handleReviewSubmit(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const app = store.getApplication(id);
  const error = reviewError(interaction, app);
  if (error) return replyError(interaction, error);

  const approved = action === 'onay';
  // Karar await'ten önce kaydedilir, aynı anda karar veren ikinci kişi yukarıdaki kontrole takılır
  store.updateApplication(id, {
    status: approved ? 'approved' : 'rejected',
    reviewedBy: interaction.user.id,
    reviewedAt: Date.now(),
    note: interaction.fields.getTextInputValue(ui.IDS.reviewNote).trim() || null,
    ...(approved ? { ownerId: interaction.user.id, orientation: orientation.create(interaction.user.id) } : {}),
  });
  await interaction.deferUpdate();
  await endMeeting(interaction.guild, app);

  if (approved) return orientation.begin(interaction, app);

  const applicant = await interaction.client.users.fetch(app.userId).catch(() => null);
  await interaction.editReply({ components: [ui.applicationNotice(app, applicant)], allowedMentions: { parse: [] } });
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
  ],
  events: {
    [Events.ClientReady]: handleReady,
    // Başvuran kanala girince yetkiliye haber verir, görüşmeden sonra ayrılınca kanalları tekrar kilitler
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
  },
};
