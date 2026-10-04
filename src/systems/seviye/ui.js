// /seviye komutunun sonucu ve kanaldaki seviye atlama duyurusu
const { page, colors } = require('../../core/ui');
const config = require('./config');
const { levelFromXp } = require('./level');

const KIND_TITLE = { mesaj: 'Mesaj', ses: 'Ses' };
const KIND_PLACE = { mesaj: 'sohbette', ses: 'sesli sohbette' };

// Seviye atlandığında (ana seviyelerde rol de kazanıldıysa onunla birlikte) kanala giden duyuru.
// role: kazanılan Discord rolü (name) ya da null. Etiket cümlenin içinde gider (index.js'teki allowedMentions
// ana seviyede değilse sessiz kalır, gerçek bildirim göndermez).
function levelUpAnnounce(user, kind, level, role) {
  const blocks = [`**Yeni Seviye**\n<@${user.id}> ${KIND_PLACE[kind]} **seviye ${level}**'e ulaştı!`];
  if (role) blocks.push(`**Kazanılan Rol**\n✨ **${role.name}** rolünü kazandın!`);
  return page({
    title: '🎉 Seviye Atladı!',
    sub: 'Sohbette ve sesli kanallarda aktif oldukça deneyim puanı kazanırsın; yeni bir seviyeye ulaştığında bu duyuru gönderilir, ana seviyelerde ise sana özel bir rol de verilir.',
    accent: colors.success,
    blocks,
  });
}

const progressLine = (kind, xp) => {
  const level = levelFromXp(xp);
  const current = level > 0 ? config.xpForLevel(level) : 0;
  const next = config.xpForLevel(level + 1);
  return `**${KIND_TITLE[kind]} Seviyesi**\nSeviye \`${level}\`・${xp - current}/${next - current} XP`;
};

// /seviye [kullanici]
function levelCard(user, mesajXp, sesXp) {
  return page({
    title: 'Seviye Bilgisi',
    sub: `<@${user.id}> kullanıcısının mesaj ve ses seviyeleri aşağıda; sohbette yazdıkça ve sesli kanallarda vakit geçirdikçe deneyim puanı kazanıp bir sonraki seviyeye yaklaşırsın.`,
    blocks: [progressLine('mesaj', mesajXp), progressLine('ses', sesXp)],
  });
}

module.exports = { levelCard, levelUpAnnounce };
