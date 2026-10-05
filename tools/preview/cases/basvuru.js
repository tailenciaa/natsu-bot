// Yetkili alım (başvuru) sistemi (src/systems/basvuru/ui.js): gerçek ui fonksiyonları çağrılır
module.exports = ({ mock, ui, src }) => {
  const b = src('systems/basvuru/ui');
  const config = src('systems/basvuru/config');

  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const applicant = mock.user({ username: 'ahmet', displayName: 'Ahmet' });
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const other = mock.user({ username: 'can', displayName: 'Can' });
  const noMentions = { allowedMentions: { parse: [] } };
  const eph = { flags: ui.EPHEMERAL_CV2, allowedMentions: { parse: [] } };
  const channelId = mock.snowflake();
  const meetingChannel = config.voiceChannels[0].id;
  const alert = (message, hint, color) => ({ components: [ui.alert(message, hint, color)], ...eph });

  const answers = [
    { title: 'Ad ve Yaş', answer: 'Ahmet, 18' },
    { title: 'Aktiflik', answer: '4-5 saat' },
    { title: 'Deneyim', answer: '2 sunucuda 6 ay moderatörlük yaptım. Ticket ve ses kanallarına baktım.' },
    {
      title: 'Ekipte Olma Nedeni',
      answer: 'Sunucuda 1 yıldır aktifim ve yeni üyelere yardım etmeyi seviyorum. Ekibe düzenli vakit ayırabilirim, kuralları iyi biliyorum.',
    },
    { title: 'Ek Not', answer: 'Hafta sonları daha uzun süre aktifim.' },
  ];
  const longAnswers = [
    { title: 'Ad ve Yaş', answer: 'Ahmet Yılmaz Kaya, 18 yaşındayım ve öğrenciyim' },
    { title: 'Aktiflik', answer: 'Hafta içi 3-4 saat, hafta sonu 8 saat' },
    { title: 'Deneyim', answer: 'Daha önce 3 farklı sunucuda görev yaptım. '.repeat(11).trim() },
    { title: 'Ekipte Olma Nedeni', answer: `${'Ekibe katkı sağlamak, üyelerle ilgilenmek ve sunucuyu daha düzenli hale getirmek istiyorum. '.repeat(7)}\n\nTeşekkürler.` },
    { title: 'Ek Not', answer: 'Mülakat için her akşam müsaitim.\nDiscord dışında da ulaşabilirim.' },
  ];

  const base = () => ({
    id: `${guild.id}-12`,
    guildId: guild.id,
    number: 12,
    userId: applicant.id,
    username: applicant.username,
    accountCreatedAt: Date.now() - 800 * mock.DAY,
    joinedAt: Date.now() - 120 * mock.DAY,
    previous: { total: 0, rejected: 0 },
    answers,
    reviewerRoleId: config.roles.reviewer,
    acceptRoleId: config.roles.accept,
    status: 'pending',
    createdAt: Date.now() - 3 * mock.HOUR,
    channelId,
    messageId: mock.snowflake(),
    meetingBy: null,
    meetingAt: null,
    reviewedBy: null,
    reviewedAt: null,
    note: null,
    roleGiven: null,
  });
  const meeting = (o = {}) => ({ ...base(), ownerId: staff.id, meetingBy: staff.id, meetingAt: Date.now() - 40 * mock.MIN, meetingChannelId: meetingChannel, ...o });
  const rejected = (o = {}) => ({ ...base(), status: 'rejected', reviewedBy: staff.id, reviewedAt: Date.now() - mock.HOUR, ...o });
  const orientation = (o = {}, app = {}) => ({
    ...base(),
    status: 'approved',
    ownerId: staff.id,
    reviewedBy: staff.id,
    reviewedAt: Date.now() - mock.HOUR,
    orientation: { status: 'waiting', staffId: staff.id, suggestedChannelId: meetingChannel, channelId: null, messageId: null, ...o },
    ...app,
  });
  const active = (o = {}, app = {}) => orientation({ status: 'active', channelId: meetingChannel, messageId: mock.snowflake(), ...o }, app);

  const notice = (app, extra = {}) => ({ components: [b.applicationNotice(app, applicant)], ...noMentions, ...extra });
  const reviewerRole = base().reviewerRoleId;
  const voiceInfo = { staffId: staff.id, waitingIn: meetingChannel, until: Date.now() + 24 * mock.HOUR };

  return [
    {
      id: 'panel',
      title: 'Başvuru paneli',
      where: 'Yetkili alım bilgi kanalına bot açılırken gönderilen kalıcı panel',
      visibility: 'panel',
      kind: 'message',
      build: () => ({ components: [b.panel()] }),
    },
    {
      id: 'basvuru-modal',
      title: 'Başvuru formu',
      where: 'Panelde Başvur butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => b.applicationModal(),
    },
    {
      id: 'onay-modal',
      title: 'Başvuruyu onaylama formu',
      where: 'Başvuru mesajında Onayla butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => b.reviewModal(base(), 'onay'),
    },
    {
      id: 'red-modal',
      title: 'Başvuruyu reddetme formu',
      where: 'Başvuru mesajında Reddet butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => b.reviewModal(base(), 'red'),
    },
    {
      id: 'basvuru-bekleyen',
      title: 'Başvuru mesajı: yeni başvuru (incelenmeyi bekliyor)',
      where: 'Başvurular kanalı, form gönderilince inceleyen rolü etiketler',
      visibility: 'public',
      kind: 'message',
      build: () => notice(base(), { allowedMentions: { roles: [reviewerRole] } }),
    },
    {
      id: 'basvuru-onceki',
      title: 'Başvuru mesajı: önceki başvuruları olan üye',
      where: 'Başvurular kanalı, daha önce reddedilmiş başvurusu olan üye',
      visibility: 'public',
      kind: 'message',
      build: () => notice({ ...base(), previous: { total: 3, rejected: 2 }, joinedAt: null }, { allowedMentions: { roles: [reviewerRole] } }),
    },
    {
      id: 'basvuru-uzun',
      title: 'Başvuru mesajı: uzun cevaplar',
      where: 'Başvurular kanalı, form alanları sonuna kadar dolu',
      visibility: 'public',
      kind: 'message',
      build: () => notice({ ...base(), answers: longAnswers }, { allowedMentions: { roles: [reviewerRole] } }),
    },
    {
      id: 'basvuru-gorusme',
      title: 'Başvuru mesajı: görüşme bekleniyor',
      where: 'Başvurular kanalı, Görüşmeye Çağır butonuna basınca güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => notice(meeting()),
    },
    {
      id: 'basvuru-gorusme-kanalsiz',
      title: 'Başvuru mesajı: görüşmeye çağrıldı (yetkili kanalda değil)',
      where: 'Başvurular kanalı, çağıran yetkili bir görüşme kanalında değilken',
      visibility: 'public',
      kind: 'message',
      build: () => notice(meeting({ meetingChannelId: null })),
    },
    {
      id: 'basvuru-gorusmede',
      title: 'Başvuru mesajı: görüşme sürüyor',
      where: 'Başvurular kanalı, yetkili ve başvuran aynı kanala girince güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => notice(meeting({ meeting: { channelId: meetingChannel, startedAt: Date.now() - 10 * mock.MIN, endedAt: null, messageId: null } })),
    },
    {
      id: 'basvuru-gorusme-bitti',
      title: 'Başvuru mesajı: görüşme bitti, karar bekleniyor',
      where: 'Başvurular kanalı, başvuran görüşme kanalından ayrılınca güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () =>
        notice(meeting({ meeting: { channelId: meetingChannel, startedAt: Date.now() - 25 * mock.MIN, endedAt: Date.now() - 2 * mock.MIN, messageId: null } })),
    },
    {
      id: 'basvuru-reddedildi',
      title: 'Başvuru mesajı: reddedildi (sebepli)',
      where: 'Başvurular kanalı, Reddet formu gönderilince güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => notice(rejected({ note: 'Aktiflik süren şu an için yeterli değil.' })),
    },
    {
      id: 'basvuru-onaylandi-bekliyor',
      title: 'Başvuru mesajı: onaylandı, oryantasyon bekleniyor',
      where: 'Başvurular kanalı, Onayla formu gönderilince güncellenir (oryantasyon butonlarıyla)',
      visibility: 'public',
      kind: 'message',
      build: () => notice(orientation({}, { note: 'Görüşmede çok iyiydin.' })),
    },
    {
      id: 'basvuru-oryantasyonda',
      title: 'Başvuru mesajı: oryantasyon sürüyor',
      where: 'Başvurular kanalı, oryantasyon başlayınca güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => notice(active()),
    },
    {
      id: 'basvuru-yetkili-bekleniyor',
      title: 'Başvuru mesajı: oryantasyon sürüyor, yetkili ayrıldı',
      where: 'Başvurular kanalı, oryantasyonu veren yetkili kanaldan ayrılınca',
      visibility: 'public',
      kind: 'message',
      build: () => notice(active({ staffNeeded: true })),
    },
    {
      id: 'basvuru-ekipte',
      title: 'Başvuru mesajı: ekibe katıldı',
      where: 'Başvurular kanalı, oryantasyon tamamlanınca güncellenir',
      visibility: 'public',
      kind: 'message',
      build: () => notice(active({ status: 'completed', levelLabel: 'Stajyer Yetkili', areaLabels: ['Ticket', 'Sorun Çözücü'] })),
    },
    {
      id: 'basvuru-ekipte-tek-alan',
      title: 'Başvuru mesajı: ekibe katıldı (tek alan)',
      where: 'Başvurular kanalı, tek görev alanı seçilmişse',
      visibility: 'public',
      kind: 'message',
      build: () => notice(active({ status: 'completed', levelLabel: 'Stajyer Yetkili', areaLabels: ['Ticket'] })),
    },
    {
      id: 'basvuru-oryantasyon-iptal',
      title: 'Başvuru mesajı: oryantasyon iptal edildi (ceza ile)',
      where: 'Başvurular kanalı, başvuran defalarca ayrılınca otomatik iptal',
      visibility: 'public',
      kind: 'message',
      build: () =>
        notice(
          active({ status: 'cancelled', cancelledBy: null, cancelReason: 'Başvuran oryantasyon sırasında 3 kez kanaldan ayrıldı.' }, { penaltyUntil: Date.now() + 7 * mock.DAY }),
        ),
    },
    {
      id: 'basvuru-oryantasyon-iptal-yetkili',
      title: 'Başvuru mesajı: oryantasyon yetkili tarafından iptal edildi',
      where: 'Başvurular kanalı, yetkili İptal formunu gönderince',
      visibility: 'public',
      kind: 'message',
      build: () => notice(active({ status: 'cancelled', cancelledBy: other.id, cancelReason: 'Başvuran oryantasyona gelmedi.' })),
    },
    {
      id: 'sicil-gorunum',
      title: 'Başvuru mesajı: sicil görünümü (salt okunur, etiketsiz)',
      where: 'Sicil, Başvurular sekmesinde bir başvuru seçilince',
      visibility: 'public',
      kind: 'message',
      build: () => notice(base()),
    },
    {
      id: 'dm-gorusme-kanalli',
      title: 'DM: görüşmeye çağrıldın (yetkili kanalda bekliyor)',
      where: 'Başvurana DM, Görüşmeye Çağır butonuna basılınca',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.meetingDm(meeting(), guild.name, voiceInfo)] }),
    },
    {
      id: 'dm-gorusme-kanalsiz',
      title: 'DM: görüşmeye çağrıldın (kanal seçeneklerinden biri)',
      where: 'Başvurana DM, yetkili bir görüşme kanalında değilken',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.meetingDm(meeting(), guild.name, { ...voiceInfo, waitingIn: null })] }),
    },
    {
      id: 'dm-gorusme-seskapali',
      title: 'DM: görüşmeye çağrıldın (ses kanalları açılamadı)',
      where: 'Başvurana DM, kanalların kilidi açılamadıysa',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.meetingDm(meeting(), guild.name, null)] }),
    },
    {
      id: 'dm-red',
      title: 'DM: başvurun reddedildi (sebepli, bekleme süreli)',
      where: 'Başvurana DM, Reddet formu gönderilince',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.resultDm(rejected({ note: 'Aktiflik süren şu an için yeterli değil.' }), guild.name, Date.now() + 7 * mock.DAY)] }),
    },
    {
      id: 'dm-red-sebepsiz',
      title: 'DM: başvurun reddedildi (süre yok)',
      where: 'Başvurana DM, bekleme süresi tanımsızsa ve sebep yazılmadıysa',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.resultDm(rejected(), guild.name, null)] }),
    },
    {
      id: 'dm-yetkili-gorusme',
      title: 'DM: başvuran seni bekliyor (görüşme)',
      where: 'Görüşmeye çağıran yetkiliye DM, başvuran görüşme kanalına girince',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.applicantWaitingDm(meeting(), guild.name, meetingChannel, false)] }),
    },
    {
      id: 'dm-yetkili-oryantasyon',
      title: 'DM: başvuran seni bekliyor (oryantasyon)',
      where: 'Oryantasyonu verecek yetkiliye DM, başvuran görüşme kanalına girince',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [b.applicantWaitingDm(orientation(), guild.name, meetingChannel, true)] }),
    },
    {
      id: 'log-gorusme-basladi',
      title: 'Log: görüşme başladı',
      where: 'Kayıt kanalı, başvuru mesajına yanıt olarak',
      visibility: 'log',
      kind: 'message',
      build: () => ({ components: [b.meetingLog(meeting({ meeting: { channelId: meetingChannel, startedAt: Date.now() - 5 * mock.MIN, endedAt: null, messageId: null } }))], ...noMentions }),
    },
    {
      id: 'log-gorusme-bitti',
      title: 'Log: görüşme bitti',
      where: 'Kayıt kanalı, başvuran kanaldan ayrılınca ya da karar verilince güncellenir',
      visibility: 'log',
      kind: 'message',
      build: () =>
        ({
          components: [b.meetingLog(meeting({ meeting: { channelId: meetingChannel, startedAt: Date.now() - 25 * mock.MIN, endedAt: Date.now() - 2 * mock.MIN, messageId: null } }))],
          ...noMentions,
        }),
    },
  ];
};
