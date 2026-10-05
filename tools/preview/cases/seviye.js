// Seviye ve profil sistemleri (src/systems/seviye, src/systems/profil): kartlar canvas ile çizilen PNG olduğu için
// önizlemede aynı boyutta yer tutucu PNG kullanılır; mesaj düzeni ve metinler gerçek ui fonksiyonlarından gelir.
module.exports = ({ mock, ui, src }) => {
  const s = src('systems/seviye/ui');
  const p = src('systems/profil/ui');
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
      id: 'profil-sahibi',
      title: 'Profil kartı: kendi profili, tema seçili',
      where: '/profil komutu, herkese açık; kontrolleri sadece sahibi kullanır',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.profile('profil.png', true, 'gece')], files: [card('profil.png', 1000, 676, 'Profil kartı')], ...noMentions }),
    },
    {
      id: 'profil-sahibi-temasiz',
      title: 'Profil kartı: kendi profili, tema seçilmemiş',
      where: '/profil komutu, ilk açılış ya da Sıfırla sonrası',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.profile('profil.png', true, null)], files: [card('profil.png', 1000, 676, 'Profil kartı')], ...noMentions }),
    },
    {
      id: 'profil-baskasi',
      title: 'Profil kartı: başka üyenin profili',
      where: '/profil komutu başka üyeyle; kontrol yok',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.profile('profil.png', false)], files: [card('profil.png', 1000, 676, 'Profil kartı')], ...noMentions }),
    },
    {
      id: 'bio-modal-bos',
      title: 'Biyografi formu: boş',
      where: 'Profilde Biyografi butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.bioModal({}),
    },
    {
      id: 'bio-modal-dolu',
      title: 'Biyografi formu: dolu',
      where: 'Profilde Biyografi butonuna basınca açılır, kayıtlı değerlerle',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.bioModal({ bio: 'Anime izlemeyi ve gece sohbetlerini severim.', title: 'Anime Sever' }),
    },
    {
      id: 'renk-modal',
      title: 'Renk formu',
      where: 'Profilde Renk butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.colorModal({ color: 0xff5599 }),
    },
    {
      id: 'kapak-modal',
      title: 'Kapak formu',
      where: 'Profilde Kapak butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.bannerModal({ banner: 'https://i.imgur.com/ornek.png' }),
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
      id: 'hata-bot-profil',
      title: 'Hata: bot profili',
      where: '/profil komutu bir botla',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [ui.alert('Botların profili bulunmaz.', undefined, 'danger')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'hata-renk',
      title: 'Hata: geçersiz renk',
      where: 'Renk formu gönderilince',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [ui.alert('Renk anlaşılamadı.', 'Örnek: #ff5599 ya da ff5599', 'danger')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
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
