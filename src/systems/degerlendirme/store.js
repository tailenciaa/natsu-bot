// Yetkili değerlendirmelerinin kaydı: ratings, talebin alt başlık ID'si ile
const { data, save } = require('../../core/db');

module.exports = {
  getRating(id) {
    return data.ratings[id] ?? null;
  },

  setRating(id, rating) {
    data.ratings[id] = rating;
    save();
    return rating;
  },

  updateRating(id, patch) {
    if (!data.ratings[id]) return null;
    Object.assign(data.ratings[id], patch);
    save();
    return data.ratings[id];
  },

  // Yetkilinin sicilindeki değerlendirmeler, en yeni önce.
  // İtirazı onaylanan ya da sicilden elle kaldırılan değerlendirmeler sicilde görünmez, kayıtta yine de tutulur.
  ratingsOf(guildId, staffId) {
    return Object.values(data.ratings)
      .filter((r) => r.guildId === guildId && r.staffId === staffId && r.score && r.reportStatus !== 'approved' && !r.removedAt)
      .sort((a, b) => b.ratedAt - a.ratedAt);
  },
};
