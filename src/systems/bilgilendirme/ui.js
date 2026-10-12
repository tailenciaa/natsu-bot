// Bilgilendirme panelleri: her bölüm ayrı bir mesaj (container). Düzen kurallar paneliyle aynı: başlık, çizgiyle ayrılan
// bloklar. İlk mesajın en üstünde panel başlığı, girişi ve varsa görsel bulunur.
const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');

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

// Her bölüm için bir container üretir; ilk container panel başlığı, girişi ve varsa görselle başlar
function messages(panel) {
  return panel.sections.map((section, index) => {
    const container = new ContainerBuilder();
    if (index === 0) {
      container.addTextDisplayComponents(text(`${panelTitle(`${botName} ${panel.title}`)}\n${panel.intro}`));
      if (panel.banner) {
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(panel.banner)));
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

module.exports = { messages };
