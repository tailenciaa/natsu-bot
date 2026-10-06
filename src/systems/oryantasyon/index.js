// Oryantasyon: onaylanan başvuranın ekibe katılmadan önceki son aşaması.
// Başvuru onaylanınca (basvuru sistemi begin'i çağırır) başvurana ve onaylayan yetkiliye DM ile boş bir görüşme kanalı
// bildirilir. İkisi aynı görüşme kanalına girince oryantasyon kendiliğinden başlar ve bot kanalın sohbetine bir panel
// atar. Yetkili adımları panelden ilerletir (bilinen adımlar atlanabilir), başvuran görev alanlarını seçer, en sonda
// yetkili seviyeyi seçip "Yetki Ver"e basar: roller verilir, başvurana tebrik DM'i gider, kanallar tekrar kilitlenir.
// Oryantasyon başka bir yetkiliye aktarılabilir ya da sebep yazılarak iptal edilebilir.
//
// Oryantasyon sürerken giriş çıkışlar takip edilir (config.presence):
// - İkisi birlikte başka bir görüşme kanalına geçerse panel de o kanala taşınır.
// - Başvuran ayrılırsa ikisine de DM gider; süresi içinde dönmezse oryantasyon iptal edilir, izin verilenden fazla
//   ayrılırsa hemen iptal edilir ve başvuru cezası alır.
// - Yetkili ayrılırsa ikisine de DM gider; süresi içinde dönmezse başvurular kanalına "yetkili bekleniyor" mesajı gider
//   ve başka bir yetkili oryantasyonu devralabilir.
// Kısa kopmalar (confirmSeconds içinde dönenler) ayrılık sayılmaz. Zamanlayıcılar bot yeniden açılınca kaldığı yerden sürer.
const { Events, PermissionFlagsBits } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const basvuruConfig = require('../basvuru/config');
const basvuruLog = require('../basvuru/log');
const basvuruStore = require('../basvuru/store');
const basvuruUi = require('../basvuru/ui');
const voice = require('../basvuru/voice');
const ratings = require('../degerlendirme');
const config = require('./config');
const ui = require('./ui');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Oryantasyon verebilen roller: başvuruları inceleyen rol ve yetkili alım / oryantasyon liderleri ile oryantasyon yetkilileri
const orienterRoles = (app) => [app.reviewerRoleId, ...basvuruConfig.roles.orientation].filter(Boolean);
const mentionRoles = (ids) => ids.map((id) => `<@&${id}>`).join(', ');
const isAdmin = (interaction) => Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
const fetchUser = (client, userId) => client.users.fetch(userId).catch(() => null);
const followUp = (interaction, container) =>
  interaction.followUp({ components: [container], flags: core.EPHEMERAL_CV2, allowedMentions: { parse: [] } });
const voiceChannelOf = (guild, userId) => guild.voiceStates.cache.get(userId)?.channelId ?? null;
const inRecruitment = (guild, userId) => voice.isRecruitmentChannel(voiceChannelOf(guild, userId));
const activeApp = (id) => {
  const app = basvuruStore.getApplication(id);
  return app?.orientation?.status === 'active' ? app : null;
};

// Kayıt await'lerden önce yapılır; aynı anda basılan ikinci buton güncel durumu görür
function saveOrientation(app, patch) {
  basvuruStore.updateApplication(app.id, { orientation: { ...app.orientation, ...patch } });
}

// Başvuru onaylanırken kaydedilen yeni oryantasyon
function create(staffId) {
  return {
    status: 'waiting',
    staffId,
    suggestedChannelId: null,
    channelId: null,
    messageId: null,
    step: 0,
    skipped: [],
    areas: [],
    levelId: config.defaultLevelId,
    transfers: [],
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    // Giriş çıkış takibi
    applicantAwaySince: null,
    applicantLeaves: 0,
    staffAwaySince: null,
    staffJoining: false,
    staffNeeded: false,
    takeoverMessageId: null,
  };
}

// Zamanlayıcılar: <başvuru>:<applicant|staff>:<confirm|deadline> -> timeout
const timers = new Map();

function setTimer(key, ms, fn) {
  clearTimer(key);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      Promise.resolve(fn()).catch((err) => console.error('[oryantasyon] Zamanlayıcı hatası:', err));
    }, Math.max(0, ms)),
  );
}

function clearTimer(key) {
  clearTimeout(timers.get(key));
  timers.delete(key);
}

function clearTimers(app) {
  for (const key of [...timers.keys()]) if (key.startsWith(`${app.id}:`)) clearTimer(key);
}

// Kayıt kanalındaki canlı oryantasyon mesajını günceller
// Oryantasyon bitince aynı mesaj sonuç mesajına dönüşür
const updateLog = (guild, app) =>
  basvuruLog.edit(
    guild,
    app.orientation.logMessageId,
    app.orientation.status === 'active' ? ui.orientationLog(app) : ui.orientationResult(app),
  );

// Başvurular kanalındaki mesajı, görüşme kanalındaki paneli ve kayıt mesajını son duruma göre günceller
async function refresh(guild, app) {
  const applicant = await fetchUser(guild.client, app.userId);
  const edit = async (channelId, messageId, container) => {
    if (!channelId || !messageId) return;
    const channel = await fetchTextChannel(guild, channelId);
    await channel?.messages.edit(messageId, { components: [container], allowedMentions: { parse: [] } }).catch(() => {});
  };
  await edit(app.channelId, app.messageId, basvuruUi.applicationNotice(app, applicant));
  await edit(app.orientation.channelId, app.orientation.messageId, ui.panel(app, applicant));
  await updateLog(guild, app);
}

// Başvurular kanalındaki "yetkili bekleniyor" mesajını son haline getirir (artık yetkili beklenmiyorsa)
async function closeTakeover(guild, app, state) {
  const messageId = app.orientation.takeoverMessageId;
  if (!messageId) return;
  saveOrientation(app, { takeoverMessageId: null });
  await basvuruLog.edit(guild, messageId, ui.takeoverNotice(app, state));
}

// Giriş çıkış DM'leri: presenceDm kimi ilgilendiriyorsa ona gider
async function notify(guild, app, kind, channelId) {
  for (const [userId, toApplicant] of [
    [app.userId, true],
    [app.orientation.staffId, false],
  ]) {
    const container = ui.presenceDm(app, guild.name, kind, toApplicant, channelId);
    if (!container) continue;
    const user = await fetchUser(guild.client, userId);
    await user?.send({ components: [container], flags: core.CV2 }).catch(() => {});
  }
}

// Oryantasyon bitince (tamamlanınca ya da iptal edilince) zamanlayıcıları durdurur, mesajları günceller, kayıt kanalına
// sonucu yazar ve kanalları başvurana hemen kilitler. Başvuran kanaldan çıkarılacaksa true döner.
async function finish(guild, app, reason) {
  clearTimers(app);
  await closeTakeover(guild, app, 'closed');
  await refresh(guild, app);
  // Canlı kayıt mesajı refresh ile sonuca döndü; oryantasyon hiç başlamadan bittiyse sonuç ayrı mesaj olarak gider
  if (!app.orientation.logMessageId) await basvuruLog.send(guild, app, ui.orientationResult(app));
  return voice.closeForApplicant(guild, app, reason);
}

// Paneli gönderilemeyen oryantasyonlar için uyarı bir kez gönderilir
const panelFailureNotified = new Set();
// Panel adım butonlarına art arda (çift) tıklama iki adım birden ilerletmesin: son adım değişikliği zamanı
const lastMove = new Map();

// Oryantasyonu başlatır: paneli kanalın sohbetine atar, iki taraf da etiketlenir
async function start(guild, app, channelId) {
  saveOrientation(app, { status: 'active', channelId, startedAt: Date.now(), step: 0 });

  const channel = await fetchTextChannel(guild, channelId);
  const applicant = await fetchUser(guild.client, app.userId);
  const message = await channel
    ?.send({
      components: [ui.panel(app, applicant)],
      flags: core.CV2,
      allowedMentions: { users: [app.userId, app.orientation.staffId] },
    })
    .catch((err) => console.error('[oryantasyon] Panel gönderilemedi:', err.message));

  if (!message) {
    saveOrientation(app, { status: 'waiting', channelId: null, startedAt: null });
    // Her ses olayında yeniden denenip sessizce başarısız olmasın: yetkililere bir kez haber verilir
    if (!panelFailureNotified.has(app.id)) {
      panelFailureNotified.add(app.id);
      await basvuruLog.send(
        guild,
        app,
        core.alert('Oryantasyon paneli gönderilemedi.', 'Botun görüşme kanalının sohbetinde mesaj gönderme izni olmalı.', 'danger'),
      );
    }
    return false;
  }

  saveOrientation(app, { messageId: message.id });
  // Oryantasyon uzun sürebilir, kanal erişimi baştan uzatılır
  if (app.voiceAccessUntil) {
    basvuruStore.updateApplication(app.id, { voiceAccessUntil: Date.now() + basvuruConfig.voiceAccessHours * HOUR });
  }
  const logMessage = await basvuruLog.send(guild, app, ui.orientationLog(app));
  if (logMessage) saveOrientation(app, { logMessageId: logMessage.id });
  await refresh(guild, app);
  return true;
}

// Başvuran ve yetkili aynı görüşme kanalındaysa bekleyen oryantasyonu başlatır
async function tryStart(guild, app) {
  if (app.orientation?.status !== 'waiting') return false;
  const applicantChannel = voiceChannelOf(guild, app.userId);
  if (!voice.isRecruitmentChannel(applicantChannel) || applicantChannel !== voiceChannelOf(guild, app.orientation.staffId)) {
    return false;
  }
  return start(guild, app, applicantChannel);
}

// İkisi birlikte başka bir görüşme kanalına geçince paneli o kanala taşır; eski kanalda kısa bir not kalır
async function movePanel(guild, app, channelId) {
  const { channelId: oldChannelId, messageId: oldMessageId } = app.orientation;
  saveOrientation(app, { channelId });

  const channel = await fetchTextChannel(guild, channelId);
  const applicant = await fetchUser(guild.client, app.userId);
  const message = await channel
    ?.send({ components: [ui.panel(app, applicant)], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch((err) => console.error('[oryantasyon] Panel taşınamadı:', err.message));
  if (!message) return saveOrientation(app, { channelId: oldChannelId });

  saveOrientation(app, { messageId: message.id });
  const oldChannel = await fetchTextChannel(guild, oldChannelId);
  await oldChannel?.messages.edit(oldMessageId, { components: [ui.panelMoved(app)], allowedMentions: { parse: [] } }).catch(() => {});
  await refresh(guild, app);
}

// Ayrılan tarafın dönmesi için tanınan süre dolunca ne olacağını zamanlar
function scheduleDeadline(guild, app, side) {
  const o = app.orientation;
  const p = config.presence;
  const at =
    side === 'applicant'
      ? o.applicantAwaySince + p.applicantGraceMinutes * MINUTE
      : o.staffAwaySince + p.staffGraceMinutes * MINUTE;
  setTimer(`${app.id}:${side}:deadline`, at - Date.now(), () =>
    side === 'applicant' ? onApplicantTimeout(guild, app.id) : onStaffTimeout(guild, app.id),
  );
}

// Kısa kopma süresi geçtikten sonra hâlâ kanalda değilse ayrılmış sayılır
async function markAway(guild, appId, side) {
  const app = activeApp(appId);
  if (!app) return;
  const o = app.orientation;
  if (inRecruitment(guild, side === 'applicant' ? app.userId : o.staffId)) return;

  if (side === 'applicant') {
    const leaves = (o.applicantLeaves ?? 0) + 1;
    saveOrientation(app, { applicantAwaySince: Date.now(), applicantLeaves: leaves });
    if (leaves >= config.presence.maxApplicantLeaves) return autoCancel(guild, app, 'leaves');
  } else {
    saveOrientation(app, { staffAwaySince: Date.now() });
  }
  scheduleDeadline(guild, app, side);
  await notify(guild, app, side === 'applicant' ? 'applicantLeft' : 'staffLeft');
  await refresh(guild, app);
}

// Başvuran ya da yetkili için kanalda olup olmama durumunu işler
async function syncSide(guild, app, side, present) {
  const o = app.orientation;
  const awayKey = side === 'applicant' ? 'applicantAwaySince' : 'staffAwaySince';
  const confirmKey = `${app.id}:${side}:confirm`;
  const deadlineKey = `${app.id}:${side}:deadline`;

  if (present) {
    clearTimer(confirmKey);
    if (!o[awayKey]) return;
    clearTimer(deadlineKey);
    if (side === 'applicant') {
      saveOrientation(app, { applicantAwaySince: null });
      await notify(guild, app, 'applicantBack');
    } else {
      const joining = o.staffJoining;
      saveOrientation(app, { staffAwaySince: null, staffJoining: false, staffNeeded: false });
      await closeTakeover(guild, app, 'returned');
      await notify(guild, app, joining ? 'staffJoined' : 'staffBack');
    }
    return refresh(guild, app);
  }

  // Zaten ayrılmış sayılıyorsa süresi işliyor olmalı (bot yeniden açıldıysa tekrar zamanlanır)
  if (o[awayKey]) {
    if (!(side === 'staff' && o.staffNeeded) && !timers.has(deadlineKey)) scheduleDeadline(guild, app, side);
    return;
  }
  if (!timers.has(confirmKey)) setTimer(confirmKey, config.presence.confirmSeconds * 1000, () => markAway(guild, app.id, side));
}

// Süren bir oryantasyonda iki tarafın kanal durumunu değerlendirir: panel taşıma, ayrılma ve dönme
async function syncPresence(guild, appId) {
  let app = activeApp(appId);
  if (!app) return;
  const applicantChannel = voiceChannelOf(guild, app.userId);
  const staffChannel = voiceChannelOf(guild, app.orientation.staffId);

  if (voice.isRecruitmentChannel(applicantChannel) && applicantChannel === staffChannel && applicantChannel !== app.orientation.channelId) {
    await movePanel(guild, app, applicantChannel);
  }
  await syncSide(guild, app, 'applicant', voice.isRecruitmentChannel(applicantChannel));
  app = activeApp(appId);
  if (app) await syncSide(guild, app, 'staff', voice.isRecruitmentChannel(staffChannel));
}

// Başvuran süresi içinde dönmedi: oryantasyon iptal edilir
async function onApplicantTimeout(guild, appId) {
  const app = activeApp(appId);
  if (!app?.orientation.applicantAwaySince) return;
  if (inRecruitment(guild, app.userId)) return syncPresence(guild, appId);
  await autoCancel(guild, app, 'timeout');
}

// Yetkili süresi içinde dönmedi: başvurular kanalına "yetkili bekleniyor" mesajı gider, inceleyen rol etiketlenir
async function onStaffTimeout(guild, appId) {
  const app = activeApp(appId);
  if (!app?.orientation.staffAwaySince || app.orientation.staffNeeded) return;
  if (inRecruitment(guild, app.orientation.staffId)) return syncPresence(guild, appId);

  saveOrientation(app, { staffNeeded: true });
  const message = await basvuruLog.send(guild, app, ui.takeoverNotice(app, 'open'), app.reviewerRoleId ? [app.reviewerRoleId] : []);
  if (message) saveOrientation(app, { takeoverMessageId: message.id });
  await notify(guild, app, 'staffNeeded');
  await refresh(guild, app);
}

// Başvuran dönmediği ya da çok kez ayrıldığı için oryantasyonu iptal eder; çok kez ayrıldıysa başvuru cezası verir
async function autoCancel(guild, app, why) {
  const p = config.presence;
  saveOrientation(app, {
    status: 'cancelled',
    cancelledBy: null,
    autoCancel: why,
    cancelReason:
      why === 'leaves'
        ? `Başvuran oryantasyon sırasında ${p.maxApplicantLeaves} kez kanaldan ayrıldı.`
        : `Başvuran kanaldan ayrıldıktan sonra ${p.applicantGraceMinutes} dakika içinde geri dönmedi.`,
    finishedAt: Date.now(),
  });
  if (why === 'leaves') basvuruStore.updateApplication(app.id, { penaltyUntil: Date.now() + p.penaltyDays * DAY });

  const applicant = await fetchUser(guild.client, app.userId);
  await applicant?.send({ components: [ui.cancelledDm(app, guild.name)], flags: core.CV2 }).catch(() => {});
  await notify(guild, app, 'autoCancelled');
  await finish(guild, app, `Yetkili başvurusu #${core.pad(app.number)} oryantasyonu otomatik iptal edildi`);
}

// Oryantasyonu yeni bir yetkiliye verir (elle aktarma ya da devralma). Yeni yetkili kanalda değilse gelmesi beklenir;
// süresi içinde gelmezse yine "yetkili bekleniyor" mesajı gider.
function assignStaff(guild, app, targetId, byId) {
  const o = app.orientation;
  const fromId = o.staffId;
  const joining = o.status === 'active' && !inRecruitment(guild, targetId);
  clearTimer(`${app.id}:staff:confirm`);
  clearTimer(`${app.id}:staff:deadline`);
  saveOrientation(app, {
    staffId: targetId,
    transfers: [...o.transfers, { from: fromId, to: targetId, by: byId, at: Date.now() }],
    staffNeeded: false,
    staffJoining: joining,
    staffAwaySince: joining ? Date.now() : null,
  });
  basvuruStore.updateApplication(app.id, { ownerId: targetId });
  if (joining) scheduleDeadline(guild, app, 'staff');
  return fromId;
}

// Süren oryantasyonda kanalın sohbetinde yeni yetkiliyi etiketler
async function announceNewStaff(guild, app, fromId) {
  if (app.orientation.status !== 'active') return;
  const channel = await fetchTextChannel(guild, app.orientation.channelId);
  await channel
    ?.send({ components: [ui.transferNotice(app, fromId)], flags: core.CV2, allowedMentions: { users: [app.orientation.staffId] } })
    .catch(() => {});
}

// Başvuru sistemi onaylanan başvuru için çağırır (başvuru kaydedilmiş, etkileşim deferUpdate edilmiş olarak):
// kanalların kilidini açar, boş kanalı bulur, iki tarafa DM atar, ikisi zaten aynı kanaldaysa hemen başlatır
async function begin(interaction, app) {
  const { guild } = interaction;
  const access = await voice.grantAccess(guild, app, `Yetkili başvurusu #${core.pad(app.number)} oryantasyonu`);
  const channelId = voice.pickOrientationChannel(guild, app.orientation.staffId);
  saveOrientation(app, { suggestedChannelId: channelId });

  const applicant = await fetchUser(interaction.client, app.userId);
  await interaction.editReply({ components: [basvuruUi.applicationNotice(app, applicant)], allowedMentions: { parse: [] } });

  // Görüşmeden hemen sonra onaylandıysa ikisi zaten aynı kanalda olabilir; o zaman yetkiliye ayrıca DM gerekmez
  const started = await tryStart(guild, app);
  const target = started ? app.orientation.channelId : channelId;
  const applicantSent = await applicant
    ?.send({ components: [ui.approvedDm(app, guild.name, target)], flags: core.CV2 })
    .catch(() => null);
  const staffSent =
    started ||
    (await interaction.user.send({ components: [ui.staffDm(app, guild.name, channelId)], flags: core.CV2 }).catch(() => null));

  const lines = [
    started
      ? `İkiniz de <#${target}> kanalında olduğunuz için oryantasyon hemen başladı, panel kanalın sohbetinde.`
      : channelId
        ? `Oryantasyon için <#${channelId}> kanalı ayarlandı. İkiniz de kanala girince oryantasyon kendiliğinden başlayacak.`
        : 'Şu an boş görüşme kanalı yok; ikinize de boşalan bir kanala geçmeniz söylendi. Aynı kanala girince oryantasyon başlar.',
    access ? null : 'Ses kanallarının kilidi açılamadı, başvuran sunucuda olmayabilir.',
    applicantSent ? 'Başvurana DM ile haber verildi.' : "Başvuranın DM'si kapalı, kendisine ayrıca ulaşman gerekiyor.",
    staffSent ? null : "Senin DM'in kapalı olduğu için sana ayrıca bilgi gönderilemedi.",
  ].filter(Boolean);

  await respond(
    interaction,
    core.notice(`**Başvuru onaylandı, oryantasyonu sen vereceksin.**\n${lines.map((l) => `${l}`).join('\n')}`, access && applicantSent ? 'success' : 'warning'),
  );
}

// Oryantasyon bekleyen yetkili bir görüşme kanalına girip başvuran orada değilse başvurana haber verir
const staffWaitingNotified = new Map();
async function notifyApplicantOfStaff(guild, app, channelId) {
  if (voiceChannelOf(guild, app.userId) === channelId) return;
  if (Date.now() - (staffWaitingNotified.get(app.id) ?? 0) < 5 * MINUTE) return;
  staffWaitingNotified.set(app.id, Date.now());
  const container = ui.presenceDm(app, guild.name, 'staffWaiting', true, channelId);
  const applicant = await fetchUser(guild.client, app.userId);
  await applicant?.send({ components: [container], flags: core.CV2 }).catch(() => {});
}

// Görüşme kanallarındaki giriş çıkışlar: bekleyen oryantasyonu başlatır, sürende giriş çıkışları takip eder
async function handleVoiceUpdate(oldState, newState) {
  const { guild } = newState;
  if (guild.id !== guildId || oldState.channelId === newState.channelId) return;
  if (!voice.isRecruitmentChannel(oldState.channelId) && !voice.isRecruitmentChannel(newState.channelId)) return;

  const related = basvuruStore
    .inOrientation()
    .filter((a) => a.userId === newState.id || a.orientation.staffId === newState.id);
  for (const app of related) {
    if (app.orientation.status === 'active') {
      await syncPresence(guild, app.id);
    } else if (voice.isRecruitmentChannel(newState.channelId)) {
      const started = await tryStart(guild, app);
      if (!started && newState.id === app.orientation.staffId) await notifyApplicantOfStaff(guild, app, newState.channelId);
    }
  }
}

// Açılışta: bot kapalıyken ikisi de kanala girdiyse başlatır, süren oryantasyonların takibini kaldığı yerden sürdürür
// Alanların roleName'ini sunucudaki role bağlar (bir kere, bot açılırken); bulunamayan alan "rol tanımlanmadı" sayılır
const normalizeName = (name) => name.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
async function resolveAreaRoles(guild) {
  const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  for (const area of config.areas) {
    if (area.roleId || !area.roleName) continue;
    const wanted = normalizeName(area.roleName);
    const role = roles.find((r) => normalizeName(r.name) === wanted);
    if (role) area.roleId = role.id;
    else console.error(`[oryantasyon] "${area.roleName}" rolü sunucuda bulunamadı (${area.label} alanı).`);
  }
}

async function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  await resolveAreaRoles(guild);
  for (const app of basvuruStore.inOrientation()) {
    if (app.orientation.status === 'active') await syncPresence(guild, app.id);
    else await tryStart(guild, app);
  }
}

// Panel adımları: sadece oryantasyonu veren yetkili (ya da yönetici) kullanabilir
function moveStep(app, action) {
  const o = app.orientation;
  const step = config.steps[o.step];
  const last = config.steps.length - 1;

  if (action === 'geri') return saveOrientation(app, { step: Math.max(0, o.step - 1) });
  if (action === 'atla') {
    if (!step.skippable) return 'Bu adım atlanamaz.';
    return saveOrientation(app, { step: Math.min(last, o.step + 1), skipped: [...new Set([...o.skipped, step.id])] });
  }
  // ileri: adım anlatıldı sayılır, önceden atlandıysa atlananlardan çıkar
  if (step.type === 'areas' && !o.areas.length) return 'Devam etmeden önce en az bir görev alanı seçilmeli.';
  return saveOrientation(app, { step: Math.min(last, o.step + 1), skipped: o.skipped.filter((id) => id !== step.id) });
}

// "Başka Yetkiliye Aktar" menüsünden seçilen yetkiliye oryantasyonu aktarır
async function handleTransfer(interaction, app) {
  const targetId = interaction.values[0];
  const o = app.orientation;
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);

  let error = null;
  if (!member) error = 'Seçilen kişi sunucuda bulunamadı.';
  else if (member.user.bot) error = 'Oryantasyon bir bota aktarılamaz.';
  else if (targetId === app.userId) error = 'Oryantasyon başvurana aktarılamaz.';
  else if (targetId === o.staffId) error = 'Oryantasyon zaten bu yetkilide.';
  else if (!member.permissions.has(PermissionFlagsBits.Administrator) && !orienterRoles(app).some((id) => member.roles.cache.has(id))) {
    error = `Oryantasyon sadece ${mentionRoles(orienterRoles(app))} rolündekilere aktarılabilir.`;
  }
  if (error) return interaction.update({ components: [core.alert(error, null, 'danger')], allowedMentions: { parse: [] } });

  const fromId = assignStaff(interaction.guild, app, targetId, interaction.user.id);
  await interaction.update({
    components: [core.alert('Oryantasyon aktarıldı.', `Oryantasyon artık <@${targetId}> tarafından yürütülecek.`, 'success')],
    allowedMentions: { parse: [] },
  });
  await closeTakeover(interaction.guild, app, 'taken');
  await refresh(interaction.guild, app);
  await announceNewStaff(interaction.guild, app, fromId);
  await member.send({
    components: [ui.staffDm(app, interaction.guild.name, app.orientation.suggestedChannelId, fromId)],
    flags: core.CV2,
  }).catch(() => {});
  if (app.orientation.status === 'active') await syncPresence(interaction.guild, app.id);
  else await tryStart(interaction.guild, app);
}

// Başvurular kanalındaki "Oryantasyonu Devral": yetkili ayrıldığında inceleyen roldeki biri oryantasyonu üstlenir
async function handleTakeover(interaction, app) {
  const o = app.orientation;
  if (o.status !== 'active' || !o.staffNeeded) {
    return replyError(interaction, 'Bu oryantasyon şu an yetkili beklemiyor.');
  }
  if (interaction.user.id === app.userId) return replyError(interaction, 'Kendi oryantasyonunu devralamazsın.');
  if (!isStaff(interaction, orienterRoles(app))) {
    return replyError(interaction, `Oryantasyonu sadece ${mentionRoles(orienterRoles(app))} rolündekiler devralabilir.`);
  }

  const fromId = assignStaff(interaction.guild, app, interaction.user.id, interaction.user.id);
  saveOrientation(app, { takeoverMessageId: null });
  await interaction.update({ components: [ui.takeoverNotice(app, 'taken')], allowedMentions: { parse: [] } });

  await interaction.user
    .send({ components: [ui.staffDm(app, interaction.guild.name, o.channelId, fromId, true)], flags: core.CV2 })
    .catch(() => {});
  await notify(interaction.guild, app, 'takenOver');
  await refresh(interaction.guild, app);
  await announceNewStaff(interaction.guild, app, fromId);
  await syncPresence(interaction.guild, app.id);
}

// İptal formu gönderilince oryantasyonu sonlandırır, başvurana sebebi iletir ve kanalları kilitler
async function handleCancel(interaction, app) {
  saveOrientation(app, {
    status: 'cancelled',
    cancelledBy: interaction.user.id,
    cancelReason: interaction.fields.getTextInputValue(ui.IDS.cancelReason).trim(),
    finishedAt: Date.now(),
  });
  await interaction.deferUpdate();

  const applicant = await fetchUser(interaction.client, app.userId);
  const sent = await applicant
    ?.send({ components: [ui.cancelledDm(app, interaction.guild.name)], flags: core.CV2 })
    .catch(() => null);
  const kicked = await finish(interaction.guild, app, `Yetkili başvurusu #${core.pad(app.number)} oryantasyonu iptal edildi`);

  const notes = [
    sent ? 'Başvurana sebep DM ile iletildi.' : "Başvuranın DM'si kapalı, sebebi kendisine ayrıca iletmen gerekiyor.",
    `Görüşme kanalları başvurana kilitlendi${kicked ? `, ${basvuruConfig.disconnectDelaySeconds} saniye içinde kanaldan çıkarılacak` : ''}.`,
  ];
  await followUp(interaction, core.notice(`**Oryantasyon iptal edildi.**\n${notes.map((n) => `${n}`).join('\n')}`, sent ? 'success' : 'warning'));
}

// "Yetki Ver": seviye ve alan rollerini verir, oryantasyonu tamamlar, başvurana tebrik DM'i gönderir
async function handleGrant(interaction, app) {
  if (!app.orientation.areas.length) return replyError(interaction, 'Önce en az bir görev alanı seçilmeli.');

  const { roleIds, missing } = ui.plannedRoles(app);
  // Tamamlandı olarak işaretlenir, aynı anda ikinci kez basılırsa yukarıdaki kontrollere takılır; rol verilemezse geri alınır
  saveOrientation(app, { status: 'completed', finishedAt: Date.now() });
  await interaction.deferUpdate();

  const member = await interaction.guild.members.fetch(app.userId).catch(() => null);
  const given =
    member &&
    (!roleIds.length ||
      (await member.roles
        .add(roleIds, `Yetkili başvurusu #${core.pad(app.number)} oryantasyonu tamamlandı`)
        .then(() => true)
        .catch(() => false)));
  if (!given) {
    saveOrientation(app, { status: 'active', finishedAt: null });
    return followUp(
      interaction,
      member
        ? core.alert('Roller verilemedi.', 'Botun rolü, verilecek rollerin üstünde olmalı. Oryantasyon tamamlanmadı, tekrar deneyebilirsin.', 'danger')
        : core.alert('Başvuran sunucuda bulunamadı.', 'Oryantasyon tamamlanmadı.', 'danger'),
    );
  }

  saveOrientation(app, {
    rolesGiven: roleIds,
    missingRoles: missing,
    levelLabel: ui.levelOf(app).label,
    areaLabels: ui.areasOf(app).map((a) => a.label),
  });
  const sent = await member.send({ components: [ui.completedDm(app, interaction.guild.name)], flags: core.CV2 }).catch(() => null);
  // Tebrik mesajının ardından oryantasyonu veren yetkiliyi puanlaması istenir
  await ratings.requestForApplication(interaction.client, app, 'oryantasyon', app.orientation.staffId);
  const kicked = await finish(interaction.guild, app, `Yetkili başvurusu #${core.pad(app.number)} oryantasyonu tamamlandı`);

  const notes = [
    sent ? 'Yeni yetkiliye tebrik mesajı DM ile gönderildi.' : "Yeni yetkilinin DM'si kapalı olduğu için tebrik mesajı gönderilemedi.",
    missing.length ? `Rolü tanımlanmadığı için atlananlar: ${missing.join(', ')}.` : null,
    `Görüşme kanalları kilitlendi${kicked ? `, yeni yetkili ${basvuruConfig.disconnectDelaySeconds} saniye içinde kanaldan çıkarılacak` : ''}.`,
  ].filter(Boolean);
  await followUp(interaction, core.alert('Yetki verildi, oryantasyon tamamlandı.', notes.join('\n'), 'success'));
}

// Tüm oryantasyon butonları, menüleri ve formları: oryantasyon:<başvuru>:<işlem>
async function handleAction(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const app = basvuruStore.getApplication(id);
  if (!app?.orientation) return replyError(interaction, 'Bu oryantasyon bulunamadı.');
  const o = app.orientation;
  if (!['waiting', 'active'].includes(o.status)) return replyError(interaction, 'Bu oryantasyon zaten sonuçlandı.');

  // Devralma butonu başvurular kanalında, oryantasyonu yöneten kişi dışındakiler içindir
  if (action === 'devral') return handleTakeover(interaction, app);

  const isApplicant = interaction.user.id === app.userId;
  const canManage = interaction.user.id === o.staffId || isAdmin(interaction);

  // Alan seçimini başvuran da yapabilir
  if (action === 'alan') {
    if (!isApplicant && !canManage) return replyError(interaction, 'Alan seçimini sadece başvuran ve oryantasyonu veren yetkili yapabilir.');
    if (o.status !== 'active') return replyError(interaction, 'Oryantasyon henüz başlamadı.');
    saveOrientation(app, { areas: interaction.values });
    const applicant = await fetchUser(interaction.client, app.userId);
    await interaction.update({ components: [ui.panel(app, applicant)], allowedMentions: { parse: [] } });
    return updateLog(interaction.guild, app);
  }

  if (!canManage) {
    return replyError(
      interaction,
      isApplicant ? 'Oryantasyonu yetkilin yönetiyor.' : `Bu oryantasyonu sadece <@${o.staffId}> yönetebilir.`,
      isApplicant ? 'Adımları o ilerletir; senin yapman gereken tek şey görev alanı adımında seçim yapmak.' : undefined,
    );
  }

  if (action === 'aktar') return respond(interaction, ui.transferPicker(app));
  if (action === 'aktar-sec') return handleTransfer(interaction, app);
  if (action === 'iptal') return interaction.showModal(ui.cancelModal(app));
  if (action === 'iptal-form') return handleCancel(interaction, app);

  if (o.status !== 'active') return replyError(interaction, 'Oryantasyon henüz başlamadı.');
  if (action === 'ver') return handleGrant(interaction, app);
  if (action === 'seviye') {
    saveOrientation(app, { levelId: interaction.values[0] });
  } else {
    // Aynı oryantasyonda 1 saniye içindeki ikinci adım tıklaması yoksayılır (çift tıklama ya da iki yetkili aynı anda)
    const now = Date.now();
    if (now - (lastMove.get(app.id) ?? 0) < 1000) return interaction.deferUpdate();
    lastMove.set(app.id, now);
    const error = moveStep(app, action);
    if (typeof error === 'string') return replyError(interaction, error);
  }
  const applicant = await fetchUser(interaction.client, app.userId);
  await interaction.update({ components: [ui.panel(app, applicant)], allowedMentions: { parse: [] } });
  return updateLog(interaction.guild, app);
}

module.exports = {
  name: 'oryantasyon',
  create,
  begin,
  prefixed: [[ui.IDS.action, handleAction]],
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
  },
};
