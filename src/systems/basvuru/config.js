// Yetkili alım (başvuru) sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.

const { botName } = require('../../core/config');

module.exports = {
  // Panel görseli (Discord CDN bağlantısı); bot görseli indirip panele kalıcı ek olarak koyar (core/banner.js)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555886026638102549/yetkilialmkazuki.jpg?backend=b2&ex=6ac378c7&is=6ac22747&hm=7dc28ff219fe2ab5cfca8a3252b4599a389b7b5184a2427a99ef898f5633631a&',

  channels: {
    // #yetkili-alım-bilgi: başvuru paneli
    panel: '1538544076910104636',
    // #yetkili-alım-başvuruları: gelen başvurular
    applications: '1538942729273348187',
    // Süreç kayıtları: görüşme ve oryantasyonun başladığı, ilerlediği ve bittiği bu kanala yazılır. null: kapalı.
    // Başvurular kanalıyla aynıysa kayıtlar başvuru mesajına yanıt olarak gider.
    log: '1538942729273348187',
  },

  // Görüşme ses kanalları: normalde herkese kapalı (@everyone "Bağlan" yasak).
  // Başvuran görüşmeye çağrılınca ona özel açılır; başvurusu onaylanınca oryantasyon da bu kanallarda yapılır.
  voiceChannels: [
    { id: '1538933965648568381', label: 'Yetkili Alım 1' },
    { id: '1538933991938334891', label: 'Yetkili Alım 2' },
    { id: '1538934016298848376', label: 'Yetkili Alım 3' },
  ],
  // Açılan ses kanalı erişimi kaç saat sonra kendiliğinden kapanır (başvuru reddedilirse hemen kapanır)
  voiceAccessHours: 24,
  // Başvuran mülakattan sonra görüşme kanalından ayrılınca kanallar kaç dakika sonra tekrar kilitlenir.
  // Bağlantısı koparsa bu süre içinde geri dönebilsin diye; geri dönerse kilitlenmez.
  leaveLockMinutes: 2,
  // Oryantasyon bitince kanallar hemen kilitlenir; başvuran hâlâ kanaldaysa son mesajları görebilsin diye
  // kaç saniye sonra kanaldan çıkarılır
  disconnectDelaySeconds: 10,

  roles: {
    // Yetkili Alım DM: başvuruları inceler, yeni başvurularda etiketlenir
    reviewer: '1553398951816863844',
    // Oryantasyonu tamamlayan kişiye seviye ve alan rollerinin yanında verilecek ortak yetkili rolü. null: verilmez
    // Yetkili Ekibi
    accept: '1555890043992940614',
    // Yetkili Alım DM'nin yanında başvuruları inceleyebilen roller: Yetkili Alım Lideri
    reviewerExtra: ['1554240783580667954'],
    // Yetkili Alım DM'nin yanında oryantasyon verebilen, oryantasyonu devralabilen ve kendilerine aktarılabilen roller:
    // Yetkili Alım Lideri, Oryantasyon Lideri, Oryantasyon Yetkilisi
    orientation: ['1554240783580667954', '1554240783769669663', '1554240783929049168'],
    // Bekleyen oryantasyon bildirimlerinde sadece bu rol etiketlenir: Oryantasyon Yetkilisi
    orientationPing: ['1554240783929049168'],
  },

  panel: {
    title: `${botName} Yetkili Alımı`,
    buttonLabel: 'Başvur',
    footer: 'Formu doğru ve eksiksiz doldur; yanlış bilgi başvurunun reddedilmesine yol açar.',
  },

  // Reddedilen başvurudan sonra kaç gün tekrar başvurulamaz (0: sınır yok)
  reapplyCooldownDays: 0,

  // Formdaki sorular (en fazla 5). "title" başvuru mesajında cevabın başlığı olarak görünür.
  questions: [
    { id: 'bilgi', title: 'Ad ve Yaş', label: 'Adın ve yaşın', placeholder: 'Örn: Ahmet, 18', min: 2, max: 60 },
    {
      id: 'aktiflik',
      title: 'Aktiflik',
      label: 'Günde ortalama kaç saat aktifsin?',
      placeholder: 'Örn: 4-5 saat',
      min: 1,
      max: 60,
    },
    {
      id: 'deneyim',
      title: 'Deneyim',
      label: 'Daha önce yetkili oldun mu?',
      description: 'Olduysan hangi sunucularda ve ne kadar süre görev yaptığını yaz.',
      placeholder: 'Örn: 2 sunucuda 6 ay moderatörlük yaptım.',
      paragraph: true,
      min: 2,
      max: 500,
    },
    {
      id: 'neden',
      title: 'Neden Ekipte Olmak İstiyor',
      label: 'Neden ekibimize katılmak istiyorsun?',
      placeholder: 'Kendinden ve ekibe neler katabileceğinden bahset.',
      paragraph: true,
      min: 20,
      max: 700,
    },
    {
      id: 'ek',
      title: 'Ek Not',
      label: 'Eklemek istediğin bir şey var mı?',
      description: 'İsteğe bağlı.',
      paragraph: true,
      required: false,
      max: 400,
    },
  ],
};
