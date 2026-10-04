// Log kategorileri: her biri ana log kanalının altında kendi alt başlığına sahip olur, o kategorinin bütün
// logları alt başlığa mesaj olarak atılır. Yeni bir kategori eklemek için buraya bir satır eklemek ve ilgili
// Discord olayını dinleyen kodu events/ altındaki uygun dosyaya (ya da yeni bir dosyaya) yazmak yeterli.
module.exports = [
  {
    key: 'mesaj',
    label: 'Mesaj Logları',
    emoji: '📝',
    threadName: 'mesaj-loglari',
    description: 'Silinen ve düzenlenen mesajlar',
  },
  {
    key: 'ses',
    label: 'Ses Logları',
    emoji: '🔊',
    threadName: 'ses-loglari',
    description: 'Ses kanalına giriş/çıkış/taşınma, susturma, sağırlaştırma, yayın ve kamera',
  },
  {
    key: 'uye',
    label: 'Üye Logları',
    emoji: '👤',
    threadName: 'uye-loglari',
    description: 'Katılma, ayrılma, takma ad, rol, kullanıcı adı ve profil fotoğrafı değişiklikleri',
  },
  {
    key: 'moderasyon',
    label: 'Moderasyon Logları',
    emoji: '🛡️',
    threadName: 'moderasyon-loglari',
    description: 'Uyarı, susturma, jail, yasaklama, kaldırılma ve atılmalar',
  },
  {
    key: 'sunucu',
    label: 'Sunucu Logları',
    emoji: '⚙️',
    threadName: 'sunucu-loglari',
    description: 'Kanal, rol, sunucu ayarı, emoji ve davet değişiklikleri',
  },
  {
    key: 'boost',
    label: 'Boost Logları',
    emoji: '💎',
    threadName: 'boost-loglari',
    description: 'Sunucu takviyesi başlama ve bitme',
  },
];
