// Yardım menüsünün mesajı
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { colors, page, divider, text } = require('../../core/ui');

const IDS = { navigate: 'yardim' }; // yardim:<kategori> (eski mesajlardaki butonlar) ve yardim:kategori (kategori menüsü)

const MAX_COMPONENTS = 40;
const countComponents = (json) => 1 + (json.components ?? []).reduce((n, c) => n + countComponents(c), 0) + (json.accessory ? 1 : 0);

// view: { botName, avatarUrl, categories: [{ key, label, desc }], tab, entries: [{ description, usage, need }], total }
function helpMenu({ botName, avatarUrl, categories, tab, entries, total = 0 }) {
  const container = page({
    title: 'Yardım Menüsü',
    sub: `${botName} komutları kategoriler halinde burada listelenir, komutun adına tıklayıp hemen kullanabilirsin. Bu menüde **${total}** komut var; kategoriyi menüden değiştirirsin.`,
    thumbnail: avatarUrl,
    accent: colors.primary,
  });

  // Kategoriler tek menüden seçilir; menü mesajın üstünde kalır, böylece liste ne kadar uzarsa uzasın kategori
  // değiştirmek için kaydırmak gerekmez
  container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.navigate}:kategori`)
          .setPlaceholder('Komut kategorisi seç')
          .addOptions(
            categories.map((category) =>
              new StringSelectMenuOptionBuilder().setValue(category.key).setLabel(category.label).setDescription(category.desc),
            ),
          ),
      ),
    );

  const active = categories.find((category) => category.key === tab);
  // need: komut herkesin kullanabildiği bir komut değilse ne gerektiği (rol etiketi ya da Discord izni)
  const lines = entries.map((entry) =>
    [`**${entry.description}**`, entry.usage, entry.need ? `Gerekli: ${entry.need}` : null].filter(Boolean).join('\n'),
  );
  // Discord bir mesajda en fazla 40 bileşene izin verir: komut sayısı çoksa komutlar ikişer ikişer (gerekirse daha fazla)
  // aynı bloğa konur, böylece liste uzasa da mesaj gönderilebilir kalır
  const used = countComponents(container.toJSON()) + (active ? 1 : 0);
  let perBlock = 1;
  while (used + 2 * Math.ceil(lines.length / perBlock) > MAX_COMPONENTS && perBlock < lines.length) perBlock += 1;
  for (let i = 0; i < lines.length; i += perBlock) {
    const block = active && i === 0 ? [`**${active.label} · ${lines.length} komut**`, ...lines.slice(i, i + perBlock)].join('\n\n') : lines.slice(i, i + perBlock).join('\n\n');
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  }

  return container;
}

module.exports = { IDS, helpMenu };
