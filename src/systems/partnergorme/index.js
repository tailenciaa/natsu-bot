// Partner görme sistemi: ayarlı kanaldaki panelin butonuna basan üyeye partner kanallarını görme rolü verilir.
// Tek buton hem verir hem alır: panel tek ve ortak bir mesaj olduğu için etiket kişinin rol durumunu gösteremez.
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
  const varMi = interaction.member.roles.cache.has(config.role);
  const roller = interaction.member.roles;

  const ok = await (varMi ? roller.remove(config.role, 'Partner rolü bırakıldı') : roller.add(config.role, 'Partner görme'))
    .then(() => true)
    .catch((err) => {
      console.error('[partnergorme] Rol güncellenemedi:', err.message);
      return false;
    });
  if (!ok) return replyError(interaction, varMi ? 'Rolün alınamadı.' : 'Rol verilemedi.', 'Lütfen bir yetkiliye bildir.');

  // KİŞİYE ÖZEL: kendi rolünün durumu yalnızca butona basanı ilgilendirir
  return respond(
    interaction,
    varMi
      ? core.alert('Partner rolün alındı.', 'Partner kanallarını artık göremiyorsun; istediğin zaman aynı butonla geri alabilirsin.', 'warning')
      : core.alert('Partner rolün verildi.', 'Partner kanallarını artık görebilirsin; bırakmak için aynı butona tekrar bas.', 'success'),
    { ephemeral: true },
  );
}

module.exports = {
  name: 'partnergorme',
  buttons: { [ui.IDS.ver]: handleButton },
  events: { [Events.ClientReady]: sendPanel },
};
