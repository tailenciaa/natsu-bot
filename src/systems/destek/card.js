// Durum kanalındaki "Açık Destek Talepleri" panelinin çizim kartı: başlık, sayfadaki talep satırları
// (numara, talep sahibi, konu, üstlenme durumu) ve altta sayfa bilgisi. Mesaj her değişimde yeniden
// çizildiği için kart dosya adı her seferinde eşsiz verilir; aynı adla yüklenen yeni görsel Discord'da
// eski görseli güncellemeyebiliyor.
const { WIDTH, ROW_H, ROW_GAP, createCard, listHeight, drawHeading, drawRow, drawEmpty, drawFooter } = require('../../core/card');
const { pad } = require('../../core/ui');
const { STATUS_TITLE, STATUS_SUB, statusPage, ticketState } = require('./ui');

const THEME = { from: '#0e1a2b', to: '#155e75', accent: '#38bdf8' };
const WAIT_COLOR = '#fbbf24';

// tickets: tüm açık talepler (sayfalama kartın içinde yapılır), name: bu çizime özel dosya adı,
// nameOf: görünecek sayfadaki üyelerin adlarını veren eşleştirici (çözülemeyen için null)
function buildStatusCard(tickets, page, name, nameOf) {
  const { current, pageCount, shown } = statusPage(tickets, page);
  const rows = shown.map((t) => {
    const state = ticketState(t);
    const color = state.tone === 'claim' ? THEME.accent : WAIT_COLOR;
    return {
      color,
      title: `#${pad(t.number)} · ${nameOf(t.ownerId) ?? 'bilinmiyor'}`,
      sub: `Konu: ${t.reason}`,
      status: state.pill,
      statusColor: color,
    };
  });

  const { canvas, ctx, c } = createCard(WIDTH, listHeight(STATUS_SUB, Math.max(1, rows.length)), THEME);
  let y = drawHeading(ctx, STATUS_TITLE, STATUS_SUB, WIDTH, c);
  for (const row of rows) {
    drawRow(ctx, row, y, WIDTH, c);
    y += ROW_H + ROW_GAP;
  }
  if (!rows.length) {
    drawEmpty(ctx, 'Şu an açık destek talebi yok.', y, WIDTH, c);
    y += ROW_H + ROW_GAP;
  }
  drawFooter(ctx, `Sayfa ${current + 1} / ${pageCount} · ${tickets.length} açık talep`, y, WIDTH, c);

  return { name, buffer: canvas.toBuffer('image/png') };
}

module.exports = { buildStatusCard };
