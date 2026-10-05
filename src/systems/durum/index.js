// Bot durumu: Discord'un İzliyor / Oynuyor gibi durumlarından biri (config.js'te seçilir).
// Başta sunucunun adı yazar (Discord durumu zaten kalın gösterir), yanında öncelik sırasıyla:
//   1. Seste biri varsa sesteki kişi sayısı (botlar hariç)
//   2. Yoksa sunucudaki çevrimiçi üye sayısı (Discord'un yaklaşık sayısı, ek yetki gerektirmez)
//   3. O da alınamazsa config.js'teki yazılar sırayla
const { Events } = require('discord.js');
const { guildId } = require('../../core/config');
const config = require('./config');

// Çevrimiçi sayısı her seferinde Discord'dan istenmez, bu süre boyunca son alınan sayı kullanılır
const ONLINE_CACHE = 2 * 60 * 1000;

let online = { count: null, fetchedAt: 0 };
let phraseIndex = 0;
let lastText = null;

async function onlineCount(client) {
  if (Date.now() - online.fetchedAt < ONLINE_CACHE) return online.count;
  const guild = await client.guilds.fetch({ guild: guildId, withCounts: true, force: true }).catch(() => null);
  online = { count: guild?.approximatePresenceCount ?? null, fetchedAt: Date.now() };
  return online.count;
}

function voiceCount(guild) {
  // AFK kanalındakiler seviye ve sıralama sistemlerindeki gibi sayılmaz
  return guild.voiceStates.cache.filter((state) => state.channelId && state.channelId !== guild.afkChannelId && !state.member?.user.bot).size;
}

async function detail(client, guild) {
  const inVoice = voiceCount(guild);
  if (inVoice > 0) return `Seste ${inVoice} kişi`;

  const count = await onlineCount(client);
  if (count) return `${count} aktif üye`;

  const phrase = config.phrases[phraseIndex % config.phrases.length];
  phraseIndex += 1;
  return phrase;
}

async function update(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const text = `❄️ ${guild.name} - ${await detail(client, guild)}`;
  if (text === lastText) return;
  lastText = text;
  client.user.setPresence({ activities: [{ name: text, type: config.type }], status: 'online' });
}

function handleReady(client) {
  const run = () => update(client).catch((err) => console.error('[durum] Durum güncellenemedi:', err.message));
  run();
  setInterval(run, config.intervalSeconds * 1000).unref();
}

module.exports = {
  name: 'durum',
  events: {
    [Events.ClientReady]: handleReady,
    // Discord bağlantısı yeniden kurulunca durum bir sonraki güncellemede tekrar gönderilsin
    [Events.ShardResume]: () => {
      lastText = null;
    },
    [Events.ShardReady]: () => {
      lastText = null;
    },
  },
};
