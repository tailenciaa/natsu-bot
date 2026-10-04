// /seviye komutunun sonucu ve kanaldaki seviye atlama duyurusu
const { page, colors } = require('../../core/ui');
const config = require('./config');
const { levelFromXp } = require('./level');

const KIND_TITLE = { mesaj: 'Mesaj', ses: 'Ses' };
const KIND_PLACE = { mesaj: 'sohbette', ses: 'sesli sohbette' };

// Ana seviyeye ulaşılınca kanala giden duyuru; kazanılan rol (varsa) ayrı blokta etiket olarak yazılır.
// Etiketler allowedMentions ile sadece seviye atlayan üyeyi bildirir, rol etiketi bildirim göndermez.
function levelUpAnnounce(user, kind, level, role) {
  const blocks = [`**Yeni Seviye**\n<@${user.id}>・${KIND_TITLE[kind]} Seviyesi・**${level}**`];
  if (role) blocks.push(`**Kazanılan Rol**\n<@&${role.id}>`);
  return page({
    title: 'Seviye Atladı',
    sub: 'Sohbette ve sesli kanallarda aktif oldukça deneyim puanı kazanırsın; her 5 seviyede bir bu duyuru gönderilir ve o seviyeye ait rol hesabına otomatik olarak verilir.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
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
    thumbnail: user.displayAvatarURL({ size: 256 }),
    sub: `<@${user.id}> kullanıcısının mesaj ve ses seviyeleri aşağıda; sohbette yazdıkça ve sesli kanallarda vakit geçirdikçe deneyim puanı kazanıp bir sonraki seviyeye yaklaşırsın.`,
    blocks: [progressLine('mesaj', mesajXp), progressLine('ses', sesXp)],
  });
}

module.exports = { levelCard, levelUpAnnounce };
