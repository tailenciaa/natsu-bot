// Yardım menüsünün mesajı
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { colors, divider, page } = require('../../core/ui');

const IDS = { navigate: 'yardim' }; // yardim:<kategori>

// view: { botName, avatarUrl, categories: { anahtar: ad }, tab, entries: [{ description, usage, access }] }
function helpMenu({ botName, avatarUrl, categories, tab, entries }) {
  const container = page({
    title: 'Yardım Menüsü',
    sub: `${botName} ile neler yapabileceğine buradan göz atabilirsin; butonlarla kategoriler arasında geçiş yapabilir, komutun adına tıklayarak hemen kullanabilirsin.`,
    thumbnail: avatarUrl,
    accent: colors.primary,
    blocks: entries.map((entry) => `**${entry.description}**\n${entry.usage}\n-# Kimler kullanabilir: ${entry.access}`),
  });

  // Bir satırda en fazla 5 buton olabilir; kategori sayısı arttıkça yeni satırlara taşar
  const buttons = Object.entries(categories).map(([key, label]) =>
    new ButtonBuilder()
      .setCustomId(`${IDS.navigate}:${key}`)
      .setLabel(label)
      .setStyle(key === tab ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
  container.addSeparatorComponents(divider());
  for (let i = 0; i < buttons.length; i += 5) {
    container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }

  return container;
}

module.exports = { IDS, helpMenu };
