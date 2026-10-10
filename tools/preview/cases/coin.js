// Coin sistemi (src/systems/coin): /gunluk ödülü, /bakiye cüzdanı, sipariş listesi ve hata/onay metinleri.
// Tutarlar gerçek config'den alınır, böylece ayar değişince önizleme de değişir ve metindeki sayılarla config aynı kalır.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/coin/config');
  const coin = src('systems/coin/ui');
  const noMentions = { allowedMentions: { parse: [] } };
  const user = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const base = config.daily.base;
  // Seri bonusi (streak - 1) * streakBonus, seviye bonusu seviye * perLevel; beşinci günde altı seviyelik üye
  const streakBonus = 4 * config.daily.streakBonus;
  const levelBonus = 6 * config.daily.perLevel;
  const besinci = base + streakBonus + levelBonus;
  // İlk dört gün seri bonusuyla, beşinci gün ayrıca seviye bonusu birikir
  const bakiye = [0, 1, 2, 3].reduce((toplam, i) => toplam + base + i * config.daily.streakBonus, besinci);

  // Mağazadan alınmış ürünler (coin/store'daki sipariş kayıtlarının biçimi); ad, tür ve fiyat gerçek katalogdan
  const urun = (tur, name, price, daysAgo) => ({ id: `${tur}-${name}-${daysAgo}`, userId: user.id, tur, name, price, at: mock.ago(daysAgo * mock.DAY) });
  const purchases = [urun('tema', 'Elmas', 6000, 3), urun('kapak', 'Buzlu Cam', 3400, 11), urun('cerceve', 'Neon', 7200, 26)];
  const manyPurchases = [
    ...purchases,
    urun('tema', 'Kor', 2500, 40),
    urun('rozet', 'Taç', 3400, 52),
    urun('cerceve', 'Altın', 4800, 61),
    urun('tema', 'Zümrüt', 4500, 70),
    urun('kapak', 'Yıldız', 2600, 84),
  ];

  return [
    {
      id: 'gunluk-ilk',
      title: '/gunluk: ilk gün, ödül toplandı',
      where: '/gunluk komutu, kanala düşen kazanç kartı',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          coin.daily({
            user,
            amount: base,
            streak: 1,
            base,
            bonus: 0,
            balance: base,
            nextAt: Date.now() + mock.DAY,
          }),
        ],
        flags: ui.CV2,
        allowedMentions: { users: [user.id] },
      }),
    },
    {
      id: 'gunluk-seri',
      title: '/gunluk: seri devam ediyor, seviye bonusu var',
      where: '/gunluk komutu, art arda giriş yapan ve seviye atlamış üyede',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          coin.daily({
            user,
            amount: besinci,
            streak: 5,
            base,
            bonus: streakBonus + levelBonus,
            balance: bakiye,
            nextAt: Date.now() + mock.DAY,
          }),
        ],
        flags: ui.CV2,
        allowedMentions: { users: [user.id] },
      }),
    },
    {
      id: 'gunluk-tekrar',
      title: '/gunluk: bugün zaten toplanmış',
      where: '/gunluk komutu günde ikinci kez kullanılınca',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          ui.alert('Günlük ödülünü bugün zaten topladın.', `Sıradaki ödül <t:${Math.floor(Date.now() / 1000) + 9 * 3600 + 40 * 60}:R> içinde hazır oluyor.`),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },

    // ── /bakiye: cüzdan ve siparişler ──────────────────────────────────────────
    {
      id: 'bakiye',
      title: '/bakiye: cüzdan kartı',
      where: '/bakiye komutu',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [coin.wallet({ user, balance: 18400, earned: 42000, spent: 23600, streak: 5, readyAt: Date.now() + 9 * 3600 * 1000 })],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'bakiye-odul-hazir',
      title: '/bakiye: günlük ödül hazır',
      where: '/bakiye, günün ödülünü henüz toplamamış üye',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [coin.wallet({ user, balance: 800, earned: 800, spent: 0, streak: 0, readyAt: Date.now() })],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'siparisler',
      title: 'Siparişlerim: alınmış ürünler',
      where: 'Cüzdan kartındaki Siparişlerim butonu',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [coin.orders({ user, items: purchases, page: 0 })],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'siparisler-bos',
      title: 'Siparişlerim: henüz alışveriş yok',
      where: 'Cüzdan kartındaki Siparişlerim butonu',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [coin.orders({ user, items: [], page: 0 })], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'siparisler-uzun',
      title: 'Siparişlerim: sayfalama',
      where: 'Sipariş listesi ikinci sayfada',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [coin.orders({ user, items: manyPurchases, page: 1 })], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
  ];
};
