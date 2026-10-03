// Yardım menüsünün mesajı
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
} = require('discord.js');
const { colors, text, divider } = require('../../core/ui');

const IDS = { navigate: 'yardim' }; // yardim:<kategori>

// view: { botName, avatarUrl, categories: { anahtar: ad }, tab, entries: [{ description, usage, access }] }
function helpMenu({ botName, avatarUrl, categories, tab, entries }) {
  const container = new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          text(
            '## Yardım Menüsü\n' +
              `**${botName} ile neler yapabileceğine buradan göz atabilirsin.**\n` +
              '-# Butonlarla kategoriler arasında geçiş yap, komutun adına tıklayarak hemen kullan.',
          ),
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)),
    )
    .addSeparatorComponents(divider());

  // Bir satırda en fazla 5 buton olabilir; kategori sayısı arttıkça yeni satırlara taşar
  const buttons = Object.entries(categories).map(([key, label]) =>
    new ButtonBuilder()
      .setCustomId(`${IDS.navigate}:${key}`)
      .setLabel(label)
      .setStyle(key === tab ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
  for (let i = 0; i < buttons.length; i += 5) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  container.addSeparatorComponents(divider());

  entries.forEach((entry, index) => {
    if (index > 0) container.addSeparatorComponents(divider());
    container.addTextDisplayComponents(text(`**${entry.description}**\n${entry.usage}\n-# Kimler kullanabilir: ${entry.access}`));
  });

  return container;
}

module.exports = { IDS, helpMenu };
