// Profil kartı: üyenin profili tek geniş bir görselde toplanır (PNG, Buffer döner). Kapağın içinde avatar, ad,
// unvan ve sıralama/coin etiketleri; gövdede tek büyük **puan bandı** (profil puanı, rütbe ilerlemesi ve puanın
// hangi bölümlerden geldiği), sekiz sütunluk çıplak sayı şeridi, rozet şeridi ve biyografi + vitrin şeridi çizilir.
// Kutu kalabalığı bilinçli olarak kaldırıldı: eskiden on dört panel üst üste bindiği için her şey iç içe
// görünüyordu. Şimdi gövdede yalnızca iki panel (puan bandı ve alt şerit) var; sayılar panel kutusu olmadan,
// bol boşlukla çiziliyor. Coin ve kozmetik temalar ayrı panel değil, kapaktaki etiket ve puan bandındaki hücre.
// Paneller temaya göre düz opak ya da yarı saydam "buzlu cam" olarak çizilir; cam temalarda saydamlığı üye kendisi
// ayarlar (custom.glassOpacity). Kapak görseli büyütülüp dört yöne kaydırılabilir (bannerZoom / bannerX / bannerY)
// ve "banner" ya da "sığdır" yerleşiminden biriyle oturtulur (bannerFit; boşsa banner'dır: görsel kapağın tamamını
// doldurur, kırpılan şeridi görselden seçilir). Çerçeveler kartın kenarına çizilir, yazılar
// assets/fonts altındaki Poppins ile çizilir.
//
// Kart bilinçli olarak enlemesine geniş ve az bantlı: Discord sohbetteki görseli yüksekliğinden kıptığı için,
// aynı içeriği daha az dikey banda yaymak kartı sohbette belirgin biçimde büyütür. Bu yüzden kimlik bloğu
// kapağın içine taşındı (ayrı bir isim bandı yok) ve alt bilgiler tek şeritte toplandı.
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
const { levelFromXp } = require('../seviye/level');
const { coverOf, drawCover } = require('./kapak');
const { resolveTheme } = require('./themes');

const WIDTH = 1800;
const PAD = 60;
const HEADER = 380; // kapak: kimlik bloğu da burada çizildiği için geniş tutulur
const AVATAR = 176;
const BADGE_ROW_H = 40;
const BADGE_GAP = 12;
const BADGE_ROW_GAP = 14;
const BADGE_ROWS_MAX = 2;
const SKOR_H = 210;
const STRIP_H = 104;
const FOOT_H = 118;
const GAP = 22;
const HEADER_GAP = 28;
const BOTTOM = 44;

// Kapağın altındaki karartmanın yüksekliği: yazıların okunduğu bant, görselin geri kalanı açık kalır
const SCRIM_H = 250;

// Saydamlık ayarının aralığı: 0 koyu (belirgin) panel, 100 neredeyse görünmez panel. Varsayılan bugünkü görünüm.
const OPACITY_DEFAULT = 50;
const OPACITY_STEP = 10;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;
const number = (n) => Number(n).toLocaleString('tr-TR');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Bir tarihten bugüne geçen süre "3 yıl 2 ay" gibi kısa yazılır: kartın "Sunucuda" sütununda kullanılır
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

// Kapağın hangi şeridi göreceği: kaplama kırpıldığında dışarıda kalan bant seçilirken fotoğrafın kendisi
// ölçülür ve en kontrastlı (en "kalabalık") şerit bulunur. Telefonla çekilmiş dik bir fotoğrafta özne tek bir
// yatay şeritte durur; kadrajın ortasını almak yerine o şeridi almak kapağı düzgün gösterir. Eşit kontrastlarda
// merkeze yakın şerit yeğlenir. Dönen değer -1..1 arası kaydırma; görsel o eksende kırpılmıyorsa 0.
function focusPan(image) {
  const scale = Math.max(WIDTH / image.width, HEADER / image.height);
  const drawnW = image.width * scale;
  const drawnH = image.height * scale;
  const axis = drawnH > HEADER + 1 ? 'y' : drawnW > WIDTH + 1 ? 'x' : null;
  if (!axis) return { x: 0, y: 0 };

  try {
    const cols = 40;
    const rows = clamp(Math.round((image.height / image.width) * cols), 8, 120);
    const probe = canvasLib().createCanvas(cols, rows);
    const pctx = probe.getContext('2d');
    pctx.drawImage(image, 0, 0, cols, rows);
    const { data } = pctx.getImageData(0, 0, cols, rows);
    const lum = (c, r) => {
      const i = (r * cols + c) * 4;
      return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    };

    const n = axis === 'y' ? rows : cols;
    const band = clamp(Math.round((n * (axis === 'y' ? HEADER : WIDTH)) / (axis === 'y' ? drawnH : drawnW)), 2, n);
    let best = 0;
    let bestScore = -1;
    for (let start = 0; start + band <= n; start += 1) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      for (let i = start; i < start + band; i += 1) {
        for (let j = 0; j < (axis === 'y' ? cols : rows); j += 1) {
          const v = axis === 'y' ? lum(j, i) : lum(i, j);
          sum += v;
          sumSq += v * v;
          count += 1;
        }
      }
      const mean = sum / count;
      const centreBias = 1 - (Math.abs((start + band / 2) / n - 0.5) * 0.6);
      const score = (sumSq / count - mean * mean) * centreBias;
      if (score > bestScore) {
        bestScore = score;
        best = start;
      }
    }
    const pan = n > band ? (best / (n - band)) * 2 - 1 : 0;
    return axis === 'y' ? { x: 0, y: pan } : { x: pan, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

// Kapağın yerleşimi iki durumdan biridir. "banner" (varsayılan) görseli kapağın tamamına yayar: alanı
// dolduracak ölçek, otomatik odak şeridi ve üyenin kendi kaydırması birlikte uygulanır; kapak her zaman
// baştan başa fotoğraftır. "sığdır" görselin tamamını gösterirken kenarlarda kalan yeri aynı fotoğrafın
// koyulaştırılmış hâliyle doldurur. Dönen değer: görsel çizildi mi (false ise tema efekti çizilmiş olur).
async function drawBanner(ctx, custom) {
  let image;
  try {
    image = await loadImageSafe(custom.banner);
  } catch (err) {
    console.error('[profil] Kapak görseli yüklenemedi:', err.message);
    return false;
  }

  const coverScale = Math.max(WIDTH / image.width, HEADER / image.height);

  if (custom.bannerFit !== 'sigdir') {
    const zoom = clamp(Number(custom.bannerZoom) || 1, 1, 3);
    const focus = focusPan(image);
    const scale = coverScale * zoom;
    const w = image.width * scale;
    const h = image.height * scale;
    const roomX = (w - WIDTH) / 2;
    const roomY = (h - HEADER) / 2;
    // Üyenin kaydırması otomatik odağın üstüne biner: 0 bırakıldığında kadrajı bot seçer
    const panX = clamp(focus.x + clamp(Number(custom.bannerX) || 0, -1, 1), -1, 1);
    const panY = clamp(focus.y + clamp(Number(custom.bannerY) || 0, -1, 1), -1, 1);
    ctx.drawImage(image, (WIDTH - w) / 2 + panX * roomX, (HEADER - h) / 2 + panY * roomY, w, h);
    return true;
  }

  // Sığdır: görselin tamamı görünür ama boşluk tema efektiyle dolmaz — kapağın geri kalanı aynı fotoğrafın
  // alanı dolduran, koyulaştırılmış hâlidir. Görsel çerçeveli bir kutu gibi ortada durmaz, kapak baştan başa
  // uzar; ortadaki net dilimin kenarları da fona doğru karartılarak iki katman birbirine karıştırılır.
  const fw = image.width * coverScale;
  const fh = image.height * coverScale;
  ctx.drawImage(image, (WIDTH - fw) / 2, (HEADER - fh) / 2, fw, fh);
  ctx.fillStyle = 'rgba(8,5,10,0.66)';
  ctx.fillRect(0, 0, WIDTH, HEADER);

  const scale = Math.min(WIDTH / image.width, HEADER / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const x = (WIDTH - w) / 2;
  const y = (HEADER - h) / 2;
  ctx.drawImage(image, x, y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const feather = Math.min(w / 2, 260);
  const blend = ctx.createLinearGradient(x, 0, x + w, 0);
  const dark = 'rgba(8,5,10,0.72)';
  blend.addColorStop(0, dark);
  blend.addColorStop(feather / w, 'rgba(8,5,10,0)');
  blend.addColorStop(1 - feather / w, 'rgba(8,5,10,0)');
  blend.addColorStop(1, dark);
  ctx.fillStyle = blend;
  ctx.fillRect(x, y, w, h);
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

// Kapağın alt bandındaki karartma: sol alt köşeden yayılan ışınsal bir karartı kimlik yazılarını tutar. Köşeden
// yayıldığı için dikdörtgen bandın kenar çizgisi oluşmaz, görselin üst ve sağ bölümü olduğu gibi kalır. Güç,
// bölgenin ölçülen parlaklığına göre ayarlanır; parlak fotoğrafta koyulaşır, koyu fotoğrafta inceltir.
function drawHeroScrim(ctx) {
  const tone = avgTone(ctx, 0, HEADER - SCRIM_H, Math.round(WIDTH * 0.6), SCRIM_H);
  const strength = clamp(0.3 + (tone ? luminance(tone) : 0.35) * 0.5, 0.3, 0.78);
  const a = (k) => `rgba(6,4,8,${(strength * k).toFixed(3)})`;
  const glow = ctx.createRadialGradient(0, HEADER, 0, 0, HEADER, Math.round(WIDTH * 0.78));
  glow.addColorStop(0, a(1));
  glow.addColorStop(0.45, a(0.82));
  glow.addColorStop(0.75, a(0.35));
  glow.addColorStop(1, 'rgba(6,4,8,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEADER);
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
  if (!custom.banner || !(await drawBanner(ctx, custom))) {
    drawCover(ctx, coverOf(custom.cover).effect ?? theme.effect, { x: 0, y: 0, w: WIDTH, h: HEADER }, p);
  }

  // Sağ üst: sıralama etiketleri ve altında coin bakiyesi
  const rankColor = 'rgba(10,6,12,0.58)';
  let right = WIDTH - PAD;
  right -= pill(ctx, `Ses  ${view.sesRank ? `#${view.sesRank}` : '-'}`, right, 28, rankColor) + 12;
  pill(ctx, `Mesaj  ${view.mesajRank ? `#${view.mesajRank}` : '-'}`, right, 28, rankColor);
  pill(ctx, `${number(view.coins ?? 0)} coin`, WIDTH - PAD, 92, c.accent, '#120a10', null);

  // Evlilik bandı: kalp simgeli etiket coinin altında durur, birlikte geçen günle birlikte okunur. Boşanma
  // kaydı götürdüğü için etiket kendiliğinden kalkar; hiç evlenmemiş üyede satır doğmaz.
  if (view.evlilik) {
    const ad = view.evlilik.es ? `Eş: ${view.evlilik.es}` : 'Evli';
    ctx.font = font(500, 24);
    const yazi = fitText(ctx, view.evlilik.gun ? `${ad} · ${number(view.evlilik.gun)} gün` : ad, 520);
    pill(ctx, yazi, WIDTH - PAD, 156, 'rgba(10,6,12,0.58)', '#ffd9e5', hexAlpha('#ff6b9a', 0.6), 'kalp', '#ff6b9a');
  }

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
  ctx.font = font(700, 56);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, textMax), textX, HEADER - 126);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 27);
  ctx.fillText(fitText(ctx, `@${user.username}${custom.pronoun ? ` · ${custom.pronoun}` : ''}`, textMax), textX, HEADER - 88);
  if (custom.title) {
    ctx.font = font(500, 24);
    const width = ctx.measureText(custom.title).width + 44;
    ctx.fillStyle = hexAlpha(c.accent, 0.24);
    roundRect(ctx, textX, HEADER - 76, width, 44, 22);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexAlpha(c.accent, 0.55);
    roundRect(ctx, textX + 0.5, HEADER - 75.5, width - 1, 43, 21.5);
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.fillText(custom.title, textX + 22, HEADER - 45);
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

// Yuvarlak köşeli küçük etiket (rank, coin, evlilik); genişliğini yazıya göre ayarlar ve (sağ kenar hizalı) çizer.
// `icon` verilirse simge metnin soluna, kendi renkleriyle oturur ve metin kalan alanda ortalanır.
function pill(ctx, text, right, y, color, textColor = '#ffffff', border = 'rgba(255,255,255,0.18)', icon = null, iconColor = textColor) {
  ctx.font = font(500, 24);
  const alan = icon ? 30 : 0;
  const width = ctx.measureText(text).width + 44 + alan;
  const x = right - width;
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, 52, 26);
  ctx.fill();
  if (border) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    roundRect(ctx, x + 0.5, y + 0.5, width - 1, 51, 25.5);
    ctx.stroke();
  }
  if (icon) drawIcon(ctx, icon, x + 26, y + 25, 10, iconColor);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(text, x + alan / 2 + width / 2, y + 35);
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
  ctx.font = font(500, 21);
  const items = badges.map((b) => {
    const textWidth = Math.round(ctx.measureText(b.label).width);
    return { ...b, w: textWidth + (b.icon ? 74 : 50), textWidth };
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

      const iconX = b.icon ? x + 27 : x + 21;
      drawIcon(ctx, b.icon, iconX, ry + BADGE_ROW_H / 2, b.icon ? 11 : 6, b.color);
      ctx.fillStyle = mix(b.color, '#ffffff', 0.3);
      ctx.font = font(500, 21);
      ctx.textAlign = 'left';
      ctx.fillText(b.label, x + (b.icon ? 46 : 36), ry + 29);
      x += b.w + BADGE_GAP;
    }
  });
}

// Puan bandının sağındaki hücreler: puanın bölümlere göre dağılımı. Skor.js tek kaynaktır; burada yalnızca
// biçimlendirilir. Bölüm sayısı sekiz olduğu için hücreler tam dört sütunluk iki satıra oturur; üyenin sırası
// hücre olarak yinelenmez, bandın solundaki etiketin yanında yazılır.
function skorCells(view) {
  return view.score.parts.map((part) => ({ label: part.label, value: number(part.points), note: `/ ${part.max}` }));
}

// Puan bandı: kartın manşeti. Solda toplam puan ve rütbenin ilerleme çubuğu, sağda puanın hangi bölümden kaç
// puan geldiği durur. Hücreler ayrı kutu çizilmez, boşlukla ayrılır; bandın tek paneli kartın nefesini bozmaz.
function drawSkor(ctx, y, view, c) {
  const s = view.score;
  const inner = PAD + 36;
  const barW = 496;
  glass(ctx, PAD, y, WIDTH - PAD * 2, SKOR_H, 26, c);

  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(700, 18);
  const etiket = 'PROFİL PUANI';
  ctx.fillText(etiket, inner, y + 44);
  // Sıra burada yazılır: hücrelere çıkarsa bölüm sayısıyla çakışır ve aynı bilgi iki kez görünür
  const etiketW = ctx.measureText(etiket).width;
  ctx.font = font(500, 18);
  ctx.fillText(
    view.scoreRank ? `${number(view.scoreRank)}. sıra / ${number(view.scoreSize)} üye` : 'sıra henüz hesaplanmadı',
    inner + etiketW + 16,
    y + 44,
  );

  const big = number(s.total);
  ctx.font = font(700, 86);
  const bigW = ctx.measureText(big).width;
  ctx.fillStyle = s.next ? '#ffffff' : c.accent;
  ctx.fillText(big, inner, y + 124);
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 26);
  ctx.fillText(`/ ${s.max}`, inner + bigW + 14, y + 124);

  const line = s.next ? `${s.tier.label} · ${s.next.label} için ${number(s.next.remaining)} puan` : `${s.tier.label} · en yüksek rütbe`;
  ctx.font = font(500, 25);
  ctx.fillStyle = c.muted;
  ctx.fillText(fitText(ctx, line, barW), inner, y + 158);
  drawBar(ctx, inner, y + 174, barW, 12, s.next ? s.next.ratio : 1, c.accent, c.track);

  const cells = skorCells(view);
  const areaX = inner + barW + 76;
  const colW = (WIDTH - PAD - 34 - areaX) / 4;
  cells.forEach((cell, i) => {
    const x = areaX + (i % 4) * colW;
    const top = y + 30 + Math.floor(i / 4) * 88;
    ctx.fillStyle = c.muted;
    ctx.font = font(700, 16);
    ctx.fillText(fitText(ctx, cell.label.toLocaleUpperCase('tr-TR'), colW - 24), x, top + 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(700, 33);
    const valueW = ctx.measureText(cell.value).width;
    ctx.fillText(cell.value, x, top + 58);
    ctx.fillStyle = c.muted;
    ctx.font = font(500, 18);
    ctx.fillText(fitText(ctx, cell.note, colW - 34 - valueW), x + valueW + 10, top + 58);
  });
}

// Şerit sütunu tek bir birim yazsın: saat dolan süre "sa", altında "dk" olarak; ayrıntı /siralama'da.
function shortDuration(seconds) {
  const minutes = Math.floor((seconds ?? 0) / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${number(hours)} sa` : `${minutes} dk`;
}

// Sayı şeridi: kutusuz sütunlar. Eskiden on iki kutuluk bir ızgaraydı; aynı bilgilerin en çok bakılanları şimdi
// panel çizgisi olmadan, bol boşlukla tek satırda duruyor. Geri kalan ayrıntı puan sayfasında.
function stripItems(view) {
  const sicil = view.punishments;
  return [
    { label: 'Mesaj Seviyesi', value: String(levelFromXp(view.mesajXp ?? 0)) },
    { label: 'Ses Seviyesi', value: String(levelFromXp(view.sesXp ?? 0)) },
    { label: 'Mesaj', value: number(view.messageCount ?? 0) },
    { label: 'Ses Süresi', value: shortDuration(view.voiceSeconds) },
    { label: 'Yayın', value: view.streamSeconds >= 60 ? shortDuration(view.streamSeconds) : '-' },
    { label: 'Ziyaret', value: number(view.visits ?? 0) },
    { label: 'Sicil', value: sicil ? (sicil.active ? `${sicil.active} aktif` : 'Temiz') : '-' },
    { label: 'Sunucuda', value: view.joinedAt ? age(view.joinedAt) : '-' },
  ];
}

function drawStrip(ctx, y, view, c) {
  const items = stripItems(view);
  const colW = (WIDTH - PAD * 2) / items.length;
  ctx.textAlign = 'left';
  items.forEach((item, i) => {
    const x = PAD + i * colW + 18;
    if (i) {
      ctx.fillStyle = hexAlpha(c.accent, 0.2);
      roundRect(ctx, PAD + i * colW - 1.5, y + 16, 3, STRIP_H - 44, 2);
      ctx.fill();
    }
    ctx.fillStyle = c.muted;
    ctx.font = font(700, 16);
    ctx.fillText(fitText(ctx, item.label.toLocaleUpperCase('tr-TR'), colW - 40), x, y + 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(700, 36);
    ctx.fillText(fitText(ctx, item.value, colW - 40), x, y + 76);
  });
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
    ctx.font = font(400, 27);
    wrapLines(ctx, custom.bio, bioW - 72, 2).forEach((line, i) => ctx.fillText(line, PAD + 30, y + 50 + i * 38));
  } else {
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 26);
    ctx.fillText('Henüz bir biyografi eklenmemiş.', PAD + 30, y + 70);
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
    ctx.font = font(700, 17);
    ctx.fillText(view.featured.label.toLocaleUpperCase('tr-TR'), x + 30, y + 34);
    ctx.fillStyle = c.accent;
    ctx.font = font(700, 36);
    ctx.fillText(fitText(ctx, view.featured.value, vitrinW - 60), x + 30, y + 74);
  }
  if (view.links?.length) {
    ctx.fillStyle = '#efe6ea';
    ctx.font = font(500, 21);
    ctx.fillText(fitText(ctx, view.links.join('   ·   '), vitrinW - 60), x + 30, y + (view.featured ? 102 : 66));
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
//         ownedCount, earnedCoins, badges: [rozet], featured: {label,value}|null, links: [metin], frame,
//         score: {total,max,tier,next,parts}, scoreRank, scoreSize }
// user: ad/zamir/avatar için discord.js üye ya da kullanıcı nesnesi.
async function buildProfileCard(user, view) {
  const custom = view.custom;
  const theme = resolveTheme(custom, view.roleColor);
  const { scheme, accent, c, p } = paletteOf(theme, custom);

  // Yükseklik çizimden önce bilinmeli: rozet satırları kartı uzatır
  const probe = measureCtx();
  const rows = badgeRows(probe, view.badges ?? [], WIDTH - PAD * 2);
  const badgesH = rows.length ? rows.length * BADGE_ROW_H + (rows.length - 1) * BADGE_ROW_GAP : 0;

  let y = HEADER + HEADER_GAP;
  const skorY = y;
  y += SKOR_H + GAP;
  const stripY = y;
  y += STRIP_H + GAP;
  const badgesY = y;
  if (rows.length) y += badgesH + GAP;
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

  // Gövde dört alandan oluşur: puan bandı, sayı şeridi, rozet şeridi ve alt şerit
  drawSkor(ctx, skorY, view, c);
  drawStrip(ctx, stripY, view, c);

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
