// Seviye atlama duyurusunun yedeği (kart çizilemezse gider) ve /seviye cevabının kart görseli
const { MediaGalleryBuilder, MediaGalleryItemBuilder, ContainerBuilder } = require('discord.js');
const { page } = require('../../core/ui');
const coinConfig = require('../coin/config');

const KIND_TITLE = { mesaj: 'Mesaj', ses: 'Ses' };

// Ana seviyeye ulaşılınca kanala giden yedek duyuru; kazanılan rol (varsa) ayrı bir blokta etiket olarak yazılır.
// allowedMentions ile sadece seviye atlayan üye bildirim alır, rol etiketi bildirim göndermez.
function levelUpAnnounce(user, kind, level, role) {
  return page({
    title: 'Seviye Atladı',
    sub: 'Sohbette ve sesli kanallarda aktif oldukça XP kazanırsın; her seviye atlamada bu duyuru gelir ve coin ödülü cüzdana eklenir. Rol ise sadece her 5. seviyede verilir.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [
      `### Yeni Seviye\n**Üye:** <@${user.id}>\n**Tür:** ${KIND_TITLE[kind]}\n**Seviye:** ${level}`,
      `### Kazanılan Ödül\n**+${coinConfig.awards.levelUp} coin** cüzdana eklendi.`,
      role ? `### Kazanılan Rol\n<@&${role.id}> rolü hesabına verildi.` : null,
    ],
  });
}

// /seviye cevabı: sadece kart görseli (description ekran okuyucular için)
const levelImage = (imageName, description = 'Seviye kartı') =>
  new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`).setDescription(description)),
  );

module.exports = { levelUpAnnounce, levelImage };
