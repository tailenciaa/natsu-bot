// Görev ilerlemesinin okunduğu yer. Sayaç tutmaz: mesaj ve ses sayıları sıralama kaydından, saygınlık haftalık
// tablosundan, günlük ödül ve siparişler coin kaydından, kozmetik/biyografi/renk profil kaydından, kutu ve seri
// bu sistemin kendi kaydından gelir. Burada üretilen sayılar ile panellerde görünen sayılar aynı kaynaktır.
const coinStore = require('../coin/store');
const saygiStore = require('../saygi/store');
const siralamaStore = require('../siralama/store');
const profilStore = require('../profil/store');
const rozet = require('../profil/rozet');
const skor = require('../profil/skor');
const config = require('./config');
const store = require('./store');

// ── Ölçümler ──────────────────────────────────────────────────────────────────
// Sunucu geneli haritalar bir kez alınır ve sayfadaki bütün görevler için yeniden kullanılır.
// totals(kind, 1) yalnızca bugünü, totals(kind, 7) son yedi günü (bu hafta) toplar.
function olcumler(at = Date.now()) {
  const gun = config.dayKey(at);
  const hafta = config.haftaAnahtari(at);
  return {
    at,
    gun,
    hafta,
    haftaBas: config.haftaBaslangici(hafta),
    mesajGun: siralamaStore.totals('messages', 1),
    mesajHafta: siralamaStore.totals('messages', 7),
    sesGun: siralamaStore.totals('voice', 1),
    sesHafta: siralamaStore.totals('voice', 7),
    yayinGun: siralamaStore.totals('stream', 1),
    yayinHafta: siralamaStore.totals('stream', 7),
    repHafta: saygiStore.weekTotals(hafta),
  };
}

// Rozet, puan ve ömür boyu ses süresi Keşif Yolu'nun adımlarında gerekiyor; kart açıldığında zaten hesaplandığı
// için ayrı bir geçiş istenmiyor. Yalnızca Yol sekmesi bunu çağırır.
function ekler(guild, member, userId, m) {
  const measures = m ?? rozet.measures();
  const ctx = rozet.contextOfMember(guild, member, userId, measures);
  const kazanilan = rozet.earned(ctx);
  return {
    rozetSayisi: kazanilan.length,
    puan: skor.scoreOf(ctx, kazanilan.length).total,
    sesToplam: measures.voice.get(userId) ?? 0,
  };
}

// ── Ölçüm adları ──────────────────────────────────────────────────────────────
// config.js'teki görevlerin `olcum` alanı buradaki anahtarla eşleşir. Hepsi üyenin o anki değerini döndürür;
// "yapıldı" türündekiler 0 ya da 1 döner. `ek` yalnızca rozet/puan ölçümlerini okur.
const OLCUMLER = {
  mesajGun: (m, uid) => m.mesajGun.get(uid) ?? 0,
  mesajHafta: (m, uid) => m.mesajHafta.get(uid) ?? 0,
  sesGun: (m, uid) => m.sesGun.get(uid) ?? 0,
  sesHafta: (m, uid) => m.sesHafta.get(uid) ?? 0,
  yayinGun: (m, uid) => m.yayinGun.get(uid) ?? 0,
  yayinHafta: (m, uid) => m.yayinHafta.get(uid) ?? 0,
  gunlukBugun: (m, uid) => (coinStore.lastClaimAt(uid) && config.dayKey(coinStore.lastClaimAt(uid)) === m.gun ? 1 : 0),
  gunlukHic: (m, uid) => (coinStore.lastClaimAt(uid) > 0 ? 1 : 0),
  repVerdiBugun: (m, uid) => (saygiStore.lastGiven(uid) && config.dayKey(saygiStore.lastGiven(uid)) === m.gun ? 1 : 0),
  repVerdiHic: (m, uid) => (saygiStore.lastGiven(uid) > 0 ? 1 : 0),
  repHafta: (m, uid) => m.repHafta[uid] ?? 0,
  satinAlmaHafta: (m, uid) => coinStore.purchasesOf(uid).filter((p) => p.at >= m.haftaBas).length,
  kutuHafta: (m, uid) => store.kutuSayilari(uid).hafta,
  kutuToplam: (m, uid) => store.kutuSayilari(uid).toplam,
  demetHafta: (m, uid) => store.demetHafta(uid, m.hafta),
  // Renk ve biyografi "var mı" diye sorulur: 0 (siyah) geçerli bir renk seçimidir, boş sayılmaz
  renkVar: (m, uid) => (profilStore.get(uid).color == null ? 0 : 1),
  bioVar: (m, uid) => (String(profilStore.get(uid).bio ?? '').trim() ? 1 : 0),
  kozmetikSahibi: (m, uid) => profilStore.ownedCount(uid),
  sesToplam: (m, uid, ek) => ek?.sesToplam ?? 0,
  rozetSayisi: (m, uid, ek) => ek?.rozetSayisi ?? 0,
  puan: (m, uid, ek) => ek?.puan ?? 0,
  // İzlenen adımlar: hiçbir depoda izi olmayan iki eylem, etkileşim gözlemiyle görülür (index.js yazar)
  'goruldu:kartini-gor': (m, uid) => (store.goruldu(uid, 'kartini-gor') ? 1 : 0),
  'goruldu:cekilis-katil': (m, uid) => (store.goruldu(uid, 'cekilis-katil') ? 1 : 0),
};

const deger = (gorev, m, uid, ek) => {
  const olcum = OLCUMLER[gorev.olcum];
  return olcum ? Math.max(0, olcum(m, uid, ek)) : 0;
};

// ── Günün ve haftanın görevleri ───────────────────────────────────────────────
// Havuzdan seçim anahtardan (bugünün ya da haftanın tarihi) türetilir: aynı gün bütün sunucu aynı görevleri
// görür, yarın liste kendiliğinden değişir, tutulacak bir şey olmaz.
function tohum(anahtar) {
  let h = 2166136261;
  for (let i = 0; i < anahtar.length; i += 1) {
    h ^= anahtar.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function secim(havuz, anahtar, adet) {
  const kopya = [...havuz];
  let t = tohum(anahtar);
  for (let i = kopya.length - 1; i > 0; i -= 1) {
    t = (Math.imul(t, 1664525) + 1013904223) >>> 0;
    const j = t % (i + 1);
    [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
  }
  return kopya.slice(0, Math.min(adet, kopya.length));
}

const gunlukGorevleri = (gun) => secim(config.GUNLUK_HAVUZU, gun, config.gunlukAdet);
const haftalikGorevleri = (hafta) => secim(config.HAFTALIK_HAVUZU, hafta, config.haftalikAdet);

// ── Durum ─────────────────────────────────────────────────────────────────────
// Bir görevin satırı: ilerleme, bitti mi, ödül alındı mı, bu dönem alınabilir mi
function durum(gorev, m, uid, ek, alindi) {
  const degeri = deger(gorev, m, uid, ek);
  const bitti = degeri >= gorev.hedef;
  return { gorev, deger: Math.min(degeri, gorev.hedef), ham: degeri, hedef: gorev.hedef, bitti, alindi, alinabilir: bitti && !alindi };
}

const gunlukDurum = (uid, m, ek) => gunlukGorevleri(m.gun).map((g) => durum(g, m, uid, ek, store.gunlukAlindi(uid, g.key, m.gun)));
const haftalikDurum = (uid, m, ek) => haftalikGorevleri(m.hafta).map((g) => durum(g, m, uid, ek, store.haftalikAlindi(uid, g.key, m.hafta)));

// Demet: bugünün üç görevi de alındıysa verilir. Yarısı alındıysa "iki görevin kaldı" diye gösterilir.
function demetDurumu(uid, m, ek) {
  const satirlar = gunlukDurum(uid, m, ek);
  const kalan = satirlar.filter((s) => !s.alinabilir && !s.alindi).length;
  const bitti = satirlar.every((s) => s.alindi);
  return { satirlar, kalan, alindi: store.demetAlindi(uid, m.gun), alinabilir: bitti && !store.demetAlindi(uid, m.gun) };
}

// Keşif Yolu sıralı ilerler: ilk tamamlanmamış adım sıradakidir, sonrakiler kilitli gösterilir ki "ne yapacağım"
// sorusu hiç havada kalmasın.
function yolDurumu(uid, m, ek) {
  let sirada = true;
  return config.YOL.map((adim) => {
    const alindi = store.yolAlindi(uid, adim.key);
    const degeri = deger(adim, m, uid, ek);
    const bitti = degeri >= adim.hedef;
    const satir = { adim, deger: Math.min(degeri, adim.hedef), hedef: adim.hedef, bitti, alindi, kilit: !sirada && !bitti && !alindi, alinabilir: bitti && !alindi };
    if (!alindi && !bitti) sirada = false;
    return satir;
  });
}

// Sezon: kademe atlanmış mı, puan yetiyor mu
function sezonDurumu(uid, m) {
  const sezon = config.sezonAnahtari(m.at);
  const puan = store.sezonPuan(uid, sezon);
  const alinanlar = store.sezonKademeleri(uid, sezon);
  return {
    sezon,
    ad: config.SEZON.ad(sezon),
    puan,
    kademeler: config.SEZON.kademe.map((k, index) => ({
      ...k,
      index,
      yetti: puan >= k.puan,
      alindi: alinanlar.includes(index),
      alinabilir: puan >= k.puan && !alinanlar.includes(index),
    })),
  };
}

module.exports = { olcumler, ekler, deger, gunlukGorevleri, haftalikGorevleri, durum, gunlukDurum, haftalikDurum, demetDurumu, yolDurumu, sezonDurumu, OLCUMLER };
