// Seviye sisteminin XP kayıtları: kullanıcı başına, mesaj ve ses için ayrı kalıcı toplam. Sıralama sistemindeki
// günlük istatistiklerden bağımsızdır, hiç sıfırlanmaz. Her mesajda diske yazmamak için değişiklikler biriktirilip toplu kaydedilir.
const { data, save } = require('../../core/db');

data.levelXp ??= {};
data.levelXp.mesaj ??= {};
data.levelXp.ses ??= {};
data.levelAnnounced ??= {};
data.levelAnnounced.mesaj ??= {};
data.levelAnnounced.ses ??= {};

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

module.exports = {
  xpOf(kind, userId) {
    return data.levelXp[kind][userId] ?? 0;
  },

  addXp(kind, userId, amount) {
    const current = data.levelXp[kind][userId] ?? 0;
    if (!(amount > 0)) return current;
    data.levelXp[kind][userId] = current + amount;
    scheduleSave();
    return current + amount;
  },

  allXp(kind) {
    return data.levelXp[kind];
  },

  announcedLevel(kind, userId) {
    return data.levelAnnounced[kind][userId] ?? 0;
  },

  markAnnounced(kind, userId, level) {
    data.levelAnnounced[kind][userId] = level;
    scheduleSave();
  },

  flush,
};
