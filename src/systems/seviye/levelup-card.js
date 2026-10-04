// Seviye atlama duyuru görseli: avatar, kullanıcı adı, eski -> yeni seviye ve kazanılan rol (PNG, Buffer döner).
// Kart, kullanıcının profilinde seçtiği renkte çizilir (seçmediyse varsayılan vurgu rengi).
const { FONT, canvasLib, fitText, roundRect, hexColor, mix, makeScheme, truncate, drawBackground, drawAvatar } = require('../../core/canvas');
const { resolveTheme } = require('../profil/themes');

const WIDTH = 900;
const HEIGHT = 310;
// Yazı tipinde olmayan karakterler (・, emoji vb.) kutucuk çıkardığı için rol adından temizlenir
const cleanName = (name) =>
  String(name)
    .replace(/[・｜|]/g, ' • ')
    .replace(/[^\p{Script=Latin}\p{N}\s.,'’!&()+•_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const KIND_LABEL = { mesaj: 'SOHBET SEVİYESİ ATLADIN', ses: 'SES SEVİYESİ ATLADIN' };

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.stroke();
}

function label(ctx, text, x, y, color) {
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(text, x, y);
}

// view: { kind, from, to, custom (profil kaydı), roleColor (üyenin rol rengi), roleName, roleDotColor, roleColor, nextMilestone }
async function buildLevelUpCard(user, view) {
  const canvas = canvasLib().createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const scheme = makeScheme(resolveTheme(view.custom, view.roleColor));
  const { accent, muted } = scheme;

  drawBackground(ctx, WIDTH, HEIGHT, scheme, 150, 155);
  await drawAvatar(ctx, user, 52, 80, 150, accent);

  const x = 244;
  label(ctx, KIND_LABEL[view.kind] ?? KIND_LABEL.mesaj, x, 62, accent);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(fitText(ctx, truncate(user.username, 24), WIDTH - x - 50), x, 118);

  // Eski -> yeni seviye
  const levelW = 330;
  panel(ctx, x, 150, levelW, 108);
  label(ctx, 'ESKİ SEVİYE', x + 26, 182, muted);
  label(ctx, 'YENİ SEVİYE', x + 196, 182, accent);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(`LVL ${view.from}`, x + 26, 230);
  ctx.fillStyle = accent;
  ctx.fillText(`LVL ${view.to}`, x + 196, 230);
  // Ok işareti yazı tipinde yok; çizgiyle çizilir
  ctx.strokeStyle = muted;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 150, 218);
  ctx.lineTo(x + 172, 218);
  ctx.moveTo(x + 165, 210);
  ctx.lineTo(x + 173, 218);
  ctx.lineTo(x + 165, 226);
  ctx.stroke();

  // Kazanılan rol (rol tanımlı değilse sıradaki hedef gösterilir)
  const roleX = x + levelW + 20;
  const roleW = WIDTH - roleX - 40;
  panel(ctx, roleX, 150, roleW, 108);
  if (view.roleName) {
    label(ctx, 'KAZANILAN ROL', roleX + 26, 182, mix(accent, '#ffffff', 0.45));
    const dot = view.roleDotColor ? hexColor(view.roleDotColor) : accent;
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(roleX + 38, 224, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    const roleText = cleanName(view.roleName) || 'Yeni Rol';
    let size = 22; // uzun rol adlarında yazı, sığana kadar (en fazla 16'ya) küçülür
    ctx.font = `700 ${size}px ${FONT}`;
    while (size > 16 && ctx.measureText(roleText).width > roleW - 84) ctx.font = `700 ${--size}px ${FONT}`;
    ctx.fillText(fitText(ctx, roleText, roleW - 84), roleX + 58, 233);
  } else {
    label(ctx, 'SIRADAKİ ROL', roleX + 26, 182, muted);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(view.nextMilestone ? `Seviye ${view.nextMilestone}` : 'Tamamlandı', roleX + 26, 233);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { buildLevelUpCard };
