// Profil kartı temaları: kapak (üst alan) gradyanı ve varsayılan vurgu rengi. Kullanıcı renk seçtiyse vurgu o renk olur,
// kapak görseli eklediyse görsel temanın yerine geçer. price alanı olan temalar coin ile satın alınır (coin/mağaza).
const { mix, luminance } = require('../../core/canvas');

const THEMES = {
  sakura: { label: 'Sakura', description: 'Pembe tonları', from: '#3a1020', to: '#9a3560', accent: '#ff6b9a' },
  gece: { label: 'Gece', description: 'Lacivert ve indigo', from: '#0d1022', to: '#33388a', accent: '#7c8cff' },
  okyanus: { label: 'Okyanus', description: 'Turkuaz ve mavi', from: '#06222e', to: '#117a9c', accent: '#38c6e8' },
  orman: { label: 'Orman', description: 'Koyu ve açık yeşil', from: '#07210f', to: '#237a43', accent: '#5be08a' },
  gunbatimi: { label: 'Gün Batımı', description: 'Turuncu ve mor', from: '#2b0f2e', to: '#cc5a2c', accent: '#ff9b5e' },
  ruya: { label: 'Mor Rüya', description: 'Menekşe tonları', from: '#1b0b33', to: '#7230c2', accent: '#b57bff' },
  kor: { label: 'Kor', description: 'Kızıl ve turuncu', from: '#2a0708', to: '#a3271b', accent: '#ff6a4d', price: 2500 },
  krom: { label: 'Krom', description: 'Çelik grisi', from: '#141619', to: '#5b646e', accent: '#c3ccd6', price: 3200 },
  zumrut: { label: 'Zümrüt', description: 'Yeşil ve altın', from: '#04211a', to: '#0f7a5a', accent: '#3ee0a1', price: 4500 },
  elmas: { label: 'Elmas', description: 'Buz mavisi', from: '#071a2b', to: '#2f7fbf', accent: '#9fe6ff', price: 6000 },
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

// Tek renkten tema üretir; kartın tonu seçilen renkten, vurgusu okunabilirliğe çekilmiş halinden türer
function themeFromColor(color) {
  const accent = readableAccent(hex(color));
  return { from: mix(accent, '#000000', 0.78), to: mix(accent, '#000000', 0.35), accent };
}

// Kartların rengi: profilde seçilen tema/renk; yoksa üyenin rol rengi; o da yoksa varsayılan tema.
// custom: profil kaydı ({ theme, color, ... }), roleColor: üyenin görünen rol rengi (0 = renksiz).
// Profilde seçilen renk 0 olabilir (siyah), bu yüzden "seçim yok" null/undefined ile ayrılır.
function resolveTheme(custom = {}, roleColor = 0) {
  const color = Number.isInteger(custom.color) ? custom.color : null;
  if (custom.theme && THEMES[custom.theme]) {
    const theme = THEMES[custom.theme];
    return color !== null ? { ...theme, accent: readableAccent(hex(color)) } : theme;
  }
  if (color !== null) return themeFromColor(color);
  if (roleColor) return themeFromColor(roleColor);
  return THEMES[DEFAULT_THEME];
}

module.exports = { THEMES, DEFAULT_THEME, resolveTheme };
