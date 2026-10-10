// Profil kartı: kapak (kullanıcının görseli, satın alınan kapak efekti ya da temanın kendi efekti), avatar, ad,
// unvan, rozetler, biyografi, mesaj/ses seviye kutuları, alt bilgi kutuları ve vitrin şeridi içeren görsel
// (PNG, Buffer döner). Kutular yarı saydam "buzlu cam" paneli olarak çizilir; kapak görseli yakınlaştırılıp
// kaydırılabilir (custom.bannerZoom / bannerX / bannerY). Yükseklik çizilecek içeriğe göre hesaplanır.
// Çerçeveler kartın kenarına çizilir, yazılar assets/fonts altındaki Poppins ile çizilir.
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
const { coverOf, drawCover } = require('./kapak');
const { resolveTheme } = require('./themes');

const WIDTH = 1000;
const PAD = 44;
const HEADER = 300; // kapağın yüksekliği: banner'ın belirgin görünmesi için geniş tutulur
const BADGE_ROW_H = 32;
const BADGE_GAP = 8;
const BADGE_ROW_GAP = 12;
const BADGE_ROWS_MAX = 2;
const BIO_H = 92;
const LEVEL_H = 112;
const INFO_H = 64;
const FOOTER_H = 74;
const GAP = 16;
const BOTTOM = 36;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;
const number = (n) => n.toLocaleString('tr-TR');
const date = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function duration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} sa ${minutes % 60} dk` : `${minutes} dk`;
}

// Yuvarlak köşeli kutunun üstüne ince parlak şerit ve iç dolgu: kartın bütün paneleri bu "cam" düzeniyle çizilir
function glass(ctx, x, y, w, h, r, tint = '255,255,255') {
  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, `rgba(${tint},0.09)`);
  fill.addColorStop(0.5, `rgba(${tint},0.045)`);
  fill.addColorStop(1, `rgba(${tint},0.02)`);
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x, y + 20);
  sheen.addColorStop(0, `rgba(${tint},0.2)`);
  sheen.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, 20);
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = `rgba(${tint},0.13)`;
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(1, r - 0.75));
  ctx.stroke();
}

// Kapak görseli: alanı kaplayacak ölçek, sonra kullanıcının ayarladığı yakınlaştırma ve kaydırma. Kaydırma
// oranı -1 ile 1 arasındadır ve yalnızca taşan (ekranın dışına kalan) alan kadar hareket eder; böylece kapakta
// boşluk oluşmaz. Görsel yüklenemezse false döner ve tema efekti çizilir.
async function drawBanner(ctx, custom) {
  let image;
  try {
    image = await loadImageSafe(custom.banner);
  } catch (err) {
    console.error('[profil] Kapak görseli yüklenemedi:', err.message);
    return false;
  }
  const zoom = clamp(Number(custom.bannerZoom) || 1, 1, 3);
  const scale = Math.max(WIDTH / image.width, HEADER / image.height) * zoom;
  const w = image.width * scale;
  const h = image.height * scale;
  const roomX = (w - WIDTH) / 2;
  const roomY = (h - HEADER) / 2;
  const x = (WIDTH - w) / 2 + clamp(Number(custom.bannerX) || 0, -1, 1) * roomX;
  const y = (HEADER - h) / 2 + clamp(Number(custom.bannerY) || 0, -1, 1) * roomY;
  ctx.drawImage(image, x, y, w, h);
  return true;
}

// Kapağın tamamı: görsel varsa o, yoksa satın alınan kapak efekti (custom.cover), o da yoksa temanın efekti.
// Üst soldaki etiketlerin okunması için hafif bir karartma, altta zemine geçiş için yumuşak kararmanın eklenir.
async function paintHeader(ctx, view, theme, p, base) {
  const custom = view.custom;
  if (!custom.banner || !(await drawBanner(ctx, custom))) {
    drawCover(ctx, coverOf(custom.cover).effect ?? theme.effect, { x: 0, y: 0, w: WIDTH, h: HEADER }, p);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, 170);
  shade.addColorStop(0, 'rgba(8,5,10,0.42)');
  shade.addColorStop(1, 'rgba(8,5,10,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, 170);
  const fade = ctx.createLinearGradient(0, HEADER - 70, 0, HEADER);
  fade.addColorStop(0, 'rgba(12,8,16,0)');
  fade.addColorStop(1, base);
  ctx.fillStyle = fade;
  ctx.fillRect(0, HEADER - 70, WIDTH, 70);
}

// Yuvarlak köşeli küçük etiket (rank, coin); genişliğini yazıya göre ayarlar ve (sağ kenar hizalı) çizer
function pill(ctx, text, right, y, color, textColor = '#ffffff', border = 'rgba(255,255,255,0.16)') {
  ctx.font = font(500, 16);
  const width = ctx.measureText(text).width + 28;
  const x = right - width;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, 34, 17);
  ctx.fill();
  if (border) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    roundRect(ctx, x + 0.5, y + 0.5, width - 1, 33, 16.5);
    ctx.stroke();
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + 23);
  return width;
}

// Satın alınan rozet simgeleri: kartta renkli nokta yerine bu şekiller çizilir
function drawIcon(ctx, icon, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (icon === 'kalp') {
    ctx.moveTo(cx, cy + r);
    ctx.bezierCurveTo(cx - r * 1.35, cy - r * 0.2, cx - r * 0.5, cy - r * 1.15, cx, cy - r * 0.35);
    ctx.bezierCurveTo(cx + r * 0.5, cy - r * 1.15, cx + r * 1.35, cy - r * 0.2, cx, cy + r);
    ctx.fill();
  } else if (icon === 'yildiz') {
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 ? r * 0.44 : r;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'tac') {
    ctx.moveTo(cx - r, cy + r * 0.65);
    ctx.lineTo(cx - r * 0.82, cy - r * 0.55);
    ctx.lineTo(cx - r * 0.3, cy + r * 0.05);
    ctx.lineTo(cx, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.3, cy + r * 0.05);
    ctx.lineTo(cx + r * 0.82, cy - r * 0.55);
    ctx.lineTo(cx + r, cy + r * 0.65);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'hilal') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.moveTo(cx + r * 0.45 + r * 0.86, cy);
    ctx.arc(cx + r * 0.45, cy, r * 0.86, 0, Math.PI * 2);
    ctx.fill('evenodd');
  } else if (icon === 'elmas') {
    ctx.moveTo(cx - r * 0.92, cy - r * 0.25);
    ctx.lineTo(cx - r * 0.45, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.45, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.92, cy - r * 0.25);
    ctx.lineTo(cx, cy + r * 0.92);
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'ates') {
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r * 0.95, cy - r * 0.15, cx + r * 0.55, cy + r * 0.95, cx, cy + r * 0.95);
    ctx.bezierCurveTo(cx - r * 0.55, cy + r * 0.95, cx - r * 0.95, cy - r * 0.15, cx, cy - r);
    ctx.fill();
    ctx.fillStyle = hexAlpha('#ffffff', 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.2);
    ctx.bezierCurveTo(cx + r * 0.42, cy + r * 0.35, cx + r * 0.2, cy + r * 0.8, cx, cy + r * 0.78);
    ctx.bezierCurveTo(cx - r * 0.2, cy + r * 0.8, cx - r * 0.42, cy + r * 0.35, cx, cy - r * 0.2);
    ctx.fill();
  } else {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Rozet etiketlerinin satırlara dağılımı: her etiket yazısına göre genişler, sığmayan alt satıra iner. En fazla
// iki satır ayrılır; hiç sığdıramadıkların yerine son satıra tek bir "+N" etiketi konur.
function badgeRows(ctx, badges, maxWidth) {
  ctx.font = font(500, 14);
  const items = badges.map((b) => {
    const textWidth = Math.round(ctx.measureText(b.label).width);
    return { ...b, w: textWidth + (b.icon ? 52 : 34), textWidth };
  });

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

  if (hidden > 0) rows[rows.length - 1].push({ key: 'diger', label: `+${hidden}`, color: '#c3ccd6', w: 48, textWidth: 22 });
  return rows.filter((row) => row.length);
}

function drawBadges(ctx, rows, y) {
  rows.forEach((row, i) => {
    let x = PAD;
    const ry = y + i * (BADGE_ROW_H + BADGE_ROW_GAP);
    for (const b of row) {
      const fill = ctx.createLinearGradient(x, ry, x, ry + BADGE_ROW_H);
      fill.addColorStop(0, hexAlpha(b.color, 0.26));
      fill.addColorStop(1, hexAlpha(b.color, 0.1));
      roundRect(ctx, x, ry, b.w, BADGE_ROW_H, BADGE_ROW_H / 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexAlpha(b.color, 0.45);
      roundRect(ctx, x + 0.5, ry + 0.5, b.w - 1, BADGE_ROW_H - 1, (BADGE_ROW_H - 1) / 2);
      ctx.stroke();

      const iconX = b.icon ? x + 20 : x + 15;
      drawIcon(ctx, b.icon, iconX, ry + BADGE_ROW_H / 2, b.icon ? 8 : 4, b.icon ? b.color : b.color);
      ctx.fillStyle = mix(b.color, '#ffffff', 0.3);
      ctx.font = font(500, 14);
      ctx.textAlign = 'left';
      ctx.fillText(b.label, x + (b.icon ? 34 : 25), ry + 21);
      x += b.w + BADGE_GAP;
    }
  });
}

// Seviye kutusu: başlık, büyük seviye numarası, XP ve ilerleme çubuğu (cam panel üstünde)
function levelCard(ctx, x, y, w, h, title, xp, c) {
  const accent = c.accent;
  const level = levelFromXp(xp);
  const current = level > 0 ? levelConfig.xpForLevel(level) : 0;
  const next = levelConfig.xpForLevel(level + 1);

  glass(ctx, x, y, w, h, 20);

  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 15);
  ctx.fillText(title, x + 22, y + 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 17);
  ctx.fillText(`${number(xp - current)} / ${number(next - current)} XP`, x + 22, y + 62);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = font(700, 46);
  ctx.fillText(String(level), x + w - 22, y + 68);
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 12);
  ctx.fillText('SEVİYE', x + w - 22, y + 22);

  drawBar(ctx, x + 22, y + h - 28, w - 44, 14, (xp - current) / (next - current), accent, c.track);
}

// Alt bilgi kutusu: sol üstte küçük başlık, altında değer
function infoBox(ctx, x, y, w, label, value, c) {
  glass(ctx, x, y, w, INFO_H, 16);
  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 11);
  ctx.fillText(label.toLocaleUpperCase('tr-TR'), x + 16, y + 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 18);
  ctx.fillText(fitText(ctx, value, w - 32), x + 16, y + 45);
}

// Vitrin şeridi: solda üyenin öne çıkardığı istatistik, sağda bağlantılar ve ziyaret sayısı
function drawFooter(ctx, y, view, c) {
  glass(ctx, PAD, y, WIDTH - PAD * 2, FOOTER_H, 18, '255,255,255');
  ctx.fillStyle = hexAlpha(c.accent, 0.75);
  roundRect(ctx, PAD, y + 16, 5, FOOTER_H - 32, 3);
  ctx.fill();

  if (view.featured) {
    ctx.textAlign = 'left';
    ctx.fillStyle = c.muted;
    ctx.font = font(500, 12);
    ctx.fillText(view.featured.label.toLocaleUpperCase('tr-TR'), PAD + 24, y + 26);
    ctx.fillStyle = c.accent;
    ctx.font = font(700, 24);
    ctx.fillText(fitText(ctx, view.featured.value, 340), PAD + 24, y + 54);
  }

  const right = WIDTH - PAD - 24;
  ctx.textAlign = 'right';
  if (view.links?.length) {
    ctx.fillStyle = '#efe6ea';
    ctx.font = font(500, 15);
    ctx.fillText(fitText(ctx, view.links.join('   ·   '), 520), right, y + (view.featured ? 32 : 44));
  }
  if (view.visits > 0) {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 13);
    ctx.fillText(`${number(view.visits)} profil ziyareti`, right, y + (view.featured || view.links?.length ? 55 : 44));
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

// Kartın renkleri: tema -> şema (vurgu, soluk yazı, çubuk zemini) ve koyu zemin tonu
function paletteOf(theme) {
  const scheme = makeScheme(theme);
  return {
    scheme,
    accent: scheme.accent,
    c: {
      accent: scheme.accent,
      muted: scheme.muted,
      track: scheme.track,
      base: mix(theme.from, '#000000', 0.86),
    },
    p: { from: theme.from, to: theme.to, accent: scheme.accent },
  };
}

// view: { custom, roleColor, mesajXp, sesXp, mesajRank, sesRank, joinedAt, messageCount, voiceSeconds, rep,
//         badges: [rozet], featured: { label, value } | null, links: [metin], visits: sayı, frame: çerçeve }
async function buildProfileCard(user, view) {
  const custom = view.custom;
  const theme = resolveTheme(custom, view.roleColor);
  const { scheme, accent, c, p } = paletteOf(theme);

  // Yükseklik çizimden önce bilinmeli: rozet satırları ve vitrin şeridi kartı uzatır
  const probe = measureCtx();
  const rows = badgeRows(probe, view.badges ?? [], WIDTH - PAD * 2);
  const badgesH = rows.length ? rows.length * BADGE_ROW_H + (rows.length - 1) * BADGE_ROW_GAP + 14 : 0;
  const hasFooter = Boolean(view.featured || view.links?.length || view.visits > 0);
  const badgesTop = HEADER + 112;
  const bioY = badgesTop + badgesH;
  const levelY = bioY + BIO_H + GAP;
  const infoY = levelY + LEVEL_H + GAP;
  const footerY = infoY + INFO_H + GAP;
  const height = (hasFooter ? footerY + FOOTER_H : infoY + INFO_H) + BOTTOM;

  const canvas = canvasLib().createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  // Kartın tamamı yuvarlak köşeli; her şey bu şeklin içine çizilir
  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, height, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.save();
  await paintHeader(ctx, view, theme, p, c.base);
  ctx.restore();

  // Sağ üst: sıralama etiketleri ve altında coin bakiyesi
  const rankColor = 'rgba(10,6,12,0.5)';
  let right = WIDTH - PAD;
  right -= pill(ctx, `Ses  ${view.sesRank ? `#${view.sesRank}` : '-'}`, right, 26, rankColor) + 10;
  pill(ctx, `Mesaj  ${view.mesajRank ? `#${view.mesajRank}` : '-'}`, right, 26, rankColor);
  pill(ctx, `${number(view.coins ?? 0)} coin`, WIDTH - PAD, 70, accent, '#120a10', null);

  // Avatar kapağın altına taşar; zemin renginde kalın halka kapakla arasını ayırır
  const avatarSize = 168;
  const avatarX = PAD;
  const avatarY = HEADER - 84;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
  ctx.fillStyle = c.base;
  ctx.fill();
  await drawAvatar(ctx, user, avatarX, avatarY, avatarSize, accent);

  // Ad, kullanıcı adı (varsa zamiriyle) ve unvan
  const textX = avatarX + avatarSize + 30;
  const textMax = WIDTH - PAD - textX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 36);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, textMax), textX, HEADER + 36);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 17);
  ctx.fillText(fitText(ctx, `@${user.username}${custom.pronoun ? ` · ${custom.pronoun}` : ''}`, textMax), textX, HEADER + 62);
  if (custom.title) {
    ctx.font = font(500, 16);
    const width = ctx.measureText(custom.title).width + 28;
    ctx.fillStyle = hexAlpha(accent, 0.22);
    roundRect(ctx, textX, HEADER + 74, width, 30, 15);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexAlpha(accent, 0.5);
    roundRect(ctx, textX + 0.5, HEADER + 74.5, width - 1, 29, 14.5);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(custom.title, textX + 14, HEADER + 94);
  }

  // Rozetler: kazanılanlar ve satın alınan sergi rozetleri unvanın altında sırayla dizilir
  if (rows.length) drawBadges(ctx, rows, badgesTop);

  // Biyografi kutusu
  glass(ctx, PAD, bioY, WIDTH - PAD * 2, BIO_H, 20);
  ctx.fillStyle = accent;
  roundRect(ctx, PAD, bioY + 16, 5, BIO_H - 32, 3);
  ctx.fill();
  ctx.textAlign = 'left';
  if (custom.bio) {
    ctx.fillStyle = '#ece3e8';
    ctx.font = font(400, 19);
    wrapLines(ctx, custom.bio, WIDTH - PAD * 2 - 60, 2).forEach((line, i) => ctx.fillText(line, PAD + 26, bioY + 40 + i * 28));
  } else {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 18);
    ctx.fillText('Henüz bir biyografi eklenmemiş.', PAD + 26, bioY + 52);
  }

  // Mesaj ve ses seviye kutuları
  const cardW = (WIDTH - PAD * 2 - GAP) / 2;
  levelCard(ctx, PAD, levelY, cardW, LEVEL_H, 'Mesaj Seviyesi', view.mesajXp, c);
  levelCard(ctx, PAD + cardW + GAP, levelY, cardW, LEVEL_H, 'Ses Seviyesi', view.sesXp, c);

  // Alt bilgiler
  const infoW = (WIDTH - PAD * 2 - GAP * 3) / 4;
  infoBox(ctx, PAD, infoY, infoW, 'Katılım', view.joinedAt ? date(view.joinedAt) : '-', c);
  infoBox(ctx, PAD + (infoW + GAP) * 1, infoY, infoW, 'Mesaj', number(view.messageCount), c);
  infoBox(ctx, PAD + (infoW + GAP) * 2, infoY, infoW, 'Ses süresi', duration(view.voiceSeconds), c);
  infoBox(ctx, PAD + (infoW + GAP) * 3, infoY, infoW, 'Saygınlık', number(view.rep ?? 0), c);

  if (hasFooter) drawFooter(ctx, footerY, view, c);

  drawFrame(ctx, height, view.frame, scheme);
  ctx.restore();
  return canvas.toBuffer('image/png');
}

// Kapak düzenleyicisinin önizlemesi: kartın üst alanı tek başına çizilir, böylece büyütme ve kaydırma anında görülür
async function buildHeaderPreview(view, note = null) {
  const theme = resolveTheme(view.custom, view.roleColor);
  const { c, p } = paletteOf(theme);
  const canvas = canvasLib().createCanvas(WIDTH, HEADER);
  const ctx = canvas.getContext('2d');

  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEADER, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, HEADER);
  await paintHeader(ctx, view, theme, p, c.base);
  ctx.restore();

  if (note) {
    ctx.font = font(500, 16);
    const width = ctx.measureText(note).width + 30;
    ctx.fillStyle = 'rgba(10,6,12,0.6)';
    roundRect(ctx, WIDTH - PAD - width, HEADER - 50, width, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(note, WIDTH - PAD - width / 2, HEADER - 27);
  }
  return canvas.toBuffer('image/png');
}

module.exports = { buildProfileCard, buildHeaderPreview, WIDTH, HEADER, PAD };
