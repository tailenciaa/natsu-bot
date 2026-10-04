// Cezalarım paneli ayarları. ID değiştirince botu yeniden başlatmak yeterli.
const sicilConfig = require('../sicil/config');

module.exports = {
  // Panelin gönderileceği kanal (#cezalarım)
  channel: '1538535566172229672',

  // Ana panel görseli (doğrudan URL)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555889162949754920/cezalarmkazuki.jpg?backend=b2&ex=6ac37bb3&is=6ac22a33&hm=b242051ba36fc92353e5cea7ad0be97b359439c1fb95d82b620e02d3ce06ee4b&',

  // Jail kanalına da aynı "ne zaman bitecek" butonunu taşıyan küçük bir bilgilendirme paneli gönderilir:
  // jail'deki üye başka kanalları göremediği için #cezalarım paneline ulaşamaz. sicil ayarlarındaki jail
  // kanalıyla aynıdır, null ise jail kapalı demektir ve bu panel gönderilmez.
  jailChannel: sicilConfig.channels.jail,
};
