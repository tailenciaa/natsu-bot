// Eğlence kayıtları: karşılık bekleyen şaka kartları, ikililer arası bekleme ve üyenin şaka sicili burada durur.
// Coinin kendisi burada tutulmaz (coin/store.js); buradaki sayılar kaç kart atıldığı, kaç karşılık verildiği ve
// karşılıklardan cebine kaç coin yattığıdır — profil kartı ve görevler bu sayaçları okur.
// Kartlar tek seferde sonuçlanır: karşılık ya da süre sonu kartı kayıttan düşürür, böylece eski bir karttan
// düğmeye basmak ikinci kez ödül üretemez.
const { data, save } = require('../../core/db');
const config = require('./config');

data.eglence ??= {
  kartlar: {}, // no -> açık kart { no, eylem, saldirgan, hedef, sonAt, olusum }
  kullanici: {},
  ikili: {}, // 'küçükID:büyükID' -> bu ikili arasındaki son kartın anı
};

const e = data.eglence;
const KEEP_DAYS = 3;

const rec = (userId) => (e.kullanici[userId] ??= {
  kart: {}, // gün anahtarı -> o gün atılan kart sayısı
  atilan: {}, // eylem anahtarı -> toplam atılan kart
  karsilikVerdi: 0, // başkasının kartına karşılık verdiği sayı
  karsilikAldi: 0, // kendi kartına karşılık geldiği sayı
  kacirdi: 0, // karşılıksız kalan kartı
  kazanc: 0, // karşılıklardan cebine yatan toplam coin
});

const yaz = (fn) => {
  fn();
  save();
};

// Eski gün anahtarları atılır: sayaç sonsuza birikmesin
function gunGuncelle(hedef, gun, artan) {
  const guncel = { ...hedef, [gun]: (hedef[gun] ?? 0) + artan };
  Object.assign(hedef, Object.fromEntries(Object.entries(guncel).sort((a, b) => b[0].localeCompare(a[0])).slice(0, KEEP_DAYS)));
}

// İkili anahtarı yön fark etmesin: iki ID sıralı yazılır
const ikiliAnahtari = (a, b) => [a, b].sort().join(':');

const kart = (no) => e.kartlar[no] ?? null;

// Bu üyeye uzanan açık kartlar: şakalaşma sayfası bunları listeler ki kimse düğmesini kanalda aramasın.
// Süresi geçmişler de burada durur — sayfa "karşılık bekleniyor" ile "artık geç kaldın" farkını gösterir.
function acikKartlar(userId) {
  return Object.values(e.kartlar)
    .filter((k) => k.hedef === userId)
    .sort((a, b) => a.sonAt - b.sonAt);
}

// Atılan kart kayda geçer: düğme bu numaradan hangi ikilinin şakasını çözdüğünü bulur
function kartKaydet({ no, eylem, saldirgan, hedef, sonAt }, at = Date.now()) {
  yaz(() => {
    e.kartlar[no] = { no, eylem, saldirgan, hedef, sonAt, olusum: at };
    e.ikili[ikiliAnahtari(saldirgan, hedef)] = at;
    const r = rec(saldirgan);
    gunGuncelle(r.kart, config.dayKey(at), 1);
    r.atilan[eylem] = (r.atilan[eylem] ?? 0) + 1;
  });
  return e.kartlar[no];
}

function kartKapat(no) {
  yaz(() => {
    delete e.kartlar[no];
  });
}

// Süresi hiç sonuçlanmayan kart (muhatabı hiç dokunmadı, bot yeniden başladı) dosyada birikmesin
function kartTemizle(at = Date.now()) {
  const eski = Object.values(e.kartlar).filter((k) => at - k.olusum > 6 * 60 * 60 * 1000);
  if (!eski.length) return 0;
  yaz(() => {
    for (const k of eski) delete e.kartlar[k.no];
  });
  return eski.length;
}

// Bu ikili arasındaki son kartın bitişi: sıfırsa bekleme yok
function ikiliBekleme(a, b, at = Date.now()) {
  const son = e.ikili[ikiliAnahtari(a, b)] ?? 0;
  const bitti = son + config.ikiliAralik;
  return bitti > at ? bitti : 0;
}

// Karşılık geldi: kart kayıttan kalkar, iki tarafın sayacı ve kazancı yazılır
function karsilikSonuclandir(g, odenenSaldirgan, odenenHedef) {
  yaz(() => {
    delete e.kartlar[g.no];
    rec(g.saldirgan).karsilikAldi += 1;
    rec(g.saldirgan).kazanc += odenenSaldirgan;
    rec(g.hedef).karsilikVerdi += 1;
    rec(g.hedef).kazanc += odenenHedef;
  });
}

// Süre doldu, karşılık gelmedi: kart kalkar, sahibi kaçırılan hanesine yazar
function karsizSonuclandir(g) {
  yaz(() => {
    delete e.kartlar[g.no];
    rec(g.saldirgan).kacirdi += 1;
  });
}

// Kartın sahibine göre okunan özeti: profil ve görevler bu tek kapıdan beslenir
function durumOf(userId, at = Date.now()) {
  const r = rec(userId);
  const gunluk = r.kart[config.dayKey(at)] ?? 0;
  return {
    at,
    atilan: Object.fromEntries(Object.keys(config.eylemler).map((k) => [k, r.atilan[k] ?? 0])),
    atilanToplam: Object.values(r.atilan).reduce((a, b) => a + b, 0),
    karsilikVerdi: r.karsilikVerdi,
    karsilikAldi: r.karsilikAldi,
    kacirdi: r.kacirdi,
    kazanc: r.kazanc,
    gunluk,
    kalan: Math.max(0, config.gunlukKart - gunluk),
  };
}

module.exports = {
  rec,
  ikiliAnahtari,
  kart,
  acikKartlar,
  kartKaydet,
  kartKapat,
  kartTemizle,
  ikiliBekleme,
  karsilikSonuclandir,
  karsizSonuclandir,
  durumOf,
};
