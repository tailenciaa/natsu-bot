// Kalıcı oda sistemi ayarları: başvuru paneli ve başvuruların düşeceği kanal, roller, başvuru ve oda sınırları,
// odaları açık tutan haftalık/aylık ses şartları. Kanal ve rol ID'leri boş (null) bırakılırsa ilgili adım çalışmaz;
// ID'yi girip botu yeniden başlatman yeterli.
module.exports = {
  channels: {
    // #kalıcı-oda-bilgi: kurallar ve gereksinimler panelinin gönderileceği kanal. null: panel gönderilmez.
    panel: '1538941087195074702',
    // #kalıcı-oda-başvuruları: gelen başvuruların ve kararların yazılacağı kanal. null: başvuru alınmaz.
    applications: '1538941302681501907',
    // #kalıcı-oda-duyuruları: açılan ve kapanan odaların herkese açık bildirim kartlarının gideceği kanal.
    // null: duyuru kartı gönderilmez; olay yine log kaydına işlenir.
    notifications: '1538941133684482129',
  },

  roles: {
    // Başvuruları inceleyen rol. Boş bırakılırsa (null) Onayla ve Reddet yalnızca yönetici yetkisi olanlar çalışır;
    // başvuruları sadece yöneticiler onaylasın istiyorsa null kalmalı.
    reviewer: null,
    // Ekip rolü: girilirse her kalıcı odaya bu rolün erişimi de verilir, yani ekip üyeleri tüm odaları görür. null: kapalı.
    team: null,
    // Oda sahibi rolü: odası onaylanan üyeye verilir, odası kapatıldığında ya da sahipliği devredildiğinde geri alınır.
    // Bu rol kuralın gözüdür; /kalici-oda komutu yine de sahipliğe bakar, yani rol verilemezse komut çalışmaya devam eder.
    owner: '1558768699530281055',
  },

  // Kalıcı odaların açılacağı kategori: her oda bu kategorinin içine tek bir ses kanalı olarak açılır. Odaya özel
  // alt kategori ya da ayrı yazı kanalı oluşturulmaz; odanın yazısı ses kanalının kendi sohbetidir. Bu kategori
  // @everyone'a kapalıysa odalar kimseye görünmez (bot açılışta logda uyarır). null: sunucu köküne açılır.
  categoryId: '1538520845775929385',

  // Bir üyenin aynı anda en fazla kaç kalıcı odası olabilir
  maxRoomsPerOwner: 1,
  // Odayı en az kaç kişi kullanacak (başvuran dahil); başvurunun üye seçimi adımında seçtiklerinden sayılır
  minMembers: 4,
  // Üye seçme menüsünden seçilebilecek azami üye sayısı (başvuran hariç)
  maxExtraMembers: 14,
  // Odayı kullanacakların son 7 gündeki toplam ses süresi hedefi (saat). Başvuruda hesaplanır ve kartta gösterilir;
  // altında kalan başvuru otomatik reddedilmez, kararı yöneticiler verir. Odayı açtıktan sonra koruyacak şartlar
  // aşağıdaki activity bloğundadır (korumak, başvurmaktan daha kolaydır).
  minWeeklyVoiceHours: 60,
  // Oda açılınca ses kanalına konan kişi limiti (0 = sınırsız)
  defaultUserLimit: 20,
  // Son başvurusu reddedilen üye kaç gün sonra tekrar başvurabilir (0: sınır yok)
  reapplyCooldownDays: 14,

  // Odayı açık tutan şartlar: odadakilerin (sahip dahil) topladığı ses süresi. Her hafta biterken o haftanın sayısı
  // odanın kaydına işlenir, hedefin altındaysa sahibine uyarı gider; ay başında geçen ayın haftalarına bakılır ve
  // şartı karşılamayan oda "şart yetersizliği" ile kapatılır. enabled: false tüm denetimi durdurur.
  activity: {
    enabled: true,
    // Haftalık hedef (saat): odadakilerin bir haftadaki toplam ses süresi bundan azsa hafta kaçmış sayılır.
    weeklyHours: 40,
    // Aylık hedef (saat): ay boyunca toplanan toplam. Haftalık hedefi tek tek tutan bir oda bunu zaten geçer;
    // düşük ama dengeli kullanımı da yakalar. Ayın ortasında açılan odada hedef, sayılan hafta kadarına bölünür.
    monthlyHours: 150,
  },

  // Panelde "Kurallar" başlığı altında gösterilen satırlar
  rules: [
    'Oda **sana ait**: ismini, kişi limitini ve üyelerini **/kalici-oda** komutuyla kendin yönetirsin.',
    'Oda **kalıcıdır**: içinde kimse olmasa bile kapanmaz; ay sonu şartını karşılamayan oda ise silinir.',
    'Sunucu kuralları odada da geçerlidir; odada olanlardan **oda sahibi** sorumludur.',
  ],

  // Başvuru formunun soruları (modalda en fazla 5 alan). Cevaplar başvuru kartında etiket-değer satırı olarak çizilir.
  // Üyeler burada sorulmaz: başvurunun ilk adımında üye seçme menüsüyle seçilir, ID yazılmaz.
  questions: [
    { id: 'ad', label: 'Oda adı', description: 'Ses kanalının adı olur.', placeholder: 'Örn: Müzik Odası', max: 30 },
    {
      id: 'amac',
      label: 'Oda ne için kullanılacak?',
      description: 'Kısaca odanın amacını yaz.',
      placeholder: 'Örn: Her akşam birlikte müzik dinlemek ve kaydetmek için.',
      paragraph: true,
      min: 15,
      max: 500,
    },
  ],
};
