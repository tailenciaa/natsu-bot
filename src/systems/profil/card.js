// Profil kartı: kapak (tema gradyanı ya da kullanıcının görseli), avatar, ad, unvan, biyografi, mesaj/ses seviye kartları
// ve alt bilgi kutuları içeren görsel (PNG, Buffer döner). Yazılar assets/fonts altındaki Poppins ile çizilir.
const { FONT, fitText, wrapLines, roundRect, hexAlpha, mix, makeScheme, loadImageSafe, drawAvatar, drawBar } = require('../../core/canvas');
const levelConfig = require('../seviye/config');
const { levelFromXp } = require('../seviye/level');
const { resolveTheme } = require('./themes');

const WIDTH = 1000;
const HEIGHT = 676;
const PAD = 48;
const HEADER = 215;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;
const number = (n) => n.toLocaleString('tr-TR');
const date = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });

function duration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} sa ${minutes % 60} dk` : `${minutes} dk`;
}

// Kapak: görsel varsa alanı kaplayacak şekilde ortalanıp çizilir (yüklenemezse tema gradyanına dönülür)
async function drawHeader(ctx, theme, bannerUrl, base) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEADER);
  ctx.clip(); // ışık lekeleri ve görsel kapak alanının dışına taşmasın
  let drawn = false;
  if (bannerUrl) {
    try {
      const image = await loadImageSafe(bannerUrl);
      const scale = Math.max(WIDTH / image.width, HEADER / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.drawImage(image, (WIDTH - w) / 2, (HEADER - h) / 2, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, WIDTH, HEADER);
      drawn = true;
    } catch (err) {
      console.error('[profil] Kapak görseli yüklenemedi:', err.message);
    }
  }
  if (!drawn) {
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEADER);
    gradient.addColorStop(0, theme.from);
    gradient.addColorStop(1, theme.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEADER);
    // Hafif yuvarlak ışık lekeleri: düz gradyan sıkıcı durmasın
    for (const [x, y, r, a] of [[820, 40, 150, 0.12], [640, 170, 110, 0.08], [930, 190, 90, 0.1]]) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Kapağın altı zemine doğru yumuşakça kararır
  const fade = ctx.createLinearGradient(0, HEADER - 90, 0, HEADER);
  fade.addColorStop(0, 'rgba(12,8,16,0)');
  fade.addColorStop(1, base);
  ctx.fillStyle = fade;
  ctx.fillRect(0, HEADER - 90, WIDTH, 90);
  ctx.restore();
}

// Yuvarlak köşeli küçük etiket (rank, unvan); genişliğini yazıya göre ayarlar ve (sağ kenar hizalı) çizer
function pill(ctx, text, right, y, color, textColor = '#ffffff') {
  ctx.font = font(500, 16);
  const width = ctx.measureText(text).width + 28;
  const x = right - width;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, 34, 17);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + 23);
  return width;
}

// Seviye kutusu: başlık, büyük seviye numarası, XP ve ilerleme çubuğu
function levelCard(ctx, x, y, w, h, title, xp, c) {
  const accent = c.accent;
  const level = levelFromXp(xp);
  const current = level > 0 ? levelConfig.xpForLevel(level) : 0;
  const next = levelConfig.xpForLevel(level + 1);

  ctx.fillStyle = c.panel;
  roundRect(ctx, x, y, w, h, 20);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 16);
  ctx.fillText(title, x + 24, y + 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 17);
  ctx.fillText(`${number(xp - current)} / ${number(next - current)} XP`, x + 24, y + 66);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = font(700, 46);
  ctx.fillText(String(level), x + w - 24, y + 70);
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 13);
  ctx.fillText('SEVİYE', x + w - 24, y + 22);

  drawBar(ctx, x + 24, y + h - 30, w - 48, 14, (xp - current) / (next - current), accent, c.track);
}

// Alt bilgi kutusu: sol üstte küçük başlık, altında değer
function infoBox(ctx, x, y, w, label, value, c) {
  ctx.fillStyle = c.panel;
  roundRect(ctx, x, y, w, 56, 16);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 12);
  ctx.fillText(label.toLocaleUpperCase('tr-TR'), x + 18, y + 21);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 17);
  ctx.fillText(fitText(ctx, value, w - 36), x + 18, y + 43);
}

// view: { custom: { bio, title, color, theme, banner }, roleColor, mesajXp, sesXp, mesajRank, sesRank, joinedAt, messageCount, voiceSeconds }
async function buildProfileCard(user, view) {
  const canvas = canvasLib().createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const custom = view.custom;
  const theme = resolveTheme(custom, view.roleColor);
  const scheme = makeScheme(theme);
  const accent = scheme.accent;
  const c = { accent, muted: scheme.muted, track: scheme.track, base: mix(theme.from, '#000000', 0.86), panel: mix(theme.from, '#000000', 0.7) };

  // Kartın tamamı yuvarlak köşeli; her şey bu şeklin içine çizilir
  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  await drawHeader(ctx, theme, custom.banner, c.base);

  // Sağ üst: sıralama etiketleri
  const rankColor = 'rgba(12,8,16,0.55)';
  let right = WIDTH - PAD;
  right -= pill(ctx, `Ses  ${view.sesRank ? `#${view.sesRank}` : '-'}`, right, 28, rankColor) + 10;
  pill(ctx, `Mesaj  ${view.mesajRank ? `#${view.mesajRank}` : '-'}`, right, 28, rankColor);

  // Avatar kapağın altına taşar; zemin renginde kalın halka kapakla arasını ayırır
  const avatarSize = 160;
  const avatarX = PAD;
  const avatarY = HEADER - 70;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
  ctx.fillStyle = c.base;
  ctx.fill();
  await drawAvatar(ctx, user, avatarX, avatarY, avatarSize, accent);

  // Ad, kullanıcı adı ve unvan
  const textX = avatarX + avatarSize + 32;
  const textMax = WIDTH - PAD - textX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 36);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, textMax), textX, HEADER + 40);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 17);
  ctx.fillText(`@${user.username}`, textX, HEADER + 68);
  if (custom.title) {
    ctx.font = font(500, 16);
    const width = ctx.measureText(custom.title).width + 28;
    ctx.fillStyle = hexAlpha(accent, 0.2);
    roundRect(ctx, textX, HEADER + 82, width, 30, 15);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillText(custom.title, textX + 14, HEADER + 102);
  }

  // Biyografi kutusu
  const bioY = HEADER + 128;
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, bioY, WIDTH - PAD * 2, 90, 20);
  ctx.fill();
  ctx.fillStyle = accent;
  roundRect(ctx, PAD, bioY + 18, 5, 54, 3);
  ctx.fill();
  ctx.textAlign = 'left';
  if (custom.bio) {
    ctx.fillStyle = '#e6dce2';
    ctx.font = font(400, 19);
    wrapLines(ctx, custom.bio, WIDTH - PAD * 2 - 60, 2).forEach((line, i) => ctx.fillText(line, PAD + 28, bioY + 42 + i * 30));
  } else {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 18);
    ctx.fillText('Henüz bir biyografi eklenmemiş.', PAD + 28, bioY + 52);
  }

  // Mesaj ve ses seviye kutuları
  const gap = 20;
  const cardW = (WIDTH - PAD * 2 - gap) / 2;
  const cardY = bioY + 90 + 20;
  levelCard(ctx, PAD, cardY, cardW, 108, 'Mesaj Seviyesi', view.mesajXp, c);
  levelCard(ctx, PAD + cardW + gap, cardY, cardW, 108, 'Ses Seviyesi', view.sesXp, c);

  // Alt bilgiler
  const infoY = cardY + 108 + 20;
  const infoW = (WIDTH - PAD * 2 - gap * 2) / 3;
  infoBox(ctx, PAD, infoY, infoW, 'Sunucuya katılım', view.joinedAt ? date(view.joinedAt) : '-', c);
  infoBox(ctx, PAD + infoW + gap, infoY, infoW, 'Toplam mesaj', number(view.messageCount), c);
  infoBox(ctx, PAD + (infoW + gap) * 2, infoY, infoW, 'Toplam ses süresi', duration(view.voiceSeconds), c);

  ctx.restore();
  return canvas.toBuffer('image/png');
}

module.exports = { buildProfileCard };
