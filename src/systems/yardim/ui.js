// Yardım menüsünün mesajı
const { colors, page, tabRow, divider, text } = require('../../core/ui');

const IDS = { navigate: 'yardim' }; // yardim:<kategori>

// view: { botName, avatarUrl, categories: { anahtar: ad }, tab, entries: [{ description, usage, access }], note: sekmenin ortak notu }
function helpMenu({ botName, avatarUrl, categories, tab, entries, note }) {
  const container = page({
    title: 'Yardım Menüsü',
    sub: `${botName} komutlarını kategorilere göre buradan görebilirsin; kategori butonlarıyla sekme değiştirir, komutun adına tıklayarak komutu hemen çalıştırırsın.`,
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

  // Sekmedeki bütün komutların erişimi aynıysa bir kez yazılır; farklıysa her girdi kendisininkini taşır.
  // Girdinin son satırı küçük yazı olmaz (olursa otomatik düzenleme onu ayrı bölüp çizgi koyar)
  const accesses = [...new Set(entries.map((entry) => entry.access))];
  const shared = entries.length > 1 && accesses.length === 1 ? accesses[0] : null;
  const common = [shared ? `**Kimler kullanabilir:** ${shared}` : null, note].filter(Boolean).join('\n');
  if (common) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(common));
  for (const entry of entries) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(
      text(`**${entry.description}**\n${entry.usage}${shared ? '' : `\nKimler kullanabilir: ${entry.access}`}`),
    );
  }
  return container;
}

module.exports = { IDS, helpMenu };
