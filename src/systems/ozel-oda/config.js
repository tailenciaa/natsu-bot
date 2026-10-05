// Özel oda sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Oda rehberi panelinin gönderileceği bilgi kanalı (#özel-oda-rehberi)
  guideChannel: '1538940282895208518',
  // Üyenin katılınca kendi özel odasının açıldığı sabit ses kanalı ("⚓ Özel Oda Oluştur")
  createChannelId: '1538940395663130674',
  // Yeni oda açılınca verilen varsayılan kişi limiti (0 = sınırsız)
  defaultUserLimit: 0,
  // Oda adı: oluşturulduğu anda üyenin görünen adından üretilir
  nameOf: (member) => `🔊 ${member.displayName}`,
};
