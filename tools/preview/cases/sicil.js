// Sicil sistemi: sekmeli sicil görünümü, ceza detayı, formlar, DM'ler ve hızlı ceza komutlarının mesajları
module.exports = ({ mock, ui, src }) => {
  const sicil = src('systems/sicil/ui');
  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const member = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const noMentions = { allowedMentions: { parse: [] } };

  let number = 0;
  const punishment = (o = {}) => {
    number += 1;
    return {
      id: `${guild.id}-${number}`,
      number,
      guildId: guild.id,
      userId: member.id,
      username: member.username,
      type: 'mute',
      reason: 'Sohbet kanalında art arda küfürlü mesaj gönderdi.',
      by: staff.id,
      createdAt: mock.ago(2 * mock.DAY),
      duration: 3 * mock.DAY,
      expiresAt: Date.now() + mock.DAY,
      status: 'active',
      extensions: [],
      savedRoles: null,
      ...o,
    };
  };
  const longReason = Array.from({ length: 6 }, (_, i) => `Sohbet kanallarında art arda kural ihlali yaptı ve uyarılara rağmen devam etti (${i + 1}).`).join('\n');
  const many = (n) =>
    Array.from({ length: n }, (_, i) =>
      punishment({
        type: ['mute', 'ban', 'uyari', 'jail'][i % 4],
        status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'expired' : 'lifted',
        reason: i % 2 ? longReason : 'Kısa sebep',
        duration: i % 4 === 2 ? null : 3 * mock.DAY,
        expiresAt: i % 4 === 2 ? null : Date.now() + mock.DAY,
      }),
    );

  const tickets = Array.from({ length: 8 }, (_, i) => ({
    number: i + 1,
    threadId: `${1000 + i}`,
    createdAt: mock.ago((i + 1) * mock.DAY),
    closedAt: i % 2 ? mock.ago(i * mock.DAY) : null,
    closeReason: i % 2 ? { label: 'Sorun çözüldü' } : null,
    reason: i % 3 === 0 ? longReason : 'Sunucuya girerken bir hata alıyorum.',
  }));
  const applications = Array.from({ length: 4 }, (_, i) => ({
    id: `${guild.id}-${i + 1}`,
    number: i + 1,
    createdAt: mock.ago((i + 2) * mock.DAY),
    status: ['pending', 'approved', 'rejected', 'approved'][i],
    orientation: i === 3 ? { status: 'completed' } : null,
  }));
  const ratings = Array.from({ length: 8 }, (_, i) => ({
    id: `r${i}`,
    score: 5 - (i % 4),
    ratedAt: mock.ago(i * mock.DAY),
    comment: i % 2 ? longReason : 'Çok yardımcı oldu.',
    category: 'destek',
    ticketNumber: i + 1,
    staffId: staff.id,
  }));

  const base = {
    user: member,
    tab: 'genel',
    page: 0,
    punishments: many(14),
    tickets,
    applications,
    ratings,
    claimedCount: 12,
    givenCount: 5,
    showRatings: true,
    allowedTypes: ['uyari', 'mute', 'jail', 'ban'],
  };
  const view = (o) => ({
    components: [sicil.sicil({ ...base, ...o }, 'sicil.png')],
    files: [mock.pngFile('sicil.png', { width: 1000, height: 420, label: 'Sicil kartı' })],
    ...noMentions,
  });
  const detail = (p, canEdit = true) => ({ components: [sicil.punishmentDetail(p, '123456789', canEdit)], flags: ui.EPHEMERAL_CV2, ...noMentions });

  return [
    { id: 'genel-yetkili', title: 'Sicil: Genel (yetkili görünümü, 14 kayıt)', where: 'Yetkili komut kanalında /sicil', visibility: 'public', kind: 'message', build: () => view({}) },
    { id: 'genel-uye', title: 'Sicil: Genel (üye kendi sicilini görüyor)', where: '/sicil, kendi sicili', visibility: 'ephemeral', kind: 'message', build: () => view({ allowedTypes: [], showRatings: false }) },
    { id: 'genel-son-sayfa', title: 'Sicil: Genel, son sayfa', where: '/sicil sayfa butonları', visibility: 'public', kind: 'message', build: () => view({ page: 2 }) },
    { id: 'genel-bos', title: 'Sicil: Genel, ceza yok', where: '/sicil, temiz sicil', visibility: 'public', kind: 'message', build: () => view({ punishments: [], allowedTypes: [] }) },
    { id: 'talepler', title: 'Sicil: Destek Talepleri', where: '/sicil, Destek Talepleri sekmesi', visibility: 'public', kind: 'message', build: () => view({ tab: 'talepler' }) },
    { id: 'basvurular', title: 'Sicil: Başvurular', where: '/sicil, Başvurular sekmesi', visibility: 'public', kind: 'message', build: () => view({ tab: 'basvurular' }) },
    { id: 'degerlendirmeler', title: 'Sicil: Değerlendirmeler', where: '/sicil, Değerlendirmeler sekmesi', visibility: 'public', kind: 'message', build: () => view({ tab: 'puan' }) },
    { id: 'degerlendirmeler-bos', title: 'Sicil: Değerlendirmeler, boş', where: '/sicil, değerlendirme yok', visibility: 'public', kind: 'message', build: () => view({ tab: 'puan', ratings: [] }) },
    { id: 'islem-sonucu', title: 'Sicil: işlem sonucu başlıkta', where: 'Ceza verildikten sonra güncellenen sicil', visibility: 'public', kind: 'message', build: () => view({ banner: '**Susturma verildi - Ceza #15**\n3 gün sonra kendiliğinden kalkacak.' }) },

    { id: 'detay-aktif-sureli', title: 'Ceza detayı: aktif susturma (yetkili)', where: 'Sicil menüsünden ceza seçince', visibility: 'ephemeral', kind: 'message', build: () => detail(punishment({ extensions: [{ by: staff.id, at: Date.now(), added: mock.DAY }] })) },
    { id: 'detay-uyari', title: 'Ceza detayı: uyarı', where: 'Sicil menüsünden ceza seçince', visibility: 'ephemeral', kind: 'message', build: () => detail(punishment({ type: 'uyari', duration: null, expiresAt: null })) },
    { id: 'detay-kaldirildi', title: 'Ceza detayı: kaldırılmış ban', where: 'Sicil menüsünden ceza seçince', visibility: 'ephemeral', kind: 'message', build: () => detail(punishment({ type: 'ban', status: 'lifted', liftedBy: staff.id, endedAt: Date.now(), liftReason: 'İtirazı haklı bulundu.' })) },
    { id: 'detay-salt-okunur', title: 'Ceza detayı: yetkisiz görünüm', where: 'Sicil menüsünden ceza seçince', visibility: 'ephemeral', kind: 'message', build: () => detail(punishment({ reason: longReason }), false) },

    { id: 'tur-secici', title: 'Ceza Ver: tür seçici', where: 'Sicilde Ceza Ver butonuna basınca', visibility: 'ephemeral', kind: 'message', build: () => ({ components: [sicil.typePicker(member, '123456789', ['uyari', 'mute', 'jail', 'ban'])], flags: ui.EPHEMERAL_CV2, ...noMentions }) },
    { id: 'form-ceza', title: 'Form: ceza ver (susturma)', where: 'Tür seçilince açılır', visibility: 'ephemeral', kind: 'modal', build: () => sicil.punishModal(member, 'mute', '123456789') },
    { id: 'form-ceza-uyari', title: 'Form: ceza ver (uyarı)', where: 'Tür seçilince açılır', visibility: 'ephemeral', kind: 'modal', build: () => sicil.punishModal(member, 'uyari', '123456789') },
    { id: 'form-sure', title: 'Form: süre ekle', where: 'Ceza detayında Süre Ekle butonu', visibility: 'ephemeral', kind: 'modal', build: () => sicil.extendModal(punishment(), '123456789') },
    { id: 'form-kaldir', title: 'Form: cezayı kaldır', where: 'Ceza detayında Cezayı Kaldır butonu', visibility: 'ephemeral', kind: 'modal', build: () => sicil.liftModal(punishment(), '123456789') },
    { id: 'form-sil', title: 'Form: sicilden sil (aktif ceza)', where: 'Ceza detayında Sicilden Sil butonu', visibility: 'ephemeral', kind: 'modal', build: () => sicil.deleteModal(punishment(), '123456789') },

    { id: 'dm-ceza-mute', title: 'DM: susturuldun', where: 'Ceza verilince cezalı üyeye', visibility: 'dm', kind: 'message', build: () => ({ components: [sicil.punishDm(punishment(), guild.name)] }) },
    { id: 'dm-ceza-uyari', title: 'DM: uyarı aldın', where: 'Ceza verilince cezalı üyeye', visibility: 'dm', kind: 'message', build: () => ({ components: [sicil.punishDm(punishment({ type: 'uyari', duration: null, expiresAt: null }), guild.name)] }) },
    { id: 'dm-ceza-ban', title: 'DM: yasaklandın (süresiz)', where: 'Ceza verilince cezalı üyeye', visibility: 'dm', kind: 'message', build: () => ({ components: [sicil.punishDm(punishment({ type: 'ban', duration: null, expiresAt: null }), guild.name)] }) },
    { id: 'dm-bitti', title: 'DM: ceza sona erdi', where: 'Süre dolunca ya da kaldırılınca', visibility: 'dm', kind: 'message', build: () => ({ components: [sicil.liftDm(punishment({ status: 'expired' }), guild.name)] }) },
    { id: 'dm-uzatildi', title: 'DM: ceza süresi uzatıldı', where: 'Süre eklenince', visibility: 'dm', kind: 'message', build: () => ({ components: [sicil.extendDm(punishment(), mock.DAY, guild.name)] }) },

    { id: 'komut-sonuc', title: 'Hızlı komut: ceza uygulandı', where: 'Yetkili kanalında /mute, /ban...', visibility: 'public', kind: 'message', build: () => ({ components: [sicil.commandResult(punishment())], ...noMentions }) },
    { id: 'komut-sonuc-uyari', title: 'Hızlı komut: uyarı verildi', where: 'Yetkili kanalında /uyari', visibility: 'public', kind: 'message', build: () => ({ components: [sicil.commandResult(punishment({ type: 'uyari', duration: null, expiresAt: null }))], ...noMentions }) },
    { id: 'komut-kaldir', title: 'Hızlı komut: ceza kaldırıldı', where: 'Yetkili kanalında /unmute, /ceza-kaldir', visibility: 'public', kind: 'message', build: () => ({ components: [sicil.commandLift(punishment(), staff.id, 'İtirazı haklı bulundu.')], ...noMentions }) },
    { id: 'komut-sil', title: 'Hızlı komut: ceza kaydı silindi', where: 'Yetkili kanalında /ceza-sil', visibility: 'public', kind: 'message', build: () => ({ components: [sicil.commandDelete(punishment(), staff.id, 'Yanlış kişiye verilmişti.')], ...noMentions }) },
  ];
};
