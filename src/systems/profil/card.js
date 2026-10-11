// Profil kartı: üyenin profili tek geniş bir görselde toplanır (PNG, Buffer döner). Kapağın içinde avatar, ad,
// unvan ve sıralama/coin etiketleri; gövdede rozet şeridi, mesaj-ses seviye kutuları, on iki istatistik kutusu ve
// biyografi + vitrin şeridi çizilir. Kutular temaya göre düz opak ya da yarı saydam "buzlu cam" panel olarak
// çizilir; cam temalarda saydamlığı üye kendisi ayarlar (custom.glassOpacity). Kapak görseli büyütülüp dört yöne
// kaydırılabilir (bannerZoom / bannerX / bannerY) ve "kapla" ya da "sığdır" yerleşiminden biriyle oturtulur
// (bannerFit; boşsa görselin kendine göre otomatik seçilir). Çerçeveler kartın kenarına çizilir, yazılar
// assets/fonts altındaki Poppins ile çizilir.
//
// Kart bilinçli olarak enlemesine geniş ve az bantlı: Discord sohbetteki görseli yüksekliğinden kıptığı için,
// aynı içeriği daha az dikey banda yaymak kartı sohbette belirgin biçimde büyütür. Bu yüzden kimlik bloğu
// kapağın içine taşındı (ayrı bir isim bandı yok) ve alt bilgiler tek ızgarada toplandı.
const {
  FONT,
  canvasLib,
  fitText,
  wrapLines,
  roundRect,
  hexAlpha,
  mix,
  luminance,
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

const WIDTH = 1800;
const PAD = 60;
const HEADER = 400; // kapak: kimlik bloğu da burada çizildiği için geniş tutulur
const AVATAR = 176;
const BADGE_ROW_H = 40;
const BADGE_GAP = 12;
const BADGE_ROW_GAP = 14;
const BADGE_ROWS_MAX = 2;
const LEVEL_H = 124;
const TILE_H = 96;
const TILE_COLS = 6;
const TILE_GAP = 16;
const FOOT_H = 118;
const GAP = 18;
const BOTTOM = 44;

// Kapağın altındaki karartmanın yüksekliği: yazıların okunduğu bant, görselin geri kalanı açık kalır
const SCRIM_H = 250;

// Saydamlık ayarının aralığı: 0 koyu (belirgin) panel, 100 neredeyse görünmez panel. Varsayılan bugünkü görünüm.
const OPACITY_DEFAULT = 50;
const OPACITY_STEP = 10;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;
const number = (n) => Number(n).toLocaleString('tr-TR');
const date = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function duration(seconds) {
  const minutes = Math.floor((seconds ?? 0) / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${number(h)} sa ${minutes % 60} dk` : `${minutes} dk`;
}

// Bir tarihten bugüne geçen süre "3 yıl 2 ay" gibi kısa yazılır: katılım ve hesap yaşı kutularında kullanılır
function age(ms) {
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86400000));
  const years = Math.floor(days / 365);
  if (years >= 1) return `${years} yıl ${Math.floor(((days % 365) / 30) | 0)} ay`;
  if (days >= 30) return `${Math.floor(days / 30)} ay`;
  return `${days} gün`;
}

// Panel tarzı: cam temalarda gradyan + parlama + ince kenar, saydamlık üyenin ayarıyla ölçeklenir;
// düz temalarda panel zeminden açılmış tek renkle doldurulur (opak, parlama yok).
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
  const sheen = ctx.createLinearGradient(x, y, x, y + 26);
  sheen.addColorStop(0, alpha(tint, 0.24, p));
  sheen.addColorStop(1, `rgba(${tint},0)`);
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, 26);
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = alpha(tint, 0.16, p);
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(1, r - 0.75));
  ctx.stroke();
}

// Kutunun yatay ortalanmış yeri: "kapla" alanı tamamen doldurur, "sığdır" görselin tamamını tema efektinin
// üstüne yerleştirir. Dönen değer: görsel çizildi mi (false ise tema efekti çizilmiş olur).
async function drawBanner(ctx, custom, theme, p) {
  let image;
  try {
    image = await loadImageSafe(custom.banner);
  } catch (err) {
    console.error('[profil] Kapak görseli yüklenemedi:', err.message);
    return false;
  }

  // Kaplamada görünen alan kapağın alanı, görselin ölçeklenmiş alanına bölünür. Üye yerleşimi kendisi
  // seçmemişse bu oran karar verir: dik bir telefon fotoğrafı kaplamada ince bir şeride dönüğü için sığdırılır.
  const coverScale = Math.max(WIDTH / image.width, HEADER / image.height);
  const visible = (WIDTH * HEADER) / (image.width * coverScale * image.height * coverScale);
  const mode = custom.bannerFit === 'kapla' || custom.bannerFit === 'sigdir' ? custom.bannerFit : visible < 0.3 ? 'sigdir' : 'kapla';

  if (mode === 'kapla') {
    const zoom = clamp(Number(custom.bannerZoom) || 1, 1, 3);
    const scale = coverScale * zoom;
    const w = image.width * scale;
    const h = image.height * scale;
    const roomX = (w - WIDTH) / 2;
    const roomY = (h - HEADER) / 2;
    const x = (WIDTH - w) / 2 + clamp(Number(custom.bannerX) || 0, -1, 1) * roomX;
    const y = (HEADER - h) / 2 + clamp(Number(custom.bannerY) || 0, -1, 1) * roomY;
    ctx.drawImage(image, x, y, w, h);
    return true;
  }

  // Sığdır: tüm görsel görünür; kalan yere üyenin arka plan efekti çizilir ve görsel gölgeyle üstüne konur
  drawCover(ctx, coverOf(custom.cover).effect ?? theme.effect, { x: 0, y: 0, w: WIDTH, h: HEADER }, p);
  const scale = Math.min(WIDTH / image.width, HEADER / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const x = (WIDTH - w) / 2;
  const y = (HEADER - h) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#0a0608';
  roundRect(ctx, x - 7, y - 7, w + 14, h + 14, 26);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, 20);
  ctx.clip();
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
  return true;
}

// Verilen bölgenin ortalama rengi (#rrggbb). Kapağın alt tonu ve karartmanın gücü buradan ölçülür; okunamazsa
// null döner ve çağıran temanın kendi rengini kullanır.
function avgTone(ctx, x, y, w, h) {
  try {
    const { data } = ctx.getImageData(x, y, w, h);
    const sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
    }
    const n = data.length / 4 || 1;
    const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
    return `#${hex(sum[0])}${hex(sum[1])}${hex(sum[2])}`;
  } catch {
    return null;
  }
}

// Kapağın alt bandındaki karartma: soldan sağa incelen yatay bir karartı kimlik yazılarını tutar. Güç, bölgenin
// ölçülen parlaklığına göre ayarlanır; parlak bir fotoğrafta koyulaşır, koyu bir fotoğrafta inceltir. Eskisi gibi
// kapağın yarısını kapatmaz: görselin üst ve sağ bölümü olduğu gibi kalır.
function drawHeroScrim(ctx) {
  const tone = avgTone(ctx, 0, HEADER - SCRIM_H, Math.round(WIDTH * 0.6), SCRIM_H);
  const strength = clamp(0.3 + (tone ? luminance(tone) : 0.35) * 0.5, 0.3, 0.78);
  const left = ctx.createLinearGradient(0, 0, Math.round(WIDTH * 0.72), 0);
  left.addColorStop(0, `rgba(6,4,8,${strength.toFixed(3)})`);
  left.addColorStop(1, 'rgba(6,4,8,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, HEADER - SCRIM_H, WIDTH, SCRIM_H);
}

// Kapağın tamamı: görsel varsa o, yoksa satın alınan kapak efekti (custom.cover), o da yoksa temanın efekti.
// Üst sağdaki etiketler kendi koyu dolgularıyla geldiği için ek karartma istemez; karartma yalnızca alttaki
// kimlik bandına çizilir. Dönen değer: gövdenin ilk rengi (seam) ve avatarın yeri.
async function paintHeader(ctx, user, view, theme, p, c) {
  const custom = view.custom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEADER);
  ctx.clip(); // yakınlaştırılan görsel ve ışık lekeleri kapağın dışına taşmasın
  if (!custom.banner || !(await drawBanner(ctx, custom, theme, p))) {
    drawCover(ctx, coverOf(custom.cover).effect ?? theme.effect, { x: 0, y: 0, w: WIDTH, h: HEADER }, p);
  }

  // Sağ üst: sıralama etiketleri ve altında coin bakiyesi
  const rankColor = 'rgba(10,6,12,0.58)';
  let right = WIDTH - PAD;
  right -= pill(ctx, `Ses  ${view.sesRank ? `#${view.sesRank}` : '-'}`, right, 28, rankColor) + 12;
  pill(ctx, `Mesaj  ${view.mesajRank ? `#${view.mesajRank}` : '-'}`, right, 28, rankColor);
  pill(ctx, `${number(view.coins ?? 0)} coin`, WIDTH - PAD, 92, c.accent, '#120a10', null);

  // Birleşim rengi kapağın kendi alt tonundan türer ve ince bir karartmayla gövdeye bağlanır. Gövde bu tondan
  // başladığı için çizgi ya da kirli bant oluşmaz; karartma yazılardan önce çizilir ki altlarına almasınlar.
  const tone = avgTone(ctx, 0, HEADER - 6, WIDTH, 6);
  const seam = tone ? mix(mix(tone, '#000000', 0.34), c.bgTop, 0.4) : c.bgTop;
  const fade = ctx.createLinearGradient(0, HEADER - 70, 0, HEADER);
  fade.addColorStop(0, hexAlpha(seam, 0));
  fade.addColorStop(1, hexAlpha(seam, 0.72));
  ctx.fillStyle = fade;
  ctx.fillRect(0, HEADER - 70, WIDTH, 70);

  // Kimlik bandının karartması çizilip ad, kullanıcı adı ve unvan üstüne yazılır
  drawHeroScrim(ctx);
  const identity = drawIdentity(ctx, user, view, c);
  ctx.restore();
  return { seam, ...identity };
}

// Kimlik bloğu: kapağın sol alt köşesinde avatar, yanında ad, kullanıcı adı (zamiriyle) ve unvan etiketi
function drawIdentity(ctx, user, view, c) {
  const custom = view.custom;
  const avatarX = PAD;
  const avatarY = HEADER - AVATAR - 30;

  // Avatarın halkası: dışta koyu bir bant, içte vurgu rengi; görselin üzerinde net dursun
  ctx.beginPath();
  ctx.arc(avatarX + AVATAR / 2, avatarY + AVATAR / 2, AVATAR / 2 + 13, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,5,10,0.72)';
  ctx.fill();

  const textX = avatarX + AVATAR + 36;
  const textMax = Math.min(WIDTH - PAD - textX, 1040);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 52);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, textMax), textX, HEADER - 128);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 25);
  ctx.fillText(fitText(ctx, `@${user.username}${custom.pronoun ? ` · ${custom.pronoun}` : ''}`, textMax), textX, HEADER - 88);
  if (custom.title) {
    ctx.font = font(500, 22);
    const width = ctx.measureText(custom.title).width + 40;
    ctx.fillStyle = hexAlpha(c.accent, 0.24);
    roundRect(ctx, textX, HEADER - 76, width, 42, 21);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexAlpha(c.accent, 0.55);
    roundRect(ctx, textX + 0.5, HEADER - 75.5, width - 1, 41, 20.5);
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.fillText(custom.title, textX + 20, HEADER - 46);
  }
  return { avatarX, avatarY };
}

// Kapağın rengi gövdeye hafif bir ışımayla sızar. Cam paneller yarı saydam olduğu için arkalarında bu ışımayı
// görür; saydamlık ayarının fark edilebilir olmasını sağlayan şey budur. Düz panelleri ise kapatır, görünmez.
// Işıma kapağın birleşim çizgisinde sıfır alfa ile açılır ve parlamaların üst ucu o çizgiye hiç değmez: gövde,
// kapağın bağladığı renkten kesintisiz devam eder.
function paintAmbient(ctx, height, p) {
  const body = height - HEADER;
  const bleed = ctx.createLinearGradient(0, HEADER, 0, HEADER + Math.max(240, Math.round(body * 0.85)));
  bleed.addColorStop(0, hexAlpha(p.to, 0));
  bleed.addColorStop(0.4, hexAlpha(p.to, 0.12));
  bleed.addColorStop(1, hexAlpha(p.to, 0));
  ctx.fillStyle = bleed;
  ctx.fillRect(0, HEADER, WIDTH, body);

  const glow = (x, y, r, color, a) => {
    r = Math.min(r, y - HEADER); // parlamanın üst ucu kapağın altında başlamaz
    if (r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexAlpha(color, a));
    g.addColorStop(1, hexAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // İki parlama aynı güçte ve gövdeye yayılmış durur; bir köşeye toplanan güçlü parlama kartı dengesiz gösterir
  glow(WIDTH * 0.1, HEADER + Math.round(body * 0.62), Math.round(body * 0.6), p.accent, 0.06);
  glow(WIDTH * 0.9, height - 60, body, p.accent, 0.06);
}

// Yuvarlak köşeli küçük etiket (rank, coin); genişliğini yazıya göre ayarlar ve (sağ kenar hizalı) çizer
function pill(ctx, text, right, y, color, textColor = '#ffffff', border = 'rgba(255,255,255,0.18)') {
  ctx.font = font(500, 22);
  const width = ctx.measureText(text).width + 40;
  const x = right - width;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, 48, 24);
  ctx.fill();
  if (border) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    roundRect(ctx, x + 0.5, y + 0.5, width - 1, 47, 23.5);
    ctx.stroke();
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + width / 2, y + 32);
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
  ctx.font = font(500, 19);
  const items = badges.map((b) => {
    const textWidth = Math.round(ctx.measureText(b.label).width);
    return { ...b, w: textWidth + (b.icon ? 68 : 46), textWidth };
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

  if (hidden > 0) rows[rows.length - 1].push({ key: 'diger', label: `+${hidden}`, color: '#c3ccd6', w: 60, textWidth: 28 });
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

      const iconX = b.icon ? x + 26 : x + 20;
      drawIcon(ctx, b.icon, iconX, ry + BADGE_ROW_H / 2, b.icon ? 10.5 : 5.5, b.color);
      ctx.fillStyle = mix(b.color, '#ffffff', 0.3);
      ctx.font = font(500, 19);
      ctx.textAlign = 'left';
      ctx.fillText(b.label, x + (b.icon ? 44 : 34), ry + 27);
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

  glass(ctx, x, y, w, h, 24, c);

  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 20);
  ctx.fillText(title, x + 28, y + 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 24);
  ctx.fillText(`${number(xp - current)} / ${number(next - current)} XP`, x + 28, y + 74);

  ctx.textAlign = 'right';
  ctx.fillStyle = accent;
  ctx.font = font(700, 62);
  ctx.fillText(String(level), x + w - 28, y + 80);
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 15);
  ctx.fillText('SEVİYE', x + w - 28, y + 30);

  drawBar(ctx, x + 28, y + h - 32, w - 56, 16, (xp - current) / (next - current), accent, c.track);
}

// İstatistik kutusu: üstte küçük başlık, altında değer, varsa en altta tek satırlık yant not. Kutu her zaman
// çizilir; ölçülemeyen alan "-" ile durur, böylece ızgaranın düzeni hiçbir profilde bozulmaz.
function statTile(ctx, x, y, w, tile, c) {
  glass(ctx, x, y, w, TILE_H, 18, c);
  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 14);
  ctx.fillText(fitText(ctx, tile.label.toLocaleUpperCase('tr-TR'), w - 40), x + 20, y + 27);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 26);
  ctx.fillText(fitText(ctx, tile.value, w - 40), x + 20, y + tile.sub ? 58 : 66);
  if (tile.sub) {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 15);
    ctx.fillText(fitText(ctx, tile.sub, w - 40), x + 20, y + 80);
  }
}

// Kartın veri ızgarası: sunucudaki bütün kayıtların tek bakışta göründüğü kutular. index.js'teki view.js
// bağlamından beslenir; burada yalnızca biçimlendirilir.
function statTiles(view) {
  const sicil = view.punishments;
  return [
    { label: 'Mesaj', value: number(view.messageCount ?? 0), sub: view.mesajRank ? `${number(view.mesajRank)}. sırada` : null },
    { label: 'Ses süresi', value: duration(view.voiceSeconds), sub: view.sesRank ? `${number(view.sesRank)}. sırada` : null },
    { label: 'Yayın', value: view.streamSeconds >= 60 ? duration(view.streamSeconds) : '-', sub: 'ekran paylaşımı' },
    { label: 'Saygınlık', value: number(view.rep ?? 0), sub: view.rep ? 'alınan saygı' : 'henüz yok' },
    { label: 'Giriş serisi', value: view.streak ? `${number(view.streak)} gün` : '-', sub: 'art arda günlük ödül' },
    { label: 'Ziyaret', value: number(view.visits ?? 0), sub: 'profil görüntülenme' },
    { label: 'Katılım', value: view.joinedAt ? date(view.joinedAt) : '-', sub: view.joinedAt ? `${age(view.joinedAt)} burada` : null },
    { label: 'Hesap', value: view.accountAt ? age(view.accountAt) : '-', sub: view.accountAt ? date(view.accountAt) : null },
    { label: 'Sicil', value: sicil ? (sicil.total ? `${sicil.active} aktif` : 'temiz') : '-', sub: sicil ? `${number(sicil.total)} ceza kaydı` : null },
    { label: 'Takviye', value: view.premiumSince ? age(view.premiumSince) : '-', sub: view.premiumSince ? 'devam ediyor' : 'takviye yok' },
    { label: 'Kozmetik', value: view.ownedCount ? `${number(view.ownedCount)} ürün` : '-', sub: 'çerçeve, tema, kapak' },
    { label: 'Kazanılan', value: number(view.earnedCoins ?? 0), sub: 'toplam coin' },
  ];
}

// Alt şerit: solda biyografi, sağda vitrin (öne çıkan istatistik ve bağlantılar). Vitrin boşsa biyografi
// tüm genişliği kullanır; iki kutu her zaman aynı yükseklikte durur.
function drawFoot(ctx, y, view, c) {
  const custom = view.custom;
  const total = WIDTH - PAD * 2;
  const vitrinW = view.featured || view.links?.length ? 600 : 0;
  const bioW = vitrinW ? total - vitrinW - GAP : total;

  glass(ctx, PAD, y, bioW, FOOT_H, 22, c);
  ctx.fillStyle = c.accent;
  roundRect(ctx, PAD, y + 22, 6, FOOT_H - 44, 3);
  ctx.fill();
  ctx.textAlign = 'left';
  if (custom.bio) {
    ctx.fillStyle = '#ece3e8';
    ctx.font = font(400, 25);
    wrapLines(ctx, custom.bio, bioW - 72, 2).forEach((line, i) => ctx.fillText(line, PAD + 30, y + 48 + i * 36));
  } else {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 24);
    ctx.fillText('Henüz bir biyografi eklenmemiş.', PAD + 30, y + 66);
  }

  if (!vitrinW) return;
  const x = PAD + bioW + GAP;
  glass(ctx, x, y, vitrinW, FOOT_H, 22, c);
  ctx.fillStyle = hexAlpha(c.accent, 0.75);
  roundRect(ctx, x, y + 22, 6, FOOT_H - 44, 3);
  ctx.fill();
  ctx.textAlign = 'left';
  if (view.featured) {
    ctx.fillStyle = c.muted;
    ctx.font = font(500, 15);
    ctx.fillText(view.featured.label.toLocaleUpperCase('tr-TR'), x + 30, y + 34);
    ctx.fillStyle = c.accent;
    ctx.font = font(700, 32);
    ctx.fillText(fitText(ctx, view.featured.value, vitrinW - 60), x + 30, y + 72);
  }
  if (view.links?.length) {
    ctx.fillStyle = '#efe6ea';
    ctx.font = font(500, 19);
    ctx.fillText(fitText(ctx, view.links.join('   ·   '), vitrinW - 60), x + 30, y + (view.featured ? 100 : 60));
  }
}

// Satın alınan çerçeve: kartın kenarına çizilen renkli kenar ve köşelerde yumuşak parlama
function drawFrame(ctx, height, frame, scheme) {
  if (!frame || frame.key === 'yok') return;
  const edge = frame.edge === 'accent' ? scheme.accent : frame.edge;
  const glow = frame.glow === 'accent' ? scheme.accent : frame.glow;

  for (const [gx, gy] of [[8, 8], [WIDTH - 8, height - 8]]) {
    const g = ctx.createRadialGradient(gx, gy, 10, gx, gy, 380);
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
    // Gövde zemini düz siyah değil, kapağın kendi renginden türemiş koyu bir ton: kapağın altında başlayıp
    // aşağı doğru kararan opak gradyan. Alfa ile boyanan ışıma gibi kirli bir leke bırakmaz.
    bgTop: mix(theme.to, '#000000', 0.82),
    bgBottom: mix(theme.from, '#000000', 0.94),
  };
  c.panel = panelStyle(theme, custom ?? {}, c.bgTop);
  return {
    scheme,
    accent: scheme.accent,
    c,
    p: { from: theme.from, to: theme.to, accent: scheme.accent },
  };
}

// view: { custom, roleColor, mesajXp, sesXp, mesajRank, sesRank, coins, joinedAt, accountAt, messageCount,
//         voiceSeconds, streamSeconds, rep, streak, visits, punishments: {active,total}, premiumSince,
//         ownedCount, earnedCoins, badges: [rozet], featured: {label,value}|null, links: [metin], frame }
// user: ad/zamir/avatar için discord.js üye ya da kullanıcı nesnesi.
async function buildProfileCard(user, view) {
  const custom = view.custom;
  const theme = resolveTheme(custom, view.roleColor);
  const { scheme, accent, c, p } = paletteOf(theme, custom);

  // Yükseklik çizimden önce bilinmeli: rozet satırları ve ızgarasının satır sayısı kartı uzatır
  const probe = measureCtx();
  const rows = badgeRows(probe, view.badges ?? [], WIDTH - PAD * 2);
  const badgesH = rows.length ? rows.length * BADGE_ROW_H + (rows.length - 1) * BADGE_ROW_GAP : 0;
  const tiles = statTiles(view);
  const tileRows = Math.ceil(tiles.length / TILE_COLS);
  const tilesH = tileRows * TILE_H + (tileRows - 1) * TILE_GAP;

  let y = HEADER + 26;
  const badgesY = y;
  if (rows.length) y += badgesH + GAP;
  const levelsY = y;
  y += LEVEL_H + GAP;
  const tilesY = y;
  y += tilesH + GAP;
  const footY = y;
  const height = footY + FOOT_H + BOTTOM;

  const canvas = canvasLib().createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  // Kartın tamamı yuvarlak köşeli; her şey bu şeklin içine çizilir
  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, height, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, height);
  // Kapak önce çizilir: döndürdüğü alt ton gövdenin ilk rengi olur, böylece ikisi birleşim çizgisinde kesintisiz
  // devam eder. Gövde o tondan tema renginin karanlığına, oradan kartın altında neredeyse siyaha iner.
  const hero = await paintHeader(ctx, user, view, theme, p, c);
  const body = ctx.createLinearGradient(0, HEADER, 0, height);
  body.addColorStop(0, hero.seam);
  body.addColorStop(0.26, c.bgTop);
  body.addColorStop(1, c.bgBottom);
  ctx.fillStyle = body;
  ctx.fillRect(0, HEADER, WIDTH, height - HEADER);
  paintAmbient(ctx, height, p);

  // Avatar kapağın içindeki yerinde çizilir: yazılar ve karartma hazır, halkasının üstüne sadece görsel gelir
  await drawAvatar(ctx, user, hero.avatarX, hero.avatarY, AVATAR, accent);

  if (rows.length) drawBadges(ctx, rows, badgesY);

  // Mesaj ve ses seviye kutuları yan yana, kartın genişliği ikisini birden rahat alır
  const cardW = (WIDTH - PAD * 2 - GAP) / 2;
  levelCard(ctx, PAD, levelsY, cardW, LEVEL_H, 'Mesaj Seviyesi', view.mesajXp, c);
  levelCard(ctx, PAD + cardW + GAP, levelsY, cardW, LEVEL_H, 'Ses Seviyesi', view.sesXp, c);

  // İstatistik ızgarası: altı kutu bir satır, iki satır
  const tileW = (WIDTH - PAD * 2 - TILE_GAP * (TILE_COLS - 1)) / TILE_COLS;
  tiles.forEach((tile, i) => {
    const col = i % TILE_COLS;
    const row = Math.floor(i / TILE_COLS);
    statTile(ctx, PAD + col * (tileW + TILE_GAP), tilesY + row * (TILE_H + TILE_GAP), tileW, tile, c);
  });

  drawFoot(ctx, footY, view, c);

  drawFrame(ctx, height, view.frame, scheme);
  ctx.restore();
  return canvas.toBuffer('image/png');
}

// Kapak düzenleyicisinin önizlemesi: kartın üst alanı tek başına çizilir, böylece büyütme, kaydırma ve yerleşim
// anında görülür. Kimlik bloğu ve etiketler de çizilir; üye karartmanın görselini ne kadar kapladığını burada görür.
async function buildHeaderPreview(user, view, note = null) {
  const theme = resolveTheme(view.custom, view.roleColor);
  const { c, p } = paletteOf(theme, view.custom);
  const canvas = canvasLib().createCanvas(WIDTH, HEADER);
  const ctx = canvas.getContext('2d');

  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, HEADER, 32);
  ctx.clip();
  ctx.fillStyle = c.base;
  ctx.fillRect(0, 0, WIDTH, HEADER);
  const hero = await paintHeader(ctx, user, view, theme, p, c);
  ctx.restore();

  await drawAvatar(ctx, user, hero.avatarX, hero.avatarY, AVATAR, c.accent);

  if (note) {
    ctx.font = font(500, 21);
    const width = ctx.measureText(note).width + 38;
    ctx.fillStyle = 'rgba(10,6,12,0.66)';
    roundRect(ctx, WIDTH - PAD - width, HEADER - 74, width, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(note, WIDTH - PAD - width / 2, HEADER - 41);
  }
  return canvas.toBuffer('image/png');
}

module.exports = { buildProfileCard, buildHeaderPreview, WIDTH, HEADER, PAD, OPACITY_DEFAULT, OPACITY_STEP, clamp };
