// Sunucu etiketi sisteminin mesajları
const { ContainerBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const { text, divider, stamp } = require('../../core/ui');
const config = require('./config');

// Etiketi takan üyeye kanalda teşekkür: kısa ve tek bakışta okunur; sağ üstte üyenin fotoğrafı, kenar rengi config.color
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
    .addTextDisplayComponents(text(stamp()));
}

module.exports = { thanks };
