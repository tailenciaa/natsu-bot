// Haftanın aktifleri verileri: kind -> hafta anahtarı -> kullanıcı ID'si -> değer (mesaj adet, ses/yayın saniye).
// Ayrıca her kategorinin rolünü şu an kimin taşıdığı ve son duyurulan haftanın anahtarı tutulur.
const { data, save } = require('../../core/db');

data.weeklyActive ??= { mesaj: {}, ses: {}, yayin: {} };
data.weeklyHolders ??= { mesaj: null, ses: null, yayin: null };
data.weeklyLastRun ??= null;

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

function add(kind, userId, amount, weekKey) {
  if (!(amount > 0)) return;
  const users = (data.weeklyActive[kind][weekKey] ??= {});
  users[userId] = (users[userId] ?? 0) + amount;
  scheduleSave();
}

// { userId: değer } şeklinde o haftanın toplamları
const totals = (kind, weekKey) => data.weeklyActive[kind][weekKey] ?? {};

const holder = (kind) => data.weeklyHolders[kind];

function setHolder(kind, userId) {
  data.weeklyHolders[kind] = userId;
  save();
}

const lastRun = () => data.weeklyLastRun;

function setLastRun(weekKey) {
  data.weeklyLastRun = weekKey;
  save();
}

module.exports = { add, totals, holder, setHolder, lastRun, setLastRun, flush };
