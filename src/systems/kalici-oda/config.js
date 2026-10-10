// Kalıcı oda sistemi ayarları: başvuru paneli ve başvuruların düşeceği kanal, gereksinimler, oda sınırları.
// Kanal ve rol ID'leri boş (null) bırakılırsa ilgili adım çalışmaz; ID'yi girip botu yeniden başlatman yeterli.
module.exports = {
  channels: {
    // #kalıcı-oda-bilgi: kurallar ve gereksinimler panelinin gönderileceği kanal. null: panel gönderilmez.
    panel: null,
    // #kalıcı-oda-başvuruları: gelen başvuruların ve kararların yazılacağı kanal. null: başvuru alınmaz.
    applications: null,
  },

  roles: {
    // Başvuruları inceleyen rol; Onayla ve Reddet sadece bu roldekiler ve yöneticiler için çalışır. null: sadece yöneticiler.
    reviewer: null,
    // Ekip rolü: girilirse her kalıcı odaya bu rolün erişimi de verilir, yani ekip üyeleri tüm odaları görür. null: kapalı.
    team: null,
  },

  // Kalıcı odaların açılacağı kategori. null: odalar sunucu kökünde açılır.
  categoryId: null,

  // Bir üyenin aynı anda en fazla kaç kalıcı odası olabilir
  maxRoomsPerOwner: 1,
  // Odayı en az kaç kişi kullanacak (başvuran dahil); formda etiketlenen üyelerden sayılır
  minMembers: 4,
  // Formda belirtilebilecek azami üye sayısı (başvuran hariç)
  maxExtraMembers: 14,
  // Odayı kullanacakların son 7 gündeki toplam ses süresi hedefi (saat). Başvuruda hesaplanır ve kartta gösterilir;
  // altında kalan başvuru otomatik reddedilmez, kararı yetkililer verir.
  minWeeklyVoiceHours: 60,
  // Oda açılınca ses kanalına konan kişi limiti (0 = sınırsız)
  defaultUserLimit: 20,
  // Son başvurusu reddedilen üye kaç gün sonra tekrar başvurabilir (0: sınır yok)
  reapplyCooldownDays: 14,

  // Panelde "Kurallar" başlığı altında gösterilen satırlar
  rules: [
    'Oda **kalıcıdır**: içinde kimse olmasa bile kapanmaz, yalnızca yetkililer kapatır.',
    'Odayı **sahibi yönetir**: isim, kişi limiti, üye ve devir işlemleri odanın yazı kanalındaki panelinden yapılır.',
    'Sunucu kuralları odada da geçerlidir; odada olanlardan **oda sahibi** sorumludur.',
  ],

  // Başvuru formunun soruları (modalda en fazla 5 alan). Cevaplar başvuru kartında etiket-değer satırı olarak çizilir.
  questions: [
    { id: 'ad', label: 'Oda adı', description: 'Kategori ve kanal adında görünür.', placeholder: 'Örn: Müzik Odası', max: 30 },
    {
      id: 'kisiler',
      title: 'Odayı Kimler Kullanacak',
      label: 'Odada kimler olacak?',
      description: 'Üyeleri etiketleyerek yaz, başvuran sayılmaz.',
      placeholder: 'Örn: @mehmet @ayşe @fatma',
      paragraph: true,
      max: 600,
    },
    {
      id: 'amac',
      title: 'Amaç',
      label: 'Oda ne için kullanılacak?',
      description: 'Kısaca odanın amacını yaz.',
      placeholder: 'Örn: Her akşam birlikte müzik dinlemek ve kaydetmek için.',
      paragraph: true,
      min: 15,
      max: 500,
    },
  ],
};
