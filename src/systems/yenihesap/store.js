// Yeni hesap kısıtlama rolünün ID'si: bot tarafından oluşturulduğu için kalıcı olarak burada tutulur.
const { data, save } = require('../../core/db');

data.newAccountRole ??= {};

module.exports = {
  roleId(guildId) {
    return data.newAccountRole[guildId] ?? null;
  },

  setRoleId(guildId, roleId) {
    data.newAccountRole[guildId] = roleId;
    save();
  },
};
