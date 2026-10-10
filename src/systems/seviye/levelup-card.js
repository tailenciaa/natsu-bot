// Seviye atlama duyuru görseli: avatar, kullanıcı adı, eski -> yeni seviye ve kazanılan rol (PNG, Buffer döner).
// Kart, kullanıcının profilinde seçtiği renkte çizilir (seçmediyse varsayılan vurgu rengi).
const { FONT, canvasLib, fitText, roundRect, hexColor, mix, makeScheme, truncate, drawBackground, drawAvatar } = require('../../core/canvas');
const { resolveTheme } = require('../profil/themes');

const WIDTH = 900;
const HEIGHT = 310;
// Yazı tipinde olmayan karakterler (・, emoji vb.) kutucuk çıkardığı için rol adından temizlenir
const cleanName = (name) =>
  String(name)
    .replace(/[・｜|]/g, ' - ')
    .replace(/[^\p{Script=Latin}\p{N}\s.,'’!&()+•_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const KIND_LABEL = { mesaj: 'SOHBETTE SEVİYE ATLADIN', ses: 'SESTE SEVİYE ATLADIN' };

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.stroke();
}

function label(ctx, text, x, y, color, align = 'left') {
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText(text, x, y);
}

// view: { kind, from, to, custom (profil kaydı), roleColor (üyenin rol rengi), roleName, roleDotColor }
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

  // Eski -> yeni seviye. Rol kazanılmayan seviyelerde sağ kutu olmadığı için seviye kutusu satırı doldurur.
  const hasRole = Boolean(view.roleName);
  const levelW = hasRole ? 330 : WIDTH - x - 40;
  const newX = hasRole ? x + 196 : x + levelW - 26;
  const newAlign = hasRole ? 'left' : 'right';
  panel(ctx, x, 150, levelW, 108);
  label(ctx, 'ESKİ SEVİYE', x + 26, 182, muted);
  label(ctx, 'YENİ SEVİYE', newX, 182, accent, newAlign);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 32px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`LVL ${view.from}`, x + 26, 230);
  ctx.fillStyle = accent;
  ctx.textAlign = newAlign;
  ctx.fillText(`LVL ${view.to}`, newX, 230);
  // Ok işareti yazı tipinde yok; çizgiyle çizilir
  const cx = x + levelW / 2;
  ctx.strokeStyle = muted;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 15, 218);
  ctx.lineTo(cx + 7, 218);
  ctx.moveTo(cx - 6, 210);
  ctx.lineTo(cx + 8, 218);
  ctx.lineTo(cx - 6, 226);
  ctx.stroke();

  // Yalnız kazanılan rol gösterilir; yeni rol yoksa kutu çizilmez
  if (hasRole) {
    const roleX = x + levelW + 20;
    const roleW = WIDTH - roleX - 40;
    panel(ctx, roleX, 150, roleW, 108);
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
  }

  return canvas.toBuffer('image/png');
}

module.exports = { buildLevelUpCard };
