// Bilgilendirme panelleri: her bölüm ayrı bir mesaj (container). Düzen kurallar paneliyle aynı: başlık, çizgiyle ayrılan
// bloklar. İlk mesajın en üstünde panel başlığı, girişi ve varsa görsel bulunur.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');

// Madde listesi: işaretsiz maddeler alt alta dizilince birbirine karışıyor, bu yüzden kendiliğinden işaret
// konur. Zaten etiketli olanlara (`1.`, "1)", "· ", "— ") ikinci bir işaret eklenmez.
const ISARETLI = /^\s*(?:`[^`]+`|\d+[.)]|[·•‣⁃\-–—>»])/u;
const maddeListesi = (items) => items.map((i) => (ISARETLI.test(i) ? i : `· ${i}`)).join('\n');

// Bir bloğun metni: kalın alt başlık, açıklama, madde listesi ve küçük not
function blockText(block) {
  const parts = [];
  if (block.heading) parts.push(`**${block.heading}**`);
  if (block.text) parts.push(block.text);
  if (block.items) parts.push(maddeListesi(block.items));
  if (block.note) parts.push(`\n${block.note}`);
  return parts.join('\n');
}

// Her bölümün başlığının altındaki açıklama bilerek uzun yazılır (iki satıra yayılır): mesajın genişliği en uzun
// satıra göre belirlendiği için böylece bütün mesajlar aynı ve en geniş boyutta görünür, boşluk bırakmaya gerek kalmaz.
// Normal yazıyla gösterilir (küçük gri yazı değil); içerik metni onaylı tasarım olduğu için değiştirilmez.
const titleText = (section) => `### ${section.title}\n${section.sub}`;

// Panel mesajlarındaki buton kimlikleri; işleyiciler index.js'te bu tablodan bağlanır
const IDS = {
  partnerMetniKopyala: 'bilgi:partner-metni-kopyala',
};

// Her bölüm için bir container üretir; ilk container panel başlığı, girişi ve varsa görselle başlar.
// hideTitle: bölüm başlığı yazılmaz (tek kartlık panellerde başlık zaten panel başlığıdır); button: kartın altına düğme
function messages(panel) {
  return panel.sections.map((section, index) => {
    const container = new ContainerBuilder();
    if (index === 0) {
      const baslik = panelTitle(`${botName} ${panel.title}`);
      container.addTextDisplayComponents(text(panel.intro ? `${baslik}\n${panel.intro}` : baslik));
      if (panel.banner) {
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(panel.banner)));
      }
      container.addSeparatorComponents(divider());
    }
    if (!section.hideTitle) container.addTextDisplayComponents(text(titleText(section)));
    for (const [blockIndex, block] of section.blocks.entries()) {
      // Başlıksız ilk kartta panel başlığının çizgisi zaten var; ikinci çizgi üst üste binmesin
      if (blockIndex > 0 || !(index === 0 && section.hideTitle)) container.addSeparatorComponents(divider());
      container.addTextDisplayComponents(text(blockText(block)));
    }
    if (section.button) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(section.button.id).setLabel(section.button.label).setStyle(ButtonStyle.Primary),
        ),
      );
    }
    return container;
  });
}

module.exports = { messages, IDS };
