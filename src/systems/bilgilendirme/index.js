// Bilgilendirme paneli: bot açılınca #bilgilendirme kanalına bölümlerin her biri ayrı mesaj olarak kendiliğinden
// gönderilir, metin config.js'te. Metin ya da görsel değişince eski mesajlar silinip hepsi yeniden gönderilir.
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

const KEY = 'bilgilendirme';
const UNKNOWN_MESSAGE = 10008;

const exists = (channel, id) =>
  channel.messages
    .fetch(id)
    .then(() => true)
    .catch((err) => err.code !== UNKNOWN_MESSAGE);

// Mesajdaki attachment://dosya adlarını bulur (Discord CDN afişleri yerel kopyaya çevrilmiş olur, core/banner.js)
const attachmentNames = (container) => [...JSON.stringify(container.toJSON()).matchAll(/attachment:\/\/([^"]+)"/g)].map((m) => m[1]);

async function sendPanel(client) {
  const guild = client.guilds.cache.get(guildId);
  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) return console.error(`[panel] Bilgilendirme paneli gönderilemedi: kanal bulunamadı (${config.channel}).`);

  // Afiş bağlantılarının süresi dolduğu için önce yerel kopyaları hazırlanır, sonra mesajlar bu kopyalarla kurulur
  const urls = ui.messages().flatMap((c) => [...JSON.stringify(c.toJSON()).matchAll(/"url":"(https:[^"]+)"/g)].map((m) => m[1]));
  await banner.ensure(client, urls);
  const containers = ui.messages();
  const files = containers.map((c) => banner.attachmentsFor(attachmentNames(c)));
  // Özet, imzalı bağlantıların her yenilemede değişen kısmından etkilenmez
  const hash = crypto
    .createHash('sha1')
    .update(banner.stripSignature(JSON.stringify(containers.map((c) => c.toJSON()))))
    .update(files.flat().map((f) => crypto.createHash('sha1').update(f.buffer).digest('hex')).join(''))
    .digest('hex');

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
  data.panels[KEY] = { channelId: channel.id, messageIds, hash: failure ? '' : hash };
  save();
  if (failure) {
    console.error(`[panel] Bilgilendirme paneli yarım kaldı (${messageIds.length}/${containers.length} mesaj): ${failure.message}`);
    return logSystem
      .write(client, 'bot', {
        color: 'danger',
        title: 'Bilgilendirme Paneli Gönderilemedi',
        lines: [`**Kanal:** <#${channel.id}>`, `**Gönderilen:** ${messageIds.length}/${containers.length}`, `**Hata:** ${failure.message}`],
      })
      .catch(() => {});
  }
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
