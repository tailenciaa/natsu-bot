// Saygınlık verileri: hafta anahtarı -> kullanıcı ID'si -> o hafta kazandığı saygınlık adedi (haftanın kazananını
// bulmak için), ayrıca her kullanıcının tüm zamanlar toplamı (/saygi-siralama tablosu için). Verenlerin bekleme
// süresi, haftanın rol sahibi ve son duyurulan hafta de burada tutulur.
const { data, save } = require('../../core/db');

data.saygi ??= { weekly: {}, total: {} };
data.saygiCooldown ??= {};
data.saygiHolder ??= null;
data.saygiLastRun ??= null;

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

// +1 saygınlık ekler: hem o haftanın hem de tüm zamanların toplamına
function add(userId, weekKey) {
  const users = (data.saygi.weekly[weekKey] ??= {});
  users[userId] = (users[userId] ?? 0) + 1;
  data.saygi.total[userId] = (data.saygi.total[userId] ?? 0) + 1;
  scheduleSave();
}

// { userId: değer } şeklinde o haftanın toplamları
const weekTotals = (weekKey) => data.saygi.weekly[weekKey] ?? {};

// Tüm zamanların toplam saygınlığı, { userId: değer }
const allTotals = () => data.saygi.total;

const lastGiven = (giverId) => data.saygiCooldown[giverId] ?? 0;

function setLastGiven(giverId, at) {
  data.saygiCooldown[giverId] = at;
  scheduleSave();
}

const holder = () => data.saygiHolder;

function setHolder(userId) {
  data.saygiHolder = userId;
  save();
}

const lastRun = () => data.saygiLastRun;

function setLastRun(weekKey) {
  data.saygiLastRun = weekKey;
  save();
}

module.exports = { add, weekTotals, allTotals, lastGiven, setLastGiven, holder, setHolder, lastRun, setLastRun, flush };
