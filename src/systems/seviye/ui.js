// Seviye atlama duyurusunun yedeği (kart çizilemezse gider) ve /seviye cevabının kart görseli
const { MediaGalleryBuilder, MediaGalleryItemBuilder, ContainerBuilder } = require('discord.js');
const { page } = require('../../core/ui');

const KIND_TITLE = { mesaj: 'Mesaj', ses: 'Ses' };

// Ana seviyeye ulaşılınca kanala giden yedek duyuru; kazanılan rol (varsa) aynı blokta etiket olarak yazılır.
// allowedMentions ile sadece seviye atlayan üye bildirim alır, rol etiketi bildirim göndermez.
function levelUpAnnounce(user, kind, level, role) {
  const lines = [`**Üye:** <@${user.id}>`, `**Seviye:** ${KIND_TITLE[kind]} ${level}`];
  if (role) lines.push(`**Kazanılan Rol:** <@&${role.id}>`);
  return page({
    title: 'Seviye Atladı',
    sub: 'Sohbette ve sesli kanallarda aktif oldukça XP kazanırsın; her 5 seviyede bir bu duyuru gelir ve o seviyeye ait rol hesabına otomatik olarak verilir.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [`**Yeni Seviye**\n${lines.join('\n')}`],
  });
}

// /seviye cevabı: sadece kart görseli (description ekran okuyucular için)
const levelImage = (imageName, description = 'Seviye kartı') =>
  new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`).setDescription(description)),
  );

module.exports = { levelUpAnnounce, levelImage };
