// Haftanın aktifleri duyurusu: ses, mesaj ve yayın kategorilerinde ilk 5'i gösteren liste, sıralama panelinin düzeninde
const { page, receipt, rel } = require('../../core/ui');

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
    : ['**Geçen hafta bu kategoride kayıt yok.**'];
  return `## ${meta.title}\n${lines.join('\n')}`;
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

// /haftalik komutunun cevabı: iki haftalık duyurunun (aktif + saygınlık) sonucu tek işlem kartında.
// denemeler: zamanlayıcının son otomatik denemesi { aktif, saygi } — kartta neden hiç mesaj görülmediğinin
// izi sürülebilmesi için yazılır (deneme yoksa zamanlayıcı hiç çalışmamış ya da duyurulacak hafta olmamıştır).
function weeklyRunCard({ target, aktif, saygi, user, denemeler = {} }) {
  const tamam = aktif.ok && saygi.ok;
  const bos = aktif.durum === 'kayıt yok' && saygi.durum === 'kayıt yok';
  const deneme = (d) => (d ? `${d.week} · ${d.durum} · ${rel(d.at)}` : 'zamanlayıcı henüz deneme yapmadı');
  return receipt({
    title: 'Haftalık Duyuru',
    sub: bos
      ? `**${target}** haftasında duyurulacak kayıt yok. Hafta tüketilmedi: sayım biriktiği anda duyuru kendiliğinden atılır.`
      : tamam
        ? `**${target}** haftasının birincileri ilgili kanallara gönderildi.`
        : `**${target}** haftasında en az bir duyuru gönderilemedi; nedeni aşağıda yazıyor.`,
    pairs: [
      ['Haftanın Aktifleri', `${aktif.durum} — ${aktif.not}`],
      ['Haftanın En Saygını', `${saygi.durum} — ${saygi.not}`],
      ['Otomatik deneme (Aktifler)', deneme(denemeler.aktif)],
      ['Otomatik deneme (En Saygın)', deneme(denemeler.saygi)],
    ],
    note: aktif.pay
      ? 'Coin ödülleri bu çalıştırmada yatırıldı. Aynı haftayı ikinci kez çalıştırırsan ödüller tekrar yatmaz.'
      : 'Bu çalıştırmada coin ödülü yatırılmadı: ya bu hafta zaten duyuruldu ya da süren haftanın önizlemesini açtın.',
    user,
    accent: bos ? 'warning' : tamam ? 'success' : 'danger',
  });
}

module.exports = { weeklyAnnounce, weeklyRunCard };
