// Coin sistemi (src/systems/coin): /gunluk ödülü ve hata/onay metinleri. Tutarlar gerçek config'den alınır, böylece
// ayar değişince önizleme de değişir ve metindeki sayılarla config aynı kalır.
module.exports = ({ ui, src }) => {
  const config = src('systems/coin/config');
  const noMentions = { allowedMentions: { parse: [] } };

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
            `${coinConfig.daily.base} coin topladın.`,
            `**1. gün** serin. Taban **${coinConfig.daily.base}**, seri ve seviye bonusu **0**, bakiyen **${coinConfig.daily.base}** coin.`,
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
      where: '/gunluk komutu, art arda giriş yapan üyede',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          ui.alert(
            '106 coin topladın.',
            `**5. gün** serin. Taban **${coinConfig.daily.base}**, seri ve seviye bonusu **66**, bakiyen **1.284** coin.`,
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
