// Takviye (boost) hakkı kullanım takibi ve süreli ayrıcalıklar: özel rol ve isim değişikliği. Takviye bitince
// bu iki ayrıcalık geri alınır, bunun için orijinal hal (eski takma ad, rol ID'si) burada saklanır.
const { data, save } = require('../../core/db');

data.boosterPerks ??= {};
data.boosterRoles ??= {};
data.boosterNicks ??= {};

module.exports = {
  used(userId, kind) {
    return data.boosterPerks[userId]?.[kind] ?? 0;
  },

  use(userId, kind) {
    const record = (data.boosterPerks[userId] ??= {});
    record[kind] = (record[kind] ?? 0) + 1;
    save();
  },

  getRole(userId) {
    return data.boosterRoles[userId] ?? null;
  },

  setRole(userId, roleId) {
    data.boosterRoles[userId] = roleId;
    save();
  },

  clearRole(userId) {
    delete data.boosterRoles[userId];
    save();
  },

  // Takma ad ilk değiştirildiğinde orijinali saklanır; sonraki değişikliklerde üzerine yazılmaz
  hasSavedNick(userId) {
    return userId in data.boosterNicks;
  },

  getSavedNick(userId) {
    return data.boosterNicks[userId] ?? null;
  },

  saveNick(userId, nick) {
    data.boosterNicks[userId] = nick;
    save();
  },

  clearNick(userId) {
    delete data.boosterNicks[userId];
    save();
  },
};
