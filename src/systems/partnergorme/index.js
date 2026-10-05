// Partner görme sistemi: ayarlı kanaldaki panelin butonuna basan üyeye partner kanallarını görme rolü verilir.
// Panel diğer sistemlerdeki gibi bot açılınca kendiliğinden gönderilir (core/panel.js).
const { Events } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const config = require('./config');
const ui = require('./ui');

function sendPanel(client) {
  if (!config.channel) return;
  return syncPanel(client, {
    key: 'partnergorme',
    label: 'Partner Görme',
    channelId: config.channel,
    buttonId: ui.IDS.ver,
    build: ui.panel,
    image: '',
  });
}

async function handleButton(interaction) {
  if (interaction.member.roles.cache.has(config.role)) {
    return replyError(interaction, 'Zaten partner rolün var.', 'Partner kanallarını görebiliyorsun.');
  }

  const added = await interaction.member.roles.add(config.role, 'Partner görme').catch((err) => {
    console.error('[partnergorme] Rol verilemedi:', err.message);
    return null;
  });
  if (!added) return replyError(interaction, 'Rol verilemedi.', 'Lütfen bir yetkiliye bildir.');

  return respond(interaction, core.alert('Partner rolün verildi.', 'Partner kanallarını artık görebilirsin.', 'success'));
}

module.exports = {
  name: 'partnergorme',
  buttons: { [ui.IDS.ver]: handleButton },
  events: { [Events.ClientReady]: sendPanel },
};
