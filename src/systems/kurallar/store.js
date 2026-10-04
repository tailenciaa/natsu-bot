// Kuralları "okudum, kabul ediyorum" diyen üyeler: data.rulesAccepted (kullanıcı ID'si -> kabul zamanı)
const { data, save } = require('../../core/db');

const accepted = () => (data.rulesAccepted ??= {});

module.exports = {
  has: (userId) => userId in accepted(),
  count: () => Object.keys(accepted()).length,
  add(userId) {
    accepted()[userId] = Date.now();
    save();
  },
};
