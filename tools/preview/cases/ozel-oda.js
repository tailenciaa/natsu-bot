// Özel oda sistemi (src/systems/ozel-oda/ui.js)
module.exports = ({ mock, src }) => {
  const o = src('systems/ozel-oda/ui');
  const owner = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const room = { ownerId: owner.id };
  const member = () => mock.user({ username: mock.name('uye'), displayName: mock.name('uye') }).id;
  const channel = (userLimit = 0) => ({ userLimit });
  const noMentions = { allowedMentions: { parse: [] } };
  const where = 'Odanın kendi yazı sohbeti';
  const panel = (state, limit, access) => ({ components: [o.controlPanel(room, channel(limit), state, access)], ...noMentions });
  const davetli = (n) => Array.from({ length: n }, member);

  return [
    { id: 'panel-acik', title: 'Oda kontrol paneli: açık oda, davet yok', where, visibility: 'public', kind: 'message', build: () => panel({ locked: false, hidden: false }) },
    {
      id: 'panel-kilitli',
      title: 'Oda kontrol paneli: kilitli, 5 kişilik, iki davetli bir yasaklı',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => panel({ locked: true, hidden: false }, 5, { invited: davetli(2), banned: davetli(1) }),
    },
    {
      id: 'panel-gizli',
      title: 'Oda kontrol paneli: kilitli ve gizli, çok davetli',
      where: 'Odanın kendi yazı sohbeti | Kalabalık davet listesi',
      visibility: 'public',
      kind: 'message',
      build: () => panel({ locked: true, hidden: true }, 0, { invited: davetli(14), banned: [] }),
    },
    { id: 'rehber', title: 'Özel oda rehberi paneli', where: 'Özel oda rehberi kanalı', visibility: 'panel', kind: 'message', build: () => ({ components: [o.guidePanel()], ...noMentions }) },
    { id: 'form-limit', title: 'Form: kişi limiti', where: 'Limiti Ayarla butonu', visibility: 'ephemeral', kind: 'modal', build: () => o.limitModal(5) },
    { id: 'form-isim', title: 'Form: oda ismi', where: 'İsmi Değiştir butonu', visibility: 'ephemeral', kind: 'modal', build: () => o.renameModal('Mehmet') },
  ];
};
