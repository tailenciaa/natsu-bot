// Özel oda sistemi (src/systems/ozel-oda/ui.js)
module.exports = ({ mock, src }) => {
  const o = src('systems/ozel-oda/ui');
  const owner = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const room = { ownerId: owner.id };
  const channel = (userLimit = 0) => ({ userLimit });
  const noMentions = { allowedMentions: { parse: [] } };
  const where = 'Odanın kendi yazı sohbeti';
  const panel = (state, limit) => ({ components: [o.controlPanel(room, channel(limit), state)], ...noMentions });

  return [
    { id: 'panel-acik', title: 'Oda kontrol paneli: açık oda', where, visibility: 'public', kind: 'message', build: () => panel({ locked: false, hidden: false }) },
    { id: 'panel-kilitli', title: 'Oda kontrol paneli: kilitli, 5 kişilik', where, visibility: 'public', kind: 'message', build: () => panel({ locked: true, hidden: false }, 5) },
    { id: 'panel-gizli', title: 'Oda kontrol paneli: kilitli ve gizli', where, visibility: 'public', kind: 'message', build: () => panel({ locked: true, hidden: true }) },
    { id: 'rehber', title: 'Özel oda rehberi paneli', where: 'Özel oda rehberi kanalı', visibility: 'panel', kind: 'message', build: () => ({ components: [o.guidePanel()], ...noMentions }) },
    { id: 'form-limit', title: 'Form: kişi limiti', where: 'Limiti Ayarla butonu', visibility: 'ephemeral', kind: 'modal', build: () => o.limitModal(5) },
    { id: 'form-isim', title: 'Form: oda ismi', where: 'İsmi Değiştir butonu', visibility: 'ephemeral', kind: 'modal', build: () => o.renameModal('Mehmet') },
  ];
};
