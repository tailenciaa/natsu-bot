// Kurallar paneli ve bilgilendirme paneli (src/systems/kurallar/ui.js, src/systems/bilgilendirme/ui.js)
module.exports = ({ src }) => {
  const kurallar = src('systems/kurallar/ui');
  const bilgi = src('systems/bilgilendirme/ui');
  const noMentions = { allowedMentions: { parse: [] } };

  const cases = [
    {
      id: 'kurallar-panel',
      title: 'Kurallar paneli',
      where: 'Kurallar kanalı',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [kurallar.panel()], ...noMentions }),
    },
  ];

  // Bilgilendirme paneli: her bölüm ayrı bir mesaj
  bilgi.messages().forEach((container, index) => {
    cases.push({
      id: `bilgilendirme-${String(index + 1).padStart(2, '0')}`,
      title: `Bilgilendirme paneli: ${index + 1}. mesaj`,
      where: 'Bilgilendirme kanalı',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [container], ...noMentions }),
    });
  });
  return cases;
};
