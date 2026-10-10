// Çekiliş sistemi (src/systems/cekilis/ui.js)
module.exports = ({ mock, src }) => {
  const c = src('systems/cekilis/ui');
  const users = ['Mehmet', 'Ayşe', 'Can', 'Elif', 'Burak', 'Zeynep'].map((n) => mock.user({ username: n.toLocaleLowerCase('tr'), displayName: n }));
  const role = mock.role({ name: 'Üye', color: '#57f287' });
  const noMentions = { allowedMentions: { parse: [] } };
  const where = 'Çekiliş kanalı, herkese açık';

  const base = {
    no: 7,
    channelId: mock.snowflake(),
    messageId: mock.snowflake(),
    prize: '1 Aylık Discord Nitro',
    description: 'Sunucuya katılan herkesin katılabildiği, ödülü sunucu sahibinin verdiği haftalık çekiliş.',
    winnerCount: 2,
    endsAt: Date.now() + 3 * mock.HOUR,
    hostId: users[0].id,
    roleId: null,
    participants: users.slice(1).map((u) => u.id),
    winners: [],
    status: 'active',
  };
  const msg = (container) => ({ components: [container], ...noMentions });

  return [
    { id: 'panel-acik', title: 'Çekiliş: açık (yönetim butonlarıyla)', where, visibility: 'public', kind: 'message', build: () => msg(c.panel(base)) },
    { id: 'panel-rol', title: 'Çekiliş: rol şartlı, açıklamasız', where, visibility: 'public', kind: 'message', build: () => msg(c.panel({ ...base, roleId: role.id, description: null })) },
    {
      id: 'panel-bitti',
      title: 'Çekiliş: bitti (kazananlarla)',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => msg(c.panel({ ...base, status: 'ended', endsAt: Date.now() - mock.HOUR, winners: [users[1].id, users[2].id] })),
    },
    {
      id: 'panel-bitti-kazanansiz',
      title: 'Çekiliş: bitti (kazanan yok)',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => msg(c.panel({ ...base, status: 'ended', endsAt: Date.now() - mock.HOUR, participants: [], winners: [] })),
    },
    { id: 'panel-iptal', title: 'Çekiliş: iptal edildi', where, visibility: 'public', kind: 'message', build: () => msg(c.panel({ ...base, status: 'cancelled' })) },
    {
      id: 'duyuru-kazanan',
      title: 'Kazanan duyurusu (çekiliş mesajına yanıt)',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [c.winners(base, [users[1].id, users[2].id], false)], allowedMentions: { users: [users[1].id, users[2].id] } }),
    },
    {
      id: 'duyuru-yeniden',
      title: 'Yeniden çekiliş duyurusu',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [c.winners(base, [users[3].id], true)], allowedMentions: { users: [users[3].id] } }),
    },
    { id: 'duyuru-kazanan-yok', title: 'Kazanan çıkmadı (kimse katılmadı)', where, visibility: 'public', kind: 'message', build: () => msg(c.noWinner({ ...base, participants: [] })) },
    { id: 'duyuru-uygun-yok', title: 'Kazanan çıkmadı (katılanlar uygun değil)', where, visibility: 'public', kind: 'message', build: () => msg(c.noWinner(base)) },
    { id: 'zaten-katildin', title: 'Zaten katıldın (ayrılma butonlu)', where: 'Katıl butonuna ikinci basış', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [c.joined(base)], ...noMentions }) },
    { id: 'onay-bitir', title: 'Onay: çekilişi bitir', where: 'Bitir butonu', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [c.confirm('bitir', base)], ...noMentions }) },
    { id: 'onay-iptal', title: 'Onay: çekilişi iptal et', where: 'İptal Et butonu', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [c.confirm('iptal', base)], ...noMentions }) },
    { id: 'form-olustur', title: 'Form: çekiliş oluştur', where: '/cekilis baslat', visibility: 'ephemeral', kind: 'modal', build: () => c.createModal(mock.snowflake(), role.id) },
    { id: 'form-duzenle', title: 'Form: çekilişi düzenle', where: 'Düzenle butonu', visibility: 'ephemeral', kind: 'modal', build: () => c.editModal(base) },

    // /cekilis liste: açık çekilişler ve son sonuçlananlar tek yönetim kartında
    {
      id: 'yonetim-paneli',
      title: 'Çekiliş yönetimi: açık ve sonuçlanmış çekilişler',
      where: '/cekilis liste, sadece yöneticiye görünür',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          c.managementPanel({
            active: [
              { ...base, url: 'https://discord.com/channels/1/2/3' },
              {
                ...base,
                no: 8,
                prize: 'Rolıblop Aboneliği',
                winnerCount: 1,
                endsAt: Date.now() + 2 * mock.DAY,
                roleId: role.id,
                participants: users.slice(2).map((u) => u.id),
                url: 'https://discord.com/channels/1/2/4',
              },
            ],
            ended: [{ ...base, no: 6, status: 'ended', winners: [users[4].id], endsAt: Date.now() - mock.DAY }],
            channelId: base.channelId,
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'yonetim-paneli-bos',
      title: 'Çekiliş yönetimi: açık çekiliş yok',
      where: '/cekilis liste, yeni sunucuda',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [c.managementPanel({ active: [], ended: [], channelId: base.channelId })], ...noMentions }),
    },
  ];
};
