// Yayın yetkisi sistemi: ayarlı kanaldaki panelin butonuna basan üyeye yayın yetkisi rolü verilir, "Yetkiyi Bırak" ile geri alınır.
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
    key: 'yayin',
    label: 'Yayın Yetkisi',
    channelId: config.channel,
    buttonId: ui.IDS.al,
    build: ui.panel,
    image: '',
  });
}

async function handleTake(interaction) {
  if (interaction.member.roles.cache.has(config.role)) return replyError(interaction, 'Zaten yayın yetkin var.', 'Bırakmak için **Yetkiyi Bırak** butonuna bas.');

  const added = await interaction.member.roles.add(config.role, 'Yayın yetkisi alındı').catch((err) => {
    console.error('[yayin] Rol verilemedi:', err.message);
    return null;
  });
  if (!added) return replyError(interaction, 'Rol verilemedi.', 'Lütfen bir yetkiliye bildir.');

  return respond(interaction, core.alert('Yayın yetkin verildi.', 'Artık sesli kanallarda **yayın açabilirsin.**', 'success'));
}

async function handleLeave(interaction) {
  if (!interaction.member.roles.cache.has(config.role)) return replyError(interaction, 'Yayın yetkin zaten yok.', 'Almak için **Yayın Yetkisi Al** butonuna bas.');

  const removed = await interaction.member.roles.remove(config.role, 'Yayın yetkisi bırakıldı').catch((err) => {
    console.error('[yayin] Rol alınamadı:', err.message);
    return null;
  });
  if (!removed) return replyError(interaction, 'Rol alınamadı.', 'Lütfen bir yetkiliye bildir.');

  return respond(interaction, core.alert('Yayın yetkin bırakıldı.', 'İstediğin zaman yeniden alabilirsin.', 'success'));
}

module.exports = {
  name: 'yayin',
  buttons: { [ui.IDS.al]: handleTake, [ui.IDS.birak]: handleLeave },
  events: { [Events.ClientReady]: sendPanel },
};
