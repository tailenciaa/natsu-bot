// Profil kartı temaları: kapak (üst alan) gradyanı ve varsayılan vurgu rengi. Kullanıcı renk seçtiyse vurgu o renk olur,
// kapak görseli eklediyse görsel temanın yerine geçer.
const { mix, luminance } = require('../../core/canvas');

const THEMES = {
  sakura: { label: 'Sakura', description: 'Pembe tonları', from: '#3a1020', to: '#9a3560', accent: '#ff6b9a' },
  gece: { label: 'Gece', description: 'Lacivert ve indigo', from: '#0d1022', to: '#33388a', accent: '#7c8cff' },
  okyanus: { label: 'Okyanus', description: 'Turkuaz ve mavi', from: '#06222e', to: '#117a9c', accent: '#38c6e8' },
  orman: { label: 'Orman', description: 'Koyu ve açık yeşil', from: '#07210f', to: '#237a43', accent: '#5be08a' },
  gunbatimi: { label: 'Gün Batımı', description: 'Turuncu ve mor', from: '#2b0f2e', to: '#cc5a2c', accent: '#ff9b5e' },
  ruya: { label: 'Mor Rüya', description: 'Menekşe tonları', from: '#1b0b33', to: '#7230c2', accent: '#b57bff' },
};

const DEFAULT_THEME = 'sakura';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// Tek renkten tema üretir; çok koyu renkler okunabilsin diye vurguda biraz açılır
function themeFromColor(color) {
  let accent = hex(color);
  if (luminance(accent) < 0.28) accent = mix(accent, '#ffffff', 0.45);
  return { from: mix(accent, '#000000', 0.78), to: mix(accent, '#000000', 0.35), accent };
}

// Kartların rengi: profilde seçilen tema/renk; yoksa üyenin rol rengi; o da yoksa varsayılan tema.
// custom: profil kaydı ({ theme, color, ... }), roleColor: üyenin görünen rol rengi (0 = renksiz)
function resolveTheme(custom = {}, roleColor = 0) {
  if (custom.theme && THEMES[custom.theme]) {
    const theme = THEMES[custom.theme];
    return custom.color ? { ...theme, accent: hex(custom.color) } : theme;
  }
  if (custom.color) return themeFromColor(custom.color);
  if (roleColor) return themeFromColor(roleColor);
  return THEMES[DEFAULT_THEME];
}

module.exports = { THEMES, DEFAULT_THEME, resolveTheme };
