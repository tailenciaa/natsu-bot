// Bilgilendirme paneli: bot açılınca #bilgilendirme kanalına bölümlerin her biri ayrı mesaj olarak kendiliğinden
// gönderilir, metin config.js'te. Metin ya da görsel değişince eski mesajlar silinip hepsi yeniden gönderilir.
// Tek mesajlık panellerden (core/panel.js) farkı: birden çok mesaj olduğu için mesaj ID'leri burada tutulur.
const crypto = require('node:crypto');
const { Events } = require('discord.js');
const { guildId } = require('../../core/config');
const { data, save } = require('../../core/db');
const { fetchTextChannel } = require('../../core/helpers');
const { CV2 } = require('../../core/ui');
const logSystem = require('../log');
const config = require('./config');
const ui = require('./ui');

const KEY = 'bilgilendirme';
const UNKNOWN_MESSAGE = 10008;

const exists = (channel, id) =>
  channel.messages
    .fetch(id)
    .then(() => true)
    .catch((err) => err.code !== UNKNOWN_MESSAGE);

async function sendPanel(client) {
  const guild = client.guilds.cache.get(guildId);
  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) return console.error(`[panel] Bilgilendirme paneli gönderilemedi: kanal bulunamadı (${config.channel}).`);

  const containers = ui.messages();
  const hash = crypto.createHash('sha1').update(JSON.stringify(containers.map((c) => c.toJSON()))).digest('hex');

  const saved = data.panels[KEY];
  const upToDate =
    saved?.channelId === channel.id &&
    saved.hash === hash &&
    saved.messageIds?.length === containers.length &&
    (await Promise.all(saved.messageIds.map((id) => exists(channel, id)))).every(Boolean);
  if (upToDate) return;

  // Eski panel mesajları ve kanalda kalmış diğer bot mesajları silinir
  for (const id of saved?.messageIds ?? []) await channel.messages.delete(id).catch(() => {});
  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  for (const message of recent?.filter((m) => m.author.id === client.user.id).values() ?? []) await message.delete().catch(() => {});

  const messageIds = [];
  for (const container of containers) {
    const message = await channel.send({ components: [container], flags: CV2, allowedMentions: { parse: [] } });
    messageIds.push(message.id);
  }

  data.panels[KEY] = { channelId: channel.id, messageIds, hash };
  save();
  console.log(`[panel] Bilgilendirme paneli #${channel.name} kanalına gönderildi (${messageIds.length} mesaj).`);

  logSystem
    .write(client, 'bot', {
      color: 'primary',
      title: 'Bilgilendirme Paneli Güncellendi',
      lines: [`**Kanal:** <#${channel.id}>`, `**Mesaj sayısı:** ${messageIds.length}`],
    })
    .catch(() => {});
}

module.exports = {
  name: 'bilgilendirme',
  events: { [Events.ClientReady]: sendPanel },
};
