// Kurallar paneli: bot açılınca #kurallar kanalına kendiliğinden gönderilir (core/panel.js), metin config.js'te.
// Metin ya da görsel değişince eski panel silinip yenisi gönderilir.
const path = require('node:path');
const { Events } = require('discord.js');
const { syncPanel } = require('../../core/panel');
const config = require('./config');
const ui = require('./ui');

const IMAGE = path.join(__dirname, '..', '..', '..', 'assets', 'kurallar.png');

function sendPanel(client) {
  if (!config.channel) return;
  return syncPanel(client, {
    key: 'kurallar',
    label: 'Kurallar',
    channelId: config.channel,
    buttonId: ui.TITLE,
    build: ui.panel,
    image: IMAGE,
  });
}

module.exports = {
  name: 'kurallar',
  events: { [Events.ClientReady]: sendPanel },
};
