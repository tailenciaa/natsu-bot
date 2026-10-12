// Kurallar paneli (src/systems/kurallar/ui.js). Bilgilendirme panelleri kendi case dosyasında: cases/bilgilendirme.js
module.exports = ({ src }) => {
  const kurallar = src('systems/kurallar/ui');
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

  return cases;
};
