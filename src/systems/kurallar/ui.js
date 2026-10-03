// Kurallar paneli: başlık, numaralı bölümler, görsel ve en altta not
const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');

const TITLE = `${botName} Sunucu Kuralları`;

const sectionText = (section, index) =>
  `### ${section.title}\n${section.rules.map((rule, i) => `\`${index + 1}.${i + 1}\` ${rule}`).join('\n')}`;

function panel(imageName) {
  const container = new ContainerBuilder().addTextDisplayComponents(
    text(`${panelTitle(TITLE)}\n**Sunucumuzda herkesin rahat etmesi için aşağıdaki kurallara uymak zorunludur.**`),
  );
  if (imageName) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`)),
    );
  }
  config.sections.forEach((section, index) => {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(sectionText(section, index)));
  });
  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(config.note));
}

module.exports = { TITLE, panel };
