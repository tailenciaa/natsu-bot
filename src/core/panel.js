// Paneller komutla kurulmaz: bot açılınca her sistem kendi panelini ayarlı kanala kendisi gönderir.
// Gönderilen panelin mesaj ID'si ve içeriğinin özeti data/db.json'da tutulur. Metin ya da görsel değişmediyse
// ve mesaj yerindeyse dokunulmaz; değiştiyse ya da mesaj silindiyse eski panel kaldırılıp yenisi gönderilir.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { AttachmentBuilder } = require('discord.js');
const { guildId } = require('./config');
const { data, save } = require('./db');
const { fetchTextChannel } = require('./helpers');
const ui = require('./ui');

const BANNER_NAME = 'banner.png';
const UNKNOWN_MESSAGE = 10008;

const hashOf = (...parts) => crypto.createHash('sha1').update(parts.join('\n')).digest('hex');

async function messageExists(channel, messageId) {
  return channel.messages
    .fetch(messageId)
    .then(() => true)
    .catch((err) => err.code !== UNKNOWN_MESSAGE);
}

// Kayıtlı panel mesajını ve kayıttan önce elle kurulmuş, butonu bu panele ait bot mesajlarını siler
async function removeOldPanels(client, channel, saved, buttonId) {
  if (saved?.messageId) {
    const savedChannel = await fetchTextChannel(channel.guild, saved.channelId);
    await savedChannel?.messages.delete(saved.messageId).catch(() => {});
  }

  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const old = recent?.filter((m) => m.author.id === client.user.id && JSON.stringify(m.components).includes(buttonId));
  for (const message of old?.values() ?? []) await message.delete().catch(() => {});
}

// key: kayıttaki panel adı, label: loglarda görünen ad, buttonId: paneldeki butonun ID'si (butonsuz panelde
// panele özgü bir metin parçası), build(görselAdı): panel mesajını üreten fonksiyon, image: varsayılan banner
// yerine kullanılacak görselin yolu
async function syncPanel(client, { key, label, channelId, buttonId, build, image = ui.DEFAULT_BANNER }) {
  const guild = client.guilds.cache.get(guildId);
  const channel = await fetchTextChannel(guild, channelId);
  if (!channel) return console.error(`[panel] ${label} paneli gönderilemedi: kanal bulunamadı (${channelId}).`);

  const banner = fs.existsSync(image) ? fs.readFileSync(image) : null;
  const container = build(banner ? BANNER_NAME : null);
  const hash = hashOf(JSON.stringify(container.toJSON()), banner ? hashOf(banner) : '');

  const saved = data.panels[key];
  if (saved?.channelId === channel.id && saved.hash === hash && (await messageExists(channel, saved.messageId))) return;

  await removeOldPanels(client, channel, saved, buttonId);
  const message = await channel.send({
    components: [container],
    files: banner ? [new AttachmentBuilder(banner, { name: BANNER_NAME })] : [],
    flags: ui.CV2,
  });

  data.panels[key] = { channelId: channel.id, messageId: message.id, hash };
  save();
  console.log(`[panel] ${label} paneli #${channel.name} kanalına gönderildi.`);
}

module.exports = { syncPanel };
