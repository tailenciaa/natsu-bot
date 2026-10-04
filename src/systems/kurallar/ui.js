// Kurallar paneli: başlık, numaralı bölümler, görsel ve en altta not
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');
const store = require('./store');

const TITLE = `${botName} Sunucu Kuralları`;
const IDS = { accept: 'kurallar-kabul' };

const sectionText = (section, index) =>
  `**${section.title}**\n${section.rules.map((rule, i) => `\`${index + 1}.${i + 1}\` ${rule}`).join('\n')}`;

// Panelin en altında kuralları kabul eden üye sayısını gösteren buton bulunur
function panel() {
  const container = new ContainerBuilder().addTextDisplayComponents(
    text(`${panelTitle(TITLE)}\n-# Sunucumuzda herkesin rahat etmesi için aşağıdaki kurallara uymak zorunludur; lütfen hepsini dikkatle oku ve sunucuda bu kurallara uygun davran, okuduktan sonra aşağıdaki butonla kabul et.`),
  );
  if (config.banner) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  }
  config.sections.forEach((section, index) => {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(sectionText(section, index)));
  });
  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Önemli Not**\n${config.note}`))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(IDS.accept)
          .setLabel(`Okudum, Kabul Ediyorum (${store.count()})`)
          .setStyle(ButtonStyle.Success),
      ),
    );
}

module.exports = { TITLE, IDS, panel };
