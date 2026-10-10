// Profil kartı: kapak (kullanıcının görseli, satın alınan kapak efekti ya da temanın kendi efekti), avatar, ad,
// unvan, rozetler, biyografi, mesaj/ses seviye kutuları, alt bilgi kutuları ve vitrin şeridi içeren görsel
// (PNG, Buffer döner). Kutular temaya göre düz opak ya da yarı saydam "buzlu cam" panel olarak çizilir; cam
// temalarda saydamlığı üye kendisi ayarlar (custom.glassOpacity). Kapak görseli yakınlaştırılıp kaydırılabilir
// (custom.bannerZoom / bannerX / bannerY). Yükseklik çizilecek içeriğe göre hesaplanır.
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

// Discord kartı sohbet içinde ~440 px genişliğe küçülttüğü için tüm ölçek bol tutulur: 1000 px'lik tuvalde
// çizilen yazılar önizlemede okunabilsin.
const WIDTH = 1000;
const PAD = 48;
const HEADER = 300; // kapağın yüksekliği: banner'ın belirgin görünmesi için geniş tutulur
const BADGE_ROW_H = 38;
const BADGE_GAP = 10;
const BADGE_ROW_GAP = 14;
const BADGE_ROWS_MAX = 2;
const BIO_H = 106;
const LEVEL_H = 132;
const INFO_H = 80;
const FOOTER_H = 92;
const GAP = 18;
const BOTTOM = 40;

// Saydamlık ayarının aralığı: 0 koyu (belirgin) panel, 100 neredeyse görünmez panel. Varsayılan bugünkü görünüm.
const OPACITY_DEFAULT = 50;
const OPACITY_STEP = 10;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;
const number = (n) => n.toLocaleString('tr-TR');
const date = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function duration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} sa ${minutes % 60} dk` : `${minutes} dk`;
}

// Panel tarzı: cam temalarda gradyan + parlama + ince kenar, saydamlık üyenin ayarıyla ölçeklenir;
// düz temalarda panel zeminden açılmış tek renkle doldurulur ( opak, parlama yok ).
function panelStyle(theme, custom, base) {
  // null/undefined "ayar yok" demektir (Number(null) 0 olduğu için doğrudan Number() kullanılmaz)
  const opacity = clamp(Number(custom.glassOpacity ?? OPACITY_DEFAULT), 0, 100) / 100;
  return {
    glass: Boolean(theme.glass),
    // panelin tüm alfa değerlerini çarpan katsayı: 0 -> 2 kat belirgin buzlu cam, 1 -> neredeyse görünmez panel
    k: 2 - opacity * 1.85,
    fill: mix(base, '#ffffff', 0.07),
    edge: mix(base, '#ffffff', 0.16),
  };
}

const alpha = (tint, value, p) => `rgba(${tint},${Math.min(0.55, value * (p.glass ? p.k : 1)).toFixed(3)})`;

// Yuvarlak köşeli kutu: cam temada üstte parlak şerit ve saydam dolgu, düz temada opak dolgu ve ince kenar
function glass(ctx, x, y, w, h, r, c, tint = '255,255,255') {
  const p = c.panel;
  roundRect(ctx, x, y, w, h, r);

  if (!p.glass) {
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.edge;
    roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(1, r - 0.75));
    ctx.stroke();
    return;
  }

  const fill = ctx.createLinearGradient(x, y, x, y + h);
  fill.addColorStop(0, alpha(tint, 0.12, p));
  fill.addColorStop(0.5, alpha(tint, 0.06, p));
  fill.addColorStop(1, alpha(tint, 0.025, p));
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x, y + 22);
  sheen.addColorStop(0, alpha(tint, 0.24, p));
  sheen.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, 22);
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = alpha(tint, 0.16, p);
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
async function paintHeader(ctx, view, theme, p, c) {
  const custom = view.custom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEADER);
  ctx.clip(); // yakınlaştırılan görsel ve ışık lekeleri kapağın dışına taşmasın
  if (!custom.banner || !(await drawBanner(ctx, custom))) {
    drawCover(ctx, coverOf(custom.cover).effect ?? theme.effect, { x: 0, y: 0, w: WIDTH, h: HEADER }, p);
  }
  // Etiketlerin (sıra ve coin) okunması için kapağın üstüne ince bir karartma; görseli bastırmayacak kadar hafif
  const shade = ctx.createLinearGradient(0, 0, 0, 130);
  shade.addColorStop(0, 'rgba(8,5,10,0.3)');
  shade.addColorStop(1, 'rgba(8,5,10,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, 130);
  // Kapağın altındaki kararma gövdenin ilk tonuna bağlanır: hedef gövde rengi olmazsa koyu bir kapak ile zemin
  // arasında sert, kirli bir bant oluşur.
  const fade = ctx.createLinearGradient(0, HEADER - 100, 0, HEADER);
  fade.addColorStop(0, hexAlpha(c.bgTop, 0));
  fade.addColorStop(1, c.bgTop);
  ctx.fillStyle = fade;
  ctx.fillRect(0, HEADER - 100, WIDTH, 100);
  ctx.restore();
}

// Kapağın rengi gövdeye hafif bir ışımayla sızar. Cam paneller yarı saydam olduğu için arkalarında bu ışımayı
// görür; saydamlık ayarının fark edilebilir olmasını sağlayan şey budur. Düz panelleri ise kapatır, görünmez.
// Işıma kapağın hemen altında başlamaz (koyu bir kapağın altındaki açık bant kartı kirli gösterir): sıfırdan açılır,
// gövdenin içinde güçlenir ve kartın altına doğru yeniden söner.
function paintAmbient(ctx, height, p) {
  const body = height - HEADER;
  const bleed = ctx.createLinearGradient(0, HEADER, 0, HEADER + Math.max(240, Math.round(body * 0.8)));
  bleed.addColorStop(0, hexAlpha(p.to, 0));
  bleed.addColorStop(0.3, hexAlpha(p.to, 0.16));
  bleed.addColorStop(1, hexAlpha(p.to, 0));
  ctx.fillStyle = bleed;
  ctx.fillRect(0, HEADER, WIDTH, body);

  const glow = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexAlpha(color, a));
    g.addColorStop(1, hexAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // İki parlama aynı güçte ve gövdeye yayılmış durur; bir köşeye toplanan güçlü parlama kartı dengesiz gösterir
  glow(WIDTH * 0.1, HEADER + Math.round(body * 0.45), 430, p.accent, 0.055);
  glow(WIDTH * 0.9, height - Math.round(body * 0.22), 400, p.accent, 0.06);
}

// Yuvarlak köşeli küçük etiket (rank, coin); genişliğini yazıya göre ayarlar ve (sağ kenar hizalı) çizer
function pill(ctx, text, right, y, color, textColor = '#ffffff', border = 'rgba(255,255,255,0.16)') {
  ctx.font = font(500, 19);
  const width = ctx.measureText(text).width + 34;
  const x = right - width;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, 42, 21);
  ctx.fill();
  if (border) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    roundRect(ctx, x + 0.5, y + 0.5, width - 1, 41, 20.5);
    ctx.stroke();
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + 28);
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
  ctx.font = font(500, 17);
  const items = badges.map((b) => {
    const textWidth = Math.round(ctx.measureText(b.label).width);
    return { ...b, w: textWidth + (b.icon ? 62 : 40), textWidth };
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

  if (hidden > 0) rows[rows.length - 1].push({ key: 'diger', label: `+${hidden}`, color: '#c3ccd6', w: 56, textWidth: 26 });
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

      const iconX = b.icon ? x + 24 : x + 18;
      drawIcon(ctx, b.icon, iconX, ry + BADGE_ROW_H / 2, b.icon ? 9.5 : 5, b.color);
      ctx.fillStyle = mix(b.color, '#ffffff', 0.3);
      ctx.font = font(500, 17);
      ctx.textAlign = 'left';
      ctx.fillText(b.label, x + (b.icon ? 40 : 30), ry + 25);
      x += b.w + BADGE_GAP;
    }
  });
}

// Seviye kutusu: başlık, büyük seviye numarası, XP ve ilerleme çubuğu (panel üstünde)
function levelCard(ctx, x, y, w, h, title, xp, c) {
  const accent = c.accent;
  const level = levelFromXp(xp);
  const current = level > 0 ? levelConfig.xpForLevel(level) : 0;
  const next = levelConfig.xpForLevel(level + 1);

  glass(ctx, x, y, w, h, 22, c);

  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 18);
  ctx.fillText(title, x + 26, y + 38);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 21);
  ctx.fillText(`${number(xp - current)} / ${number(next - current)} XP`, x + 26, y + 70);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = font(700, 56);
  ctx.fillText(String(level), x + w - 26, y + 76);
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 14);
  ctx.fillText('SEVİYE', x + w - 26, y + 26);

  drawBar(ctx, x + 26, y + h - 32, w - 52, 16, (xp - current) / (next - current), accent, c.track);
}

// Alt bilgi kutusu: sol üstte küçük başlık, altında değer
function infoBox(ctx, x, y, w, label, value, c) {
  glass(ctx, x, y, w, INFO_H, 18, c);
  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 14);
  ctx.fillText(label.toLocaleUpperCase('tr-TR'), x + 20, y + 27);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 24);
  ctx.fillText(fitText(ctx, value, w - 40), x + 20, y + 57);
}

// Vitrin şeridi: solda üyenin öne çıkardığı istatistik, sağda bağlantılar ve ziyaret sayısı
function drawFooter(ctx, y, view, c) {
  glass(ctx, PAD, y, WIDTH - PAD * 2, FOOTER_H, 20, c);
  ctx.fillStyle = hexAlpha(c.accent, 0.75);
  roundRect(ctx, PAD, y + 20, 6, FOOTER_H - 40, 3);
  ctx.fill();

  if (view.featured) {
    ctx.textAlign = 'left';
    ctx.fillStyle = c.muted;
    ctx.font = font(500, 15);
    ctx.fillText(view.featured.label.toLocaleUpperCase('tr-TR'), PAD + 28, y + 32);
    ctx.fillStyle = c.accent;
    ctx.font = font(700, 30);
    ctx.fillText(fitText(ctx, view.featured.value, 340), PAD + 28, y + 68);
  }

  const right = WIDTH - PAD - 26;
  ctx.textAlign = 'right';
  if (view.links?.length) {
    ctx.fillStyle = '#efe6ea';
    ctx.font = font(500, 19);
    ctx.fillText(fitText(ctx, view.links.join('   ·   '), 500), right, y + (view.featured ? 40 : 52));
  }
  if (view.visits > 0) {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 16);
    ctx.fillText(`${number(view.visits)} profil ziyareti`, right, y + (view.featured || view.links?.length ? 68 : 52));
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

// Kartın renkleri: tema -> şema (vurgu, soluk yazı, çubuk zemini), koyu zemin tonu ve panel tarzı
function paletteOf(theme, custom) {
  const scheme = makeScheme(theme);
  const c = {
    accent: scheme.accent,
    muted: scheme.muted,
    track: scheme.track,
    base: mix(theme.from, '#000000', 0.86),
    // Gövde zemini tek düz tondan değil, kapağın altından başlayıp aşağı koyulaşan hafif bir gradyanından türer.
    // Düz ton karışınca alta doğru çamurlaşır; gradyan ise temanın rengini koruyarak kartı temiz kapatır.
    bgTop: mix(theme.from, '#000000', 0.78),
    bgBottom: mix(theme.from, '#000000', 0.93),
  };
  c.panel = panelStyle(theme, custom ?? {}, c.base);
  return {
    scheme,
    accent: scheme.accent,
    c,
    p: { from: theme.from, to: theme.to, accent: scheme.accent },
  };
}

// view: { custom, roleColor, mesajXp, sesXp, mesajRank, sesRank, joinedAt, messageCount, voiceSeconds, rep,
//         badges: [rozet], featured: { label, value } | null, links: [metin], visits: sayı, frame: çerçeve }
async function buildProfileCard(user, view) {
  const custom = view.custom;
  const theme = resolveTheme(custom, view.roleColor);
  const { scheme, accent, c, p } = paletteOf(theme, custom);

  // Yükseklik çizimden önce bilinmeli: rozet satırları ve vitrin şeridi kartı uzatır
  const probe = measureCtx();
  const rows = badgeRows(probe, view.badges ?? [], WIDTH - PAD * 2);
  const badgesH = rows.length ? rows.length * BADGE_ROW_H + (rows.length - 1) * BADGE_ROW_GAP + 14 : 0;
  const hasFooter = Boolean(view.featured || view.links?.length || view.visits > 0);
  const badgesTop = HEADER + 132;
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
  const body = ctx.createLinearGradient(0, HEADER, 0, height);
  body.addColorStop(0, c.bgTop);
  body.addColorStop(1, c.bgBottom);
  ctx.fillStyle = body;
  ctx.fillRect(0, HEADER, WIDTH, height - HEADER);
  await paintHeader(ctx, view, theme, p, c);
  paintAmbient(ctx, height, p);

  // Sağ üst: sıralama etiketleri ve altında coin bakiyesi
  const rankColor = 'rgba(10,6,12,0.5)';
  let right = WIDTH - PAD;
  right -= pill(ctx, `Ses  ${view.sesRank ? `#${view.sesRank}` : '-'}`, right, 26, rankColor) + 10;
  pill(ctx, `Mesaj  ${view.mesajRank ? `#${view.mesajRank}` : '-'}`, right, 26, rankColor);
  pill(ctx, `${number(view.coins ?? 0)} coin`, WIDTH - PAD, 76, accent, '#120a10', null);

  // Avatar kapağın altına taşar; gövde rengindeki kalın halka kapakla arasını ayırır
  const avatarSize = 184;
  const avatarX = PAD;
  const avatarY = HEADER - 92;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 10, 0, Math.PI * 2);
  ctx.fillStyle = c.bgTop;
  ctx.fill();
  await drawAvatar(ctx, user, avatarX, avatarY, avatarSize, accent);

  // Ad, kullanıcı adı (varsa zamiriyle) ve unvan
  const textX = avatarX + avatarSize + 30;
  const textMax = WIDTH - PAD - textX;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 44);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, textMax), textX, HEADER + 40);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 21);
  ctx.fillText(fitText(ctx, `@${user.username}${custom.pronoun ? ` · ${custom.pronoun}` : ''}`, textMax), textX, HEADER + 70);
  if (custom.title) {
    ctx.font = font(500, 19);
    const width = ctx.measureText(custom.title).width + 34;
    ctx.fillStyle = hexAlpha(accent, 0.22);
    roundRect(ctx, textX, HEADER + 84, width, 36, 18);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexAlpha(accent, 0.5);
    roundRect(ctx, textX + 0.5, HEADER + 84.5, width - 1, 35, 17.5);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillText(custom.title, textX + 17, HEADER + 108);
  }

  // Rozetler: kazanılanlar ve satın alınan sergi rozetleri unvanın altında sırayla dizilir
  if (rows.length) drawBadges(ctx, rows, badgesTop);

  // Biyografi kutusu
  glass(ctx, PAD, bioY, WIDTH - PAD * 2, BIO_H, 22, c);
  ctx.fillStyle = accent;
  roundRect(ctx, PAD, bioY + 20, 6, BIO_H - 40, 3);
  ctx.fill();
  ctx.textAlign = 'left';
  if (custom.bio) {
    ctx.fillStyle = '#ece3e8';
    ctx.font = font(400, 23);
    wrapLines(ctx, custom.bio, WIDTH - PAD * 2 - 64, 2).forEach((line, i) => ctx.fillText(line, PAD + 28, bioY + 44 + i * 34));
  } else {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 22);
    ctx.fillText('Henüz bir biyografi eklenmemiş.', PAD + 28, bioY + 58);
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
  const { c, p } = paletteOf(theme, view.custom);
  const canvas = canvasLib().createCanvas(WIDTH, HEADER);
  const ctx = canvas.getContext('2d');

  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEADER, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, HEADER);
  await paintHeader(ctx, view, theme, p, c);
  ctx.restore();

  if (note) {
    ctx.font = font(500, 19);
    const width = ctx.measureText(note).width + 34;
    ctx.fillStyle = 'rgba(10,6,12,0.6)';
    roundRect(ctx, WIDTH - PAD - width, HEADER - 62, width, 42, 21);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(note, WIDTH - PAD - width / 2, HEADER - 33);
  }
  return canvas.toBuffer('image/png');
}

module.exports = { buildProfileCard, buildHeaderPreview, WIDTH, HEADER, PAD, OPACITY_DEFAULT, OPACITY_STEP, clamp };
