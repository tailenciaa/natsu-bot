// Haftanın aktifleri duyurusu: ses, mesaj ve yayın kategorilerinde ilk 5'i gösteren liste, sıralama panelinin düzeninde
const { page } = require('../../core/ui');

const number = (n) => n.toLocaleString('tr-TR');

const formatDuration = (seconds) => {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${number(h)} saat ${m} dk` : `${m} dk`;
};

const KIND_META = {
  ses: { title: 'En Çok Seste Duranlar', label: 'Ses', format: formatDuration },
  mesaj: { title: 'En Çok Mesaj Yazanlar', label: 'Mesaj', format: (n) => `${number(n)} mesaj` },
  yayin: { title: 'En Uzun Yayın Yapanlar', label: 'Yayın', format: formatDuration },
};

// entries: [{ userId, value }] büyükten küçüğe sıralı, en fazla 5
function section(kind, entries) {
  const meta = KIND_META[kind];
  const lines = entries.length
    ? entries.map(({ userId, value }, i) => `${i + 1}. <@${userId}> » \`${meta.format(value)}\``)
    : ['Geçen hafta bu kategoride kayıt yok.'];
  return `**${meta.title}**\n${lines.join('\n')}`;
}

// results: { ses, mesaj, yayin } -> [{ userId, value }] (en fazla 5, sıralı)
function weeklyAnnounce(guild, results) {
  return page({
    title: 'Haftanın Aktifleri',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks: [
      'Geçen haftanın **ses, mesaj ve yayın birincilerini** açıklıyoruz; her kategorinin birincisi **haftalık rolünü bir sonraki pazartesiye kadar taşır** ve rol **her hafta yenilenir.**',
      ...['ses', 'mesaj', 'yayin'].map((kind) => section(kind, results[kind])),
    ],
  });
}

module.exports = { weeklyAnnounce };
