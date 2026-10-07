// Başvuru süreç kayıtları: görüşmenin ve oryantasyonun başladığı, ilerlediği ve bittiği kayıt kanalına yazılır.
// Kayıt kanalı başvurular kanalıyla aynıysa mesajlar başvuru mesajına yanıt olarak gider, hangi başvuruya ait olduğu belli olur.
// Kayıtlar takip amaçlı, normalde kimse etiketlenmez; "yetkili bekleniyor" gibi dikkat gerektirenler rol etiketleyebilir.
const core = require('../../core/ui');
const { fetchTextChannel } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

// roles / users: etiketlenecek rol ve kullanıcı ID'leri (mesajın içinde geçmeleri gerekir)
// reply: false verilirse mesaj başvuru mesajına yanıt olarak değil, bağımsız bir bildirim olarak gider
async function send(guild, app, container, roles = [], users = [], { reply: asReply = true } = {}) {
  const channel = await fetchTextChannel(guild, config.channels.log);
  if (!channel) return null;
  const reply =
    asReply && channel.id === app.channelId && app.messageId ? { messageReference: app.messageId, failIfNotExists: false } : undefined;
  return channel
    .send({ components: [container], flags: core.CV2, allowedMentions: { parse: [], roles, users, repliedUser: false }, reply })
    .catch((err) => {
      console.error('[basvuru] Süreç kaydı gönderilemedi:', err.message);
      return null;
    });
}

async function edit(guild, messageId, container) {
  if (!messageId) return;
  const channel = await fetchTextChannel(guild, config.channels.log);
  await channel?.messages.edit(messageId, { components: [container], allowedMentions: { parse: [] } }).catch(() => {});
}

// Kanalın sohbetindeki "Yetkili Bekleniyor" mesajını, yetkili bağlanınca "Yetkili Bağlandı"ya çevirir
async function closeWaiting(guild, app) {
  const wait = app.waitingChat;
  if (!wait) return;
  store.updateApplication(app.id, { waitingChat: null });
  const channel = await fetchTextChannel(guild, wait.channelId);
  await channel?.messages.edit(wait.messageId, { components: [ui.waitingResolved(app, wait.stage)], allowedMentions: { parse: [] } }).catch(() => {});
}

module.exports = { send, edit, closeWaiting };
