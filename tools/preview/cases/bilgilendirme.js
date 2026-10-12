// Bilgilendirme panelleri (src/systems/bilgilendirme/ui.js): her panel kendi kanalına, bölüm başına bir mesaj.
// Metin config.js'te durduğu için bu dosya iki panelin de bütün yazısını lint'ten geçirir.
module.exports = ({ src }) => {
  const d = src('systems/bilgilendirme/ui');
  const config = src('systems/bilgilendirme/config');

  const noMentions = { allowedMentions: { parse: [] } };

  return config.panels.flatMap((panel) => {
    const containers = d.messages(panel);
    return panel.sections.map((section, index) => ({
      id: `${panel.key}-${String(index + 1).padStart(2, '0')}`,
      title: `${panel.name}: ${section.title}`,
      where: `${panel.name} kanalı, bot açılınca sırayla gönderilir`,
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [containers[index]], ...noMentions }),
    }));
  });
};
