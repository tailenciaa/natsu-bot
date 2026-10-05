// Oryantasyon sistemi: adım paneli, kayıt mesajları, DM'ler ve aktarma/iptal pencereleri
module.exports = ({ mock, ui, src }) => {
  const o = src('systems/oryantasyon/ui');
  const config = src('systems/oryantasyon/config');
  const basvuruConfig = src('systems/basvuru/config');

  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const applicant = mock.user({ username: 'ahmet', displayName: 'Ahmet' });
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const other = mock.user({ username: 'can', displayName: 'Can' });
  const noMentions = { allowedMentions: { parse: [] } };
  const eph = { flags: ui.EPHEMERAL_CV2, ...noMentions };
  const meetingChannel = basvuruConfig.voiceChannels[0].id;
  const lastStep = config.steps.length - 1;
  const stepOf = (type) => Math.max(0, config.steps.findIndex((s) => s.type === type));

  const app = (orientation = {}, extra = {}) => ({
    id: `${guild.id}-12`,
    guildId: guild.id,
    number: 12,
    userId: applicant.id,
    username: applicant.username,
    reviewerRoleId: basvuruConfig.roles.reviewer,
    acceptRoleId: basvuruConfig.roles.accept,
    status: 'approved',
    reviewedBy: staff.id,
    reviewedAt: Date.now() - mock.HOUR,
    note: 'Görüşmede çok iyiydin.',
    ownerId: staff.id,
    orientation: {
      status: 'active',
      staffId: staff.id,
      channelId: meetingChannel,
      messageId: mock.snowflake(),
      logMessageId: mock.snowflake(),
      startedAt: Date.now() - 20 * mock.MIN,
      step: 0,
      skipped: [],
      areas: [],
      transfers: [],
      applicantLeaves: 0,
      levelId: '1',
      ...orientation,
    },
    ...extra,
  });
  const done = (extra = {}) => app({ status: 'completed', finishedAt: Date.now(), levelLabel: 'Genin', areaLabels: ['Destek Talepleri', 'Sohbet'], areas: config.areas.slice(0, 2).map((a) => a.id), step: lastStep, ...extra });
  const cancelled = (extra = {}, rest = {}) => app({ status: 'cancelled', finishedAt: Date.now(), cancelReason: 'Başvuran oryantasyona gelmedi.', cancelledBy: other.id, ...extra }, rest);
  const msg = (container, extra = {}) => ({ components: [container], ...noMentions, ...extra });

  const cases = [
    { id: 'panel-ilk', title: 'Oryantasyon paneli: ilk adım', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(app(), applicant), { allowedMentions: { users: [] } }) },
    { id: 'panel-alan', title: 'Oryantasyon paneli: görev alanı seçimi', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(app({ step: stepOf('areas'), areas: [config.areas[0].id] }), applicant)) },
    { id: 'panel-alan-bilgi', title: 'Oryantasyon paneli: alan bilgisi', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(app({ step: stepOf('areaInfo'), areas: config.areas.slice(0, 3).map((a) => a.id) }), applicant)) },
    { id: 'panel-son', title: 'Oryantasyon paneli: son adım', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(app({ step: lastStep, areas: config.areas.slice(0, 2).map((a) => a.id), skipped: [config.steps[1].id] }), applicant)) },
    { id: 'panel-ayrildi', title: 'Oryantasyon paneli: başvuran ayrıldı', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(app({ step: 2, applicantAwaySince: Date.now() - 30000, applicantLeaves: 1 }), applicant)) },
    { id: 'panel-yetkili-bekleniyor', title: 'Oryantasyon paneli: yetkili bekleniyor', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(app({ step: 3, staffAwaySince: Date.now() - 600000, staffNeeded: true }), applicant)) },
    { id: 'panel-tamam', title: 'Oryantasyon paneli: tamamlandı', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(done(), applicant)) },
    { id: 'panel-iptal', title: 'Oryantasyon paneli: iptal edildi', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panel(cancelled({}, { penaltyUntil: Date.now() + 7 * mock.DAY }), applicant)) },
    { id: 'kayit-suruyor', title: 'Kayıt: oryantasyon sürüyor', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => msg(o.orientationLog(app({ step: 4, areas: [config.areas[0].id], transfers: [{ from: other.id, to: staff.id }], applicantLeaves: 1 }))) },
    { id: 'kayit-tamam', title: 'Kayıt: oryantasyon tamamlandı', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => msg(o.orientationResult(done())) },
    { id: 'kayit-iptal', title: 'Kayıt: oryantasyon iptal edildi', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => msg(o.orientationResult(cancelled())) },
    { id: 'dm-onay', title: 'DM: başvurun onaylandı (kanal bekleniyor)', where: 'Başvurana', visibility: 'dm', kind: 'message', build: () => ({ components: [o.approvedDm(app({ status: 'waiting', channelId: null }), guild.name, null)] }) },
    { id: 'dm-onay-kanalli', title: 'DM: başvurun onaylandı (kanal belli)', where: 'Başvurana', visibility: 'dm', kind: 'message', build: () => ({ components: [o.approvedDm(app({ status: 'waiting' }), guild.name, meetingChannel)] }) },
    { id: 'dm-onay-basladi', title: 'DM: başvurun onaylandı (oryantasyon başladı)', where: 'Başvurana', visibility: 'dm', kind: 'message', build: () => ({ components: [o.approvedDm(app(), guild.name, meetingChannel)] }) },
    { id: 'dm-gorev', title: 'DM: oryantasyon görevi (yetkiliye)', where: 'Oryantasyonu verecek yetkiliye', visibility: 'dm', kind: 'message', build: () => ({ components: [o.staffDm(app({ status: 'waiting' }), guild.name, meetingChannel, null, false)] }) },
    { id: 'dm-gorev-aktarildi', title: 'DM: oryantasyon sana aktarıldı', where: 'Yeni yetkiliye', visibility: 'dm', kind: 'message', build: () => ({ components: [o.staffDm(app({ step: 3 }), guild.name, meetingChannel, other.id, false)] }) },
    { id: 'dm-gorev-devralindi', title: 'DM: oryantasyonu devraldın', where: 'Devralan yetkiliye', visibility: 'dm', kind: 'message', build: () => ({ components: [o.staffDm(app({ step: 3 }), guild.name, meetingChannel, other.id, true)] }) },
    { id: 'dm-tebrik', title: 'DM: ekibe hoş geldin', where: 'Yeni yetkiliye', visibility: 'dm', kind: 'message', build: () => ({ components: [o.completedDm(done(), guild.name)] }) },
    { id: 'dm-iptal', title: 'DM: oryantasyon iptal edildi', where: 'Başvurana', visibility: 'dm', kind: 'message', build: () => ({ components: [o.cancelledDm(cancelled({}, { penaltyUntil: Date.now() + 7 * mock.DAY }), guild.name)] }) },
    { id: 'devral-acik', title: 'Yetkili bekleniyor (devral butonu)', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => ({ components: [o.takeoverNotice(app({ step: 3 }), 'open')], allowedMentions: { roles: [] } }) },
    { id: 'devral-dondu', title: 'Yetkili geri döndü', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => msg(o.takeoverNotice(app(), 'returned')) },
    { id: 'devral-alindi', title: 'Oryantasyon devralındı', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => msg(o.takeoverNotice(app({ transfers: [{ from: other.id, to: staff.id }] }), 'taken')) },
    { id: 'devral-bitti', title: 'Oryantasyon sona erdi (devral)', where: 'Başvurular kanalı', visibility: 'log', kind: 'message', build: () => msg(o.takeoverNotice(app(), 'closed')) },
    { id: 'panel-tasindi', title: 'Panel taşındı', where: 'Eski kanalın sohbeti', visibility: 'public', kind: 'message', build: () => msg(o.panelMoved(app())) },
    { id: 'aktar-sec', title: 'Aktarma: yetkili seçimi', where: 'Yetkiliye Aktar butonu', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [o.transferPicker(app())], ...eph }) },
    { id: 'aktar-bildirim', title: 'Aktarma bildirimi (kanal)', where: 'Görüşme kanalının sohbeti', visibility: 'public', kind: 'message', build: () => ({ components: [o.transferNotice(app({ step: 3 }), other.id)], allowedMentions: { users: [] } }) },
    { id: 'iptal-form', title: 'Form: oryantasyonu iptal et', where: 'Oryantasyonu İptal butonu', visibility: 'ephemeral', kind: 'modal', build: () => o.cancelModal(app()) },
  ];

  // Giriş çıkış DM'leri: her tür başvurana ve yetkiliye
  for (const kind of ['applicantLeft', 'applicantBack', 'staffLeft', 'staffBack', 'staffJoined', 'staffNeeded', 'takenOver', 'staffWaiting', 'autoCancelled']) {
    for (const toApplicant of [true, false]) {
      const base = app({ applicantAwaySince: Date.now() - 20000, staffAwaySince: Date.now() - 20000, applicantLeaves: 1, cancelReason: 'Başvuran 3 kez kanaldan ayrıldı.' });
      const container = o.presenceDm(base, guild.name, kind, toApplicant, meetingChannel);
      if (!container) continue;
      cases.push({
        id: `giris-${kind}-${toApplicant ? 'basvuran' : 'yetkili'}`,
        title: `DM: ${kind} (${toApplicant ? 'başvurana' : 'yetkiliye'})`,
        where: 'Kanala giriş çıkışlarda',
        visibility: 'dm',
        kind: 'message',
        build: () => ({ components: [container] }),
      });
    }
  }
  return cases;
};
