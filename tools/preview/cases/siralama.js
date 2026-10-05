// Sıralama grubu: sıralama (siralama/ui.js), haftanın aktifleri, saygınlık ve VIP mesajları
module.exports = ({ mock, src }) => {
  const s = src('systems/siralama/ui');
  const aktif = src('systems/aktif/ui');
  const saygi = src('systems/saygi/ui');
  const vip = src('systems/vip/ui');
  const aktifConfig = src('systems/aktif/config');
  const saygiConfig = src('systems/saygi/config');
  const vipConfig = src('systems/vip/config');
  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const names = ['Mehmet', 'Ayşe', 'Can', 'Elif', 'Burak', 'Zeynep', 'Emre', 'Deniz', 'Selin', 'Kerem', 'Ece', 'Onur', 'Pınar', 'Tuna', 'Melis', 'Arda', 'Naz', 'Kaan', 'İrem', 'Baran'];
  const users = names.map((n) => mock.user({ username: n.toLocaleLowerCase('tr'), displayName: n }));
  const ranking = (type) => users.map((u, i) => ({ userId: u.id, value: type === 'mesaj' ? 4800 - i * 213 : 90000 - i * 3700 }));
  const role = mock.role({ name: 'Üye', color: '#57f287' });
  const view = (o) => ({ guild, viewerId: users[17].id, type: 'mesaj', period: 'genel', days: 0, roleId: '0', page: 0, ranking: ranking(o.type ?? 'mesaj'), ...o });
  const msg = (o) => ({ components: [s.leaderboard(view(o))], allowedMentions: { parse: [] } });
  const where = '/siralama komutu, herkese açık; gezinme sadece komutu kullanana';
  const pub = { allowedMentions: { parse: [] } };
  const top = (n, f) => users.slice(0, n).map((u, i) => ({ userId: u.id, value: f(i) }));

  return [
    { id: 'mesaj-genel', title: 'Mesaj sıralaması, genel, 1. sayfa', where, visibility: 'public', kind: 'message', build: () => msg({}) },
    {
      id: 'mesaj-genel-sayfa2',
      title: 'Mesaj sıralaması, 2. sayfa (komutu kullanan sayfada yok)',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => msg({ page: 1, viewerId: users[2].id }),
    },
    { id: 'ses-haftalik', title: 'Ses sıralaması, haftalık', where, visibility: 'public', kind: 'message', build: () => msg({ type: 'ses', period: 'haftalik' }) },
    {
      id: 'rol-filtreli',
      title: 'Mesaj sıralaması, rol filtreli',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => msg({ roleId: role.id, ranking: ranking('mesaj').slice(0, 6) }),
    },
    {
      id: 'ozel-sure',
      title: 'Mesaj sıralaması, özel süre (son 30 gün)',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => msg({ period: 'ozel', days: 30 }),
    },
    { id: 'bos', title: 'Sıralama: veri yok', where, visibility: 'public', kind: 'message', build: () => msg({ ranking: [] }) },
    { id: 'tek-sayfa', title: 'Sıralama: tek sayfa (sayfa butonları yok)', where, visibility: 'public', kind: 'message', build: () => msg({ ranking: ranking('ses').slice(0, 8), type: 'ses' }) },
    {
      id: 'aktif-haftalik',
      title: 'Haftanın aktifleri duyurusu',
      where: 'Her pazartesi haftalık kanal',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [aktif.weeklyAnnounce(guild, { ses: top(5, (i) => 40000 - i * 5100), mesaj: top(5, (i) => 2100 - i * 310), yayin: top(3, (i) => 9000 - i * 2500) })],
        ...pub,
      }),
    },
    {
      id: 'aktif-kismi',
      title: 'Haftanın aktifleri: bir kategoride kayıt yok',
      where: 'Her pazartesi haftalık kanal',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [aktif.weeklyAnnounce(guild, { ses: top(2, (i) => 7200 - i * 900), mesaj: top(1, () => 120), yayin: [] })], ...pub }),
    },
    { id: 'saygi-verildi', title: 'Saygınlık verildi', where: '/saygi-ver ya da +rep', visibility: 'public', kind: 'message', build: () => ({ components: [saygi.given(users[0].id, users[1].id, 7)], ...pub }) },
    { id: 'saygi-tablo', title: 'Saygınlık tablosu', where: '/saygi-siralama', visibility: 'public', kind: 'message', build: () => ({ components: [saygi.table(guild, top(15, (i) => 60 - i * 3))], ...pub }) },
    { id: 'saygi-bos', title: 'Saygınlık tablosu: kayıt yok', where: '/saygi-siralama', visibility: 'public', kind: 'message', build: () => ({ components: [saygi.table(guild, [])], ...pub }) },
    {
      id: 'saygi-haftalik',
      title: 'Haftanın saygın üyesi duyurusu',
      where: 'Her pazartesi saygı kanalı',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [saygi.weeklyAnnounce(guild, top(5, (i) => 14 - i * 2), saygiConfig.roleId)], ...pub }),
    },
    { id: 'vip-verildi', title: 'VIP rolü verildi', where: '/vip-ver', visibility: 'public', kind: 'message', build: () => ({ components: [vip.given(users[0].id, users[1].id, vipConfig.roleId)], ...pub }) },
    {
      id: 'vip-liste',
      title: 'VIP listesi (2 sayfa)',
      where: '/vip-siralama',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [vip.table(guild, users.map((u, i) => ({ userId: u.id, grantedAt: i < 18 ? Date.now() - (20 - i) * 86400000 : 0 })), 0)], ...pub }),
    },
    { id: 'vip-bos', title: 'VIP listesi: boş', where: '/vip-siralama', visibility: 'public', kind: 'message', build: () => ({ components: [vip.table(guild, [], 0)], ...pub }) },
    {
      id: 'ozel-sure-modal',
      title: 'Özel süre formu',
      where: 'Özel Süre butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => s.customModal('mesaj', '0'),
    },
  ];
};
