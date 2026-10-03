// Cezalarım paneli ayarları. ID değiştirince botu yeniden başlatmak yeterli.
const sicilConfig = require('../sicil/config');

module.exports = {
  // Panelin gönderileceği kanal (#cezalarım)
  channel: '1538535566172229672',

  // Jail kanalına da aynı "ne zaman bitecek" butonunu taşıyan küçük bir bilgilendirme paneli gönderilir:
  // jail'deki üye başka kanalları göremediği için #cezalarım paneline ulaşamaz. sicil ayarlarındaki jail
  // kanalıyla aynıdır, null ise jail kapalı demektir ve bu panel gönderilmez.
  jailChannel: sicilConfig.channels.jail,
};
