// Yardım menüsünün mesajları — tek mesajda gezilir, yeni mesaj atılmaz:
//  1) helpPanel: /yardim ile açılan kısa panel (başlık, tek açıklama, kategori menüsü). İçinde komut listesi yoktur.
//  2) categoryCard: panelde kategori seçilince panelin yerini bu kart alır (interaction.update) — başlık kategorinin
//     adı, altında açıklaması ve o kategorinin komutları; en altta panele döndüren bir düğme durur.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { colors, page, divider } = require('../../core/ui');

const IDS = { navigate: 'yardim', panel: 'yardim:panel' }; // yardim:kategori -> categoryCard, IDS.panel -> helpPanel

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

  // Panel yalnızca bu mesaj için: avatarlı başlık + açıklama, çizgi, menü. Açıklama başlıkla aynı bölümde durur;
  // ayrı bloğa yazılırsa yanındaki avatar kadar yükselir ve başlığın altında kocaman boşluk oluşur.
  return page({
    title: 'Yardım Menüsü',
    sub: `Menüden **bir komut kategorisi seç**; ${botName} komutları profil, sıralama ve partner gibi kategorilere ayrılmış durumda ve seçtiğin kategorinin komutları bu panelin yerini alır. Bu menüde **${total}** komut var, komutun adına basarak hemen kullanabilirsin.`,
    thumbnail: avatarUrl,
    accent: colors.primary,
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
}

// category: { label, desc } — entries: [{ description, usage }]
// Düzen log girdisinin kutusuyla aynı: başlık, gri açıklama, çizgi ve tek bilgi bloğu. Komutlar bir blokta toplandığı
// için kategori ne kadar büyük olursa olsun mesaj tek başlık + tek blok kalır ve bileşen sınırına yaklaşmaz.
// Panelin yerini aldığı için altında panele dönüş düğmesi durur.
function categoryCard({ category, entries }) {
  return page({
    title: category.label,
    sub: `${category.desc}. Bu komutların adına tıklayıp hemen kullanabilirsin.`,
    accent: colors.primary,
    blocks: [`**Komutlar**\n${entries.map((entry) => `**${entry.description}**\n${entry.usage}`).join('\n\n')}`],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.panel).setLabel('Yardım Menüsüne Dön').setStyle(ButtonStyle.Secondary),
      ),
    );
}

module.exports = { IDS, helpPanel, categoryCard };
