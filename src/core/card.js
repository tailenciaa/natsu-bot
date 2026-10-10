// Panellerin ve liste mesajlarının üstündeki çizim kartları (destek, başvuru, partner, değerlendirme) için ortak
// parçalar. Sicil kartıyla aynı düzeni (başlık bloğu + kayıt satırları + alt şerit) kullanan kartlar buradaki
// yardımcılarla kurulur; renk düzeni her kartın kendi temasından ({from,to,accent}) türetilir.
const {
  FONT,
  canvasLib,
  fitText,
  wrapLines,
  roundRect,
  hexAlpha,
  mix,
  makeScheme,
  drawBackground,
} = require('./canvas');

const WIDTH = 900;
const PAD = 40;
const ROW_H = 56;
const ROW_GAP = 10;
const FOOTER_H = 46;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;

// Kart: köşeleri kırpılmış zemin + parıltı hazır gelir; çizim bitince canvas.toBuffer('image/png') ile alınır.
// Boyut baştan belliyse createCard çağrılmadan önce measureLines/lineCount ile satır sayıları ölçülüp yükseklik
// hesaplanır (oluşturma tek geçişte yapılır).
function createCard(width, height, theme) {
  const canvas = canvasLib().createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const scheme = makeScheme(theme);
  const c = {
    accent: scheme.accent,
    muted: scheme.muted,
    panel: mix(theme.from, '#000000', 0.55),
  };
  ctx.save();
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.clip();
  drawBackground(ctx, width, height, scheme, width - 180, 80);
  return { canvas, ctx, scheme, c };
}

// Satır yüksekliği ölçümü için 1x1'lik geçici bağlam verir (yüksekliği önceden hesaplayan kartlar kullanır)
function measureCtx() {
  return canvasLib().createCanvas(1, 1).getContext('2d');
}

// Sağa hizalı, rengi taşandan yuvarlak durum etiketi
function drawPill(ctx, label, color, right, y) {
  ctx.font = font(500, 13);
  const w = ctx.measureText(label).width + 24;
  ctx.fillStyle = hexAlpha(color, 0.16);
  roundRect(ctx, right - w, y, w, 28, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(label, right - w / 2, y + 19);
  ctx.textAlign = 'left';
}

// Başlık bloğu: büyük kalın başlık, altında en fazla iki satıra yayılan açıklama; bloğun bittiği y'yi döner
function drawHeading(ctx, title, sub, width, c) {
  const y = 48;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 30);
  ctx.fillText(fitText(ctx, title, width - PAD * 2), PAD, y);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 16);
  const lines = wrapLines(ctx, sub, width - PAD * 2, 2);
  lines.forEach((line, i) => ctx.fillText(line, PAD, y + 34 + i * 24));
  return y + 34 + (lines.length - 1) * 24 + 20;
}

// Tek kayıt satırı: renkli nokta, başlık, altta soluk özet, sağda (varsa) durum etiketi
function drawRow(ctx, row, y, width, c) {
  const w = width - PAD * 2;
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, y, w, ROW_H, 14);
  ctx.fill();
  ctx.fillStyle = row.color;
  ctx.beginPath();
  ctx.arc(PAD + 20, y + ROW_H / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 18);
  ctx.fillText(fitText(ctx, row.title, w - 230), PAD + 40, y + 23);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 14);
  ctx.fillText(fitText(ctx, row.sub, w - 230), PAD + 40, y + 43);
  if (row.status) drawPill(ctx, row.status, row.statusColor, width - PAD - 14, y + 14);
}

// Boş liste: kayıt satırlarının yerini alan, ortalanmış soluk yazılı tek kutu. drawRow gibi y'yi ilerletmez.
function drawEmpty(ctx, message, y, width, c) {
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, y, width - PAD * 2, ROW_H, 14);
  ctx.fill();
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 15);
  ctx.textAlign = 'center';
  ctx.fillText(fitText(ctx, message, width - PAD * 2 - 40), width / 2, y + ROW_H / 2 + 5);
  ctx.textAlign = 'left';
}

// Metin bloğu: panel içinde küçük başlık + en fazla maxLines satıra yayılan gövde (yorum gibi uzun metinler için);
// bloğun bittiği y'yi döner. Yükseklik hesabı blockHeight ile aynı ölçümle yapılmalıdır.
function drawBlock(ctx, title, body, y, width, c, maxLines = 3) {
  ctx.font = font(400, 15);
  const lines = wrapLines(ctx, body, width - PAD * 2 - 40, maxLines);
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, y, width - PAD * 2, blockHeight(lines.length), 14);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = c.accent;
  ctx.font = font(700, 13);
  ctx.fillText(title.toLocaleUpperCase('tr-TR'), PAD + 20, y + 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(400, 15);
  lines.forEach((line, i) => ctx.fillText(line, PAD + 20, y + 56 + i * 23));
  return y + blockHeight(lines.length);
}

function blockHeight(lineCount) {
  return 24 + 32 + lineCount * 23 + 16;
}

// Alt şerit: ince çizgi üstünde ortalı soluk yazı (sayfa bilgisi ya da tarih); şeridin bittiği y'yi döner
function drawFooter(ctx, value, y, width, c) {
  ctx.strokeStyle = hexAlpha('#ffffff', 0.08);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y + 12);
  ctx.lineTo(width - PAD, y + 12);
  ctx.stroke();
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 14);
  ctx.textAlign = 'center';
  ctx.fillText(value, width / 2, y + 36);
  ctx.textAlign = 'left';
  return y + FOOTER_H;
}

// Kart yüksekliği: başlık bloğu (açıklama en fazla iki satır) + rowCount kayıt kutusu + alt şerit.
// drawHeading'in bittiği y ile aynı ölçümü kullanır; çizimden önce tek geçiş için yüksekliği önceden verir.
function listHeight(sub, rowCount) {
  const measure = measureCtx();
  measure.font = font(400, 16);
  const subLines = wrapLines(measure, sub, WIDTH - PAD * 2, 2).length;
  const headingBottom = 48 + 34 + (subLines - 1) * 24 + 20;
  const rows = Math.max(0, rowCount);
  return headingBottom + (rows ? rows * ROW_H + (rows - 1) * ROW_GAP : 0) + 24 + FOOTER_H;
}

// Beş köşeli yıldız (puanlama kartı): merkez (cx, cy), dış yarıçap r
function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

module.exports = {
  WIDTH,
  PAD,
  ROW_H,
  ROW_GAP,
  FOOTER_H,
  font,
  createCard,
  measureCtx,
  listHeight,
  drawHeading,
  drawRow,
  drawEmpty,
  drawPill,
  drawBlock,
  blockHeight,
  drawFooter,
  drawStar,
};
