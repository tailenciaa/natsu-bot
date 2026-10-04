// Sunucu etiketi sisteminin mesajları
const { ContainerBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const { text, divider, unix } = require('../../core/ui');
const config = require('./config');

// Etiketi takan üyeye kanalda teşekkür: sağ üstte üyenin fotoğrafı
function thanks(user) {
  return new ContainerBuilder()
    .setAccentColor(config.color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          text(
            '## Etiketimizi Taktı!\n' +
              '-# Sunucumuzu profilinde temsil ettiğin için çok teşekkür ederiz, sana özel etiket rolü de verildi; etiketi profilinde taşıdığın sürece bu rol sende kalır.',
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 }))),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(`**Etiket Bilgisi**\n<@${user.id}>・\`${user.primaryGuild.tag}\`\n-# <t:${unix(Date.now())}:F>`),
    );
}

module.exports = { thanks };
