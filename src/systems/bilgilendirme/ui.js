// Bilgilendirme paneli: her bölüm ayrı bir mesaj (container), ilk mesajın üstünde görsel bulunur
const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { text } = require('../../core/ui');
const config = require('./config');

const sectionText = (section) => `### ${section.title}\n${section.lines.join('\n')}`;

// Her bölüm için bir container üretir; ilk container görselle başlar
function messages() {
  return config.sections.map((section, index) => {
    const container = new ContainerBuilder();
    if (index === 0 && config.banner) {
      container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
    }
    return container.addTextDisplayComponents(text(sectionText(section)));
  });
}

module.exports = { messages };
