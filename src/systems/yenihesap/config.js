// Yeni/şüpheli hesap sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Discord hesabı bu süreden daha yeni olan üyeler kısıtlanır
  thresholdDays: 7,

  // Kısıtlı üyelerin görebileceği tek kanal
  channel: '1538944428063068181',

  // Kısıtlama rolünün adı; rol yoksa bot ilk açılışta kendisi oluşturup ID'sini kalıcı olarak kaydeder
  roleName: 'Şüpheli Hesap',

  // Üyelerin hesap yaşı kaç saniyede bir yeniden kontrol edilir (süresi dolanların rolü otomatik alınır)
  sweepSeconds: 60 * 60,
};
