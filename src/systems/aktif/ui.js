// Haftanın aktifleri duyurusu: ses, mesaj ve yayın kategorilerinde ilk 5'i gösteren liste, sıralama panelinin düzeninde
const { page } = require('../../core/ui');

const formatDuration = (seconds) => {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} saat ${m} dk` : `${m} dk`;
};

const KIND_META = {
  ses: { title: 'En Çok Seste Duranlar', format: formatDuration },
  mesaj: { title: 'En Çok Mesaj Yazanlar', format: (n) => `${n} mesaj` },
  yayin: { title: 'En Çok Yayın Açanlar', format: formatDuration },
};

// entries: [{ userId, value }] büyükten küçüğe sıralı, en fazla 5
function section(kind, entries) {
  const meta = KIND_META[kind];
  const lines = entries.length
    ? entries.map(({ userId, value }, i) => `${i + 1}. <@${userId}> » \`${meta.format(value)}\``)
    : ['-# Bu hafta için henüz veri yok.'];
  return `**${meta.title}**\n${lines.join('\n')}`;
}

// results: { ses, mesaj, yayin } -> [{ userId, value }] (en fazla 5, sıralı)
function weeklyAnnounce(guild, results) {
  return page({
    title: 'Haftanın Aktifleri',
    sub: 'Geçen hafta ses kanallarında en çok vakit geçiren, en çok mesaj yazan ve en çok yayın açan üyeleri listeliyoruz; birinci olanlar kendi haftalık rollerini kazanır.',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks: ['ses', 'mesaj', 'yayin'].map((kind) => section(kind, results[kind])),
  });
}

module.exports = { weeklyAnnounce };
