// Seviye sistemi (src/systems/seviye): kartlar canvas ile çizilen PNG olduğu için
// önizlemede aynı boyutta yer tutucu PNG kullanılır; mesaj düzeni ve metinler gerçek ui fonksiyonlarından gelir.
module.exports = ({ mock, ui, src }) => {
  const s = src('systems/seviye/ui');
  const level = (name, o = {}) => mock.user({ username: name, displayName: name, ...o });

  const member = level('mehmet');
  const role = mock.role({ name: 'Mesaj Seviye 15', color: '#57f287' });
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
      title: 'Seviye atlama duyurusu (kart)',
      where: 'Duyuru kanalı, ana seviyelerde; sadece seviye atlayan üye etiketlenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [],
        content: `<@${member.id}>`,
        flags: 0,
        files: [card('seviye-atladi.png', 900, 310, 'Seviye atlama kartı')],
        allowedMentions: { users: [member.id] },
      }),
    },
    {
      id: 'duyuru-yedek-rol',
      title: 'Seviye atlama duyurusu (yedek metin, rollü)',
      where: 'Duyuru kanalı, kart çizilemezse',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [s.levelUpAnnounce(member, 'mesaj', 15, role)], allowedMentions: { users: [member.id] } }),
    },
    {
      id: 'duyuru-yedek-rolsuz',
      title: 'Seviye atlama duyurusu (yedek metin, rolsüz)',
      where: 'Duyuru kanalı, kart çizilemezse ve rol verilemediyse',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [s.levelUpAnnounce(member, 'ses', 20, null)], allowedMentions: { users: [member.id] } }),
    },
    {
      id: 'hata-bot-seviye',
      title: 'Hata: bot seviyesi',
      where: '/seviye komutu bir botla',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [ui.alert('Botların seviyesi bulunmaz.', undefined, 'danger')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'test-onay',
      title: 'Test duyurusu: gönderildi',
      where: '/seviye test:True, yöneticiye',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [ui.alert('Örnek duyuru <#1538534603902554182> kanalına gönderildi.')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
  ];
};
