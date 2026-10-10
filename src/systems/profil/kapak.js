// Kapak (kartın üst alanı) çizimleri. İki şekilde kullanılır: temaların kendi efekti (themes.js'teki `effect`) ve
// mağazadan alınan arka planlar (custom.cover). Tema efekti ile kapak aynı çiziciyi paylaşır, böylece satın alınan
// bir kapak kartın tonunu bozmadan üst alanı değiştirir. Kullanıcı kendi görselini koyarsa (custom.banner) hiçbiri
// çizilmez. Çizimlerin tamamı deterministiktir: aynı kart her çizildiğinde aynı görünür (rastgele yıldız titremesi olmasın).
const { hexAlpha, mix } = require('../../core/canvas');

// Sabit tohumlu sözde-rastgele: aynı (x, y) her zaman aynı değeri verir
function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Basit gradyan + yumuşak ışık lekeleri (temaların varsayılanı)
function gradyan(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.from);
  g.addColorStop(1, p.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const [fx, fy, r, a] of [[0.82, 0.15, 0.55, 0.14], [0.62, 0.7, 0.4, 0.09], [0.94, 0.85, 0.32, 0.1]]) {
    const x = w * fx;
    const y = h * fy;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, h * r);
    glow.addColorStop(0, hexAlpha(p.accent, a));
    glow.addColorStop(1, hexAlpha(p.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}

// Aurora: eğik uzatılmış renkli bulutlar; koyu zemine hareket hissi verir
function aurora(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(p.from, '#000000', 0.25));
  g.addColorStop(1, p.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const second = mix(p.accent, '#7cf0d8', 0.45);
  const bands = [
    [0.18, 0.2, 0.5, 0.22, p.accent],
    [0.42, 0.05, 0.62, 0.16, second],
    [0.68, 0.3, 0.48, 0.2, p.accent],
    [0.9, 0.1, 0.4, 0.14, second],
  ];
  for (const [fx, fy, rw, alpha, color] of bands) {
    ctx.save();
    ctx.translate(w * fx, h * fy);
    ctx.rotate(-0.42);
    const blob = ctx.createRadialGradient(0, 0, 4, 0, 0, w * rw);
    blob.addColorStop(0, hexAlpha(color, alpha));
    blob.addColorStop(1, hexAlpha(color, 0));
    ctx.fillStyle = blob;
    ctx.fillRect(-w, -h, w * 2, h * 2);
    ctx.restore();
  }
}

// Yıldız alanı: deterministik nokta yıldızlar + iki parlak yıldız ve ufuk parlaması
function yildiz(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, mix(p.from, '#000000', 0.55));
  g.addColorStop(1, p.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 190; i++) {
    const x = hash(i, 1) * w;
    const y = hash(i, 2) * h;
    const r = 0.5 + hash(i, 3) * 1.7;
    ctx.fillStyle = hexAlpha('#ffffff', 0.18 + hash(i, 4) * 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [fx, fy, size] of [[0.72, 0.24, 13], [0.24, 0.62, 9]]) {
    const x = w * fx;
    const y = h * fy;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, size * 4);
    glow.addColorStop(0, hexAlpha(p.accent, 0.85));
    glow.addColorStop(1, hexAlpha(p.accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - size * 4, y - size * 4, size * 8, size * 8);
    ctx.strokeStyle = hexAlpha('#ffffff', 0.55);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
  }
}

// Izgara: retro perspektif çizgiler ve ufuk çizgisi parlaması
function izgara(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(p.from, '#000000', 0.7));
  g.addColorStop(0.55, p.from);
  g.addColorStop(1, mix(p.to, '#000000', 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const horizon = h * 0.56;
  const sun = ctx.createRadialGradient(w * 0.5, horizon, 6, w * 0.5, horizon, w * 0.42);
  sun.addColorStop(0, hexAlpha(p.accent, 0.5));
  sun.addColorStop(1, hexAlpha(p.accent, 0));
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = hexAlpha(p.accent, 0.34);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  // Ufuktan aşağı yayılan dikey çizgiler (merkezden dışa)
  for (let i = -9; i <= 9; i++) {
    ctx.moveTo(w * 0.5 + i * 18, horizon);
    ctx.lineTo(w * 0.5 + i * 190, h + 40);
  }
  ctx.stroke();
  ctx.beginPath();
  // Yatay çizgiler ufka doğru sıklaşır
  for (let i = 1; i <= 9; i++) {
    const y = horizon + Math.pow(i / 9, 2.1) * (h - horizon);
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.strokeStyle = hexAlpha('#ffffff', 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.stroke();
}

// Dalga: üst üste binen sinüs bantları
function dalga(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p.from);
  g.addColorStop(1, mix(p.to, '#000000', 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let band = 0; band < 5; band++) {
    const base = h * (0.28 + band * 0.15);
    const amp = 16 + band * 7;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= w; x += 12) {
      ctx.lineTo(x, base + Math.sin(x / (110 + band * 26) + band * 1.3) * amp);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = hexAlpha(band % 2 ? p.accent : mix(p.accent, '#ffffff', 0.4), 0.05 + band * 0.022);
    ctx.fill();
  }
}

// Buzlu cam: üst üste binen yarı saydam lekeler ve parlak kenar halkaları (liquid glass görünümü)
function cam(ctx, w, h, p) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, mix(p.from, '#ffffff', 0.08));
  g.addColorStop(0.5, p.to);
  g.addColorStop(1, mix(p.from, '#ffffff', 0.16));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const blobs = [[0.12, 0.82, 0.3], [0.38, 0.16, 0.26], [0.62, 0.9, 0.22], [0.8, 0.28, 0.34], [0.98, 0.78, 0.24]];
  blobs.forEach(([fx, fy, r], i) => {
    const cx = w * fx;
    const cy = h * fy;
    const rad = w * r;
    const glass = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.4, rad * 0.05, cx, cy, rad);
    glass.addColorStop(0, hexAlpha('#ffffff', 0.24));
    glass.addColorStop(0.55, hexAlpha(i % 2 ? p.accent : '#ffffff', 0.1));
    glass.addColorStop(1, hexAlpha(p.accent, 0));
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    // lekelerin kenarı ışığı kırar: ince parlak yay
    ctx.strokeStyle = hexAlpha('#ffffff', 0.3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.96, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
  });
}

const PAINTERS = { gradyan, aurora, yildiz, izgara, dalga, cam };

// Mağazadaki kapaklar: `effect` çizicinin adını kullanır, fiyatı olmayan kartın kendi temasını bırakır
const COVERS = [
  { key: 'yok', label: 'Temadan', note: 'Seçtiğin temanın kendi efekti', price: 0, effect: null },
  { key: 'aurora', label: 'Aurora', note: 'Eğik renkli ışık bulutları', price: 1800, effect: 'aurora' },
  { key: 'yildiz', label: 'Yıldız', note: 'Yıldız alanı ve parlak yıldızlar', price: 2600, effect: 'yildiz' },
  { key: 'cam', label: 'Buzlu Cam', note: 'Üst üste binen saydam lekeler', price: 3400, effect: 'cam' },
  { key: 'dalga', label: 'Dalga', note: 'Üst üste binen yumuşak dalgalar', price: 4000, effect: 'dalga' },
  { key: 'izgara', label: 'Izgara', note: 'Retro perspektif zemin', price: 4800, effect: 'izgara' },
];

const coverOf = (key) => COVERS.find((c) => c.key === key) ?? COVERS[0];

// Kutunun (kapak alanının) üstüne efekti çizer; p: { from, to, accent }
function drawCover(ctx, effectKey, box, p) {
  const paint = PAINTERS[effectKey] ?? gradyan;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.translate(box.x, box.y);
  paint(ctx, box.w, box.h, p);
  ctx.restore();
}

module.exports = { COVERS, coverOf, drawCover, PAINTERS };
