// Sunucu etiketi için teşekkür mesajı atılan üyeler: tagThanks, kullanıcı ID'si ile son mesaj zamanı
const { data, save } = require('../../core/db');

data.tagThanks ??= {};

module.exports = {
  lastThanked(userId) {
    return data.tagThanks[userId] ?? 0;
  },

  setThanked(userId) {
    data.tagThanks[userId] = Date.now();
    save();
  },
};
