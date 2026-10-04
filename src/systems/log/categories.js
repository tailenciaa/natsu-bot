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
    description: 'Katılma (hangi davetle geldiği), ayrılma ve takma ad değişiklikleri',
  },
  {
    key: 'rol',
    label: 'Rol Logları',
    emoji: '🏷️',
    threadName: 'rol-loglari',
    description: 'Rol oluşturma, silme, düzenleme ve üyelere rol verilip alınması',
  },
  {
    key: 'kanal',
    label: 'Kanal Logları',
    emoji: '📂',
    threadName: 'kanal-loglari',
    description: 'Kanal ve alt başlık oluşturma, silme, düzenleme ve izin değişiklikleri',
  },
  {
    key: 'moderasyon',
    label: 'Moderasyon Logları',
    emoji: '🛡️',
    threadName: 'moderasyon-loglari',
    description: 'Uyarı, susturma, jail, yasaklama, atılma ve AutoMod engellemeleri',
  },
  {
    key: 'sunucu',
    label: 'Sunucu Logları',
    emoji: '⚙️',
    threadName: 'sunucu-loglari',
    description: 'Sunucu ayarları, emoji, çıkartma ve davet değişiklikleri',
  },
  {
    key: 'boost',
    label: 'Boost Logları',
    emoji: '💎',
    threadName: 'boost-loglari',
    description: 'Sunucu takviyesi başlama ve bitme',
  },
  {
    key: 'bot',
    label: 'Bot Logları',
    emoji: '🤖',
    threadName: 'bot-loglari',
    description: 'Botun komutlarının kullanımı',
  },
];
