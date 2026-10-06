// Bilgilendirme paneli: her bölüm ayrı bir mesaj (container). Düzen kurallar paneliyle aynı: başlık, çizgiyle ayrılan
// bloklar. İlk mesajın en üstünde panel başlığı ve görsel bulunur.
const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');

const TITLE = `${botName} Bilgilendirme`;

// Bir bloğun metni: kalın alt başlık, açıklama, madde listesi ve küçük not
function blockText(block) {
  const parts = [];
  if (block.heading) parts.push(`**${block.heading}**`);
  if (block.text) parts.push(block.text);
  if (block.items) parts.push(block.items.join('\n'));
  if (block.note) parts.push(`${block.note}`);
  return parts.join('\n');
}

// Her bölümün başlığının altındaki açıklama bilerek uzun yazılır (iki satıra yayılır): mesajın genişliği en uzun
// satıra göre belirlendiği için böylece bütün mesajlar aynı ve en geniş boyutta görünür, boşluk bırakmaya gerek kalmaz.
// Normal yazıyla gösterilir (küçük gri yazı değil); içerik metni onaylı tasarım olduğu için değiştirilmez.
const titleText = (section) => `### ${section.title}\n${section.sub}`;

// Her bölüm için bir container üretir; ilk container panel başlığı ve görselle başlar
function messages() {
  return config.sections.map((section, index) => {
    const container = new ContainerBuilder();
    if (index === 0) {
      container.addTextDisplayComponents(
        text(`${panelTitle(TITLE)}\nSunucumuz hakkında **bilmen gereken her şey** bu kanalda, sırayla oku.`),
      );
      if (config.banner) {
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
      }
      container.addSeparatorComponents(divider());
    }
    container.addTextDisplayComponents(text(titleText(section)));
    for (const block of section.blocks) {
      container.addSeparatorComponents(divider()).addTextDisplayComponents(text(blockText(block)));
    }
    return container;
  });
}

module.exports = { TITLE, messages };
