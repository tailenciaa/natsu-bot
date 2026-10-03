// Görüşme ses kanalları: başvurana kanalların kilidini açar / kapatır, butona basan yetkilinin hangi kanalda beklediğini
// ve oryantasyon için boş kanalı bulur.
// Başvuran mülakattan sonra görüşme kanalından ayrılınca (leaveLockMinutes içinde geri dönmezse) kanallar tekrar kilitlenir.
// Oryantasyon sürerken (onaydan oryantasyon bitene kadar) kanallar kilitlenmez; oryantasyon tamamlanınca ya da iptal
// edilince hemen kilitlenir, başvuran kanaldaysa kısa süre sonra kanaldan çıkarılır.
// Hiç katılmazsa erişim başvuruda kayıtlı süre (voiceAccessUntil) dolunca kapanır; bot kapalıyken dolan süreler açılışta temizlenir.
const { pad } = require('../../core/ui');
const config = require('./config');
const store = require('./store');

const HOUR = 60 * 60 * 1000;
const SWEEP_INTERVAL = 10 * 60 * 1000;

const channelIds = () => config.voiceChannels.map((c) => c.id);
const isRecruitmentChannel = (channelId) => Boolean(channelId) && channelIds().includes(channelId);

// Onaylanmış, oryantasyonu bekleyen ya da süren başvuru
const inOrientation = (app) => app.status === 'approved' && ['waiting', 'active'].includes(app.orientation?.status);
// Sonuçlanmış başvurunun erişimi açık kalmamalı: reddedilen ya da onaylanıp oryantasyonu biten (tamamlanan / iptal edilen)
const finished = (app) => app.status === 'rejected' || (app.status === 'approved' && !inOrientation(app));

const inRecruitmentChannel = (guild, userId) => isRecruitmentChannel(guild.voiceStates.cache.get(userId)?.channelId);

async function eachChannel(guild, fn) {
  for (const id of channelIds()) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (channel) await fn(channel);
  }
}

// Başvurana üç kanalın kilidini açar; başarılıysa erişimin kapanacağı zamanı döner
async function grantAccess(guild, app, reason) {
  const member = await guild.members.fetch(app.userId).catch(() => null);
  if (!member) return null;

  let ok = true;
  await eachChannel(guild, (channel) =>
    channel.permissionOverwrites
      .edit(app.userId, { ViewChannel: true, Connect: true, Speak: true }, { reason })
      .catch((err) => {
        ok = false;
        console.error(`[basvuru] ${channel.name} kanalının kilidi açılamadı:`, err.message);
      }),
  );
  if (!ok) return null;

  const until = Date.now() + config.voiceAccessHours * HOUR;
  store.updateApplication(app.id, { voiceAccessUntil: until });
  return until;
}

// Başvuranın kanallardaki özel iznini kaldırır, kanallar yine herkese kapalı haline döner
async function revokeAccess(guild, app, reason) {
  if (!app.voiceAccessUntil) return;
  store.updateApplication(app.id, { voiceAccessUntil: null });

  // Aynı kişinin erişimi hâlâ açık, sonuçlanmamış başka bir başvurusu varsa kanallar kapatılmaz
  const stillOpen = store
    .withVoiceAccess()
    .some((a) => a.userId === app.userId && (a.voiceAccessUntil > Date.now() || inOrientation(a)) && !finished(a));
  if (stillOpen) return;
  await eachChannel(guild, (channel) => channel.permissionOverwrites.delete(app.userId, reason).catch(() => {}));
}

// Oryantasyon bitince kanalları kilitler; başvuran hâlâ bir görüşme kanalındaysa çıkana kadar bekler (çıkınca
// handleVoiceUpdate kilitler), konuşmanın ortasında kanaldan düşmesin
async function lockAfterLeave(guild, app, reason) {
  if (inRecruitmentChannel(guild, app.userId)) return;
  await revokeAccess(guild, app, reason);
}

// Oryantasyon bitince (tamamlanınca ya da iptal edilince) kanalları hemen kilitler. Başvuran hâlâ bir görüşme
// kanalındaysa son mesajları görebilsin diye kısa bir süre sonra kanaldan çıkarılır. Çıkarıldıysa true döner.
async function closeForApplicant(guild, app, reason) {
  await revokeAccess(guild, app, reason);
  const member = await guild.members.fetch(app.userId).catch(() => null);
  if (!isRecruitmentChannel(member?.voice.channelId)) return false;
  setTimeout(() => {
    if (isRecruitmentChannel(member.voice.channelId)) member.voice.disconnect(reason).catch(() => {});
  }, config.disconnectDelaySeconds * 1000);
  return true;
}

// Yetkili görüşme kanallarından birindeyse o kanalın ID'si
function staffVoiceChannel(guild, userId) {
  const channelId = guild.voiceStates.cache.get(userId)?.channelId;
  return isRecruitmentChannel(channelId) ? channelId : null;
}

// Oryantasyon için kanal: yetkili zaten bir görüşme kanalındaysa o kanal, değilse içinde kimse olmayan ve başka bir
// oryantasyonun sürmediği ilk kanal. Hepsi doluysa null.
function pickOrientationChannel(guild, staffId) {
  const staffChannel = staffVoiceChannel(guild, staffId);
  if (staffChannel) return staffChannel;

  const busy = new Set(store.inOrientation().map((a) => a.orientation.channelId).filter(Boolean));
  return (
    channelIds().find((id) => !busy.has(id) && !guild.voiceStates.cache.some((state) => state.channelId === id)) ?? null
  );
}

// Kanaldan ayrılan başvuranlar için bekleyen kilitleme zamanlayıcıları: sunucu:kullanıcı -> timeout
const leaveTimers = new Map();

// Başvuran görüşme kanalından ayrılınca mülakat bitmiş sayılır, kısa bir süre sonra erişimi kapatılır.
// Bu sürede tekrar bir görüşme kanalına girerse kilitleme iptal edilir. Oryantasyondaki başvurular kilitlenmez.
function handleVoiceUpdate(oldState, newState) {
  const key = `${newState.guild.id}:${newState.id}`;

  if (isRecruitmentChannel(newState.channelId)) {
    clearTimeout(leaveTimers.get(key));
    leaveTimers.delete(key);
    return;
  }
  if (!isRecruitmentChannel(oldState.channelId)) return;

  const hasAccess = () =>
    store
      .withVoiceAccess()
      .filter((a) => a.guildId === newState.guild.id && a.userId === newState.id && !inOrientation(a));
  if (!hasAccess().length) return;

  clearTimeout(leaveTimers.get(key));
  leaveTimers.set(
    key,
    setTimeout(async () => {
      leaveTimers.delete(key);
      for (const app of hasAccess()) {
        await revokeAccess(newState.guild, app, `Yetkili başvurusu #${pad(app.number)} görüşmesi bitti`);
      }
    }, config.leaveLockMinutes * 60 * 1000),
  );
}

// Süresi dolan ve sonuçlanmış başvurulara ait erişimleri kapatır. Oryantasyondakilere dokunulmaz;
// sonuçlanmış ama başvuranı hâlâ kanalda olanlar, başvuran çıkınca handleVoiceUpdate ile kilitlenir.
async function sweep(client) {
  for (const app of store.withVoiceAccess()) {
    if (inOrientation(app)) continue;
    if (app.voiceAccessUntil > Date.now() && !finished(app)) continue;
    const guild = client.guilds.cache.get(app.guildId);
    if (!guild) continue;
    if (finished(app)) await lockAfterLeave(guild, app, 'Başvuru sonuçlandı');
    else await revokeAccess(guild, app, 'Görüşme ses kanalı erişim süresi doldu');
  }
}

function startSweeper(client) {
  sweep(client).catch((err) => console.error('[basvuru] Ses erişimi temizlenemedi:', err.message));
  setInterval(
    () => sweep(client).catch((err) => console.error('[basvuru] Ses erişimi temizlenemedi:', err.message)),
    SWEEP_INTERVAL,
  ).unref();
}

module.exports = {
  isRecruitmentChannel,
  inOrientation,
  grantAccess,
  revokeAccess,
  lockAfterLeave,
  closeForApplicant,
  staffVoiceChannel,
  pickOrientationChannel,
  startSweeper,
  handleVoiceUpdate,
};
