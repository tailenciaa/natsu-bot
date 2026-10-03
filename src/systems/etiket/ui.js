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
            '### Etiketimizi Taktı!\n' +
              `**<@${user.id}> artık profilinde \`${user.primaryGuild.tag}\` etiketini taşıyor.**\n` +
              `-# Sunucumuzu temsil ettiğin için teşekkürler, <@&${config.roles.tag}> rolü verildi.`,
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 }))),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# <t:${unix(Date.now())}:F>`));
}

module.exports = { thanks };
