// Evlilik kayıtları: beş bölüm, hepsi data.evlilik altında.
//   evliler    : kullanıcı ID'si -> { es, at, rol }. Evlilik karşılıklıdır, iki tarafa da yazılır; tek taraflı kayıt
//                bozuk sayılmaz çünkü boşanma iki satırı birden siler. `rol` kabul anında botun yarattığı çift
//                rolünün ID'sidir; açılamadıysa boş durur ve boşanmada silinecek bir şey olmaz.
//   teklifler  : teklifi götürenin ID'si -> { hedef, no, at, sonAt, kanal, mesaj, rol }. Kişi başına bir bekleyen
//                teklif. `rol` teklifte seçilen çift rolünün provasıdır ({ ad, renk }); kabul edilirse o rol yaratılır.
//   retler     : çift anahtarı -> geri çevrilme anı. Aynı çiftin yeniden teklif etmesi için bekleme burada ölçülür.
//   bosanmalar : kullanıcı ID'si -> boşanma anı. Yeni teklif götürmeden önceki bekleme buradan okunur.
//   bonuslar   : çift anahtarı -> { sayi }. Yıl dönümü ödülünün kaç kez alındığı; hangi yedinci güne karşılık
//                geldiği evliliğin başlangıç anından hesaplanır, böylece sayaç evlilik bozulursa kendiliğinden düşer.
// Yüzüğün kendisi burada tutulmaz: elde duran adet butik storesunda (butik/store.js) yazılıdır.
const { data, save } = require('../../core/db');
const config = require('./config');

const DAY = 24 * 60 * 60 * 1000;

data.evlilik ??= { evliler: {}, teklifler: {}, retler: {}, bosanmalar: {}, bonuslar: {} };

const k = (alan) => (data.evlilik[alan] ??= {});

// Çift anahtarı: sıra fark etmez, iki ID küçükten büyüğe yan yana gelir
const ciftAnahtari = (a, b) => [a, b].sort().join(':');

// ── Evliler ───────────────────────────────────────────────────────────────────
const evlilikOf = (userId) => k('evliler')[userId] ?? null;
const esOf = (userId) => k('evliler')[userId]?.es ?? null;
const evliMi = (userId) => Boolean(k('evliler')[userId]);

// Birlikte geçen tam gün sayısı: kartta "12 gün" olarak okunur
const birlikteGun = (userId, at = Date.now()) => {
  const kayit = evlilikOf(userId);
  return kayit ? Math.max(0, Math.floor((at - kayit.at) / DAY)) : 0;
};

// Evlendirmenin tek yeri: iki satır birlikte yazılır, bekleyen teklifler birlikte kalkar. `rol` kabulde yaratılmış
// çift rolünün ID'sidir; verilemediyse boş kalır ve evlilik yine de kaydedilir.
function evlendir(a, b, at = Date.now(), rol = null) {
  k('evliler')[a] = { es: b, at, rol };
  k('evliler')[b] = { es: a, at, rol };
  teklifSil(a);
  teklifSil(b);
  save();
  return at;
}

// Boşanma: iki satır birden silinir, tarafların boşanma anı yazılır. Yıl dönümü sayacı çift anahtarında durur;
// aynı iki kişi yeniden evlenirse hesap evliliğin yeni başlangıcından sürdüğü için sayacın eski değeri düşer.
function bosan(a, b, at = Date.now()) {
  const iki = [a, b];
  for (const userId of iki) {
    delete k('evliler')[userId];
    k('bosanmalar')[userId] = at;
  }
  save();
  return at;
}

const bosanmaAni = (userId) => k('bosanmalar')[userId] ?? 0;

// Sunucudaki çiftler: her çift tek satırda, en yeni evlilik üstte
function ciftler() {
  const seen = new Set();
  return Object.entries(k('evliler'))
    .filter(([userId, kayit]) => {
      if (!kayit?.es) return false;
      const anahtar = ciftAnahtari(userId, kayit.es);
      if (seen.has(anahtar)) return false;
      seen.add(anahtar);
      return true;
    })
    .map(([userId, kayit]) => ({ a: userId, b: kayit.es, at: kayit.at }))
    .sort((x, y) => y.at - x.at);
}

// ── Bekleyen teklifler ────────────────────────────────────────────────────────
const teklifGiden = (userId) => k('teklifler')[userId] ?? null;

// Sana uzanan teklif: kayıt teklifi götürenin anahtarıyla durduğu için hedef taraf aranarak bulunur
function teklifGelen(userId) {
  return Object.values(k('teklifler')).find((t) => t.hedef === userId) ?? null;
}

const teklifByNo = (no) => Object.values(k('teklifler')).find((t) => t.no === no) ?? null;

function teklifKaydet({ oneren, hedef, no, sonAt, kanal, rol = null }) {
  k('teklifler')[oneren] = { oneren, hedef, no, at: Date.now(), sonAt, kanal, mesaj: null, rol };
  save();
  return k('teklifler')[oneren];
}

function teklifSil(userId) {
  const kayit = k('teklifler')[userId];
  delete k('teklifler')[userId];
  if (kayit) save();
  return kayit ?? null;
}

// Kart kanalda durduğu yerde sonuç kartına dönsün diye mesaj ID'si kayda yazılır
function teklifMesaj(no, mesajId) {
  for (const [userId, t] of Object.entries(k('teklifler'))) {
    if (t.no !== no) continue;
    t.mesaj = mesajId;
    save();
    return userId;
  }
  return null;
}

// Süresi dolmuş, hiç karşılık görmemiş teklifler: bekçi bunları kapatır
const bekleyenler = (at = Date.now()) =>
  Object.entries(k('teklifler')).filter(([, t]) => t.sonAt <= at).map(([oneren, t]) => ({ oneren, ...t }));

// ── Retler ────────────────────────────────────────────────────────────────────
const retAni = (a, b) => k('retler')[ciftAnahtari(a, b)] ?? 0;

function retKaydet(a, b, at = Date.now()) {
  k('retler')[ciftAnahtari(a, b)] = at;
  save();
  return at;
}

// ── Yıl dönümü ödülü ──────────────────────────────────────────────────────────
// Çiftin evlilik başlangıcı ve kaç ödeme alındığı tek yerde tutulur; sıradaki dönüm başlangıç + (sayi + 1) × gün
function bonusDurumu(userId, at = Date.now()) {
  const kayit = evlilikOf(userId);
  if (!kayit) return null;
  const { gun } = config.yilDonumu;
  const sayi = k('bonuslar')[ciftAnahtari(userId, kayit.es)]?.sayi ?? 0;
  const sonrakiAt = kayit.at + (sayi + 1) * gun * DAY;
  return { sayi, sonrakiAt, hazir: sonrakiAt <= at, gun };
}

// Ödeme alındı: sayaç bir ileri gider, yeni durum baştan okunur ki kart ile defter ayrışmasın
function bonusAl(a, at = Date.now()) {
  const kayit = evlilikOf(a);
  if (!kayit) return null;
  const sayaç = k('bonuslar')[ciftAnahtari(a, kayit.es)];
  if (sayaç) sayaç.sayi += 1;
  else k('bonuslar')[ciftAnahtari(a, kayit.es)] = { sayi: 1 };
  save();
  return bonusDurumu(a, at);
}

module.exports = {
  ciftAnahtari,
  evlilikOf,
  esOf,
  evliMi,
  birlikteGun,
  evlendir,
  bosan,
  bosanmaAni,
  ciftler,
  teklifGiden,
  teklifGelen,
  teklifByNo,
  teklifKaydet,
  teklifSil,
  teklifMesaj,
  bekleyenler,
  retAni,
  retKaydet,
  bonusDurumu,
  bonusAl,
};
