// Kurallar paneli: bot açılınca #kurallar kanalına kendiliğinden gönderilir (core/panel.js), metin config.js'te.
// Metin ya da görsel değişince eski panel silinip yenisi gönderilir. Panelin altındaki "Okudum, Kabul Ediyorum"
// butonuna basan üyeye sadece kendisinin göreceği bir teşekkür mesajı gelir, butondaki sayı güncellenir.
const { Events } = require('discord.js');
const core = require('../../core/ui');
const { data, save } = require('../../core/db');
const { respond } = require('../../core/helpers');
const { syncPanel, panelHash } = require('../../core/panel');
const logSystem = require('../log');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

function sendPanel(client) {
  if (!config.channel) return;
  return syncPanel(client, {
    key: 'kurallar',
    label: 'Kurallar',
    channelId: config.channel,
    buttonId: ui.TITLE,
    build: ui.panel,
    image: '',
  });
}

async function handleAccept(interaction) {
  if (store.has(interaction.user.id)) {
    return respond(interaction, core.alert('Kuralları zaten kabul ettin.', 'Tekrar basmana gerek yok.', 'success'));
  }
  store.add(interaction.user.id);

  // Sayı değişince panelin kayıtlı özeti de güncellenir; yoksa bot yeniden açıldığında panel gereksiz yere yeniden gönderilir
  const container = ui.panel();
  if (data.panels.kurallar) {
    data.panels.kurallar.hash = panelHash(container);
    save();
  }
  await interaction.update({ components: [container], allowedMentions: { parse: [] } });
  await respond(
    interaction,
    core.alert('Teşekkürler!', 'Kuralları okuyup kabul ettiğin için teşekkür ederiz. Sunucumuzda iyi eğlenceler!', 'success'),
  );

  logSystem
    .write(interaction.client, 'bot', {
      color: 'success',
      title: 'Kurallar Kabul Edildi',
      lines: [`**Kullanıcı:** <@${interaction.user.id}>`, `**Kabul eden toplam:** ${store.count()}`],
    })
    .catch(() => {});
}

module.exports = {
  name: 'kurallar',
  buttons: { [ui.IDS.accept]: handleAccept },
  events: { [Events.ClientReady]: sendPanel },
};
