// Sesli bilgi paneli (src/systems/sesbilgi/ui.js)
module.exports = ({ src }) => {
  const s = src('systems/sesbilgi/ui');
  return [
    {
      id: 'panel',
      title: 'Sesli bilgi paneli',
      where: 'Sesli bilgi kanalı',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [s.panel()], allowedMentions: { parse: [] } }),
    },
  ];
};
