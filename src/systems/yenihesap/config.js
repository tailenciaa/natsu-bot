// Yeni/şüpheli hesap sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Discord hesabı bu süreden daha yeni olan üyeler kısıtlanır
  thresholdDays: 7,

  // Kısıtlı üyelerin görebileceği tek kanal
  channel: '1538944428063068181',

  // Kısıtlama rolü: Discord'da zaten var olan sabit rol, bot kendisi rol oluşturmaz
  roleId: '1556274144042164234',

  // Üyelerin hesap yaşı kaç saniyede bir yeniden kontrol edilir (süresi dolanların rolü otomatik alınır)
  sweepSeconds: 60 * 60,
};
