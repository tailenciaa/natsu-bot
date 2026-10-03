// Görsel kartların (profil, seviye atlama) ortak çizim parçaları: arka plan, avatar, yuvarlak köşeli şekiller
let loadImage;

function initCanvas() {
  if (!loadImage) {
    ({ loadImage } = require('canvas'));
  }
}

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
    const image = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
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

module.exports = { roundRect, hexColor, hexAlpha, truncate, drawBackground, drawAvatar, drawBar };
