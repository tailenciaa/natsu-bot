// Yetkili değerlendirme sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.

module.exports = {
  channels: {
    // Memnuniyet bildirimleri: üyelerin bıraktığı değerlendirmeler
    rating: '1538941536094519316',
    // Memnuniyet şikayetleri: yetkililerin haksız bulup bildirdiği değerlendirmeler
    complaint: '1538941597301997700',
  },

  // Kategoriye özel değerlendirme kanalı; null ise o kategorinin değerlendirmeleri de yukarıdaki ortak kanala gider
  categoryChannels: {
    destek: null,
    oryantasyon: null,
    partner: null,
  },

  // Görüşme ses kanalları: lider "Görüşmeye Çağır"a basınca yetkiliye bu kanallardan birine geçmesi söylenir.
  // Lider bu kanallardan birindeyse yetkiliye doğrudan o kanal gösterilir.
  voiceChannels: [
    { id: '1538544966282911884', label: 'Sorun Çözme 1' },
    { id: '1538545004920971284', label: 'Sorun Çözme 2' },
    { id: '1538545038751965265', label: 'Sorun Çözme 3' },
  ],

  roles: {
    // Sorun Çözücü Lideri: şikayetlerde etiketlenir, onaylar / reddeder
    leader: '1553133497781325954',
  },
};
