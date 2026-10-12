// Değerlendirme sistemi (src/systems/degerlendirme/ui.js): puanlama DM'leri, değerlendirme ve şikayet kanalı kartları,
// itiraz / yorum formları. Kayıtlar store'daki gerçek alan adlarıyla elde kuruluyor (mock.rating fabrikası yok).
module.exports = ({ mock, src }) => {
  const d = src('systems/degerlendirme/ui');

  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const uye = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const yetkili = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const lider = mock.user({ username: 'can', displayName: 'Can' });

  // Store'daki değerlendirme kaydı: id, kategori, kaynak numarası, taraflar, puan, kanal mesajı ve itiraz alanları
  const kayit = (o = {}) => ({
    id: o.id ?? 'destek-8',
    category: o.category ?? 'destek',
    guildId: guild.id,
    guildName: guild.name,
    ticketNumber: o.ticketNumber,
    applicationNumber: o.applicationNumber,
    partnerNumber: o.partnerNumber,
    staffId: o.staffId ?? yetkili.id,
    staffName: o.staffName ?? yetkili.displayName,
    userId: o.userId ?? uye.id,
    score: o.score ?? null,
    comment: o.comment ?? '',
    ratedAt: o.ratedAt ?? mock.ago(2 * mock.HOUR),
    channelId: o.channelId ?? null,
    messageId: o.messageId ?? null,
    repAt: o.repAt ?? null,
    reportedAt: o.reportedAt ?? null,
    reportReason: o.reportReason ?? null,
    reportStatus: o.reportStatus ?? null,
    reviewedBy: o.reviewedBy ?? null,
    reviewedAt: o.reviewedAt ?? null,
    repliedAt: o.repliedAt ?? null,
    staffReply: o.staffReply ?? null,
    meetingBy: o.meetingBy ?? null,
    meetingAt: o.meetingAt ?? null,
    meetingChannelId: o.meetingChannelId ?? null,
    leaderRoleId: o.leaderRoleId ?? null,
    removedAt: o.removedAt ?? null,
    removedBy: o.removedBy ?? null,
  });

  const noMentions = { allowedMentions: { parse: [] } };

  // Kartın geçtiği değerlendirme kanalı mesajı: itiraz/yorum durumları aynı mesajda güncellenir
  const kart = (o) => d.ratingNotice(kayit({ ticketNumber: 8, score: 4, comment: 'Sorunumu hızlıca çözdü, teşekkürler.', ...o }), yetkili);

  // Şikayet kanalı: lider rolü etiketlenir, karar butonları sonuçlanana kadar durur
  const sikayet = (o) => d.ratingComplaint(kayit({
    id: 'destek-11',
    ticketNumber: 11,
    score: 2,
    comment: 'İlgilenmedi, konu yarım kaldı.',
    reportedAt: mock.ago(40 * mock.MIN),
    reportReason: 'Talebi ben çözdüm, üye sonuçtan memnun olmasına rağmen kasıtlı düşük puan verdi.',
    leaderRoleId: '1553133497781325954',
    ...o,
  }));

  // Puanlama DM'i: kategori metnini belirliyor; destek kategori DM'i destek sisteminin kapanış mesajının altında durur
  const istek = (o) => d.ratingRequestDm(kayit(o));

  return [
    {
      id: 'puan-istegi-oryantasyon',
      title: 'Oryantasyon değerlendirme DM\'i',
      where: 'Oryantasyonu biten üyeye DM, puanlama bölümüyle',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [istek({ id: 'basvuru-3-oryantasyon', category: 'oryantasyon', applicationNumber: 3 })], ...noMentions }),
    },
    {
      id: 'puan-istegi-partner',
      title: 'Partner sürecini değerlendirme DM\'i',
      where: 'Partner talebi sonuçlanan üyeye DM',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [istek({ id: 'partner-5', category: 'partner', partnerNumber: 5 })], ...noMentions }),
    },
    {
      id: 'puan-istegi-gorusme',
      title: 'Görüşme değerlendirmesi DM\'i (eski kayıt)',
      where: 'Yetkili alım görüşmesi biten üyeye DM',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [istek({ id: 'basvuru-7-gorusme', category: 'gorusme', applicationNumber: 7 })], ...noMentions }),
    },
    {
      id: 'puan-istegi-verilmis',
      title: 'Puanlama DM\'i: puan verildikten sonra',
      where: 'Üye yıldıza basınca aynı DM teşekkür haline gelir',
      visibility: 'dm',
      kind: 'message',
      build: () => ({ components: [istek({ id: 'basvuru-3-oryantasyon', category: 'oryantasyon', applicationNumber: 3, score: 5 })], ...noMentions }),
    },
    {
      id: 'puan-formu',
      title: 'Puan ve yorum formu',
      where: 'DM\'deki yıldıza basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => d.ratingModal(kayit({ category: 'destek', ticketNumber: 8 }), 3),
    },
    {
      id: 'yorum-formu',
      title: 'Yetkili yorum formu',
      where: 'Değerlendirme kartındaki Yorum Ekle butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => d.replyModal(kayit({ ticketNumber: 8, score: 4 })),
    },
    {
      id: 'itiraz-formu',
      title: 'İtiraz formu',
      where: 'Değerlendirme kartındaki İtiraz Et butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => d.reportModal(kayit({ ticketNumber: 8, score: 2 })),
    },
    {
      id: 'kart-yeni',
      title: 'Değerlendirme kartı: yeni',
      where: 'Değerlendirme kanalı, yetkili etiketlenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [kart({})], allowedMentions: { users: [yetkili.id] } }),
    },
    {
      id: 'kart-yorumsuz',
      title: 'Değerlendirme kartı: yorum bırakılmamış',
      where: 'Değerlendirme kanalı',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [kart({ comment: '' })], allowedMentions: { users: [yetkili.id] } }),
    },
    {
      id: 'kart-yorum-eklenmis',
      title: 'Değerlendirme kartı: yetkili yorum eklemiş',
      where: 'Değerlendirme kanalı, yorum butonu kilitlenir',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          kart({
            repliedAt: mock.ago(mock.HOUR),
            staffReply: 'Teşekkür ederim, çözüm için ben de memnun oldum.',
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'kart-itiraz-edilmis',
      title: 'Değerlendirme kartı: itiraz edilmiş',
      where: 'Değerlendirme kanalı, inceleme süresince kırmızı',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          kart({
            reportedAt: mock.ago(30 * mock.MIN),
            reportReason: 'Talebi çözdüm, üye kasıtlı düşük puan verdi.',
            reportStatus: 'pending',
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'kart-itiraz-reddedilmis',
      title: 'Değerlendirme kartı: itiraz reddedilmiş',
      where: 'Değerlendirme kanalı, kart ilk haline döner, buton etiketi kalır',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          kart({
            reportedAt: mock.ago(3 * mock.DAY),
            reportReason: 'Talebi çözdüm, üye kasıtlı düşük puan verdi.',
            reportStatus: 'rejected',
            reviewedBy: lider.id,
            reviewedAt: mock.ago(2 * mock.DAY),
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'kart-kaldirilmis',
      title: 'Değerlendirme kartı: itiraz onaylanmış',
      where: 'Değerlendirme kanalı, puan çizilir ve butonlar kalkar',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          kart({
            reportedAt: mock.ago(3 * mock.DAY),
            reportReason: 'Talebi çözdüm, üye kasıtlı düşük puan verdi.',
            reportStatus: 'approved',
            reviewedBy: lider.id,
            reviewedAt: mock.ago(2 * mock.DAY),
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'kart-sicilden-kaldirilmis',
      title: 'Değerlendirme kartı: sicilden elle kaldırılmış',
      where: 'Değerlendirme kanalı, itiraz olmadan kaldırılan kayıt',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [kart({ removedAt: mock.ago(mock.DAY), removedBy: lider.id })],
        ...noMentions,
      }),
    },
    {
      id: 'dm-yorum-geldi',
      title: 'DM: değerlendirmene yorum geldi',
      where: 'Yetkili yorum ekleyince puanı veren üyeye',
      visibility: 'dm',
      kind: 'message',
      build: () => ({
        components: [
          d.replyDm(
            kayit({
              ticketNumber: 8,
              score: 4,
              repliedAt: mock.ago(mock.HOUR),
              staffReply: 'Teşekkür ederim, çözüm için ben de memnun oldum.',
            }),
            guild.name,
          ),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'sikayet-inceleniyor',
      title: 'İtiraz kaydı: inceleniyor',
      where: 'Şikayet kanalı, lider rolü etiketli, karar butonları açık',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [sikayet({ channelId: '1538941597301997700', messageId: '1539000000000000001' })],
        allowedMentions: { roles: ['1553133497781325954'] },
      }),
    },
    {
      id: 'sikayet-gorusme-bekliyor',
      title: 'İtiraz kaydı: görüşme bekleniyor',
      where: 'Şikayet kanalı, lider yetkiliyi görüşmeye çağırdı',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          sikayet({
            meetingBy: lider.id,
            meetingAt: mock.ago(20 * mock.MIN),
            meetingChannelId: '1538544966282911884',
            channelId: '1538941597301997700',
            messageId: '1539000000000000001',
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'sikayet-onaylandi',
      title: 'İtiraz kaydı: onaylandı',
      where: 'Şikayet kanalı, karar butonları kalkar',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          sikayet({
            reportStatus: 'approved',
            reviewedBy: lider.id,
            reviewedAt: mock.ago(mock.HOUR),
            channelId: '1538941597301997700',
            messageId: '1539000000000000001',
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'sikayet-reddedildi',
      title: 'İtiraz kaydı: reddedildi',
      where: 'Şikayet kanalı, karar butonları kalkar',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          sikayet({
            reportStatus: 'rejected',
            reviewedBy: lider.id,
            reviewedAt: mock.ago(mock.HOUR),
            channelId: '1538941597301997700',
            messageId: '1539000000000000001',
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'dm-gorusme-kanalda',
      title: 'DM: görüşmeye çağrıldın, lider kanalda bekliyor',
      where: 'Lider ses kanallarından birindeyse yetkiliye DM',
      visibility: 'dm',
      kind: 'message',
      build: () => ({
        components: [
          d.meetingDm(
            kayit({
              ticketNumber: 11,
              score: 2,
              reportedAt: mock.ago(2 * mock.HOUR),
              reportReason: 'Talebi ben çözdüm, üye kasıtlı düşük puan verdi.',
              reportStatus: 'pending',
              meetingBy: lider.id,
              meetingAt: mock.ago(5 * mock.MIN),
              meetingChannelId: '1538544966282911884',
            }),
            guild.name,
          ),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'dm-gorusme-kanalsiz',
      title: 'DM: görüşmeye çağrıldın, kanal seçmesi gerekiyor',
      where: 'Lider bir ses kanalında değilse yetkiliye DM, katılma butonlarıyla',
      visibility: 'dm',
      kind: 'message',
      build: () => ({
        components: [
          d.meetingDm(
            kayit({
              ticketNumber: 11,
              score: 2,
              reportedAt: mock.ago(2 * mock.HOUR),
              reportReason: 'Talebi ben çözdüm, üye kasıtlı düşük puan verdi.',
              reportStatus: 'pending',
              meetingBy: lider.id,
              meetingAt: mock.ago(5 * mock.MIN),
            }),
            guild.name,
          ),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'dm-itiraz-onaylandi',
      title: 'DM: itirazın kabul edildi',
      where: 'Lider itirazı onaylayınca yetkiliye',
      visibility: 'dm',
      kind: 'message',
      build: () => ({
        components: [
          d.reviewDm(
            kayit({ ticketNumber: 11, score: 2, reportedAt: mock.ago(2 * mock.DAY), reportStatus: 'approved', reviewedBy: lider.id, reviewedAt: mock.ago(mock.HOUR) }),
            guild.name,
          ),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'dm-itiraz-reddedildi',
      title: 'DM: itirazın reddedildi',
      where: 'Lider itirazı reddedince yetkiliye',
      visibility: 'dm',
      kind: 'message',
      build: () => ({
        components: [
          d.reviewDm(
            kayit({ ticketNumber: 11, score: 2, reportedAt: mock.ago(2 * mock.DAY), reportStatus: 'rejected', reviewedBy: lider.id, reviewedAt: mock.ago(mock.HOUR) }),
            guild.name,
          ),
        ],
        ...noMentions,
      }),
    },
  ];
};
