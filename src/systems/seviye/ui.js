// Seviye atlama duyurusunun yedeği (kart çizilemezse gider) ve /seviye cevabının kart görseli
const { MediaGalleryBuilder, MediaGalleryItemBuilder, ContainerBuilder } = require('discord.js');
const { page } = require('../../core/ui');
const coinConfig = require('../coin/config');

const KIND_TITLE = { mesaj: 'Mesaj', ses: 'Ses' };

// Ses kartı çizilemezse sabit duyuru kanalına giden yedek duyuru. Bu kanalda üye hiçbir seviyede etiketlenmez;
// allowedMentions boş tutulur, kazanılan rol (varsa) yalnızca blokta görünür, bildirim göndermez.
function levelUpAnnounce(user, kind, level, role) {
  return page({
    title: 'Seviye Atladı',
    sub: 'Sesli kanallarda aktif oldukça XP kazanırsın; her seviye atlamada bu kanalda kart çıkar ve coin ödülü cüzdana eklenir. Mesaj seviyesi ise yazdığın kanalda duyurulur. Rol **yalnızca her 5. seviyede** verilir.',
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
