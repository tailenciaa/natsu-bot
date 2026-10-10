// Yardım menüsünün mesajları — düzen olarak log panelinin aynısı:
//  1) helpPanel: /yardim ile açılan kısa panel (başlık, tek açıklama, kategori menüsü). İçinde komut listesi yoktur.
//  2) categoryCard: panelden bir kategori seçilince log panelinin kategori seçimine verdiği cevap gibi ayrı bir
//     kart basılır; başlık kategorinin adıdır, altında açıklaması ve o kategorinin komutları durur.
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { colors, page, divider } = require('../../core/ui');

const IDS = { navigate: 'yardim' }; // yardim:kategori

// view: { botName, avatarUrl, categories: [{ key, label, desc }], total }
function helpPanel({ botName, avatarUrl, categories, total = 0 }) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${IDS.navigate}:kategori`)
    .setPlaceholder('Komut kategorisi seç')
    .addOptions(
      categories.map((category) =>
        new StringSelectMenuOptionBuilder().setValue(category.key).setLabel(category.label).setDescription(category.desc),
      ),
    );

  // Panel yalnızca bu mesaj için: başlık, çizgi, açıklama, çizgi, menü
  return page({
    title: 'Yardım Menüsü',
    thumbnail: avatarUrl,
    accent: colors.primary,
    blocks: [
      `Menüden **bir komut kategorisi seç**; ${botName} komutları profil, sıralama ve partner gibi kategorilere ayrılmış durumda ve seçimin o kategorinin komutlarını tek bir kartta karşına getirir. Bu menüde **${total}** komut var, komutun adına basarak hemen kullanabilirsin.`,
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
}

// category: { label, desc } — entries: [{ description, usage }]
// Düzen olarak log girdisinin kutusu: başlık, gri açıklama, çizgi ve tek bilgi bloğu. Komutlar bir blokta toplandığı
// için kategori ne kadar büyük olursa olsun mesaj tek başlık + tek blok kalır ve bileşen sınırına yaklaşmaz.
function categoryCard({ category, entries }) {
  return page({
    title: category.label,
    sub: `${category.desc}. Bu komutların adına tıklayıp hemen kullanabilirsin.`,
    accent: colors.primary,
    blocks: [`**Komutlar**\n${entries.map((entry) => `**${entry.description}**\n${entry.usage}`).join('\n\n')}`],
  });
}

module.exports = { IDS, helpPanel, categoryCard };
