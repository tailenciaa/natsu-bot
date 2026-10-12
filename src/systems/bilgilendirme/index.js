// Bilgilendirme panelleri: bot açılınca config.js'teki her panel kendi kanalına, bölüm başına bir mesaj olarak
// kendiliğinden gönderilir. Metin ya da görsel değişince eski mesajlar silinip hepsi yeniden gönderilir.
// Tek mesajlık panellerden (core/panel.js) farkı: birden çok mesaj olduğu için mesaj ID'leri burada tutulur.
const crypto = require('node:crypto');
const { AttachmentBuilder, Events } = require('discord.js');
const banner = require('../../core/banner');
const { guildId } = require('../../core/config');
const { data, save } = require('../../core/db');
const { fetchTextChannel } = require('../../core/helpers');
const { SILENT_CV2 } = require('../../core/ui');
const logSystem = require('../log');
const config = require('./config');
const ui = require('./ui');

const UNKNOWN_MESSAGE = 10008;

const exists = (channel, id) =>
  channel.messages
    .fetch(id)
    .then(() => true)
    .catch((err) => err.code !== UNKNOWN_MESSAGE);

// Mesajdaki attachment://dosya adlarını bulur (Discord CDN afişleri yerel kopyaya çevrilmiş olur, core/banner.js)
const attachmentNames = (container) => [...JSON.stringify(container.toJSON()).matchAll(/attachment:\/\/([^"]+)"/g)].map((m) => m[1]);

async function sendPanel(client, panel) {
  const guild = client.guilds.cache.get(guildId);
  const channel = await fetchTextChannel(guild, panel.channel);
  if (!channel) return console.error(`[panel] ${panel.name} gönderilemedi: kanal bulunamadı (${panel.channel}).`);

  // Afiş bağlantılarının süresi dolduğu için önce yerel kopyaları hazırlanır, sonra mesajlar bu kopyalarla kurulur
  const containers = ui.messages(panel);
  const urls = containers.flatMap((c) => [...JSON.stringify(c.toJSON()).matchAll(/"url":"(https:[^"]+)"/g)].map((m) => m[1]));
  await banner.ensure(client, urls);
  const files = containers.map((c) => banner.attachmentsFor(attachmentNames(c)));
  // Özet, imzalı bağlantıların her yenilemede değişen kısmından etkilenmez
  const hash = crypto
    .createHash('sha1')
    .update(banner.stripSignature(JSON.stringify(containers.map((c) => c.toJSON()))))
    .update(files.flat().map((f) => crypto.createHash('sha1').update(f.buffer).digest('hex')).join(''))
    .digest('hex');

  const saved = data.panels[panel.key];
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
  let failure = null;
  for (const [index, container] of containers.entries()) {
    try {
      const message = await channel.send({
        components: [container],
        files: files[index].map((f) => new AttachmentBuilder(f.buffer, { name: f.name })),
        flags: SILENT_CV2,
        allowedMentions: { parse: [] },
      });
      messageIds.push(message.id);
    } catch (err) {
      failure = err;
      break;
    }
  }

  // Gönderim yarıda kalırsa gönderilenlerin ID'leri yine de kaydedilir (bir sonraki açılışta silinip baştan gönderilsin);
  // özet boş bırakılır ki panel tamamlanmış sayılmasın
  data.panels[panel.key] = { channelId: channel.id, messageIds, hash: failure ? '' : hash };
  save();
  if (failure) {
    console.error(`[panel] ${panel.name} yarım kaldı (${messageIds.length}/${containers.length} mesaj): ${failure.message}`);
    return logSystem
      .write(client, 'bot', {
        color: 'danger',
        title: `${panel.name} Gönderilemedi`,
        lines: [`**Kanal:** <#${channel.id}>`, `**Gönderilen:** ${messageIds.length}/${containers.length}`, `**Hata:** ${failure.message}`],
      })
      .catch(() => {});
  }
  console.log(`[panel] ${panel.name} #${channel.name} kanalına gönderildi (${messageIds.length} mesaj).`);

  logSystem
    .write(client, 'bot', {
      color: 'primary',
      title: `${panel.name} Güncellendi`,
      lines: [`**Kanal:** <#${channel.id}>`, `**Mesaj sayısı:** ${messageIds.length}`],
    })
    .catch(() => {});
}

async function sendPanels(client) {
  for (const panel of config.panels) await sendPanel(client, panel);
}

module.exports = {
  name: 'bilgilendirme',
  events: { [Events.ClientReady]: sendPanels },
};
