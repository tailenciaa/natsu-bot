// Oyun Salonu kayıtları: seçili bahis, keşif sayacı ve beklemesi, kumarhane istatistikleri ile yarım kalan
// Merdiven tırmanışı burada durur. Coinin kendisi burada tutulmaz (coin/store.js); burası yalnızca "kim ne
// kadar oynadı ve ne kadar kazandı" bilgisini taşır, görevler ve rozetler de bunu okur.
// Sayaçlar gün anahtarıyla sayılır, gece bekçisi yoktur: yeni günün anahtarı ilk okumada kendiliğinden boş gelir.
const { data, save } = require('../../core/db');
const config = require('./config');

data.oyun ??= { users: {} };

// Gün anahtarı coin ve görev takvimiyle aynı (İstanbul); karşılaştırma bugün ile dünü gördüğü için üç gün yeter
const KEEP_DAYS = 3;

const rec = (userId) => (data.oyun.users[userId] ??= {
  bahis: config.bets[0],
  kesif: { bolge: {}, gun: {}, sonAt: 0 },
  kumar: { el: 0, gun: {}, net: 0, enBuyuk: 0, cekis: 0 },
  merdiven: null, // { bahis, adim, baslangic } — adim: çıkılan basamak sayısı
});

const yaz = (userId, fn) => {
  const r = rec(userId);
  fn(r);
  save();
  return r;
};

// Eski gün anahtarları atılır: sayaç sonsuza birikmesin
function gunGuncelle(hedef, gun, artan) {
  const guncel = { ...hedef, [gun]: (hedef[gun] ?? 0) + artan };
  Object.assign(hedef, Object.fromEntries(Object.entries(guncel).sort((a, b) => b[0].localeCompare(a[0])).slice(0, KEEP_DAYS)));
}

// ── Bahis ─────────────────────────────────────────────────────────────────────
// Üye bahsi düğmelerden seçer (elle coin yazdırılmaz): config.bets dışındaki bir istek en yakın lower değere iner.
const bahis = (userId) => {
  const value = rec(userId).bahis;
  return config.bets.includes(value) ? value : config.bets[0];
};

const setBahis = (userId, amount) => {
  const secenek = config.bets.filter((b) => b <= amount).pop() ?? config.bets[0];
  return yaz(userId, (r) => {
    r.bahis = secenek;
  }).bahis;
};

// ── Keşif ─────────────────────────────────────────────────────────────────────
// İki sınır birden var: geziler arasındaki bekleme (ekrana zincirlenmesin) ve günün gezi kotası (kazanç tavanını
// tek başına doldurmasın). Kota dolunca beklemenin bir anlamı kalmadığı için öncelik kotanin mesajında verilir.
function kesifDurumu(userId, at = Date.now()) {
  const k = rec(userId).kesif;
  const gun = config.dayKey(at);
  const used = k.gun[gun] ?? 0;
  const nextAt = k.sonAt + config.kesif.cooldown;
  if (used >= config.kesif.gunlukAdet) return { ok: false, sebep: 'kota', used, nextAt: 0, kalan: 0 };
  if (at < nextAt) return { ok: true, sebep: null, used, nextAt, kalan: config.kesif.gunlukAdet - used };
  return { ok: true, sebep: null, used, nextAt: at, kalan: config.kesif.gunlukAdet - used };
}

function kesifKaydet(userId, bolgeKey, at = Date.now()) {
  const gun = config.dayKey(at);
  return yaz(userId, (r) => {
    r.kesif.bolge[bolgeKey] = (r.kesif.bolge[bolgeKey] ?? 0) + 1;
    gunGuncelle(r.kesif.gun, gun, 1);
    r.kesif.sonAt = at;
  });
}

const kesifSayilari = (userId) => {
  const k = rec(userId).kesif;
  return {
    bolgeler: k.bolge,
    toplam: Object.values(k.bolge).reduce((a, b) => a + b, 0),
    gun: k.gun[config.dayKey()] ?? 0,
    sonAt: k.sonAt,
  };
};

// ── Kumarhane (Rulet ve Merdiven) ─────────────────────────────────────────────
// `net`: kazanılanlardan yitirilenlerin çıkarılmış hâli (rozet ve görevler bunu okur). `odul` tek elin
// oyuncuya dönen toplamıdır; rekor onun üzerinden tutulur.
function elKaydet(userId, { net, odul = 0 }, at = Date.now()) {
  const gun = config.dayKey(at);
  return yaz(userId, (r) => {
    r.kumar.el += 1;
    r.kumar.net += net;
    r.kumar.enBuyuk = Math.max(r.kumar.enBuyuk, odul);
    if (odul) r.kumar.cekis = Math.max(r.kumar.cekis, odul);
    gunGuncelle(r.kumar.gun, gun, 1);
  }).kumar;
}

const kumarSayilari = (userId) => {
  const k = rec(userId).kumar;
  return { el: k.el, net: k.net, enBuyuk: k.enBuyuk, cekis: k.cekis, gun: k.gun[config.dayKey()] ?? 0 };
};

// ── Merdiven ──────────────────────────────────────────────────────────────────
// Tırmanış üyenin üstünde duran bir tekaptır: sayfa kapatılıp geç kalınırsa basamaklar yanmaz, tırmanış düşer.
// Süresi dolmuş tırmanış okunurken temizlenir, ayrıca bir bekçi gerektirmez.
function merdiven(userId, at = Date.now()) {
  const r = rec(userId);
  if (!r.merdiven) return null;
  if (at - r.merdiven.baslangic > config.merdiven.TTL) {
    yaz(userId, (x) => {
      x.merdiven = null;
    });
    return null;
  }
  return r.merdiven;
}

const merdivenBaslat = (userId, amount, at = Date.now()) =>
  yaz(userId, (r) => {
    r.merdiven = { bahis: amount, adim: 0, baslangic: at };
  }).merdiven;

const merdivenYukselt = (userId) => {
  const r = rec(userId);
  if (!r.merdiven) return null;
  r.merdiven.adim += 1;
  save();
  return r.merdiven;
};

const merdivenDusur = (userId) => yaz(userId, (r) => {
  r.merdiven = null;
}).merdiven;

module.exports = {
  rec,
  bahis,
  setBahis,
  kesifDurumu,
  kesifKaydet,
  kesifSayilari,
  elKaydet,
  kumarSayilari,
  merdiven,
  merdivenBaslat,
  merdivenYukselt,
  merdivenDusur,
};
