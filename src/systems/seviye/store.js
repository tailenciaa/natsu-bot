// Seviye sisteminin XP kayıtları: kullanıcı başına, mesaj ve ses için ayrı kalıcı toplam. Sıralama sistemindeki
// günlük istatistiklerden bağımsızdır, hiç sıfırlanmaz.
const { data, save } = require('../../core/db');

data.levelXp ??= { mesaj: {}, ses: {} };
data.levelAnnounced ??= { mesaj: {}, ses: {} };

module.exports = {
  xpOf(kind, userId) {
    return data.levelXp[kind][userId] ?? 0;
  },

  addXp(kind, userId, amount) {
    const next = (data.levelXp[kind][userId] ?? 0) + amount;
    data.levelXp[kind][userId] = next;
    save();
    return next;
  },

  announcedLevel(kind, userId) {
    return data.levelAnnounced[kind][userId] ?? 0;
  },

  markAnnounced(kind, userId, level) {
    data.levelAnnounced[kind][userId] = level;
    save();
  },
};
