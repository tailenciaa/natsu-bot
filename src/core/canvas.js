// Görsel kartların (profil, seviye) ortak çizim parçaları: yazı tipi, arka plan, avatar, yuvarlak köşeli şekiller.
// Sunucuda sistem yazı tipi olmadığı için yazılar kutucuk çıkıyordu; bu yüzden assets/fonts altındaki Poppins
// yazı tipi (Türkçe karakterleri destekler) canvas'a kendimiz tanıtıyoruz. Kartlarda yazı tipi olarak FONT kullanılır.
const fs = require('node:fs');
const path = require('node:path');

const FONT = 'Poppins';
const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const FONT_FILES = [
  ['Poppins-Regular.ttf', '400'],
  ['Poppins-Medium.ttf', '500'],
  ['Poppins-Bold.ttf', '700'],
];

let lib = null;
// canvas kütüphanesini ilk kullanımda yükler ve yazı tiplerini tanıtır (kartlar her çizimde bunu çağırır)
function canvasLib() {
  if (lib) return lib;
  lib = require('canvas');
  for (const [file, weight] of FONT_FILES) {
    const fontPath = path.join(FONT_DIR, file);
    if (fs.existsSync(fontPath)) lib.registerFont(fontPath, { family: FONT, weight });
    else console.error(`[kart] Yazı tipi bulunamadı: ${fontPath}`);
  }
  return lib;
}
const initCanvas = () => canvasLib();
const DEFAULT_ACCENT = '#e8536f';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Kayıtlı sayı renk (0xff5599) -> "#ff5599"; renk yoksa varsayılan vurgu rengi
const hexColor = (color) => (color ? `#${color.toString(16).padStart(6, '0')}` : DEFAULT_ACCENT);
const hexAlpha = (hex, alpha) => `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
const truncate = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

// Metni en fazla maxWidth piksele sığacak şekilde (gerekirse sonuna … koyarak) keser; ctx'in o anki yazı tipiyle ölçer
function fitText(ctx, value, maxWidth) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

// Metni kelime kelime en fazla maxLines satıra böler; sığmayan kısım son satırın sonunda … ile kesilir
function wrapLines(ctx, value, maxWidth, maxLines) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === lines.length - 1 ? fitText(ctx, l, maxWidth) : l));
}

// Koyu bordo -> siyah zemin ve (glowX, glowY) etrafında vurgu renginde yumuşak parıltı
function drawBackground(ctx, width, height, accent, glowX, glowY) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#1a0812');
  bg.addColorStop(1, '#05030a');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, width, height, 28);
  ctx.fill();

  const glow = ctx.createRadialGradient(glowX, glowY, 10, glowX, glowY, 260);
  glow.addColorStop(0, hexAlpha(accent, 0.35));
  glow.addColorStop(1, hexAlpha(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

// Yuvarlak avatar ve vurgu renginde halka; avatar yüklenemezse sadece halka çizilir
async function drawAvatar(ctx, user, x, y, size, accent) {
  initCanvas();
  try {
    const image = await canvasLib().loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
  } catch (err) {
    console.error('[kart] Avatar yüklenemedi:', err.message);
  }
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.stroke();
}

// İlerleme çubuğu: koyu zemin üstünde oran kadar vurgu renginde dolgu
function drawBar(ctx, x, y, width, height, ratio, accent) {
  ctx.fillStyle = '#2a1620';
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  ctx.fillStyle = accent;
  roundRect(ctx, x, y, Math.max(height, width * Math.max(0, Math.min(1, ratio))), height, height / 2);
  ctx.fill();
}

module.exports = { FONT, canvasLib, fitText, wrapLines, roundRect, hexColor, hexAlpha, truncate, drawBackground, drawAvatar, drawBar };
