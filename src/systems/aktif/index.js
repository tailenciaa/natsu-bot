// Haftanın aktifleri: mesaj, ses ve yayın (ekran paylaşımı) süresi haftalık olarak ayrı ayrı sayılır. Her hafta
// pazartesi, geçen haftanın üç kategorisinin de birincisi #haftalık kanalına duyurulur ve kategorisine özel rol
// verilir; rol önceki haftanın sahibinden geri alınır. Botlar ve AFK kanalı sayılmaz, ses/yayın dakikada bir kredi verilir.
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { fetchTextChannel, respond, stillMember } = require('../../core/helpers');
const coin = require('../coin/store');
const coinConfig = require('../coin/config');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { weekKey, previousWeekKey } = require('./week');

const commands = [
  new SlashCommandBuilder()
    .setName('aktif-onizleme')
    .setDescription('Haftanın aktifleri duyurusunun önizlemesini sadece sana gösterir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const CHECK_INTERVAL = 15 * 60 * 1000;
const TICK = 60 * 1000;

const countsVoice = (state) => Boolean(state?.channelId) && !state.member?.user.bot && state.channelId !== state.guild.afkChannelId;
const countsStream = (state) => countsVoice(state) && Boolean(state.streaming);

const sesSince = new Map();
const yayinSince = new Map();

function credit(map, kind, userId, now) {
  const since = map.get(userId);
  if (since === undefined) return;
  const minutes = Math.min(now - since, 2 * TICK) / TICK;
  if (minutes <= 0) return;
  store.add(kind, userId, Math.round(minutes * 60), weekKey(now));
}

function tickVoice(guild) {
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (countsVoice(state)) {
      credit(sesSince, 'ses', state.id, now);
      sesSince.set(state.id, now);
    }
    if (countsStream(state)) {
      credit(yayinSince, 'yayin', state.id, now);
      yayinSince.set(state.id, now);
    }
  }
}

function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;
  const userId = newState.id;

  const wasStream = countsStream(oldState);
  const isStream = countsStream(newState);
  if (wasStream && !isStream) {
    credit(yayinSince, 'yayin', userId, Date.now());
    yayinSince.delete(userId);
  } else if (!wasStream && isStream) {
    yayinSince.set(userId, Date.now());
  }

  const wasVoice = countsVoice(oldState);
  const isVoice = countsVoice(newState);
  if (wasVoice && !isVoice) {
    credit(sesSince, 'ses', userId, Date.now());
    sesSince.delete(userId);
  } else if (!wasVoice && isVoice) {
    sesSince.set(userId, Date.now());
  }
}

function handleMessage(message) {
  if (message.guildId !== guildId || message.author.bot || message.webhookId) return;
  store.add('mesaj', message.author.id, 1, weekKey(message.createdTimestamp));
}

// O haftanın toplamlarından en yüksekten düşüğe ilk 5 kullanıcıyı listeler (sunucudan ayrılanlar hariç)
function topUsers(guild, totals, limit = 5) {
  return Object.entries(totals)
    .filter(([userId]) => stillMember(guild, userId))
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Kategorinin rolünü önceki sahibinden alıp yeni birinciye verir; rol gerçekten verilemezse sahip kaydedilmez
async function passRole(guild, kind, winnerId) {
  const roleId = config.roles[kind];
  const prevHolder = store.holder(kind);
  if (!roleId || winnerId === prevHolder) return;

  if (prevHolder) {
    const prevMember = await guild.members.fetch(prevHolder).catch(() => null);
    await prevMember?.roles.remove(roleId, 'Haftanın aktifi değişti').catch((err) => console.error(`[aktif] Rol önceki sahibinden alınamadı (${kind}):`, err.message));
  }
  if (!winnerId) return store.setHolder(kind, null);
  const member = await guild.members.fetch(winnerId).catch(() => null);
  const given = member ? await member.roles.add(roleId, 'Haftanın aktifi').then(() => true, (err) => {
    console.error(`[aktif] Haftanın aktifi rolü verilemedi (${kind}):`, err.message);
    return false;
  }) : false;
  store.setHolder(kind, given ? winnerId : null);
}

// Duyuruyu gönderir ve rolleri devreder; duyuru atıldıysa (ya da duyurulacak kayıt yoksa) true, tekrar denenmesi gerekiyorsa false döner
async function announceWeek(guild, target) {
  const results = {};
  for (const kind of ['ses', 'mesaj', 'yayin']) results[kind] = topUsers(guild, store.totals(kind, target));
  const winnerIds = ['ses', 'mesaj', 'yayin'].map((kind) => results[kind][0]?.userId).filter(Boolean);

  for (const kind of ['ses', 'mesaj', 'yayin']) await passRole(guild, kind, results[kind][0]?.userId ?? null);
  if (!winnerIds.length) return true; // hiç kayıt yoksa boş duyuru atılmaz

  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) {
    console.error('[aktif] Haftalık duyuru kanalı bulunamadı.');
    return false;
  }
  return channel.send({ components: [ui.weeklyAnnounce(guild, results)], flags: core.CV2, allowedMentions: { users: winnerIds } }).then(
    () => {
      // Coin ödülleri duyuru gerçekten gönderildikten sonra verilir: duyuru tekrar denenirse aynı hafta iki kez ödenmez
      for (const kind of ['ses', 'mesaj', 'yayin']) {
        results[kind].slice(0, coinConfig.awards.weekly.length).forEach((entry, index) =>
          coin.add(entry.userId, coinConfig.awards.weekly[index], `haftanın ${kind} ${index + 1}.si`),
        );
      }
      return true;
    },
    (err) => {
      console.error('[aktif] Haftalık duyuru gönderilemedi:', err.message);
      return false;
    },
  );
}

// /aktif-onizleme: bu haftanın şu ana kadarki durumuna göre duyurunun örneğini sadece komutu kullanana gösterir
async function handlePreview(interaction) {
  const results = {};
  for (const kind of ['ses', 'mesaj', 'yayin']) results[kind] = topUsers(interaction.guild, store.totals(kind, weekKey()));
  return respond(interaction, ui.weeklyAnnounce(interaction.guild, results));
}

// Bir önceki haftanın duyurusu yapılmadıysa yapar; bot pazartesi kapalıysa ya da kanal sorunluysa sonraki kontrolde yakalar
async function checkWeeklyAnnounce(guild) {
  const target = previousWeekKey(Date.now());
  if (store.lastRun() === target) return;
  const done = await announceWeek(guild, target).catch((err) => {
    console.error('[aktif] Haftalık duyuru hatası:', err.message);
    return false;
  });
  if (done) store.setLastRun(target);
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (countsVoice(state)) sesSince.set(state.id, now);
    if (countsStream(state)) yayinSince.set(state.id, now);
  }
  setInterval(() => tickVoice(guild), TICK).unref();
  setInterval(() => checkWeeklyAnnounce(guild), CHECK_INTERVAL).unref();
  checkWeeklyAnnounce(guild).catch((err) => console.error('[aktif] Haftalık kontrol hatası:', err.message));
}

module.exports = {
  name: 'aktif',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { 'aktif-onizleme': 'Yöneticiler' }, need: { 'aktif-onizleme': 'Yöneticiler' } },
  slash: { 'aktif-onizleme': handlePreview },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.MessageCreate]: handleMessage,
  },
};
