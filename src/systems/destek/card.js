// Destek panelinin üstündeki çizim kartı: başlık, sistemin nasıl işlediği adımları ve uyarı notu.
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

const CARD_NAME = 'destek-panel.png';
const THEME = { from: '#0e1a2b', to: '#155e75', accent: '#38bdf8' };

const SUB =
  'Talep Oluştur butonuyla destek talebi açabilirsin. Bir sorunla karşılaştığında ya da yardıma ihtiyaç duyduğunda talebini yaz; destek ekibimiz inceleyip en kısa sürede seninle ilgilenir.';

const STEPS = [
  { title: '1 · Talep Oluştur', sub: 'Butona bas, sorununu kısaca ve net şekilde anlat.' },
  { title: '2 · Yetkili Üstlensin', sub: 'Destek ekibi talebini inceler ve bu kanalda seninle ilgilenir.' },
  { title: '3 · Çözüm ve Puanlama', sub: 'Talep kapanınca deneyimini yıldızlayıp yorum bırakabilirsin.' },
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
