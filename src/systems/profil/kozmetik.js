// Coin ile alınan kozmetikler: kartın kenarına çizilen çerçeveler ve kartta sergilenen rozet simgeleri.
// "yok" herkesin kullandığı çerçevesiz hâl; edge/glow çizim renkleri, 'accent' değeri rengi kartın vurgu
// renginden alır. Ücretli temalar themes.js'te, kapak efektleri kapak.js'te tutulur.
const FRAMES = [
  { key: 'yok', label: 'Çerçevesiz', price: 0, note: 'Kartın kendi kenarı' },
  { key: 'bronz', label: 'Bronz', price: 1200, edge: '#c9885b', glow: '#8a4a1f', note: 'Koyu turuncu metal kenar' },
  { key: 'gumus', label: 'Gümüş', price: 2600, edge: '#dbe2e9', glow: '#7f8b97', note: 'Parlak gri metal kenar' },
  { key: 'altin', label: 'Altın', price: 4800, edge: '#f4c95d', glow: '#b47a12', note: 'Isı veren altın kenar' },
  { key: 'neon', label: 'Neon', price: 7200, edge: 'accent', glow: 'accent', note: 'Vurgu renginde parlayan kenar' },
];

// Sergi rozetleri: satın alınca kartta kazanılan rozetlerin yanında taşınır. `icon` karttaki simgenin adı
// (card.js çizer); renkler koyu kart zemininde okunacak kadar parlak seçilir.
const SHOP_BADGES = [
  { key: 'kalp', label: 'Kalp', note: 'Kartında pembe kalp simgesi', color: '#ff6b9a', price: 1500, icon: 'kalp' },
  { key: 'yildiz', label: 'Yıldız', note: 'Kartında parlayan yıldız simgesi', color: '#9fe6ff', price: 2400, icon: 'yildiz' },
  { key: 'tac', label: 'Taç', note: 'Kartında altın taç simgesi', color: '#f4c95d', price: 3400, icon: 'tac' },
  { key: 'hilal', label: 'Hilal', note: 'Kartında gümüş hilal simgesi', color: '#dbe2e9', price: 4200, icon: 'hilal' },
  { key: 'elmas', label: 'Elmas', note: 'Kartında yeşil elmas simgesi', color: '#3ee0a1', price: 5200, icon: 'elmas' },
  { key: 'ates', label: 'Alev', note: 'Kartında kızıl alev simgesi', color: '#ff6a4d', price: 6400, icon: 'ates' },
];

const frameOf = (key) => FRAMES.find((f) => f.key === key) ?? FRAMES[0];
const badgeOf = (key) => SHOP_BADGES.find((b) => b.key === key) ?? null;
const badgesOf = (keys = []) => SHOP_BADGES.filter((b) => keys.includes(b.key));

module.exports = { FRAMES, SHOP_BADGES, frameOf, badgeOf, badgesOf };
