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
  const category = mock.channel({ name: 'Kalıcı Odalar', type: 'category', guild });
  const applications = mock.channel({ name: 'kalici-oda-basvuruları', guild });

  // Odadaki üyelerin görünen adları: panelin çıkar/devret menüleri bu isimlerle dolar (index rosterOf'un karşılığı)
  const names = { [a.id]: 'Ayşe Yılmaz', [b.id]: 'Fatma Demir', [c.id]: 'Can Kaya' };
  const rosterOf = (room) => room.members.map((id) => ({ id, name: names[id] ?? 'Üye' }));

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
    textChannelId: null, // yeni odalarda ayrı yazı kanalı yok; sohbet ses kanalının kendi yazısı
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

  // Eski bir oda kaydı: ayrı yazı kanalı ve limitsiz oda. textChannelId artık hiçbir kartta gösterilmez.
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
    {
      id: 'uye-secimi',
      title: 'Başvurunun ilk adımı: üye seçme menüsü',
      where: 'Başvuru Yap butonu',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => message(k.memberPicker()),
    },
    { id: 'form', title: 'Form: kalıcı oda başvurusu', where: 'Formu Aç butonu', visibility: 'ephemeral', kind: 'modal', build: () => k.applicationModal() },
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
      title: '/kalici-oda: oda kontrol paneli ve şart durumu',
      where: 'Komutla açıldığı kanal',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.roomPanel(room(), denetim.statusOf(room()), rosterOf(room()))),
    },
    {
      id: 'oda-paneli-yeni',
      title: '/kalici-oda: henüz haftalık kaydı olmayan oda',
      where: 'Komutla açıldığı kanal',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.roomPanel(second, denetim.statusOf(second), rosterOf(second))),
    },
    {
      id: 'oda-paneli-yalniz',
      title: '/kalici-oda: odada başka üye yokken üye menüleri',
      where: 'Komutla açıldığı kanal',
      visibility: 'public',
      kind: 'message',
      build: () => {
        const solo = room({ id: '1-0003', no: 3, members: [], limit: 0 });
        return message(k.roomPanel(solo, denetim.statusOf(solo), rosterOf(solo)));
      },
    },
    {
      id: 'oda-paneli-yonetici',
      title: '/kalici-oda: yöneticinin oda paneli, oda yönetimi düğmesiyle',
      where: 'Komutla açıldığı kanal',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.roomPanel(room(), denetim.statusOf(room()), rosterOf(room()), true)),
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

    // Yönetici tarafı: ayrı komut yok. Odası olan yönetici listeyi oda panelindeki düğmeden gizli açar, odası
    // olmayan yönetici /kalici-oda ile doğrudan açar (komutla açılan sayfa kalıcı ve açık). Oda numarası yazılmaz.
    {
      id: 'yonet-liste',
      title: 'Odaları Yönet: iki oda ve bekleyen başvuru',
      where: 'Oda panelindeki "Odaları Yönet" düğmesi',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => message(k.roomAdmin([room(), second], new Map([[owner.id, 'Mehmet'], [a.id, 'Ayşe Yılmaz']]), 3)),
    },
    {
      id: 'yonet-liste-bos',
      title: 'Odaları Yönet: hiç oda yok',
      where: '/kalici-oda · odası olmayan yönetici',
      visibility: 'public',
      kind: 'message',
      build: () => message(k.roomAdmin([], new Map(), 0)),
    },
    {
      id: 'yonet-oda',
      title: 'Oda yönetim kartı: devir menüsü ve kapatma düğmesi',
      where: 'Odaları Yönet · oda seçilince',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => message(k.roomAdminCard(room(), denetim.statusOf(room()))),
    },
    {
      id: 'yonet-devredildi',
      title: 'Oda yönetim kartı: sahiplik devrinden sonra',
      where: 'Devir menüsü seçilince',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => message(k.roomAdminCard(room({ ownerId: a.id, members: [owner.id, b.id, c.id] }), denetim.statusOf(room()), `**Sahiplik devredildi:** <@${owner.id}> yeni sahip; odasına **/kalici-oda** ile erişiyor.`)),
    },
    { id: 'form-kapat', title: 'Form: odayı kapatma sebebi', where: 'Odayı Kapat butonu', visibility: 'ephemeral', kind: 'modal', build: () => k.closeModal(room()) },
  ];
};
