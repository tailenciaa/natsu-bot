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

// Anahtarlar YYYY-AA-GG biçiminde olduğu için sözlük sırası tarih sırasıdır: "<" karşılaştırması "daha eski hafta" demektir.
// Duyurulmamış, bitişi görülmüş haftalar: kaydı olan (keys), içinde bulunulan haftadan eski ve son duyurulandan yeni
// anahtarlar. Uzun süre kapalı kalan bot eskileri yakalayıp kanalı doldurmasın diye en fazla `limit` tanesi,
// eskiden yeniye döner (rol devri doğru sırayla ilerlesin).
function pendingWeeks(keys, lastRun, limit = 2) {
  const current = weekKey();
  const done = [...new Set(keys)]
    .filter((week) => week < current && (!lastRun || week > lastRun))
    .sort();
  return done.slice(-limit);
}

// İstanbul saatine göre bugün pazartesi mi
const isMonday = (ms = Date.now()) =>
  new Date(ms).toLocaleDateString('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }) === 'Mon';

module.exports = { weekKey, previousWeekKey, pendingWeeks, isMonday };
