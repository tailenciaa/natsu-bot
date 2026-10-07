// Başvuru süreç kayıtları: görüşmenin ve oryantasyonun başladığı, ilerlediği ve bittiği kayıt kanalına yazılır.
// Kayıt kanalı başvurular kanalıyla aynıysa mesajlar başvuru mesajına yanıt olarak gider, hangi başvuruya ait olduğu belli olur.
// Kayıtlar takip amaçlı, normalde kimse etiketlenmez; "yetkili bekleniyor" gibi dikkat gerektirenler rol etiketleyebilir.
const core = require('../../core/ui');
const { fetchTextChannel } = require('../../core/helpers');
const config = require('./config');

// roles / users: etiketlenecek rol ve kullanıcı ID'leri (mesajın içinde geçmeleri gerekir)
async function send(guild, app, container, roles = [], users = []) {
  const channel = await fetchTextChannel(guild, config.channels.log);
  if (!channel) return null;
  const reply =
    channel.id === app.channelId && app.messageId ? { messageReference: app.messageId, failIfNotExists: false } : undefined;
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

module.exports = { send, edit };
