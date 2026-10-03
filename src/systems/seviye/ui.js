// /seviye komutunun sonucu ve kanaldaki seviye atlama duyurusu
const { notice } = require('../../core/ui');
const config = require('./config');
const { levelFromXp } = require('./level');

const KIND_TITLE = { mesaj: 'Mesaj', ses: 'Ses' };
const KIND_PLACE = { mesaj: 'sohbette', ses: 'sesli sohbette' };

// Seviye atlandığında (ana seviyelerde rol de kazanıldıysa onunla birlikte) kanala giden duyuru.
// role: kazanılan Discord rolü (name) ya da null. Etiket cümlenin içinde gider (index.js'teki allowedMentions
// ana seviyede değilse sessiz kalır, gerçek bildirim göndermez).
function levelUpAnnounce(user, kind, level, role) {
  let message = `🎉 **Seviye Atladı!**\n<@${user.id}> ${KIND_PLACE[kind]} **seviye ${level}**'e ulaştı!`;
  if (role) message += `\n-# ✨ **${role.name}** rolünü kazandın!`;
  return notice(message, 'success');
}

const progressLine = (kind, xp) => {
  const level = levelFromXp(xp);
  const current = level > 0 ? config.xpForLevel(level) : 0;
  const next = config.xpForLevel(level + 1);
  return `**${KIND_TITLE[kind]} Seviyesi:** \`${level}\` — ${xp - current}/${next - current} XP`;
};

// /seviye [kullanici]
function levelCard(user, mesajXp, sesXp) {
  return notice([`### <@${user.id}> Seviyeleri`, `${progressLine('mesaj', mesajXp)}\n${progressLine('ses', sesXp)}`]);
}

module.exports = { levelCard, levelUpAnnounce };
