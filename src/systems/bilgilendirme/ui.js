// Bilgilendirme paneli: her bölüm ayrı bir mesaj (container). Düzen kurallar paneliyle aynı: başlık, çizgiyle ayrılan
// bloklar. İlk mesajın en üstünde panel başlığı ve görsel bulunur.
const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');

const TITLE = `${botName} Sunucu Bilgilendirmesi`;

// Bir bloğun metni: kalın alt başlık, açıklama, madde listesi ve küçük not
function blockText(block) {
  const parts = [];
  if (block.heading) parts.push(`**${block.heading}**`);
  if (block.text) parts.push(block.text);
  if (block.items) parts.push(block.items.map((item) => (block.plain ? item : `- ${item}`)).join('\n'));
  if (block.note) parts.push(`-# ${block.note}`);
  return parts.join('\n');
}

// Her mesajın genişliği en uzun satıra göre belirlendiği için başlığın altındaki küçük satırın sonuna görünmez
// boşluk (Braille boşluk karakteri) eklenir; böylece bütün mesajlar aynı ve en geniş boyutta görünür
const WIDTH_PAD = '\u2800'.repeat(150);
const titleText = (section) => `### ${section.title}\n-# ${section.sub ?? ''}${WIDTH_PAD}`;

// Her bölüm için bir container üretir; ilk container panel başlığı ve görselle başlar
function messages() {
  return config.sections.map((section, index) => {
    const container = new ContainerBuilder();
    if (index === 0) {
      container.addTextDisplayComponents(
        text(`${panelTitle(TITLE)}\n**Sunucumuz hakkında bilmen gereken her şey bu kanalda, yukarıdan aşağı oku.**`),
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
