// Durum kanalındaki "Bekleyen Başvurular" panelinin çizim kartı: başlık, sayfadaki başvuru satırları
// (numara, başvuran, ilgilenen yetkili, aşama) ve altta sayfa bilgisi. Mesaj her güncellemede yeniden
// çizildiği için kart dosya adı eşsiz verilir; aynı adla yüklenen yeni görsel Discord'da eski görseli
// güncellemeyebiliyor.
const { WIDTH, ROW_H, ROW_GAP, createCard, listHeight, drawHeading, drawRow, drawEmpty, drawFooter } = require('../../core/card');
const { pad } = require('../../core/ui');
const { STATUS_TITLE, STATUS_SUB, statusPage, statusState } = require('./ui');

const THEME = { from: '#1a1030', to: '#5b21b6', accent: '#a78bfa' };
const WAIT_COLOR = '#fbbf24';

// apps: bekleyen tüm başvurular (sayfalama kartın içinde yapılır), name: bu çizime özel dosya adı,
// nameOf: görünecek sayfadaki yetkililerin adlarını veren eşleştirici (çözülemeyen için null)
function buildStatusCard(apps, page, name, nameOf) {
  const { current, pageCount, shown } = statusPage(apps, page);
  const rows = shown.map((app) => {
    const state = statusState(app);
    const color = state.tone === 'busy' ? THEME.accent : WAIT_COLOR;
    return {
      color,
      title: `#${pad(app.number)} · ${app.username}`,
      sub: state.staffId ? `İlgilenen yetkili: ${nameOf(state.staffId) ?? 'bilinmiyor'}` : 'Henüz bir yetkili üstlenmedi',
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
    drawEmpty(ctx, 'Şu an incelenmeyi bekleyen başvuru yok.', y, WIDTH, c);
    y += ROW_H + ROW_GAP;
  }
  drawFooter(ctx, `Sayfa ${current + 1} / ${pageCount} · ${apps.length} bekleyen başvuru`, y, WIDTH, c);

  return { name, buffer: canvas.toBuffer('image/png') };
}

module.exports = { buildStatusCard };
