// Profil özelleştirmesi: biyografi ve profil rengi (kullanıcı ID'si ile). İleride coin/para sistemi de buraya eklenecek.
const { data, save } = require('../../core/db');

data.profiles ??= {};

module.exports = {
  get(userId) {
    return data.profiles[userId] ?? {};
  },

  set(userId, patch) {
    data.profiles[userId] = { ...(data.profiles[userId] ?? {}), ...patch };
    save();
    return data.profiles[userId];
  },
};
