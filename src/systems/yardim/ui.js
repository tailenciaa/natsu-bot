// Yardım menüsünün mesajı
const { colors, page, tabRow, divider, text } = require('../../core/ui');

const IDS = { navigate: 'yardim' }; // yardim:<kategori>

const MAX_COMPONENTS = 40;
const countComponents = (json) => 1 + (json.components ?? []).reduce((n, c) => n + countComponents(c), 0) + (json.accessory ? 1 : 0);

// view: { botName, avatarUrl, categories: { anahtar: ad }, tab, entries: [{ description, usage }] }
function helpMenu({ botName, avatarUrl, categories, tab, entries }) {
  const container = page({
    title: 'Yardım Menüsü',
    sub: `${botName} komutlarını kategoriler halinde burada görebilir, komutun adına tıklayarak hemen kullanabilirsin.`,
    thumbnail: avatarUrl,
    accent: colors.primary,
  });

  // Sekmeler başlığın hemen altında durur (uzun listede bile sekme değiştirmek için kaydırmak gerekmez);
  // bir satırda en fazla 5 buton olabilir, kategori sayısı arttıkça yeni satırlara taşar
  const keys = Object.keys(categories);
  container.addSeparatorComponents(divider());
  for (let i = 0; i < keys.length; i += 5) {
    const row = Object.fromEntries(keys.slice(i, i + 5).map((key) => [key, categories[key]]));
    container.addActionRowComponents(tabRow(row, tab, (key) => `${IDS.navigate}:${key}`));
  }

  const lines = entries.map((entry) => `**${entry.description}**\n${entry.usage}`);
  // Discord bir mesajda en fazla 40 bileşene izin verir: komut sayısı çoksa komutlar ikişer ikişer (gerekirse daha fazla)
  // aynı bloğa konur, böylece liste uzasa da mesaj gönderilebilir kalır
  const used = countComponents(container.toJSON());
  let perBlock = 1;
  while (used + 2 * Math.ceil(lines.length / perBlock) > MAX_COMPONENTS && perBlock < lines.length) perBlock += 1;
  for (let i = 0; i < lines.length; i += perBlock) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(lines.slice(i, i + perBlock).join('\n\n')));
  }
  return container;
}

module.exports = { IDS, helpMenu };
