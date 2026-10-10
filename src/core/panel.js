// Paneller komutla kurulmaz: bot açılınca her sistem kendi panelini ayarlı kanala kendisi gönderir.
// Gönderilen panelin mesaj ID'si ve içeriğinin özeti data/db.json'da tutulur. Metin ya da görsel değişmediyse
// ve mesaj yerindeyse dokunulmaz; değiştiyse ya da mesaj silindiyse yeni panel gönderilir, eskisi ancak yenisi
// gönderildikten sonra silinir (gönderim başarısız olursa kanal panelsiz kalmaz).
const crypto = require('node:crypto');
const fs = require('node:fs');
const { AttachmentBuilder } = require('discord.js');
const banner = require('./banner');
const { guildId } = require('./config');
const { data, save } = require('./db');
const { fetchTextChannel } = require('./helpers');
const ui = require('./ui');

const BANNER_NAME = 'banner.png';
const UNKNOWN_MESSAGE = 10008;
const SCAN_LIMIT = 100;

const hashOf = (...parts) => crypto.createHash('sha1').update(parts.join('\n')).digest('hex');

// Özet, imzalı CDN bağlantılarının her yenilemede değişen kısmından (?ex=...) etkilenmesin
const contentHash = (container) => hashOf(banner.stripSignature(JSON.stringify(container.toJSON())));

async function messageExists(channel, messageId) {
  return channel.messages
    .fetch(messageId)
    .then(() => true)
    .catch((err) => err.code !== UNKNOWN_MESSAGE);
}

// Kayıtlı panel mesajını ve kayıttan önce elle kurulmuş, butonu bu panele ait bot mesajlarını siler (yeni panel hariç)
async function removeOldPanels(client, channel, saved, buttonId, keepId) {
  if (saved?.messageId && saved.messageId !== keepId) {
    const savedChannel = await fetchTextChannel(channel.guild, saved.channelId);
    await savedChannel?.messages.delete(saved.messageId).catch(() => {});
  }

  const recent = await channel.messages.fetch({ limit: SCAN_LIMIT }).catch(() => null);
  const old = recent?.filter(
    (m) => m.id !== keepId && m.author.id === client.user.id && JSON.stringify(m.components).includes(buttonId),
  );
  for (const message of old?.values() ?? []) await message.delete().catch(() => {});
}

// Panel mesajındaki attachment://dosya adlarını bulur
const attachmentNames = (container) => [...JSON.stringify(container.toJSON()).matchAll(/attachment:\/\/([^"]+)"/g)].map((m) => m[1]);

// key: kayıttaki panel adı, label: loglarda görünen ad, buttonId: paneldeki butonun ID'si (butonsuz panelde
// panele özgü bir metin parçası), build(görselAdı): panel mesajını üreten fonksiyon, image: varsayılan banner
// yerine kullanılacak görselin yolu, card: çizim kartı ({name, buffer}) — afiş yerine panele ek olarak konur ve
// build'a kartın dosya adı verilir. Paneldeki Discord CDN afişleri otomatik indirilip mesaja ek olarak konur (core/banner.js).
async function syncPanel(client, { key, label, channelId, buttonId, build, image = ui.DEFAULT_BANNER, card = null }) {
  const guild = client.guilds.cache.get(guildId);
  const channel = await fetchTextChannel(guild, channelId);
  if (!channel) return console.error(`[panel] ${label} paneli gönderilemedi: kanal bulunamadı (${channelId}).`);

  try {
    const defaultBanner = image && fs.existsSync(image) ? fs.readFileSync(image) : null;
    const visualName = card?.name ?? (defaultBanner ? BANNER_NAME : null);

    // Önce paneldeki Discord CDN afişleri yerele indirilir, sonra panel yerel ekle birlikte kurulur
    const urls = [...JSON.stringify(build(visualName).toJSON()).matchAll(/"url":"(https:[^"]+)"/g)].map((m) => m[1]);
    await banner.ensure(client, urls);

    const container = build(visualName);
    if (buttonId && !JSON.stringify(container.toJSON()).includes(buttonId)) {
      console.error(`[panel] ${label} panelinde "${buttonId}" butonu yok; eski panel temizliği bu yüzden çalışmayabilir.`);
    }

    const attachments = banner.attachmentsFor(attachmentNames(container));
    const hash = hashOf(
      contentHash(container),
      defaultBanner ? hashOf(defaultBanner) : '',
      card ? hashOf(card.buffer) : '',
      ...attachments.map((a) => hashOf(a.buffer)),
    );

    const saved = data.panels[key];
    if (saved?.channelId === channel.id && saved.hash === hash && (await messageExists(channel, saved.messageId))) return;

    const files = [
      ...(defaultBanner ? [new AttachmentBuilder(defaultBanner, { name: BANNER_NAME })] : []),
      ...(card ? [new AttachmentBuilder(card.buffer, { name: card.name })] : []),
      ...attachments.map((a) => new AttachmentBuilder(a.buffer, { name: a.name })),
    ];
    const message = await channel.send({ components: [container], files, flags: ui.SILENT_CV2, allowedMentions: { parse: [] } });

    data.panels[key] = { channelId: channel.id, messageId: message.id, hash };
    save();
    await removeOldPanels(client, channel, saved, buttonId, message.id);
    console.log(`[panel] ${label} paneli #${channel.name} kanalına gönderildi.`);
  } catch (err) {
    // Bir panelin hatası diğer panellerin gönderimini durdurmasın
    console.error(`[panel] ${label} paneli gönderilemedi: ${err.message}`);
  }
}

// Panel mesajı bot tarafından sonradan düzenlenirse (ör. butondaki sayı) kayıtlı özeti güncellemek için.
// Afiş eki bu özeti değiştirmez; bu yüzden ek kopyalarının özeti burada da katılır.
const panelHash = (container) => {
  const attachments = banner.attachmentsFor(attachmentNames(container));
  return hashOf(contentHash(container), '', ...attachments.map((a) => hashOf(a.buffer)));
};

module.exports = { syncPanel, panelHash };
