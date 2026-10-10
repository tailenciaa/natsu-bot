// Profil kartı temaları: kapak (üst alan) gradyanı, varsayılan vurgu rengi, kapağın nasıl çizileceği (`effect`,
// kapak.js'teki çizicinin adı) ve kutuların panel tarzı (`glass`). `glass: true` olan temalar kartın kutularını
// yarı saydam buzlu cam olarak çizer; üye saydamlığı kendisi ayarlar (custom.glassOpacity). `glass: false` olanlarda
// kutular düz ve opak kalır. Kullanıcı renk seçtiyse vurgu o renk olur, kapak görseli eklediyse görsel temanın
// yerine geçer. price alanı olan temalar coin ile satın alınır (coin/mağaza).
const { mix, luminance } = require('../../core/canvas');

const THEMES = {
  sakura: { label: 'Sakura', description: 'Pembe tonları', from: '#3a1020', to: '#9a3560', accent: '#ff6b9a', effect: 'gradyan', glass: false },
  gece: { label: 'Gece', description: 'Lacivert ve indigo', from: '#0d1022', to: '#33388a', accent: '#7c8cff', effect: 'yildiz', glass: false },
  okyanus: { label: 'Okyanus', description: 'Turkuaz ve mavi', from: '#06222e', to: '#117a9c', accent: '#38c6e8', effect: 'dalga', glass: false },
  orman: { label: 'Orman', description: 'Koyu ve açık yeşil', from: '#07210f', to: '#237a43', accent: '#5be08a', effect: 'gradyan', glass: false },
  gunbatimi: { label: 'Gün Batımı', description: 'Turuncu ve mor', from: '#2b0f2e', to: '#cc5a2c', accent: '#ff9b5e', effect: 'gradyan', glass: false },
  ruya: { label: 'Mor Rüya', description: 'Menekşe tonları, cam panel', from: '#1b0b33', to: '#7230c2', accent: '#b57bff', effect: 'aurora', glass: true },
  kor: { label: 'Kor', description: 'Kızıl ve turuncu, cam panel', from: '#2a0708', to: '#a3271b', accent: '#ff6a4d', effect: 'aurora', glass: true, price: 2500 },
  krom: { label: 'Krom', description: 'Çelik grisi, cam panel', from: '#141619', to: '#5b646e', accent: '#c3ccd6', effect: 'gradyan', glass: true, price: 3200 },
  kehribar: { label: 'Kehribar', description: 'Amber cam tonları', from: '#241203', to: '#a3650f', accent: '#ffcf7a', effect: 'gradyan', glass: true, price: 3600 },
  zumrut: { label: 'Zümrüt', description: 'Yeşil ve altın, cam panel', from: '#04211a', to: '#0f7a5a', accent: '#3ee0a1', effect: 'cam', glass: true, price: 4500 },
  buz: { label: 'Buz', description: 'Buz beyazı cam panel', from: '#062026', to: '#2c8f9c', accent: '#d6f7ff', effect: 'cam', glass: true, price: 5200 },
  elmas: { label: 'Elmas', description: 'Buz mavisi, cam panel', from: '#071a2b', to: '#2f7fbf', accent: '#9fe6ff', effect: 'yildiz', glass: true, price: 6000 },
  nebula: { label: 'Nebula', description: 'Uzay bulutu renkleri, cam panel', from: '#150a29', to: '#6a2c8f', accent: '#ff8fd6', effect: 'aurora', glass: true, price: 7800 },
};

const DEFAULT_THEME = 'sakura';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// Vurgu rengi kartın koyu zemininde okunabilmeli: eşik altındaki renkler tam hedef parlaklığa gelecek kadar
// beyazla açılır. Beyazla karışımda parlaklık doğru orantılı arttığı için (l -> l + t(1-l)) tek adımda bulunur.
const MIN_ACCENT = 0.42;
function readableAccent(color) {
  const value = luminance(color);
  return value >= MIN_ACCENT ? color : mix(color, '#ffffff', (MIN_ACCENT - value) / (1 - value));
}

// Tek renkten tema üretir; kartın tonu seçilen renkten, vurgusu okunabilirliğe çekilmiş halinden türer.
// Renk seçiminde panel düzdür: buzlu cam görünümü yalnızca cam temaların özelliğidir.
function themeFromColor(color) {
  const accent = readableAccent(hex(color));
  return { from: mix(accent, '#000000', 0.78), to: mix(accent, '#000000', 0.35), accent, effect: 'gradyan', glass: false };
}

// Kartların rengi: profilde seçilen tema/renk; yoksa üyenin rol rengi; o da yoksa varsayılan tema.
// custom: profil kaydı ({ theme, color, ownedThemes, ... }), roleColor: üyenin görünen rol rengi (0 = renksiz).
// Profilde seçilen renk 0 olabilir (siyah), bu yüzden "seçim yok" null/undefined ile ayrılır.
function resolveTheme(custom = {}, roleColor = 0) {
  const color = Number.isInteger(custom.color) ? custom.color : null;
  const chosen = THEMES[custom.theme];
  // Ücretli tema satın alınmadan kullanılamaz: karta karışmasın diye varsayılan temaya düşülür
  const usable = chosen && (!(chosen.price > 0) || (custom.ownedThemes ?? []).includes(custom.theme) ? chosen : null);
  if (usable) return color !== null ? { ...usable, accent: readableAccent(hex(color)) } : usable;
  if (color !== null) return themeFromColor(color);
  if (roleColor) return themeFromColor(roleColor);
  return THEMES[DEFAULT_THEME];
}

module.exports = { THEMES, DEFAULT_THEME, resolveTheme };
