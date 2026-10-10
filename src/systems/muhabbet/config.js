// Muhabbet odası ayarları: panel kanal ve isteğe bağlı kategori/rol boşsa sistem kendi halinde çalışır
// (panel gönderilmez, odalar kategori üstüne açılır). Bekleme süreleri hem sırayı hem odaları düzenler.
module.exports = {
  channels: {
    // Muhabbet panelinin gönderileceği kanal (örn. #muhabbet-bilgi); boşsa panel atılmaz
    panel: null,
  },
  // Muhabbet odalarının açılacağı kategori; boşsa kanallar kategori üstünde oluşur
  categoryId: null,
  roles: {
    // Bu rol odaları görebilir ve inceleyebilir (yetkiler); boşsa yalnızca oda üyeleri görür
    team: null,
  },

  // Muhabbet iki kişiliktir: odanın kişi limiti
  userLimit: 2,
  // Sırada bekleyebilecek en fazla üye sayısı
  maxQueue: 100,
  // Bu kadar dakika sırada bekleyen üye sıradan düşer
  queueTimeoutMinutes: 30,
  // Oda kapandıktan sonra tekrar sıraya girmeden önce beklenen saniye
  requeueCooldownSeconds: 180,
  // Ses kanalında kimse kalmadığında oda bu kadar dakika sonra kapanır
  idleCloseMinutes: 5,
  // Bir muhabbet odası en fazla bu kadar dakika açık kalır
  maxRoomMinutes: 120,
  // Sıra ve oda kontrollerinin yenilenme aralığı (saniye)
  checkSeconds: 30,

  rules: [
    'Oda yalnızca ikinize görünür: sunucudaki diğer üyeler kanalları görmez.',
    'Sunucu kuralları muhabbet odasında da geçerlidir; yazışmalar oda kapanınca silinir.',
    'Ses kanalında kimse kalmadığında oda kendiliğinden kapanır.',
    'Oda kapandıktan sonra tekrar sıraya girmek için kısa bir bekleme vardır.',
  ],
};
