// Yeni/şüpheli hesap sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Discord hesabı bu süreden daha yeni olan üyeler kısıtlanır
  thresholdDays: 7,

  // Kısıtlı üyelerin görebileceği tek kanal
  channel: '1538944428063068181',

  // Kısıtlama rolü: Discord'da zaten var olan sabit rol, bot kendisi rol oluşturmaz
  roleId: '1556274144042164234',

  // Panel görseli (doğrudan URL)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555880947730223155/bilgilendirmekazuki.jpg?backend=b2&ex=6ac3740c&is=6ac2228c&hm=7e59ef0269e9f8fd2524f65fd9a4bd5d9e0096af1b76fcb6417c574b7ee928c9&',

  // Üyelerin hesap yaşı kaç saniyede bir yeniden kontrol edilir (süresi dolanların rolü otomatik alınır)
  sweepSeconds: 60 * 60,
};
