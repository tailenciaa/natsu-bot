// VIP mesajları: verme onayı ve VIP listesi (olma sırasına göre)
const { text, page } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];

// Verme onayı
function given(giverId, targetId, roleId) {
  return text(`**<@${giverId}>, <@${targetId}> kullanıcısına VIP verdi!** 👑\n-# <@${targetId}> artık <@&${roleId}> rolüne sahip.`);
}

// ranking: [{ userId }] VIP olma sırasına göre (en eski ilk)
function table(guild, ranking) {
  const lines = ranking.map(({ userId }, i) => `${i < 3 ? PODIUM[i] : '-# '}${i + 1}. <@${userId}>`);
  return page({
    title: `${guild.name} VIP Listesi`,
    sub: 'VIP rolüne sahip üyeleri VIP olma sırasına göre listeliyoruz; VIP rolü yetkililer tarafından özel üyelere verilen kalıcı bir roldür ve sunucuya katkısı olanlara tanınır.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks: [lines.length ? lines.join('\n') : '-# Henüz VIP üye yok.'],
  });
}

module.exports = { given, table };
