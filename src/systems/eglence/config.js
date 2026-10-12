// Eğlence katmanının ayarları: hangi şakalar atılır, karşılık için ne kadar süre var, karşılık verene ne ödenir.
// Ekonomi düzeni: buradan gelen coin günlük oyun kazancı tavanına sayılır (coin/store.js addWin), yani şaka
// spam'i sonsuz para basamaz. Ritim düzeni ise çift aralığı ve günlük kart kotası: iki arkadaş birbirini
// dakikada bir kart yağmuruna tutamasın, eğlence kanalı dolmasın.
// Metinler {vuran} ve {hedef} yer tutucularıyla kurulur: her eylem kendi düşüncesini (için/karşılık) taşıdığı
// için cümleyi kod tarafında kurmak yerine burada yazmak daha okunur kalır.
module.exports = {
  // Gün anahtarı coin ve görev takvimiyle aynı takvimden gelir (İstanbul), gece 00:00'da döner
  dayKey: (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }),

  // Şaka kartının karşılık düğmesi bu süre içinde basılmazsa kart karşılıksız sayılır
  pencere: 3 * 60 * 1000,

  // Aynı ikili arasında (yön fark etmez) bu kadar süre yeni kart açılmaz
  ikiliAralik: 10 * 60 * 1000,

  // Bir üye günde en fazla bu kadar şaka kartı atabilir; karşılık ödülü ayrıca günlük tavana sayılır
  gunlukKart: 12,

  // Şakalaşma sayfası: /şakalaş ile açılır, cüzdan kartından da ulaşılır. Komut adı burada durur ki
  // yardim menüsü, cüzdan düğmesi ve işleyici aynı adı okusun.
  sayfaKomut: 'şakalaş',
  sayfaAciklama: 'Şakalaşma sayfasını açar: sana uzanan kartlar, senin sayıların ve nasıl işlediği.',
  // Sayfada birden fazla bekleyen kart listelenebilir ama liste uzamasın: en acili üstte, sınırlı satır
  sayfaKart: 5,

  // Eylemler: komut adı, kart cümlesi, düğme etiketi ve karşılık ödülü aralığı (tek kişiye, coin olarak)
  eylemler: {
    op: {
      komut: 'öp',
      ad: 'öpücük',
      aciklama: 'Bir üyeye öpücük gönderirsin; karşılık gelirse ikiniz de coin kazanır.',
      baslik: 'Öpücük: Karşılık Bekliyor',
      kart: '{vuran} adlı üye, {hedef} kişisine bir öpücük kondurdu.',
      karsilikEtiket: 'Öperek Karşılık Ver',
      karsilik: '{hedef} adlı üye, {vuran} kişisine öpücükle karşılık verdi.',
      odul: [10, 40],
      renk: 'success',
    },
    tokat: {
      komut: 'tokat',
      ad: 'tokat',
      aciklama: 'Bir üyeye tokat atarsın; karşılık gelirse ikiniz de coin kazanır.',
      baslik: 'Tokat: Karşılık Bekliyor',
      kart: '{vuran} adlı üye, {hedef} kişisine bir tokat indirdi.',
      karsilikEtiket: 'Tokatla Karşılık Ver',
      karsilik: '{hedef} adlı üye, {vuran} kişisine tokatla karşılık verdi.',
      odul: [5, 45],
      renk: 'danger',
    },
  },

  // Kartın altındaki not: ödülün kime ve nasıl yattığı üye aramadan okusun
  ipucu: 'Karşılık veren düğmeye basar; ödül iki tarafa da yatar ve günlük oyun kazancı tavanına sayılır.',

  // Sonuç kartlarının başlıkları
  sonucBaslik: 'Karşılık Geldi',
  karsizBaslik: 'Karşılıksız Kaldı',
  tavanNotu: 'Günlük oyun kazancı tavanı dolu olan tarafın ödülü cebine girmedi.',
};
