// Profil kartının coin ile alınan çerçeveleri: kartın kenarına çizilir. "yok" herkesin kullandığı çerçevesiz hâl,
// edge/glow çizim renkleri; 'accent' değeri rengi kartın vurgu renginden alır. Ücretli temalar themes.js'te tutulur.
const FRAMES = [
  { key: 'yok', label: 'Çerçevesiz', price: 0, note: 'Kartın kendi kenarı' },
  { key: 'bronz', label: 'Bronz', price: 1200, edge: '#c9885b', glow: '#8a4a1f', note: 'Koyu turuncu metal kenar' },
  { key: 'gumus', label: 'Gümüş', price: 2600, edge: '#dbe2e9', glow: '#7f8b97', note: 'Parlak gri metal kenar' },
  { key: 'altin', label: 'Altın', price: 4800, edge: '#f4c95d', glow: '#b47a12', note: 'Isı veren altın kenar' },
  { key: 'neon', label: 'Neon', price: 7200, edge: 'accent', glow: 'accent', note: 'Vurgu renginde parlayan kenar' },
];

const frameOf = (key) => FRAMES.find((f) => f.key === key) ?? FRAMES[0];

module.exports = { FRAMES, frameOf };
