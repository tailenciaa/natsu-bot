// Profil kartı: avatar, kullanıcı adı, biyografi ve mesaj/ses seviye çubukları içeren görsel (PNG, Buffer döner).
let createCanvas;
function initCanvas() {
  if (!createCanvas) {
    ({ createCanvas } = require('canvas'));
  }
}
const { hexColor, truncate, drawBackground, drawAvatar, drawBar } = require('../../core/canvas');
const levelConfig = require('../seviye/config');
const { levelFromXp } = require('../seviye/level');

const WIDTH = 900;
const HEIGHT = 300;

function drawLevelBar(ctx, x, y, width, title, xp, rank, accent) {
  const level = levelFromXp(xp);
  const current = level > 0 ? levelConfig.xpForLevel(level) : 0;
  const next = levelConfig.xpForLevel(level + 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${title} · Seviye ${level}`, x, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#b8a4ac';
  ctx.font = '16px sans-serif';
  ctx.fillText(`${xp - current}/${next - current} XP  ·  #${rank ?? '-'}`, x + width, y);

  drawBar(ctx, x, y + 14, width, 16, (xp - current) / (next - current), accent);
}

// view: { custom: { bio, color }, mesajXp, sesXp, mesajRank, sesRank }
async function buildProfileCard(user, view) {
  initCanvas();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const accent = hexColor(view.custom.color);

  drawBackground(ctx, WIDTH, HEIGHT, accent, 150, 150);
  await drawAvatar(ctx, user, 60, 70, 160, accent);

  const textX = 260;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(truncate(user.username, 20), textX, 95);

  if (view.custom.bio) {
    ctx.fillStyle = '#b8a4ac';
    ctx.font = '22px sans-serif';
    ctx.fillText(truncate(view.custom.bio, 46), textX, 130);
  }

  const barWidth = WIDTH - textX - 60;
  drawLevelBar(ctx, textX, 190, barWidth, 'Mesaj', view.mesajXp, view.mesajRank, accent);
  drawLevelBar(ctx, textX, 250, barWidth, 'Ses', view.sesXp, view.sesRank, accent);

  return canvas.toBuffer('image/png');
}

module.exports = { buildProfileCard };
