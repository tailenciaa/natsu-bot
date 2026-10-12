// Eğlence katmanının ayarları: hangi şakalar atılır, karşılık için ne kadar süre var, karşılık verene ne ödenir.
// Ekonomi düzeni: buradan gelen coin günlük oyun kazancı tavanına sayılır (coin/store.js addWin), yani şaka
// spam'i sonsuz para basamaz. Ritim düzeni ise çift aralığı ve günlük kart kotası: iki arkadaş birbirini
// dakikada bir kart yağmuruna tutamasın, eğlence kanalı doldurmasın.
module.exports = {
  // Gün anahtarı coin ve görev takvimiyle aynı takvimden gelir (İstanbul), gece 00:00'da döner
  dayKey: (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }),

  // Şaka kartının karşılık düğmesi bu süre içinde basılmazsa kart karşılıksız sayılır
  pencere: 3 * 60 * 1000,

  // Aynı ikili arasında (yön fark etmez) bu kadar süre yeni kart açılmaz
  ikiliAralik: 10 * 60 * 1000,

  // Bir üye günde en fazla bu kadar şaka kartı atabilir; karşılık ödülü ayrıca günlük tavana sayılır
  gunlukKart: 12,

  // Eylemler: komut adı, kart cümleleri ve karşılık ödülü aralığı (tek kişiye, coin olarak)
  eylemler: {
    op: {
      komut: 'öp',
      ad: 'Öpücük',
      ozet: 'gözlerinden öptü',
      baslik: 'Öpücük Karşılık Bekliyor',
      karsilikEtiket: 'Öpücükle Karşılık Ver',
      karsilikFiil: 'öpücükle karşılık verdi',
      odul: [10, 40],
      renk: 'success',
    },
    tokat: {
      komut: 'tokat',
      ad: 'Tokat',
      ozet: 'tokat attı',
      baslik: 'Tokat Karşılık Bekliyor',
      karsilikEtiket: 'Tokatla Karşılık Ver',
      karsilikFiil: 'tokatla karşılık verdi',
      odul: [5, 45],
      renk: 'danger',
    },
  },

  // Kartın altındaki küçük not: karşılığın iki tarafa da yattığı burada söylenir
  ipucu: 'Karşılık veren düğmeye basar; ödül iki tarafa da yatar ve günlük oyun tavanına sayılır.',
};
