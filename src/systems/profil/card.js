// Profil kartı: kapak (tema gradyanı ya da kullanıcının görseli), avatar, ad, unvan, rozetler, biyografi, mesaj/ses
// seviye kartları, alt bilgi kutuları ve vitrin şeridi (öne çıkan istatistik, bağlantılar, ziyaret sayısı) içeren
// görsel (PNG, Buffer döner). Yükseklik çizilecek içeriğe göre hesaplanır; çerçeveler kartın kenarına çizilir.
// Yazılar assets/fonts altındaki Poppins ile çizilir.
const {
  FONT,
  canvasLib,
  fitText,
  wrapLines,
  roundRect,
  hexAlpha,
  mix,
  makeScheme,
  loadImageSafe,
  drawAvatar,
  drawBar,
} = require('../../core/canvas');
const { measureCtx } = require('../../core/card');
const levelConfig = require('../seviye/config');
const { levelFromXp } = require('../seviye/level');
const { resolveTheme } = require('./themes');

const WIDTH = 1000;
const PAD = 48;
const HEADER = 215;
const BASE_HEIGHT = 676; // rozet satırı ve vitrin şeridi yokken kartın yüksekliği (eskisiyle aynı kalır)
const BADGE_ROW_H = 30;
const BADGE_GAP = 8;
const BADGE_ROWS_MAX = 2;
const FOOTER_H = 68;

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

// Rozet etiketlerinin satırlara dağılımı: her etiket yazısına göre genişler, sığmayan alt satıra iner. En fazla
// iki satır ayrılır; hiç sığdıramadıkların yerine son satıra tek bir "+N" etiketi konur.
function badgeRows(ctx, badges, maxWidth) {
  ctx.font = font(500, 14);
  const items = badges.map((b) => ({ ...b, w: Math.round(ctx.measureText(b.label).width + 30) }));

  const rows = [[]];
  let used = 0;
  let hidden = 0;
  for (const b of items) {
    // Satır boşsa etiket tek başına her zaman konur (uzun etiket birkaç piksel taşabilir)
    if (used && used + b.w > maxWidth) {
      if (rows.length === BADGE_ROWS_MAX) {
        hidden += 1;
        continue;
      }
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(b);
    used += b.w + BADGE_GAP;
  }

  if (hidden > 0) rows[rows.length - 1].push({ key: 'diger', label: `+${hidden}`, color: '#c3ccd6', w: 46 });
  return rows.filter((row) => row.length);
}

function drawBadges(ctx, rows, y) {
  rows.forEach((row, i) => {
    let x = PAD;
    for (const b of row) {
      ctx.fillStyle = hexAlpha(b.color, 0.16);
      roundRect(ctx, x, y + i * (BADGE_ROW_H + 10), b.w, BADGE_ROW_H, 15);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 15, y + i * (BADGE_ROW_H + 10) + BADGE_ROW_H / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.font = font(500, 14);
      ctx.textAlign = 'left';
      ctx.fillText(b.label, x + 24, y + i * (BADGE_ROW_H + 10) + 20);
      x += b.w + BADGE_GAP;
    }
  });
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

// Vitrin şeridi: solda üyenin öne çıkardığı istatistik, sağda bağlantılar ve ziyaret sayısı
function drawFooter(ctx, y, view, c) {
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, y, WIDTH - PAD * 2, FOOTER_H, 18);
  ctx.fill();

  if (view.featured) {
    ctx.textAlign = 'left';
    ctx.fillStyle = c.muted;
    ctx.font = font(500, 12);
    ctx.fillText(view.featured.label.toLocaleUpperCase('tr-TR'), PAD + 24, y + 24);
    ctx.fillStyle = c.accent;
    ctx.font = font(700, 24);
    ctx.fillText(fitText(ctx, view.featured.value, 360), PAD + 24, y + 50);
  }

  const right = WIDTH - PAD - 24;
  ctx.textAlign = 'right';
  if (view.links?.length) {
    ctx.fillStyle = '#e6dce2';
    ctx.font = font(500, 15);
    ctx.fillText(fitText(ctx, view.links.join('   ·   '), 520), right, y + (view.featured ? 30 : 42));
  }
  if (view.visits > 0) {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 13);
    ctx.fillText(`${number(view.visits)} profil ziyareti`, right, y + (view.featured || view.links?.length ? 52 : 42));
  }
}

// Satın alınan çerçeve: kartın kenarına çizilen renkli kenar ve köşelerde yumuşak parlama
function drawFrame(ctx, height, frame, scheme) {
  if (!frame || frame.key === 'yok') return;
  const edge = frame.edge === 'accent' ? scheme.accent : frame.edge;
  const glow = frame.glow === 'accent' ? scheme.accent : frame.glow;

  for (const [gx, gy] of [[8, 8], [WIDTH - 8, height - 8]]) {
    const g = ctx.createRadialGradient(gx, gy, 10, gx, gy, 320);
    g.addColorStop(0, hexAlpha(glow, 0.3));
    g.addColorStop(1, hexAlpha(glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, height);
  }
  ctx.lineWidth = 8;
  ctx.strokeStyle = edge;
  roundRect(ctx, 4, 4, WIDTH - 8, height - 8, 30);
  ctx.stroke();
}

// view: { custom, roleColor, mesajXp, sesXp, mesajRank, sesRank, joinedAt, messageCount, voiceSeconds,
//         badges: [rozet], featured: { label, value } | null, links: [metin], visits: sayı, frame: çerçeve }
async function buildProfileCard(user, view) {
  const custom = view.custom;
  const theme = resolveTheme(custom, view.roleColor);
  const scheme = makeScheme(theme);
  const accent = scheme.accent;
  const c = { accent, muted: scheme.muted, track: scheme.track, base: mix(theme.from, '#000000', 0.86), panel: mix(theme.from, '#000000', 0.7) };

  // Yükseklik çizimden önce bilinmeli: rozet satırları ve vitrin şeridi kartı uzatır
  const probe = measureCtx();
  const rows = badgeRows(probe, view.badges ?? [], WIDTH - PAD * 2);
  const badgesH = rows.length ? rows.length * BADGE_ROW_H + (rows.length - 1) * 10 + 14 : 0;
  const hasFooter = Boolean(view.featured || view.links?.length || view.visits > 0);
  const height = BASE_HEIGHT + badgesH + (hasFooter ? FOOTER_H + 20 : 0);

  const canvas = canvasLib().createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  // Kartın tamamı yuvarlak köşeli; her şey bu şeklin içine çizilir
  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, height, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, height);
  await drawHeader(ctx, theme, custom.banner, c.base);

  // Sağ üst: sıralama etiketleri ve altında coin bakiyesi
  const rankColor = 'rgba(12,8,16,0.55)';
  let right = WIDTH - PAD;
  right -= pill(ctx, `Ses  ${view.sesRank ? `#${view.sesRank}` : '-'}`, right, 28, rankColor) + 10;
  pill(ctx, `Mesaj  ${view.mesajRank ? `#${view.mesajRank}` : '-'}`, right, 28, rankColor);
  pill(ctx, `${number(view.coins ?? 0)} coin`, WIDTH - PAD, 74, accent, '#120a10');

  // Avatar kapağın altına taşar; zemin renginde kalın halka kapakla arasını ayırır
  const avatarSize = 160;
  const avatarX = PAD;
  const avatarY = HEADER - 70;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
  ctx.fillStyle = c.base;
  ctx.fill();
  await drawAvatar(ctx, user, avatarX, avatarY, avatarSize, accent);

  // Ad, kullanıcı adı (varsa zamiriyle) ve unvan
  const textX = avatarX + avatarSize + 32;
  const textMax = WIDTH - PAD - textX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 36);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, textMax), textX, HEADER + 40);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 17);
  ctx.fillText(fitText(ctx, `@${user.username}${custom.pronoun ? ` · ${custom.pronoun}` : ''}`, textMax), textX, HEADER + 68);
  if (custom.title) {
    ctx.font = font(500, 16);
    const width = ctx.measureText(custom.title).width + 28;
    ctx.fillStyle = hexAlpha(accent, 0.2);
    roundRect(ctx, textX, HEADER + 82, width, 30, 15);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillText(custom.title, textX + 14, HEADER + 102);
  }

  // Rozetler: kazanılanlar unvanın altında sırayla dizilir
  if (rows.length) drawBadges(ctx, rows, HEADER + 128);

  // Biyografi kutusu
  const bioY = HEADER + 128 + badgesH;
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

  if (hasFooter) drawFooter(ctx, infoY + 56 + 20, view, c);

  drawFrame(ctx, height, view.frame, scheme);
  ctx.restore();
  return canvas.toBuffer('image/png');
}

module.exports = { buildProfileCard, WIDTH, BASE_HEIGHT };
