// Profil kartı temaları: kapak (üst alan) gradyanı ve varsayılan vurgu rengi. Kullanıcı renk seçtiyse vurgu o renk olur,
// kapak görseli eklediyse görsel temanın yerine geçer.
const THEMES = {
  sakura: { label: 'Sakura', description: 'Pembe tonlar', from: '#3a1020', to: '#9a3560', accent: '#ff6b9a' },
  gece: { label: 'Gece', description: 'Lacivert ve indigo', from: '#0d1022', to: '#33388a', accent: '#7c8cff' },
  okyanus: { label: 'Okyanus', description: 'Turkuaz ve mavi', from: '#06222e', to: '#117a9c', accent: '#38c6e8' },
  orman: { label: 'Orman', description: 'Koyu ve açık yeşil', from: '#07210f', to: '#237a43', accent: '#5be08a' },
  gunbatimi: { label: 'Gün Batımı', description: 'Turuncu ve mor', from: '#2b0f2e', to: '#cc5a2c', accent: '#ff9b5e' },
  ruya: { label: 'Mor Rüya', description: 'Menekşe tonlar', from: '#1b0b33', to: '#7230c2', accent: '#b57bff' },
};

const DEFAULT_THEME = 'sakura';

module.exports = { THEMES, DEFAULT_THEME };
