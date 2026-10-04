// /seviye kartı: avatar, kullanıcı adı ve mesaj/ses seviyelerinin ayrı ayrı gösterildiği görsel (PNG, Buffer döner).
// Kart, kullanıcının profilinde seçtiği renkte çizilir (seçmediyse varsayılan vurgu rengi).
const { FONT, canvasLib, hexColor, truncate, drawBackground, drawAvatar, drawBar } = require('../../core/canvas');
const config = require('./config');
const { levelFromXp } = require('./level');

const WIDTH = 900;
const HEIGHT = 340;

// Bir sonraki rol seviyesi (5'in katları); 100'den sonrası yok
const nextMilestone = (level) => config.milestones.find((m) => m > level) ?? null;

function drawRow(ctx, x, y, width, title, xp, rank, accent) {
  const level = levelFromXp(xp);
  const current = level > 0 ? config.xpForLevel(level) : 0;
  const next = config.xpForLevel(level + 1);
  const milestone = nextMilestone(level);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(title, x, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(`Seviye ${level}`, x + width, y);

  drawBar(ctx, x, y + 14, width, 18, (xp - current) / (next - current), accent);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#b8a4ac';
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText(`${xp - current} / ${next - current} XP`, x, y + 58);

  ctx.textAlign = 'right';
  ctx.fillText(`Sıralama ${rank ? `#${rank}` : '-'}   Sonraki rol: ${milestone ? `Seviye ${milestone}` : 'tamamlandı'}`, x + width, y + 58);
}

// view: { color, mesajXp, sesXp, mesajRank, sesRank }
async function buildLevelCard(user, view) {
  const canvas = canvasLib().createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hexColor(view.color);

  drawBackground(ctx, WIDTH, HEIGHT, accent, 150, 170);
  await drawAvatar(ctx, user, 60, 95, 150, accent);

  const textX = 260;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(truncate(user.username, 22), textX, 75);

  const barWidth = WIDTH - textX - 60;
  drawRow(ctx, textX, 150, barWidth, 'Mesaj Seviyesi', view.mesajXp, view.mesajRank, accent);
  drawRow(ctx, textX, 250, barWidth, 'Ses Seviyesi', view.sesXp, view.sesRank, accent);

  return canvas.toBuffer('image/png');
}

module.exports = { buildLevelCard };
