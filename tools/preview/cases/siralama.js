// Sıralama sistemi (src/systems/siralama/ui.js)
module.exports = ({ mock, src }) => {
  const s = src('systems/siralama/ui');
  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const names = ['Mehmet', 'Ayşe', 'Can', 'Elif', 'Burak', 'Zeynep', 'Emre', 'Deniz', 'Selin', 'Kerem', 'Ece', 'Onur', 'Pınar', 'Tuna', 'Melis', 'Arda', 'Naz', 'Kaan', 'İrem', 'Baran'];
  const users = names.map((n) => mock.user({ username: n.toLocaleLowerCase('tr'), displayName: n }));
  const ranking = (type) => users.map((u, i) => ({ userId: u.id, value: type === 'mesaj' ? 4800 - i * 213 : 90000 - i * 3700 }));
  const role = mock.role({ name: 'Üye', color: '#57f287' });
  const view = (o) => ({ guild, viewerId: users[17].id, type: 'mesaj', period: 'genel', days: 0, roleId: '0', page: 0, ranking: ranking(o.type ?? 'mesaj'), ...o });
  const msg = (o) => ({ components: [s.leaderboard(view(o))], allowedMentions: { parse: [] } });
  const where = '/siralama komutu, herkese açık; gezinme sadece komutu kullanana';

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
