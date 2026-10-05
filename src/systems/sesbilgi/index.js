// Sesli bilgi sistemi: ayarlı kanala sesli kanallar hakkında bilgi paneli gönderir. Panel bot açılınca kendiliğinden
// gönderilir, metin ya da görsel değişmediyse dokunulmaz (core/panel.js).
const { Events } = require('discord.js');
const { syncPanel } = require('../../core/panel');
const config = require('./config');
const ui = require('./ui');

function sendPanel(client) {
  if (!config.channel) return;
  return syncPanel(client, {
    key: 'ses-bilgi',
    label: 'Sesli bilgi',
    channelId: config.channel,
    buttonId: ui.TITLE,
    build: ui.panel,
    image: '',
  });
}

module.exports = {
  name: 'sesbilgi',
  events: { [Events.ClientReady]: sendPanel },
};
