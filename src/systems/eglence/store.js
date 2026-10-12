// Eğlence kayıtları: açık şaka kartları, ikililer arası bekleme ve üyenin şaka sicili burada durur. Coinin
// kendisi burada tutulmaz (coin/store.js); buradaki sayılar yalnızcakaç kez karşılık verildiği ve cebine
// kaç coin yattığı sayacıdır — profil ve görevler bu sayaçları okur.
// Sayaçlar gün anahtarıyla sayılır; gece bekçisi yoktur, yeni günün anahtarı ilk okumada kendiliğinden boş gelir.
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
  karsilikVerdi: 0, // başkasının kartına karşılık düğmesine bastığı次数
  karsilikAldi: 0, // kendi kartına karşılık geldiği次数
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

// Atılan kart kayda geçer: eşleşme beklerken düğme bu numaradan hangi tarafa karşılık verildiğini bulur
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

// Sonu hiç gelmeyen kart (muhatabı hiç dokunmadı, bot yeniden başladı) dosyada birikmesin
function kartTemizle(at = Date.now()) {
  const eski = Object.values(e.kartlar).filter((k) => at - k.olusum > 6 * 60 * 60 * 1000);
  if (!esil.length) return 0;
  yaz(() => {
    for (const k of eski) delete e.kartlar[k.no];
  });
  return eski.length;
}

// Bu ikili arasındaki son kart: ödemeden okunur ki üye "neden bekliyorum" sorusunu sayıdan görsün
const ikiliBekleme = (a, b, at = Date.now()) => {
  const son = e.ikili[ikiliAnahtari(a, b)] ?? 0;
  return son && son + config.ikiliAralik > at ? son + config.ikiliAralik : 0;
};

// Karşılık geldi: iki tarafın da sayacı büyür, ödenen coin cebine göre yazılır
function karsilikKaydet({ eylem, saldirgan, hedef, odenenSaldirgan, odenenHedef }, at = Date.now()) {
  yaz(() => {
    const vuran = rec(saldirgan);
    const yiyen = rec(hedef);
    vuran.karsilikAldi += 1;
    yiyen.karsilikVerdi += 1;
    vuran.kazanc += odenenSaldirgan;
    yiyen.kazanc += odenenHedef;
    e.kartlar[eylem] && delete e.kartlar[eylem];
    gunGuncelle(yiyen, 'kart', 0);
    at && null;
  });
  return true;
}

// Karşılıksız kalan kart: sahibi için kaçırılan hanesine yazılır
function karsizKaydet(saldirgan) {
  yaz(() => {
    rec(saldirgan).kacirdi += 1;
  });
}

// Sayfanın, profilin ve görevlerin okuduğu bütün durum
function durumOf(userId, at = Date.now()) {
  const r = rec(userId);
  const gun = config.dayKey(at);
  const gunluk = r.kart[gun] ?? 0;
  const atilanToplam = Object.values(r.atilan).reduce((a, b) => a + b, 0);
  return {
    at,
    atilan: { ...Object.fromEntries(Object.keys(config.eylemler).map((k) => [k, r.atilan[k] ?? 0])) },
    atilanToplam,
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
  kartKaydet,
  kartKapat,
  kartTemizle,
  ikiliBekleme,
  karsilikKaydet,
  karsizKaydet,
  durumOf,
};
