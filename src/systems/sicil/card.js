// Sicil kartı: /sicil menüsünün üstünde görünen görsel (PNG, Buffer döner). Üstte avatar ve kullanıcı adı, Genel
// sekmesinde ceza puanı / toplam işlem / yetkili puanı kutuları, Değerlendirmeler sekmesinde ortalama paneli; ortada
// o sayfadaki kayıtların listesi, altta ince bir şeritte sayfa bilgisi. Sekmeler, sayfalar ve detay menüsü mesajın
// bileşenlerinde kalır; kart listedeki bilgilerin görsel özetidir, sayfalama ui.js ile aynı hesapla yapılır.
const { FONT, canvasLib, fitText, roundRect, hexAlpha, mix, makeScheme, drawBackground, drawAvatar } = require('../../core/canvas');
const { pageInfo } = require('../../core/ui');
const { statusLabel, cancelReasonOf } = require('../basvuru/ui');
const { CATEGORIES, categoryOf } = require('../degerlendirme/ui');
const config = require('./config');
const { TYPES, PAGE_SIZE, TABS, dateTime, dateOnly, brief, formatAverage, stateWord, ticketResult } = require('./ui');

const WIDTH = 900;
const PAD = 40;
const THEME = { from: '#2a0d16', to: '#8a2a42', accent: '#e8536f' };

const HEADER_H = 132;
const STATS_H = 84;
const ROW_H = 56;
const ROW_GAP = 10;
const FOOTER_H = 46;

const font = (weight, size) => `${weight} ${size}px ${FONT}`;

// Ceza türlerine göre satır noktası rengi
const TYPE_COLORS = { uyari: '#ffd166', mute: '#38c6e8', jail: '#ff9b5e', ban: '#ff6b6b' };
// Aldığı puana göre değerlendirme satırı rengi
const scoreColor = (score) => (score >= 4 ? '#69db7c' : score >= 3 ? '#ffd166' : '#ff6b6b');
const stateColor = (p, muted) => (p.status === 'active' ? '#ff6b6b' : p.status === 'lifted' ? '#ffd166' : muted);

// Sekmedeki kayıt -> kart satırı
const ROWS = {
  genel: (p, c) => ({
    color: TYPE_COLORS[p.type] ?? c.accent,
    title: `Ceza #${p.number} · ${TYPES[p.type].label}`,
    status: stateWord(p),
    statusColor: stateColor(p, c.muted),
    sub: `${dateTime(p.createdAt)} · ${brief(p.reason)}`,
  }),
  talepler: (t, c) => ({
    color: t.closedAt ? c.muted : '#69db7c',
    title: `Talep #${t.number}`,
    status: ticketResult(t),
    statusColor: t.closedAt ? c.muted : '#69db7c',
    sub: `${dateOnly(t.createdAt)} · ${brief(t.reason)}`,
  }),
  basvurular: (a, c) => ({
    color: c.accent,
    title: `Başvuru #${a.number}`,
    status: statusLabel(a),
    statusColor: c.accent,
    sub: `${dateOnly(a.createdAt)}${cancelReasonOf(a) ? ` · ${brief(cancelReasonOf(a), 60)}` : ''}`,
  }),
  puan: (r, c) => ({
    color: scoreColor(r.score),
    title: `${r.score}/5 · ${categoryOf(r).short}`,
    status: null,
    sub: `${dateOnly(r.ratedAt)}${r.comment ? ` · ${brief(r.comment)}` : ''}`,
  }),
};

// Sağa hizalı, rengi taşandan yuvarlak durum etiketi
function statusPill(ctx, label, color, right, y) {
  ctx.font = font(500, 13);
  const w = ctx.measureText(label).width + 24;
  ctx.fillStyle = hexAlpha(color, 0.16);
  roundRect(ctx, right - w, y, w, 28, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(label, right - w / 2, y + 19);
  ctx.textAlign = 'left';
}

// Bilgi kutusu: sol üstte küçük başlık, altında değer
function infoBox(ctx, x, y, w, label, value, c) {
  ctx.fillStyle = c.panel;
  roundRect(ctx, x, y, w, STATS_H, 16);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 12);
  ctx.fillText(label.toLocaleUpperCase('tr-TR'), x + 20, y + 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 22);
  ctx.fillText(fitText(ctx, value, w - 40), x + 20, y + 58);
}

// Genel sekmesinin kutuları: toplam ceza puanı (aktif kademe etiketiyle), toplam işlem, varsa yetkili puanı
function drawGenelStats(ctx, view, y, c) {
  const points = view.punishments.reduce((sum, p) => sum + (config.penaltyPoints[p.type] ?? 0), 0);
  const tier = [...config.pointTiers].reverse().find((t) => points >= t.points);
  const boxes = [
    ['Toplam Ceza Puanı', tier ? `${points} · ${tier.label}` : String(points)],
    ['Toplam İşlem Sayısı', String(view.givenCount + view.claimedCount)],
  ];
  if (view.showRatings) {
    boxes.push(['Yetkili Puanı', view.ratings.length ? `${formatAverage(view.ratings)} / 5` : '—']);
  }
  const gap = 16;
  const w = (WIDTH - PAD * 2 - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach(([label, value], i) => infoBox(ctx, PAD + i * (w + gap), y, w, label, value, c));
}

// Değerlendirmeler sekmesinin özeti: ortalama, değerlendirme sayısı ve birden fazla kategori varsa kategori ortalamaları
function drawPuanStats(ctx, view, y, c) {
  const { ratings } = view;
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, y, WIDTH - PAD * 2, STATS_H, 16);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 12);
  ctx.fillText('DEĞERLENDİRME ÖZETİ', PAD + 20, y + 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 22);
  ctx.fillText(`Ortalama ${formatAverage(ratings)} / 5`, PAD + 20, y + 58);

  ctx.textAlign = 'right';
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 14);
  ctx.fillText(`${ratings.length} değerlendirme`, WIDTH - PAD - 20, y + 30);
  const keys = Object.keys(CATEGORIES).filter((key) => ratings.some((r) => (r.category ?? 'destek') === key));
  if (keys.length > 1) {
    ctx.font = font(400, 13);
    const detail = keys
      .map((key) => `${CATEGORIES[key].short} ${formatAverage(ratings.filter((r) => (r.category ?? 'destek') === key))}`)
      .join(' · ');
    ctx.fillText(fitText(ctx, detail, WIDTH - PAD * 2 - 260), WIDTH - PAD - 20, y + 56);
  }
  ctx.textAlign = 'left';
}

// Tek kayıt satırı: renkli nokta, başlık, altta soluk özet, sağda durum etiketi
function drawRow(ctx, row, y, c) {
  const w = WIDTH - PAD * 2;
  ctx.fillStyle = c.panel;
  roundRect(ctx, PAD, y, w, ROW_H, 14);
  ctx.fill();
  ctx.fillStyle = row.color;
  ctx.beginPath();
  ctx.arc(PAD + 20, y + ROW_H / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 18);
  ctx.fillText(fitText(ctx, row.title, w - 230), PAD + 40, y + 23);
  ctx.fillStyle = c.muted;
  ctx.font = font(400, 14);
  ctx.fillText(fitText(ctx, row.sub, w - 230), PAD + 40, y + 43);
  if (row.status) statusPill(ctx, row.status, row.statusColor, WIDTH - PAD - 14, y + 14);
}

// view: ui.js sicil() ile aynı; görünen sekme ve sayfa kartta da aynı hesapla bulunur
async function buildSicilCard(user, view) {
  const tabs = Object.keys(TABS).filter((key) => key !== 'puan' || view.showRatings);
  const tab = tabs.includes(view.tab) ? view.tab : 'genel';
  const items = { genel: view.punishments, talepler: view.tickets, basvurular: view.applications, puan: view.ratings }[tab];

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(Math.max(view.page, 0), pageCount - 1);
  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const withStats = tab === 'genel' || (tab === 'puan' && view.ratings.length > 0);
  const withFooter = items.length > 0;
  const rowsH = pageItems.length ? pageItems.length * ROW_H + (pageItems.length - 1) * ROW_GAP : 72;
  const height = HEADER_H + (withStats ? 20 + STATS_H + 24 : 24) + rowsH + 32 + (withFooter ? FOOTER_H : 0);

  const canvas = canvasLib().createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');
  const scheme = makeScheme(THEME);
  const c = {
    accent: scheme.accent,
    muted: scheme.muted,
    panel: mix(THEME.from, '#000000', 0.55),
  };

  ctx.save();
  roundRect(ctx, 0, 0, WIDTH, height, 28);
  ctx.clip();
  drawBackground(ctx, WIDTH, height, scheme, WIDTH - 180, 80);

  await drawAvatar(ctx, user, PAD, 24, 84, scheme.accent);

  // Sağ üstte kimlik rozeti: yetkili cezayı bir komutla ya da kayıt numarasıyla anarken ID'yi karttan okur
  const idText = `ID ${user.id}`;
  ctx.font = font(500, 15);
  const idW = ctx.measureText(idText).width + 30;
  ctx.fillStyle = hexAlpha('#ffffff', 0.12);
  roundRect(ctx, WIDTH - PAD - idW, 40, idW, 34, 17);
  ctx.fill();
  ctx.fillStyle = c.muted;
  ctx.textAlign = 'center';
  ctx.fillText(idText, WIDTH - PAD - idW / 2, 40 + 22);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(700, 32);
  ctx.fillText(fitText(ctx, user.globalName ?? user.username, WIDTH - PAD - idW - 16 - (PAD + 84 + 24)), PAD + 84 + 24, 24 + 38);
  ctx.fillStyle = c.muted;
  ctx.font = font(500, 17);
  ctx.fillText(`Kullanıcı Sicili · ${TABS[tab]}`, PAD + 84 + 24, 24 + 70);

  let y = HEADER_H + 20;
  if (tab === 'genel') {
    drawGenelStats(ctx, view, y, c);
    y += STATS_H + 24;
  } else if (tab === 'puan' && view.ratings.length) {
    drawPuanStats(ctx, view, y, c);
    y += STATS_H + 24;
  }

  if (!pageItems.length) {
    ctx.fillStyle = c.panel;
    roundRect(ctx, PAD, y, WIDTH - PAD * 2, rowsH, 14);
    ctx.fill();
    ctx.fillStyle = c.muted;
    ctx.font = font(400, 16);
    ctx.textAlign = 'center';
    ctx.fillText('Bu bölümde gösterilecek kayıt yok.', WIDTH / 2, y + rowsH / 2 + 6);
    ctx.textAlign = 'left';
  } else {
    const rowOf = ROWS[tab];
    pageItems.forEach((item, i) => drawRow(ctx, rowOf(item, c), y + i * (ROW_H + ROW_GAP), c));
  }

  // Sayfa bilgisi kartın alt şeridinde: ince çizgi üstünde ortalı soluk yazı
  y += rowsH;
  if (withFooter) {
    ctx.strokeStyle = hexAlpha('#ffffff', 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y + 12);
    ctx.lineTo(WIDTH - PAD, y + 12);
    ctx.stroke();
    ctx.fillStyle = c.muted;
    ctx.font = font(500, 14);
    ctx.textAlign = 'center';
    ctx.fillText(pageInfo(page, pageCount, items.length), WIDTH / 2, y + 36);
    ctx.textAlign = 'left';
  }

  ctx.restore();
  return canvas.toBuffer('image/png');
}

module.exports = { buildSicilCard };
