// Güvenilir partnerler kanalındaki panelin üstündeki çizim kartı: sayfadaki sunucu satırları, yetkili sayısı,
// müsaitlik durumu ve sayfa bilgisi. Mesaj liste değişince düzenlendiği için kartın dosya adı her çizimde eşsiz
// verilir; aynı adla yüklenen yeni görsel Discord'da eski görseli güncellemeyebiliyor.
const {
  WIDTH,
  ROW_H,
  ROW_GAP,
  createCard,
  listHeight,
  drawHeading,
  drawRow,
  drawEmpty,
  drawFooter,
} = require('../../core/card');
const { isBusy, PANEL_PAGE_SIZE } = require('./ui');

const THEME = { from: '#0c1f17', to: '#14532d', accent: '#4ade80' };
const BUSY_COLOR = '#fbbf24';

const SUB = 'Sürekli partner olduğumuz güvenilir sunucular ve yetkilileri bu kartta listelenir.';

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Istanbul' });
const fmtDate = (ts) => dateFmt.format(new Date(Number(ts) || Date.now()));

// entries: tüm güvenilir kayıtlar (sayfalama kartın içinde yapılır), name: bu çizime özel dosya adı
function buildTrustedCard(entries, page, name) {
  const pageCount = Math.max(1, Math.ceil(entries.length / PANEL_PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const shown = entries.slice(current * PANEL_PAGE_SIZE, (current + 1) * PANEL_PAGE_SIZE);

  const { canvas, ctx, scheme, c } = createCard(WIDTH, listHeight(SUB, Math.max(1, shown.length)), THEME);
  let y = drawHeading(ctx, 'Güvenilir Partnerler', SUB, WIDTH, c);
  for (const entry of shown) {
    const busy = isBusy(entry);
    const contacts = entry.contactIds?.length ?? 0;
    drawRow(
      ctx,
      {
        color: busy ? BUSY_COLOR : scheme.accent,
        title: `Sunucu ${entry.serverId ?? 'bilinmiyor'}`,
        sub: `Eklenme ${fmtDate(entry.addedAt)} · Partner yetkilisi: ${contacts ? `${contacts} kişi` : 'bilinmiyor'}`,
        status: busy ? 'Meşgul' : 'Müsait',
        statusColor: busy ? BUSY_COLOR : scheme.accent,
      },
      y,
      WIDTH,
      c,
    );
    y += ROW_H + ROW_GAP;
  }
  if (!shown.length) {
    drawEmpty(ctx, 'Henüz güvenilir listeye eklenmiş bir partner yok.', y, WIDTH, c);
    y += ROW_H + ROW_GAP;
  }
  drawFooter(ctx, `Sayfa ${current + 1} / ${pageCount} · ${entries.length} sunucu`, y, WIDTH, c);

  return { name, buffer: canvas.toBuffer('image/png') };
}

module.exports = { buildTrustedCard };
