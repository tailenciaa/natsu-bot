// XP -> seviye dönüşümü. config.xpForLevel(N), N. seviyeye ulaşmak için gereken toplam XP'yi verir.
const config = require('./config');

function levelFromXp(xp) {
  let level = 0;
  while (xp >= config.xpForLevel(level + 1)) level++;
  return level;
}

module.exports = { levelFromXp };
