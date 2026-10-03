// İstanbul takvimine göre hafta anahtarı hesaplamaları: her hafta, o haftanın pazartesi tarihiyle (YYYY-AA-GG) anılır
const dayKey = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

function weekKey(ms = Date.now()) {
  const d = new Date(`${dayKey(ms)}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

// Bugünden bir önceki haftanın anahtarı; pazartesi günü duyurulacak "geçen hafta" budur
const previousWeekKey = (ms = Date.now()) => weekKey(ms - 7 * 24 * 60 * 60 * 1000);

// İstanbul saatine göre bugün pazartesi mi
const isMonday = (ms = Date.now()) =>
  new Date(ms).toLocaleDateString('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }) === 'Mon';

module.exports = { weekKey, previousWeekKey, isMonday };
