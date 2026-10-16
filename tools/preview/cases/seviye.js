// Seviye sistemi (src/systems/seviye): kartlar canvas ile çizilen PNG olduğu için
// önizlemede aynı boyutta yer tutucu PNG kullanılır; mesaj düzeni ve metinler gerçek ui fonksiyonlarından gelir.
module.exports = ({ mock, ui, src }) => {
  const s = src('systems/seviye/ui');
  const level = (name, o = {}) => mock.user({ username: name, displayName: name, ...o });

  const member = level('mehmet');
  const role = mock.role({ name: 'Mesaj Seviye 15', color: '#57f287' });
  const sesRole = mock.role({ name: 'Ses Seviyesi 15', color: '#fee75c' });
  const noMentions = { allowedMentions: { parse: [] } };
  const card = (name, width, height, label) => mock.pngFile(name, { width, height, label });

  return [
    {
      id: 'seviye-karti',
      title: '/seviye kartı',
      where: '/seviye komutu, herkese açık',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [s.levelImage('seviye.png')], files: [card('seviye.png', 900, 362, 'Seviye kartı')], ...noMentions }),
    },
    {
      id: 'duyuru-karti',
      title: 'Ses seviyesi duyurusu (kart)',
      where: 'Duyuru kanalı, her seviyede; üye etiketlenmez',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [],
        content: '',
        flags: 0,
        files: [card('seviye-atladi.png', 900, 310, 'Ses seviyesi atlama kartı')],
        allowedMentions: { users: [], roles: [] },
      }),
    },
    {
      id: 'metin-duyurusu-rol',
      title: 'Mesaj seviyesi duyurusu (rollü)',
      where: 'Üyenin yazdığı kanal, ana seviyede; sadece o üye etiketlenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ content: s.textLevelNotice(member, 15, role), allowedMentions: { users: [member.id], roles: [] } }),
    },
    {
      id: 'metin-duyurusu',
      title: 'Mesaj seviyesi duyurusu',
      where: 'Üyenin yazdığı kanal, ara seviyede; sadece o üye etiketlenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ content: s.textLevelNotice(member, 7, null), allowedMentions: { users: [member.id], roles: [] } }),
    },
    {
      id: 'duyuru-yedek-rol',
      title: 'Ses duyurusu (kart çizilemezse, rollü)',
      where: 'Duyuru kanalı, üye etiketlenmez',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [s.levelUpAnnounce(member, 'ses', 15, sesRole)], allowedMentions: { users: [], roles: [] } }),
    },
    {
      id: 'duyuru-yedek-rolsuz',
      title: 'Ses duyurusu (kart çizilemezse, rolsüz)',
      where: 'Duyuru kanalı, rol verilemediyse; üye etiketlenmez',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [s.levelUpAnnounce(member, 'ses', 20, null)], allowedMentions: { users: [], roles: [] } }),
    },
    {
      id: 'hata-bot-seviye',
      title: 'Hata: bot seviyesi',
      where: '/seviye komutu bir botla',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [ui.alert('Botların seviyesi bulunmaz.', undefined, 'danger')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
  ];
};
