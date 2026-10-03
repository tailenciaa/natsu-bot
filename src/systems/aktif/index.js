// Haftanın aktifleri: mesaj, ses ve yayın (ekran paylaşımı) süresi haftalık olarak ayrı ayrı sayılır. Her hafta
// pazartesi, geçen haftanın üç kategorisinin de birincisi #haftalık kanalına duyurulur ve kategorisine özel rol
// verilir; rol önceki haftanın sahibinden geri alınır. Botlar ve AFK kanalı sayılmaz, ses/yayın dakikada bir kredi verilir.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, fetchTextChannel } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { weekKey, previousWeekKey, isMonday } = require('./week');

const commands = [
  new SlashCommandBuilder()
    .setName('haftalik-onizleme')
    .setDescription('Bu haftanın şu anki ses/mesaj/yayın sıralamasını önizler (test amaçlı, rol vermez, duyuru atmaz).')
    .setContexts(InteractionContextType.Guild),
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

// O haftanın toplamlarından en yüksekten düşüğe ilk 5 kullanıcıyı listeler
function topUsers(totals, limit = 5) {
  return Object.entries(totals)
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

async function announceWeek(guild, target) {
  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) return;

  const results = {};
  const winnerIds = [];
  for (const kind of ['ses', 'mesaj', 'yayin']) {
    const list = topUsers(store.totals(kind, target));
    results[kind] = list;
    const winner = list[0] ?? null;
    if (winner) winnerIds.push(winner.userId);

    const roleId = config.roles[kind];
    const prevHolder = store.holder(kind);
    if (roleId && winner && winner.userId !== prevHolder) {
      if (prevHolder) {
        const prevMember = await guild.members.fetch(prevHolder).catch(() => null);
        await prevMember?.roles.remove(roleId, 'Haftanın aktifi değişti').catch(() => {});
      }
      const member = await guild.members.fetch(winner.userId).catch(() => null);
      await member?.roles.add(roleId, 'Haftanın aktifi').catch(() => {});
      store.setHolder(kind, winner.userId);
    }
  }

  await channel.send({ components: [ui.weeklyAnnounce(guild, results)], flags: core.CV2, allowedMentions: { users: winnerIds } }).catch(() => {});
}

async function checkWeeklyAnnounce(guild) {
  const now = Date.now();
  if (!isMonday(now)) return;
  const target = previousWeekKey(now);
  if (store.lastRun() === target) return;
  await announceWeek(guild, target).catch((err) => console.error('[aktif] Haftalık duyuru gönderilemedi:', err.message));
  store.setLastRun(target);
}

// /haftalik-onizleme: bu haftanın şimdiye kadarki durumunu gösterir, rol vermez, duyuru atmaz, kimseyi etiketlemez
async function handlePreview(interaction) {
  const target = weekKey();
  const results = {
    ses: topUsers(store.totals('ses', target)),
    mesaj: topUsers(store.totals('mesaj', target)),
    yayin: topUsers(store.totals('yayin', target)),
  };
  return respond(interaction, ui.weeklyAnnounce(interaction.guild, results, true), { ephemeral: true });
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
  help: { category: ['siralama', 'Sıralama'], access: { 'haftalik-onizleme': 'Herkes' } },
  slash: { 'haftalik-onizleme': handlePreview },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.MessageCreate]: handleMessage,
  },
};
