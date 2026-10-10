// Coin sistemi (src/systems/coin): /gunluk ödülü ve hata/onay metinleri. Tutarlar gerçek config'den alınır, böylece
// ayar değişince önizleme de değişir ve metindeki sayılarla config aynı kalır.
module.exports = ({ ui, src }) => {
  const config = src('systems/coin/config');
  const noMentions = { allowedMentions: { parse: [] } };
  const base = config.daily.base;
  // Seri bonusi (streak - 1) * streakBonus, seviye bonusu seviye * perLevel; beşinci günde altı seviyelik üye
  const streakBonus = 4 * config.daily.streakBonus;
  const levelBonus = 6 * config.daily.perLevel;
  const besinci = base + streakBonus + levelBonus;
  // İlk dört gün seri bonusuyla, beşinci gün ayrıca seviye bonusu birikir
  const bakiye = [0, 1, 2, 3].reduce((toplam, i) => toplam + base + i * config.daily.streakBonus, besinci);

  return [
    {
      id: 'gunluk-ilk',
      title: '/gunluk: ilk gün, ödül toplandı',
      where: '/gunluk komutu, sadece kullanana görünür',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          ui.alert(
            `${base} coin topladın.`,
            `**1. gün** serin. Taban **${base}**, seri ve seviye bonusu **0**, bakiyen **${base}** coin.`,
            'success',
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'gunluk-seri',
      title: '/gunluk: seri devam ediyor, seviye bonusu var',
      where: '/gunluk komutu, art arda giriş yapan ve seviye atlamış üyede',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          ui.alert(
            `${besinci} coin topladın.`,
            `**5. gün** serin. Taban **${base}**, seri ve seviye bonusu **${streakBonus + levelBonus}**, bakiyen **${bakiye.toLocaleString('tr-TR')}** coin.`,
            'success',
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
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
  ];
};
