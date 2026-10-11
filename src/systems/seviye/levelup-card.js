// Seviye atlama duyuru görseli: avatar, kullanıcı adı, eski -> yeni seviye ve ödül kutusu (PNG, Buffer döner).
// Ödül kutusu her kartta çizilir: ana seviyedeyse kazanılan rolün altında, ara seviyedeyse yalnızca coin ödülüyle.
// Kart, kullanıcının profilinde seçtiği renkte çizilir (seçmediyse varsayılan vurgu rengi).
const { FONT, canvasLib, fitText, roundRect, hexColor, mix, makeScheme, truncate, drawBackground, drawAvatar } = require('../../core/canvas');
const { resolveTheme } = require('../profil/themes');

const WIDTH = 900;
const HEIGHT = 310;
// Coin temasındaki altın tonu: kartın vurgu rengi ne olursa olsun coin her yerde aynı renkte görünür
const COIN_COLOR = '#f5c451';
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

  // Eski -> yeni seviye. Kutu her kartta aynı genişlikte: sağdaki ödül kutusu her zaman çizildiği için
  // rolsüz seviyelerde kutunun tüm satıra yayılması (kötü görünüyordu) söz konusu değil.
  const levelW = 330;
  panel(ctx, x, 150, levelW, 108);
  label(ctx, 'ESKİ SEVİYE', x + 26, 182, muted);
  label(ctx, 'YENİ SEVİYE', x + 196, 182, accent);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 32px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`LVL ${view.from}`, x + 26, 230);
  ctx.fillStyle = accent;
  ctx.fillText(`LVL ${view.to}`, x + 196, 230);
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

  // Sağ kutu: ana seviyedeyse kazanılan rolün altında coin ödülü, ara seviyedeyse yalnızca coin ödülü.
  const rewardX = x + levelW + 20;
  const rewardW = WIDTH - rewardX - 40;
  panel(ctx, rewardX, 150, rewardW, 108);
  label(ctx, view.roleName ? 'KAZANILAN ROL' : 'SEVİYE ÖDÜLÜ', rewardX + 26, 182, mix(accent, '#ffffff', 0.45));

  let coinY = 232;
  if (view.roleName) {
    coinY = 246;
    const dot = view.roleDotColor ? hexColor(view.roleDotColor) : accent;
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(rewardX + 36, 208, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    const roleText = cleanName(view.roleName) || 'Yeni Rol';
    let size = 22; // uzun rol adlarında yazı, sığana kadar (en fazla 16'ya) küçülür
    ctx.font = `700 ${size}px ${FONT}`;
    while (size > 16 && ctx.measureText(roleText).width > rewardW - 80) ctx.font = `700 ${--size}px ${FONT}`;
    ctx.fillText(fitText(ctx, roleText, rewardW - 80), rewardX + 56, 216);
  }

  if (view.coinReward > 0) {
    ctx.fillStyle = COIN_COLOR;
    ctx.beginPath();
    ctx.arc(rewardX + 36, coinY - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('c', rewardX + 36, coinY - 4);
    ctx.fillStyle = COIN_COLOR;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`+${view.coinReward} coin`, rewardX + 56, coinY);
  }

  return canvas.toBuffer('image/png');
}

module.exports = { buildLevelUpCard };
