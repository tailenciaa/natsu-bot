// Butik kayıtları: tükenen ürünler (ek saygınlık hakkı, evlilik yüzüğü) kullanıcı ID'si -> elde kalan adet,
// kalıcı renkler ise kullanıcı ID'si -> sahip olunduğu renk anahtarları olarak durur. Bakiye coin sisteminde
// (coins) tutulur; buraya yalnızca satın alınan şeyin kendisi yazılır, para hiç geçmez.
const { data, save } = require('../../core/db');
const config = require('./config');

data.butik ??= { tukenen: {}, roller: {} };

// ── Tükenen ürünler ───────────────────────────────────────────────────────────
// Ürün anahtarı -> { userId: elde kalan adet }
const say = (key, userId) => data.butik.tukenen[key]?.[userId] ?? 0;

// Satın alma: adedi artırır ve yeni toplamı döner
function ekle(key, userId, adet = 1) {
  const sayac = (data.butik.tukenen[key] ??= {});
  sayac[userId] = (sayac[userId] ?? 0) + adet;
  save();
  return sayac[userId];
}

// Bir adet yakar; elde hiç yoksa false döner ve kayıt değişmez. Kullanan sistem (saygı, evlilik) bu sonuca
// göre işlemini ya tamamlar ya da durur,因此 hak asla sessizce yok olmaz.
function yak(key, userId) {
  const kalan = say(key, userId);
  if (kalan <= 0) return false;
  data.butik.tukenen[key][userId] = kalan - 1;
  save();
  return true;
}

// ── Kalıcı renkler ────────────────────────────────────────────────────────────
const rolleri = (userId) => data.butik.roller[userId] ?? [];

const rolSahibi = (userId, key) => rolleri(userId).includes(key);

// Sahiplik kaydı: rolün verilmesi ayrı bir adımdır, çünkü Discord erişilemezse para alınmaz
function rolEkle(userId, key) {
  if (rolSahibi(userId, key)) return false;
  (data.butik.roller[userId] ??= []).push(key);
  save();
  return true;
}

// ── Ürün bulguları ────────────────────────────────────────────────────────────
const renk = (key) => config.roller.find((r) => r.key === key);

// Satıştaki renkler: roleId'si doldurulmuşlar. Boş bırakılan renkDiscord'da hazır olmadığı için rafta durmaz.
const satisdakiRenkler = () => config.roller.filter((r) => r.roleId);

module.exports = {
  say,
  ekle,
  yak,
  rolleri,
  rolSahibi,
  rolEkle,
  renk,
  satisdakiRenkler,
  hakSay: (userId) => say(config.hak.key, userId),
  hakYak: (userId) => yak(config.hak.key, userId),
  yuzukSay: (userId) => say(config.yuzuk.key, userId),
  yuzukYak: (userId) => yak(config.yuzuk.key, userId),
};
