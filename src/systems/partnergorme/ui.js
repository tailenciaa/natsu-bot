// Partner görme sisteminin tek mesajı: butonuna basınca partner kanallarını görme rolünü veren panel.
const { ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SectionBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');

const IDS = {
  ver: 'partnergorme:ver',
};

function panel() {
  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          text(`${panelTitle(`${botName} Partner Görme`)}\n` + '**Partner kanallarını görmek için yandaki butona bas.**'),
        )
        .setButtonAccessory(new ButtonBuilder().setCustomId(IDS.ver).setLabel('Partner Görme').setStyle(ButtonStyle.Success)),
    )
    .addSeparatorComponents(divider())
    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
}

module.exports = { IDS, panel };
