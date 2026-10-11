// Oyun Salonu ayarları. Üç oyun tek sayfada gezilir: Keşif (ücretsiz, bekleme süreli ganimet avı), Rulet ve
// Merdiven (coin bahsi).
//
// EKONOMİ: keşif ganimeti coin üretir ve coin/store.js'teki günlük tavana (config.winCap) sayılır. Kumarhane
// oyunları coin üretmez, üyenin kendi bakiyesini taşır; masanın uzun vadeli avantajı %5-%7 arasındadır, böylece
// salon enflasyona değil enflasyonun dizginlenmesine yardım eder.
//
// Rulet: 15 cepten 7'si kırmızı, 7'si siyah, 1'i yeşil. Kırmızı/siyah 2 kat, yeşil 14 kat öder → beklenti 0,933.
// Merdiven: her basamakta düşme olasılığı artar, çarpan da artar. Çarpan × hayatta kalma olasılığı her basamakta
// ~0,94 tutulur; yani erken çekilmeyi göze alan kazanır, açgözlü olan kaybeder.
const DAY = 24 * 60 * 60 * 1000;

module.exports = {
  // Gün anahtarı coin görevleriyle aynı takvimden gelir (İstanbul), gece 00:00'da döner
  dayKey: (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }),
  DAY,

  // Bahsedilebilecek coin tutarları: basıldıkça hepsi bu listeden seçilir, elle coin yazdırılmaz (kod girişi yok)
  bets: [50, 100, 250, 500, 1000],

  // Tek bir elde risk edilebilecek en fazla coin. Bakiye bunun üstünde olsa bile tek elde hepsi masaya konamaz;
  // tek seferde tüm birikimini kaybeden üye sunucuyu terk ediyor, oyunun tadı kaçıyor.
  maxBet: 1000,

  rulet: {
    cepler: { kirmizi: 7, siyah: 7, yesil: 1 },
    // odul: kazanana bahis × bu katsayı kadar geri döner (bahsin kendisi dahil)
    renkler: { kirmizi: { ad: 'Kırmızı', odul: 2 }, siyah: { ad: 'Siyah', odul: 2 }, yesil: { ad: 'Yeşil', odul: 14 } },
  },

  merdiven: {
    // carpim × (1 - dusme) ≈ 0,94: masa her basamakta %6 pay alır, oyuncu basamak atladıkça beklenen değeri düşer
    adimlar: [
      { carpim: 1.1, dusme: 0.15 },
      { carpim: 1.25, dusme: 0.25 },
      { carpim: 1.4, dusme: 0.33 },
      { carpim: 1.6, dusme: 0.4 },
      { carpim: 1.9, dusme: 0.5 },
      { carpim: 2.4, dusme: 0.6 },
      { carpim: 3.1, dusme: 0.7 },
      { carpim: 4.2, dusme: 0.78 },
    ],
    // Yarım kalan tırmanış bu kadar süre durur; üye sayfayı kapatıp giderse basamakları yanmaz, sıfırlanır
    TTL: 30 * 60 * 1000,
  },

  // Keşif: günde en fazla bu kadar gezi, geziler arasında şu kadar bekleme. Kazanç tavanı coin'de, buradaki
  // sayılar ise ritmi tutar (her on dakikada bir gezi tavanı doldurur, kimse ekrana zincirlenmez).
  kesif: {
    cooldown: 20 * 60 * 1000,
    gunlukAdet: 8,

    // Bölge masasından kozmetik düşerse ama üyenin hepsi zaten sahipliğindeyse ödül boşa gitmesin: bu kadar coin verilir
    kozmetikYedek: 350,

    // Bölge masası: ağırlıklar 100'ü toplar. `seviye` kapısı, üyenin mesaj ya da ses seviyesinin büyük olanıdır
    // (günlük ödülle aynı ölçüm), böylece keşif sunucuda vakit geçirmenin ödülü olur.
    // Nitelikler kartın rengini ve duyuruyu belirler: efsanevi ganimet kanalda anılır.
    bolgeler: [
      {
        key: 'kasaba',
        ad: 'Kıyı Kasabası',
        seviye: 0,
        tarif: 'Her üye buradan çıkar. Küçük kazanç, büyük değil.',
        masa: [
          { agirlik: 42, tur: 'bos', nitelik: 'sıradan' },
          { agirlik: 40, tur: 'coin', aralik: [25, 80], nitelik: 'sıradan' },
          { agirlik: 14, tur: 'anahtar', adet: 1, nitelik: 'degerli' },
          { agirlik: 4, tur: 'kozmetik', secim: 'cerceve', nitelik: 'nadir' },
        ],
      },
      {
        key: 'orman',
        ad: 'Fısıltı Ormanı',
        seviye: 8,
        tarif: 'Orman cömert ama yolu uzun; seviyen 8 olmadan giremezsin.',
        masa: [
          { agirlik: 34, tur: 'bos', nitelik: 'sıradan' },
          { agirlik: 44, tur: 'coin', aralik: [60, 180], nitelik: 'degerli' },
          { agirlik: 14, tur: 'anahtar', adet: 2, nitelik: 'degerli' },
          { agirlik: 6, tur: 'kozmetik', secim: 'rozet', nitelik: 'nadir' },
          { agirlik: 2, tur: 'coin', aralik: [400, 700], nitelik: 'efsanevi' },
        ],
      },
      {
        key: 'magara',
        ad: 'Kırık Mağara',
        seviye: 20,
        tarif: 'Mağara koyusunda anahtar da var, hazine de. Karanlıkta sıra bekler.',
        masa: [
          { agirlik: 26, tur: 'bos', nitelik: 'sıradan' },
          { agirlik: 48, tur: 'coin', aralik: [120, 320], nitelik: 'degerli' },
          { agirlik: 14, tur: 'anahtar', adet: 3, nitelik: 'nadir' },
          { agirlik: 8, tur: 'kozmetik', secim: 'tema', nitelik: 'nadir' },
          { agirlik: 4, tur: 'coin', aralik: [700, 1200], nitelik: 'efsanevi' },
        ],
      },
      {
        key: 'bahce',
        ad: 'Ay Işığı Bahçesi',
        seviye: 35,
        tarif: 'Bahçenin kapısı yüksek seviyeye açılır; buradan boş dönen neredeyse yok.',
        masa: [
          { agirlik: 16, tur: 'bos', nitelik: 'sıradan' },
          { agirlik: 48, tur: 'coin', aralik: [220, 520], nitelik: 'degerli' },
          { agirlik: 16, tur: 'anahtar', adet: 4, nitelik: 'nadir' },
          { agirlik: 12, tur: 'kozmetik', secim: 'kapak', nitelik: 'nadir' },
          { agirlik: 8, tur: 'coin', aralik: [900, 1600], nitelik: 'efsanevi' },
        ],
      },
    ],
  },

  // Bu kadar ve üstü kazanç kanalda duyurulur; küçük eli her el duyurmak kanalı doldurur
  duyuruEsik: 500,
};
