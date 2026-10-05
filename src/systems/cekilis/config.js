// Çekiliş sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Çekilişlerin gönderildiği kanal (komutta "kanal" seçilirse o kullanılır)
  channel: '1538533903130828851',

  // Çekiliş mesajının altında yapılan duyuru etiketi. enabled: false iken hiçbir etiket atılmaz (test için).
  // Gerçek çekilişlere geçmek için enabled: true yapıp botu yeniden başlatmak yeterli.
  ping: {
    enabled: false,
    roleId: '1555890045066543154',
    everyone: true,
    here: true,
  },

  // Süre sınırları (dakika)
  minMinutes: 1,
  maxMinutes: 60 * 24 * 30,

  // Aynı anda en fazla kaç çekiliş açık olabilir
  maxActive: 10,

  // Bitiş kontrolünün sıklığı (saniye)
  checkSeconds: 15,
};
