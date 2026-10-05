// Ses: bot, ayarlı ses kanalında mikrofonu ve kulaklığı kapalı şekilde sürekli durur.
// Ses bağlantısı (ses çalma) kurulmaz, Discord'a sadece "bu kanaldayım" bilgisi gönderilir; bu yüzden ek paket gerekmez.
// Bağlantı koparsa, bot kanaldan atılırsa ya da başka kanala taşınırsa kendiliğinden geri döner.
const { Events, GatewayOpcodes } = require('discord.js');
const { guildId } = require('../../core/config');
const config = require('./config');

const REJOIN_DELAY = 5 * 1000;
const CHECK_INTERVAL = 5 * 60 * 1000;

let botClient = null;
let rejoinTimer = null;

function join(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(config.channelId);
  if (!channel?.isVoiceBased()) return console.error(`[ses] Ses kanalı bulunamadı (${config.channelId}).`);
  if (!channel.permissionsFor(guild.members.me)?.has(['ViewChannel', 'Connect'])) {
    return console.error(`[ses] Botun #${channel.name} kanalına bağlanma yetkisi yok.`);
  }

  const state = guild.voiceStates.cache.get(client.user.id);
  if (state?.channelId === channel.id && state.selfMute && state.selfDeaf) return;

  guild.shard.send({
    op: GatewayOpcodes.VoiceStateUpdate,
    d: { guild_id: guild.id, channel_id: channel.id, self_mute: true, self_deaf: true },
  });
}

// Kısa bir gecikmeyle tekrar bağlanır; art arda gelen olaylarda tek sefer denenir
function scheduleJoin(client) {
  clearTimeout(rejoinTimer);
  rejoinTimer = setTimeout(() => join(client), REJOIN_DELAY);
}

function handleReady(client) {
  botClient = client;
  join(client);
  setInterval(() => join(client), CHECK_INTERVAL).unref();
}

// Bot kanaldan çıkarılır ya da taşınırsa geri döner
function handleVoiceUpdate(oldState, newState) {
  if (newState.id !== newState.client.user.id || newState.guild.id !== guildId) return;

  if (newState.channelId === config.channelId) {
    if (oldState.channelId !== config.channelId) console.log(`[ses] #${newState.channel.name} kanalına girildi.`);
    if (!newState.selfMute || !newState.selfDeaf) scheduleJoin(newState.client);
    return;
  }
  scheduleJoin(newState.client);
}

module.exports = {
  name: 'ses',
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    // Discord bağlantısı yeniden kurulunca kanala geri döner (ilk açılışta ClientReady halleder)
    [Events.ShardReady]: () => botClient && scheduleJoin(botClient),
    [Events.ShardResume]: () => botClient && scheduleJoin(botClient),
  },
};
