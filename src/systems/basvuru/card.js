// Başvuru (yetkili alım) panelinin üstündeki çizim kartı: başlık, başvuru sürecinin adımları ve uyarı notu.
// İçeriği sabit olduğu için her çizimde aynı görsel üretilir; panel (core/panel.js) içerik değişmedikçe mesajı yenilemez.
const {
  WIDTH,
  ROW_H,
  ROW_GAP,
  FOOTER_H,
  font,
  createCard,
  measureCtx,
  drawHeading,
  drawRow,
  drawFooter,
} = require('../../core/card');
const { wrapLines } = require('../../core/canvas');
const config = require('./config');

const CARD_NAME = 'basvuru-panel.png';
const THEME = { from: '#1a1030', to: '#5b21b6', accent: '#a78bfa' };

const SUB =
  'Yetkili ekibine katılmak için Başvur butonuyla başvuru formunu doldur. Başvurun yetkililer tarafından dikkatle incelenir ve sonuç sana DM üzerinden iletilir.';

const STEPS = [
  { title: '1 · Başvur', sub: 'Formu doldur; inceleme bitince sonuç DM kutuna gelir.' },
  { title: '2 · Görüşme', sub: 'Uygun görülürsen yetkili alım ekibiyle sesli görüşme yapılır.' },
  { title: '3 · Oryantasyon', sub: 'Onaylanırsan oryantasyonu tamamlayıp göreve başlarsın.' },
];

const plain = (value) => String(value).replace(/\*\*/g, '');

// Panel kartının PNG'sini üretir; syncPanel'e {name, buffer} olarak verilir
async function buildPanelCard() {
  const measure = measureCtx();
  measure.font = font(400, 16);
  const subLines = wrapLines(measure, SUB, WIDTH - 80, 2).length;
  const headingBottom = 48 + 34 + (subLines - 1) * 24 + 20;
  const rowsH = STEPS.length * ROW_H + (STEPS.length - 1) * ROW_GAP;
  const height = headingBottom + rowsH + 24 + FOOTER_H;

  const { canvas, ctx, scheme, c } = createCard(WIDTH, height, THEME);
  let y = drawHeading(ctx, config.panel.title, SUB, WIDTH, c);
  STEPS.forEach((step, i) => {
    drawRow(ctx, { color: scheme.accent, ...step }, y, WIDTH, c);
    y += ROW_H + ROW_GAP;
  });
  drawFooter(ctx, plain(config.panel.footer), y, WIDTH, c);

  return { name: CARD_NAME, buffer: canvas.toBuffer('image/png') };
}

module.exports = { buildPanelCard };
