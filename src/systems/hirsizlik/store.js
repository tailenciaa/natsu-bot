// Suç Dünyası kayıtları: açık girişimler, üyenin suçu sicili (girişim/başarı/yakalanma), Devletin Kasası ve
// topluluk kayıt defteri burada durur. Coinin kendisi burada tutulmaz (coin/store.js); kasa bir sayıdır ve
// yalnızca ceza ile kefalet gelirlerinden büyür, soyulduğunda da kendi hesabından düşer.
// Sayaçlar gün anahtarıyla sayılır, gece bekçisi yoktur: yeni günün anahtarı ilk okumada kendiliğinden boş gelir.
const { data, save } = require('../../core/db');
const config = require('./config');

data.hirsizlik ??= {
  kasa: config.kasa.kurulus,
  girisimler: {}, // id -> açık girişim { id, tip, saldirgan, hedef, kanal, mesaj, sonAt, olusum }
  kullanici: {},
  sicil: [], // topluluk kayıt defteri: en yeni sonda
  kasaSonSoygun: 0,
};

const KEEP_DAYS = 3;
const h = data.hirsizlik;

const rec = (userId) => (h.kullanici[userId] ??= {
  girisim: 0, // toplam girişim (sonuçtan bağımsız)
  basari: 0, // coinle sonuçlanan girişim
  yakalanma: 0, // direnç ya da müdahale sonrası yakalandığı girişim
  avladigi: 0, // başka üyelerden aldığı coin
  kaybi: 0, // kurban olarak kaybettiği coin
  direnis: 0, // zamanında bastığı Diren düğmesi
  ikramiye: 0, // müdahale ederek kazandığı coin
  gun: {}, // gün anahtarı -> o günün girişim sayısı
  hedefler: {}, // hedef üye ID -> o hedefe en son girişimin anı
  sonGirisim: 0,
  dokunulmaz: 0, // bu ana kadar hedef olamaz
  hapis: 0, // bu ana kadar içeride
  hapisTur: null, // 'uye' | 'kasa' — kefalet bedeli ve süre buna göre seçilir
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

// ── Devletin Kasası ───────────────────────────────────────────────────────────
const kasa = () => Math.max(0, Math.floor(h.kasa));

const kasaEkle = (amount) => yaz(() => {
  h.kasa = kasa() + Math.max(0, Math.floor(amount));
});

const kasaDus = (amount) => yaz(() => {
  h.kasa = Math.max(0, kasa() - Math.max(0, Math.floor(amount)));
});

// Kasa soyulduktan sonra aynı kasa bir süre daha hedef olamaz
const kasaBekleme = () => h.kasaSonSoygun + config.kasa.bekleme;
const kasaSoyuldu = (at = Date.now()) => yaz(() => {
  h.kasaSonSoygun = at;
});

// ── Hapis ─────────────────────────────────────────────────────────────────────
// Süresi dolmuş bir hapis kaydı okumada kendiliğinden boş gelir; bekçi gerekmez.
const hapista = (userId, at = Date.now()) => (rec(userId).hapis > at ? rec(userId).hapis : 0);

const hapisVer = (userId, sonAt, tur, at = Date.now()) => yaz(() => {
  const r = rec(userId);
  r.hapis = Math.max(r.hapis, at) + sonAt; // içerideyken yakalananın süresi eklenir
  r.hapisTur = tur;
});

const hapisBitir = (userId) => yaz(() => {
  const r = rec(userId);
  r.hapis = 0;
  r.hapisTur = null;
});

// Kefalet bedeli içinde bulunulan cezeye göre seçilir; üye kefaleti öderse hapis hanesi sıfırlanır, para kasaya yazar
const kefaletBedeli = (userId) => config.kefalet[rec(userId).hapisTur ?? 'uye'];
const cezaBedeli = (tur) => config.ceza[tur];

// ── Girişimler ────────────────────────────────────────────────────────────────
// Girişim tek seferde bir tane olur: üye elindeki pusu sonuçlanmadan yenisini kuramaz (hem kart hem sayaç karmaşası).
const girisim = (id) => h.girisimler[id] ?? null;

const acikGirisim = (userId) => Object.values(h.girisimler).find((g) => g.durum === 'bekliyor' && (g.saldirgan === userId || g.hedef === userId)) ?? null;

const bekleyenler = (at = Date.now()) => Object.values(h.girisimler).filter((g) => g.durum === 'bekliyor' && g.sonAt <= at);

function girisimKaydet(g, at = Date.now()) {
  yaz(() => {
    h.girisimler[g.id] = { ...g, durum: 'bekliyor', olusum: at };
    const r = rec(g.saldirgan);
    r.girisim += 1;
    r.sonGirisim = at;
    gunGuncelle(r.gun, config.dayKey(at), 1);
    if (g.tip === 'uye') r.hedefler[g.hedef] = at;
  });
  return h.girisimler[g.id];
}

// Sonuçlanan girişim kayıttan kalkar: dosya açık pusu biriktirmez, düğmeye yeniden basmak da bir şeye benzemez
function girisimKapat(id) {
  yaz(() => {
    delete h.girisimler[id];
  });
}

// Pusu kartının mesaj numarası sonra eklenir: bekçi kartı yeni mesaj atmak yerine yerinde sonuç kartına çevirsin
function girisimMesajKaydet(id, mesajId) {
  if (!h.girisimler[id]) return null;
  yaz(() => {
    h.girisimler[id].mesaj = mesajId;
  });
  return h.girisimler[id];
}

// Bir günde bu kadar taze kayıt bırakılmazsa dosya şişer (bot yeniden başladığında süresi geçmiş yetim kayıt da bu
// yolla temizlenir; sweep bunları zaten sonuçlandırır)
function girisimTemizle(at = Date.now()) {
  const eski = Object.values(h.girisimler).filter((g) => at - g.olusum > 6 * 60 * 60 * 1000);
  if (!eski.length) return 0;
  yaz(() => {
    for (const g of eski) delete h.girisimler[g.id];
  });
  return eski.length;
}

// ── Sonuç kayıtları ───────────────────────────────────────────────────────────
function basariKaydet(userId, miktar) {
  yaz(() => {
    const r = rec(userId);
    r.basari += 1;
    r.avladigi += miktar;
  });
  return miktar;
}

// Kurban: kaybı yazılır ve dokunulmazlığı başlar
function kayipKaydet(userId, miktar, at = Date.now()) {
  yaz(() => {
    const r = rec(userId);
    r.kaybi += miktar;
    r.dokunulmaz = at + config.dokunulmazlik;
  });
  return miktar;
}

// Direnen üye: düğme sayacı ve dokunulmazlığı (yakalansa da yakalanmasa da o gün bir daha hedef olmaz)
function direnisKaydet(userId, at = Date.now()) {
  yaz(() => {
    const r = rec(userId);
    r.direnis += 1;
    r.dokunulmaz = at + config.dokunulmazlik;
  });
}

// Yakalanan saldırganın sicili; hapis ve ceza ödeme işi çağıran tarafta (coin hareketi burada olmaz)
function yakalanmaKaydet(userId, at = Date.now()) {
  yaz(() => {
    rec(userId).yakalanma += 1;
  });
}

const ikramiyeKaydet = (userId, miktar) => yaz(() => {
  rec(userId).ikramiye += miktar;
});

// ── Toplum kayıt defteri ──────────────────────────────────────────────────────
// Kartların altındaki "son girişimler" listesi buradan okunur; üye olup biteni tek mesajda görür.
function sicilEkle(kayit) {
  yaz(() => {
    h.sicil.push({ ...kayit, no: h.sicil.length + 1 });
    if (h.sicil.length > config.sicilTut) h.sicil = h.sicil.slice(-config.sicilTut);
  });
  return h.sicil[h.sicil.length - 1];
}

const sicilSon = (adet = config.sicilGoster) => [...h.sicil].slice(-adet).reverse();

// ── Sayfanın okuduğu bütün durum ──────────────────────────────────────────────
// Dışa açılır ki önizleme (tools/preview) aynı okuma kapısından geçsin, senaryo için elle durum kurmasın.
function durumOf(userId, at = Date.now()) {
  const r = rec(userId);
  const gun = config.dayKey(at);
  const hapis = r.hapis > at ? r.hapis : 0;
  return {
    at,
    hapis,
    hapisTur: hapis ? (r.hapisTur ?? 'uye') : null,
    kefalet: hapis ? config.kefalet[r.hapisTur ?? 'uye'] : 0,
    girisim: r.girisim,
    basari: r.basari,
    yakalanma: r.yakalanma,
    direnis: r.direnis,
    avladigi: r.avladigi,
    kaybi: r.kaybi,
    ikramiye: r.ikramiye,
    gunluk: r.gun[gun] ?? 0,
    kalan: Math.max(0, config.gunlukAdet - (r.gun[gun] ?? 0)),
    bekleme: r.sonGirisim ? r.sonGirisim + config.cooldown : 0,
    dokunulmaz: r.dokunulmaz > at ? r.dokunulmaz : 0,
    acikGirisim: acikGirisim(userId) ? 1 : 0,
    kasa: kasa(),
    kasaBekleme: h.kasaSonSoygun ? h.kasaSonSoygun + config.kasa.bekleme : 0,
    hedefBekleme: (hedefId) => (r.hedefler[hedefId] ? r.hedefler[hedefId] + config.hedefBekleme : 0),
    sicil: sicilSon(),
  };
}

module.exports = {
  rec,
  durumOf,
  kasa,
  kasaEkle,
  kasaDus,
  kasaBekleme,
  kasaSoyuldu,
  hapista,
  hapisVer,
  hapisBitir,
  kefaletBedeli,
  cezaBedeli,
  girisim,
  girisimKaydet,
  girisimKapat,
  girisimMesajKaydet,
  girisimTemizle,
  acikGirisim,
  bekleyenler,
  basariKaydet,
  kayipKaydet,
  direnisKaydet,
  yakalanmaKaydet,
  ikramiyeKaydet,
  sicilEkle,
  sicilSon,
};
