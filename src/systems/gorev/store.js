// Görev kayıtları: yalnızca "ödül alındı" bilgisi, anahtar sayacı, kutu istatistiği, sezon puanı ve izlenen
// adımlar burada tutulur. Görevlerin kendisi burada sayılmaz; ilerleme ilgili sistemlerin kaydından okunur
// (olcum.js). Kayıt tembel yenilenir: hangi dönemde olunduğu anahtardan anlaşılır, gece yarısı bekçisi yoktur.
const { data, save } = require('../../core/db');
const config = require('./config');

data.gorev ??= { users: {} };

// Demet günleri ve haftalık kutu sayıları sonsuz birikmez: seri görevi son 7 günü, hafta karşılaştırması son
// 8 haftayı okur; fazlası atılır.
const DEMET_KEEP = 40;
const HAFTA_KEEP = 8;

const rec = (userId) => (data.gorev.users[userId] ??= {
  gunluk: {},
  haftalik: {},
  yol: {},
  gorulen: {},
  demet: null,
  demetGunleri: [],
  anahtar: 0,
  kutu: { toplam: 0, hafta: {}, garanti: 0 },
  sezon: {},
  toplam: { gunluk: 0, haftalik: 0, yol: 0 },
});

const yaz = (userId, fn) => {
  const r = rec(userId);
  fn(r);
  save();
  return r;
};

// ── Günlük ────────────────────────────────────────────────────────────────────
// Aynı görev bir günde bir kez alınır; anahtar olarak o günün tarihi yazılır.
const gunlukAlindi = (userId, key, gun) => rec(userId).gunluk[key] === gun;

function gunlukAl(userId, key, gun) {
  return yaz(userId, (r) => {
    r.gunluk[key] = gun;
    r.toplam.gunluk += 1;
  });
}

// Üçünün de alınması gereken demet ödülü: bugün verildiyse yeniden verilmez.
const demetAlindi = (userId, gun) => rec(userId).demet === gun;

function demetVer(userId, gun) {
  return yaz(userId, (r) => {
    r.demet = gun;
    r.demetGunleri = [...r.demetGunleri, gun].slice(-DEMET_KEEP);
  });
}

// Bu haftaya kaç demet günü düştü (seri-4 görevi bunu sayar)
const demetHafta = (userId, hafta) => {
  const bas = config.haftaBaslangici(hafta);
  const bitmis = config.dayKey(bas + 6 * 24 * 60 * 60 * 1000);
  return rec(userId).demetGunleri.filter((gun) => gun >= hafta && gun <= bitmis).length;
};

// ── Haftalık ──────────────────────────────────────────────────────────────────
const haftalikAlindi = (userId, key, hafta) => rec(userId).haftalik[key] === hafta;

function haftalikAl(userId, key, hafta) {
  return yaz(userId, (r) => {
    r.haftalik[key] = hafta;
    r.toplam.haftalik += 1;
  });
}

// ── Keşif Yolu ────────────────────────────────────────────────────────────────
const yolAlindi = (userId, key) => Boolean(rec(userId).yol[key]);

function yolAl(userId, key, at = Date.now()) {
  return yaz(userId, (r) => {
    r.yol[key] = at;
    r.toplam.yol += 1;
  });
}

// İzlenen adımlar (/profil açıldı, çekilişe katılıldı): hiçbir depoda izi yok, tek kaynağı bu gözlem.
const goruldu = (userId, key) => Boolean(rec(userId).gorulen[key]);

function gorusuKaydet(userId, key, at = Date.now()) {
  return yaz(userId, (r) => {
    r.gorulen[key] = at;
  });
}

// ── Anahtar ve kutu ───────────────────────────────────────────────────────────
const anahtar = (userId) => rec(userId).anahtar;

function anahtarEkle(userId, adet) {
  if (!(adet > 0)) return anahtar(userId);
  return yaz(userId, (r) => {
    r.anahtar += adet;
  }).anahtar;
}

// Anahtar düşer; yetmiyorsa false döner ve hiçbir şey yazılmaz
function anahtarHarca(userId, adet) {
  const r = rec(userId);
  if (r.anahtar < adet) return false;
  return yaz(userId, (x) => {
    x.anahtar -= adet;
  }).anahtar >= 0;
}

const kutuSayilari = (userId) => {
  const r = rec(userId);
  return {
    toplam: r.kutu.toplam,
    hafta: r.kutu.hafta[config.haftaAnahtari()] ?? 0,
    // Garantili kozmetiğe kaç kutu kaldı: sayaç kozmetik çıkınca sıfırlanır
    garantiKaldi: Math.max(0, config.KUTU.garanti - r.kutu.garanti),
  };
};

function kutuKaydet(userId) {
  const hafta = config.haftaAnahtari();
  return yaz(userId, (r) => {
    r.kutu.toplam += 1;
    r.kutu.hafta = { ...r.kutu.hafta, [hafta]: (r.kutu.hafta[hafta] ?? 0) + 1 };
    // Eski haftalar atılır
    const tutulacak = Object.entries(r.kutu.hafta).sort((a, b) => b[0].localeCompare(a[0])).slice(0, HAFTA_KEEP);
    r.kutu.hafta = Object.fromEntries(tutulacak);
  });
}

// Kozmetik çıkınca garanti sayacı sıfırlanır, coin çıkınca bir ilerler
function kutuGaranti(userId, kozmetikCikti) {
  return yaz(userId, (r) => {
    r.kutu.garanti = kozmetikCikti ? 1 : (r.kutu.garanti % config.KUTU.garanti) + 1;
  });
}

// ── Sezon ─────────────────────────────────────────────────────────────────────
const sezonKaydi = (userId, sezon) => {
  const r = rec(userId);
  if (!r.sezon[sezon]) r.sezon[sezon] = { puan: 0, kademe: [] };
  return r.sezon[sezon];
};

const sezonPuan = (userId, sezon) => sezonKaydi(userId, sezon).puan;

function puanEkle(userId, sezon, adet) {
  if (!(adet > 0)) return sezonPuan(userId, sezon);
  return yaz(userId, (r) => {
    const s = r.sezon[sezon] ??= { puan: 0, kademe: [] };
    s.puan += adet;
  }).sezon[sezon].puan;
}

const sezonKademeleri = (userId, sezon) => sezonKaydi(userId, sezon).kademe;

function sezonKademeAl(userId, sezon, index) {
  return yaz(userId, (r) => {
    const s = r.sezon[sezon] ??= { puan: 0, kademe: [] };
    if (!s.kademe.includes(index)) s.kademe.push(index);
  }).sezon[sezon].kademe;
}

// ── Profil puanı için ─────────────────────────────────────────────────────────
// Kart ve Puanım sayfası bu tek sayıyı okur: ömür boyu bitirilen görev adedi (günlük + haftalık + yol).
function bitirilenSayisi(userId) {
  const t = rec(userId).toplam;
  return t.gunluk + t.haftalik + t.yol;
}

module.exports = {
  rec,
  gunlukAlindi,
  gunlukAl,
  demetAlindi,
  demetVer,
  demetHafta,
  haftalikAlindi,
  haftalikAl,
  yolAlindi,
  yolAl,
  goruldu,
  gorusuKaydet,
  anahtar,
  anahtarEkle,
  anahtarHarca,
  kutuSayilari,
  kutuKaydet,
  kutuGaranti,
  sezonPuan,
  puanEkle,
  sezonKademeleri,
  sezonKademeAl,
  bitirilenSayisi,
};
