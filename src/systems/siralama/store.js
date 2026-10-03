// Sıralama verileri: stats.messages ve stats.voice, kullanıcı ID'si -> gün (YYYY-AA-GG, İstanbul saati) -> değer.
// Mesajlar adet, ses saniye olarak tutulur. Her mesajda diske yazmamak için değişiklikler biriktirilip toplu kaydedilir.
const { data, save } = require('../../core/db');

data.stats ??= {};
data.stats.messages ??= {};
data.stats.voice ??= {};

const SAVE_DELAY = 10 * 1000;
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, SAVE_DELAY);
  saveTimer.unref();
}

// Bot kapanırken bekleyen değişiklikler kaybolmasın
function flush() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  save();
}

const dayKey = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

function add(kind, userId, amount, at = Date.now()) {
  if (!(amount > 0)) return;
  const days = (data.stats[kind][userId] ??= {});
  const key = dayKey(at);
  days[key] = (days[key] ?? 0) + amount;
  scheduleSave();
}

// Kullanıcıların toplamı; days verilirse sadece son o kadar gün (bugün dahil)
function totals(kind, days) {
  const from = days ? dayKey(Date.now() - (days - 1) * 24 * 60 * 60 * 1000) : null;
  const result = new Map();
  for (const [userId, byDay] of Object.entries(data.stats[kind])) {
    let sum = 0;
    for (const [key, value] of Object.entries(byDay)) if (!from || key >= from) sum += value;
    if (sum > 0) result.set(userId, sum);
  }
  return result;
}

module.exports = { add, totals, flush };
