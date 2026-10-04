// Destek sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.

const { botName, panelTitle } = require('../../core/config');

module.exports = {
  // Panel görseli (doğrudan URL)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555886636770791518/destektalebikazuki.jpg?backend=b2&ex=6ac37959&is=6ac227d9&hm=8996871e0da7a41816f8880985c628970c7e7aed083bdd45ed415fb1bffa96a7&',

  channels: {
    // #destek-talebi: destek paneli burada, talepler bu kanalın altında özel alt başlık olarak açılır
    panel: '1538535372588326973',
    // #destek-talepleri: yetkililere giden "Yeni Destek Talebi" ve hatırlatma mesajları
    claim: '1553111362765459526',
    // Açılış/kapanış logları ve konuşma kaydı (.txt) için kanal. null: kapalı
    log: null,
  },

  roles: {
    // Sorun Çözücü: talepleri üstlenir, yeni taleplerde etiketlenir
    staff: '1544337671340433569',
  },

  panel: {
    title: panelTitle(`${botName} Destek Sistemi`),
    description:
      '**Bir sorunla mı karşılaştın?** Sağdaki butondan talep oluştur ve sorununu kısaca anlat. Destek ekibimiz en kısa sürede seninle ilgilenecek.',
    buttonLabel: 'Talep Oluştur',
    footer: '-# Gereksiz veya asılsız açılan talepler yaptırım uygulanmasına neden olabilir.',
  },

  // Talep kapatılırken formda seçilen sebepler
  closeReasons: [
    { value: 'cozuldu', label: 'Sorun çözüldü' },
    { value: 'cozulemedi', label: 'Sorun çözülemedi' },
    { value: 'gerek-kalmadi', label: 'Artık yardıma ihtiyaç kalmadı' },
    { value: 'yanlislikla', label: 'Talep yanlışlıkla açıldı' },
    { value: 'diger', label: 'Diğer' },
  ],
};
