// Kalıcı oda sistemi (src/systems/kalici-oda/ui.js)
module.exports = ({ mock, src }) => {
  const k = src('systems/kalici-oda/ui');
  // Panelin şart durumu gerçek ölçüm kapısından (index.denetim) gelir: case kendi sayılarını uydurmaz
  const denetim = src('systems/kalici-oda/index').denetim;
  const { weekKey, previousWeekKey } = src('systems/aktif/week');
  const owner = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const a = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const b = mock.user({ username: 'fatma', displayName: 'Fatma' });
  const c = mock.user({ username: 'can', displayName: 'Can' });
  const reviewer = mock.user({ username: 'yetkili', displayName: 'Yetkili' });

  const guild = mock.guild({ id: '1' });
  const voice = mock.channel({ name: 'muzik-odasi', type: 'voice', guild });
  const text = mock.channel({ name: 'muzik-odasi', type: 'text', guild });
  const category = mock.channel({ name: 'Müzik Odası', type: 'category', guild });
  const applications = mock.channel({ name: 'kalici-oda-basvuruları', guild });

  // Biten haftaların ölçümleri denetimin kendi pazartesi anahtarlarıyla yazılır: ay toplamı ve kaçan hafta
  // böylece gerçek takvime oturur, kartta uydurma tarih görünmez. Ölçüler SANİYE (mock.HOUR milisaniyedir).
  const sec = (hours) => hours * 3600;
  const weeks = {
    [previousWeekKey()]: sec(28), // hedefin altında: bir hafta kaçmış
    [weekKey(Date.now() - 14 * mock.DAY)]: sec(44),
  };

  const room = (o = {}) => ({
    id: '1-0001',
    no: 1,
    guildId: '1',
    ownerId: owner.id,
    name: 'Müzik Odası',
    members: [a.id, b.id, c.id],
    limit: 20,
    categoryId: category.id,
    voiceChannelId: voice.id,
    textChannelId: text.id,
    weeks,
    createdAt: mock.ago(6 * mock.DAY),
    ...o,
  });

  const app = (o = {}) => ({
    id: '1-0007',
    guildId: '1',
    number: 7,
    userId: owner.id,
    username: owner.username,
    roomName: 'Müzik Odası',
    purpose: 'Her akşam aynı saatte bir araya gelip birlikte müzik dinlemek ve kaydetmek için.',
    members: [a.id, b.id, c.id],
    voiceSeconds: 226800,
    voiceOk: true,
    status: 'pending',
    createdAt: mock.ago(40 * mock.MIN),
    channelId: applications.id,
    messageId: mock.id(),
    reviewedBy: null,
    reviewedAt: null,
    note: null,
    roomId: null,
    ...o,
  });

  const where = 'Kalıcı oda başvuru kanalı';
  const noMentions = { allowedMentions: { parse: [] } };
  const message = (container) => ({ components: [container], ...noMentions });

  const second = room({
    id: '1-0002',
    no: 2,
    name: 'Film Odası',
    ownerId: a.id,
    members: [b.id],
    limit: 0,
    voiceChannelId: mock.channel({ name: 'film-odasi', type: 'voice', guild }).id,
    textChannelId: mock.channel({ name: 'film-odasi', type: 'text', guild }).id,
    createdAt: mock.ago(3 * mock.DAY),
  });

  return [
    { id: 'panel', title: 'Başvuru paneli: kurallar ve gereksinimler', where: 'Kalıcı oda bilgi kanalı', visibility: 'panel', kind: 'message', build: () => message(k.applyPanel()) },
    { id: 'form', title: 'Form: kalıcı oda başvurusu', where: 'Başvuru Yap butonu', visibility: 'ephemeral', kind: 'modal', build: () => k.applicationModal() },
    {
      id: 'basvuru-alindi',
      title: 'Başvuru alındı: kanala düşen özet',
      where: 'Başvuru formu gönderilince',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => message(k.submitted({ user: owner, app: app(), memberCount: 4 })),
    },

    { id: 'kart-bekleyen', title: 'Başvuru kartı: inceleniyor', where, visibility: 'public', kind: 'message', build: () => message(k.applicationCard(app())) },
    {
      id: 'kart-onayli',
      title: 'Başvuru kartı: onaylandı, kanallar açıldı',
      where,
      visibility: 'public',
      kind: 'message',
      build: () => message(k.applicationCard(app({ status: 'approved', reviewedBy: reviewer.id, reviewedAt: mock.ago(2 * mock.HOUR), roomId: room().id }), room())),
    },
    {
      id: 'kart-ret',
      title: 'Başvuru kartı: reddedildi',
      where,
      visibility: 'public',
      kind: 'message',
      build: () =>
        message(
          k.applicationCard(
            app({
              status: 'rejected',
              voiceSeconds: 90000,
              voiceOk: false,
              reviewedBy: reviewer.id,
              reviewedAt: mock.ago(20 * mock.MIN),
              note: 'Odayı birlikte kullanacak kadar aktif üye görünmedi; bir sonraki başvuruda tekrar görüşülebilir.',
            }),
          ),
        ),
    },
    { id: 'form-ret', title: 'Form: başvuru red sebebi', where: 'Reddet butonu', visibility: 'ephemeral', kind: 'modal', build: () => k.rejectModal(app()) },

    { id: 'teslim', title: 'Sahibine giden teslim kartı', where: 'Doğrudan mesaj', visibility: 'dm', kind: 'message', build: () => message(k.readyCard(room())) },
    {
      id: 'duyuru-acildi',
      title: 'Duyuru kartı: kalıcı oda açıldı',
      where: 'Kalıcı oda duyuru kanalı',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.openedNotice(room())),
    },
    {
      id: 'duyuru-kapatildi',
      title: 'Duyuru kartı: kalıcı oda kapatıldı',
      where: 'Kalıcı oda duyuru kanalı',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.closedNotice(second, 'Sahibi sunucudan ayrıldı.')),
    },
    {
      id: 'dm-ret',
      title: 'Başvurana giden ret kartı',
      where: 'Doğrudan mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () => message(k.rejectedCard(app({ status: 'rejected', reviewedBy: reviewer.id, reviewedAt: mock.ago(20 * mock.MIN), note: 'Odayı birlikte kullanacak kadar aktif üye görünmedi.' }))),
    },

    {
      id: 'oda-paneli',
      title: '/kalici-oda odam: oda kontrol paneli ve şart durumu',
      where: 'Komutla açıldığı kanal',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.roomPanel(room(), denetim.statusOf(room()))),
    },
    {
      id: 'oda-paneli-yeni',
      title: '/kalici-oda odam: henüz haftalık kaydı olmayan oda',
      where: 'Komutla açıldığı kanal',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.roomPanel(second, denetim.statusOf(second))),
    },
    {
      id: 'uyari-hafta',
      title: 'Haftalık şart kaçınca sahibine giden uyarı',
      where: 'Doğrudan mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () => message(k.weekMissedCard(room(), previousWeekKey(), sec(28))),
    },
    {
      id: 'dm-sart-kapanis',
      title: 'Ay sonu şart denetiminde kapanan oda',
      where: 'Doğrudan mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () =>
        message(
          k.inactivityCard(room(), {
            month: denetim.monthKey(Date.now() - 32 * mock.DAY),
            weeks: 4,
            missed: 1,
            total: sec(118),
            required: sec(150),
          }),
        ),
    },
    { id: 'form-limit', title: 'Form: kişi limiti', where: 'Limiti Ayarla butonu', visibility: 'ephemeral', kind: 'modal', build: () => k.limitModal(20) },
    { id: 'form-isim', title: 'Form: oda ismi', where: 'İsmi Değiştir butonu', visibility: 'ephemeral', kind: 'modal', build: () => k.renameModal('Müzik Odası') },

    { id: 'liste', title: '/kalici-oda liste: iki oda ve bekleyen başvuru', where: 'Yetkili komut kanalı', visibility: 'public', kind: 'message', build: () => message(k.roomList([room(), second], 3)) },
    { id: 'liste-bos', title: '/kalici-oda liste: hiç oda yok', where: 'Yetkili komut kanalı', visibility: 'public', kind: 'message', build: () => message(k.roomList([], 0)) },
  ];
};
