// Yetkili değerlendirme sistemi: üye DM'den puan ve yorum bırakır, değerlendirme kanalına gider ve yetkilinin siciline
// işlenir. Değerlendirmeler kategorilere ayrılır: destek talebi kapanınca (destek), oryantasyon tamamlanınca
// (oryantasyon) ve partner talebi sonuçlanınca (partner); eski görüşme (gorusme) kayıtları sicilde durur. Değerlendirilen yetkili haksız bulduğu değerlendirmeye şikayet
// kanalından itiraz edebilir, liderler onaylar / reddeder / görüşmeye çağırır.
const core = require('../../core/ui');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const destekUi = require('../destek/ui');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

// Destek sistemi talep kapanınca çağırır; talep sahibine değerlendirme için gidecek yetkiliyi belirler.
// Talebi üstlenen yetkili değerlendirilir; kimse üstlenmediyse talebi kapatan yetkili değerlendirilir.
// Talep sahibi kendini değerlendiremez.
async function createPending(client, ticket) {
  const staffId = [ticket.claimedBy, ticket.closedBy].find((id) => id && id !== ticket.ownerId);
  if (!staffId) return null;

  const staff = await client.users.fetch(staffId).catch(() => null);
  return store.setRating(ticket.threadId, {
    id: ticket.threadId,
    category: 'destek',
    guildId: ticket.guildId,
    guildName: client.guilds.cache.get(ticket.guildId)?.name ?? 'Sunucu',
    ticketNumber: ticket.number,
    staffId,
    staffName: staff?.username ?? 'Yetkili',
    userId: ticket.ownerId,
    score: null,
    comment: '',
    ratedAt: null,
    channelId: null,
    messageId: null,
    reportedAt: null,
    reportReason: null,
  });
}

// Başvuru sistemi görüşme bitince (gorusme) ve oryantasyon tamamlanınca (oryantasyon) çağırır: başvurana DM ile
// görüşmeyi yapan / oryantasyonu veren yetkiliyi puanlama mesajı gönderir. Her başvuru için her kategoride bir kez.
async function requestForApplication(client, app, category, staffId) {
  const id = `${app.id}-${category}`;
  if (!staffId || staffId === app.userId || store.getRating(id)) return null;

  const guild = client.guilds.cache.get(app.guildId);
  const staff = await client.users.fetch(staffId).catch(() => null);
  const rating = store.setRating(id, {
    id,
    category,
    guildId: app.guildId,
    guildName: guild?.name ?? 'Sunucu',
    applicationId: app.id,
    applicationNumber: app.number,
    staffId,
    staffName: staff?.username ?? 'Yetkili',
    userId: app.userId,
    score: null,
    comment: '',
    ratedAt: null,
    channelId: null,
    messageId: null,
    reportedAt: null,
    reportReason: null,
  });

  const user = await client.users.fetch(app.userId).catch(() => null);
  return user?.send({ components: [ui.ratingRequestDm(rating)], flags: core.CV2 }).catch(() => null);
}

// Partner sistemi talebi sonuçlandırınca çağırır: talep sahibine kararı veren partner yetkilisini puanlama mesajı gönderir.
// Her talep için bir kez; talep sahibi kendini değerlendiremez.
async function requestForPartner(client, request, staffId) {
  const id = `partner-${request.id}`;
  if (!staffId || staffId === request.requesterId || store.getRating(id)) return null;

  const guild = client.guilds.cache.get(request.guildId);
  const staff = await client.users.fetch(staffId).catch(() => null);
  const rating = store.setRating(id, {
    id,
    category: 'partner',
    guildId: request.guildId,
    guildName: guild?.name ?? 'Sunucu',
    partnerNumber: request.number,
    staffId,
    staffName: staff?.username ?? 'Yetkili',
    userId: request.requesterId,
    score: null,
    comment: '',
    ratedAt: null,
    channelId: null,
    messageId: null,
    reportedAt: null,
    reportReason: null,
  });

  const user = await client.users.fetch(request.requesterId).catch(() => null);
  return user?.send({ components: [ui.ratingRequestDm(rating)], flags: core.CV2 }).catch(() => null);
}

// DM'deki puan butonu: yorum formunu açar
async function handleRateButton(interaction) {
  const [, id, score] = interaction.customId.split(':');
  const rating = store.getRating(id);
  if (!rating) return replyError(interaction, 'Bu değerlendirme artık geçerli değil.');
  if (interaction.user.id !== rating.userId) return replyError(interaction, 'Bu değerlendirmeyi sadece kendisine gönderilen kişi yapabilir.');
  if (rating.score) return replyError(interaction, 'Bunun için zaten değerlendirme yaptın.');

  return interaction.showModal(ui.ratingModal(rating, Number(score)));
}

// Yorum formu gönderilince değerlendirmeyi kaydeder ve değerlendirme kanalına gönderir
async function handleRateSubmit(interaction) {
  const [, id, rawScore] = interaction.customId.split(':');
  const score = Number(rawScore);
  const rating = store.getRating(id);
  if (!rating || interaction.user.id !== rating.userId || !(score >= 1 && score <= 5)) {
    return replyError(interaction, 'Bu değerlendirme artık geçerli değil.');
  }
  if (rating.score) return replyError(interaction, 'Bunun için zaten değerlendirme yaptın.');

  // Kayıt await'ten önce yapılır, iki kez gönderilen form ikinci kez işlenmez
  store.updateRating(id, {
    score,
    comment: interaction.fields.getTextInputValue(ui.IDS.rateComment).trim(),
    ratedAt: Date.now(),
  });

  // DM'deki mesaj teşekkür haline gelir, yıldız butonları kalkar
  const dm =
    (rating.category ?? 'destek') === 'destek'
      ? destekUi.closeDm(rating.ticketNumber, rating.guildName, rating)
      : ui.ratingRequestDm(rating);
  await interaction.update({ components: [dm] });

  // Kategorinin kendi kanalı ayarlıysa oraya, değilse ortak değerlendirme kanalına gider
  const guild = interaction.client.guilds.cache.get(rating.guildId);
  const channel = await fetchTextChannel(guild, config.categoryChannels[rating.category] ?? config.channels.rating);
  if (!channel) return console.error('[degerlendirme] Değerlendirme kanalı bulunamadı.');

  // Değerlendirilen yetkili etiketlenir, bildirim alır
  const staff = await interaction.client.users.fetch(rating.staffId).catch(() => null);
  const message = await channel.send({
    components: [ui.ratingNotice(rating, staff)],
    flags: core.CV2,
    allowedMentions: { users: [rating.staffId] },
  });
  store.updateRating(id, { channelId: channel.id, messageId: message.id });
}

// Değerlendirme kanalındaki "Yorum Ekle" butonu: sadece değerlendirilen yetkili, bir kez kullanabilir
async function handleReplyButton(interaction) {
  const rating = store.getRating(interaction.customId.slice(ui.IDS.reply.length + 1));
  if (!rating?.score || rating.reportStatus === 'approved' || rating.removedAt) return replyError(interaction, 'Bu değerlendirme bulunamadı.');
  if (interaction.user.id !== rating.staffId) {
    return replyError(interaction, 'Bu değerlendirmeye sadece değerlendirilen yetkili yorum ekleyebilir.');
  }
  if (rating.repliedAt) return replyError(interaction, 'Bu değerlendirmeye zaten yorum ekledin.');

  return interaction.showModal(ui.replyModal(rating));
}

// Yorum formu gönderilince değerlendirme mesajında gösterir ve üyeye DM ile bildirir
async function handleReplySubmit(interaction) {
  const id = interaction.customId.slice(ui.IDS.replyModal.length + 1);
  const rating = store.getRating(id);
  if (!rating?.score || rating.reportStatus === 'approved' || rating.removedAt || interaction.user.id !== rating.staffId) {
    return replyError(interaction, 'Bu değerlendirme bulunamadı.');
  }
  if (rating.repliedAt) return replyError(interaction, 'Bu değerlendirmeye zaten yorum ekledin.');

  // Kayıt await'ten önce yapılır, iki kez gönderilen form ikinci kez işlenmez
  store.updateRating(id, {
    staffReply: interaction.fields.getTextInputValue(ui.IDS.replyText).trim(),
    repliedAt: Date.now(),
  });

  // Yorum değerlendirme mesajına eklenir, buton "Yorum Eklendi" olur
  await interaction.update({ components: [ui.ratingNotice(rating, interaction.user)], allowedMentions: { parse: [] } });

  const member = await interaction.client.users.fetch(rating.userId).catch(() => null);
  const sent = await member
    ?.send({ components: [ui.replyDm(rating, interaction.guild.name)], flags: core.CV2 })
    .catch(() => null);

  await respond(
    interaction,
    sent
      ? core.alert('Yorumun eklendi.', 'Değerlendirmeyi yapan üyeye DM üzerinden bildirildi.', 'success')
      : core.alert('Yorumun eklendi.', "Üyenin DM'si kapalı olduğu için bildirim gönderilemedi.", 'warning'),
  );
}

// Değerlendirme kanalındaki "İtiraz Et" butonu: sadece değerlendirilen yetkili kullanabilir
async function handleReportButton(interaction) {
  const rating = store.getRating(interaction.customId.slice(ui.IDS.report.length + 1));
  if (!rating?.score || rating.removedAt) return replyError(interaction, 'Bu değerlendirme bulunamadı.');
  if (interaction.user.id !== rating.staffId) {
    return replyError(interaction, 'Bu değerlendirmeye sadece değerlendirilen yetkili itiraz edebilir.');
  }
  if (rating.reportedAt) return replyError(interaction, 'Bu değerlendirmeye zaten itiraz edildi.');

  return interaction.showModal(ui.reportModal(rating));
}

// İtiraz formu gönderilince şikayet kanalına iletir
async function handleReportSubmit(interaction) {
  const id = interaction.customId.slice(ui.IDS.reportModal.length + 1);
  const rating = store.getRating(id);
  if (!rating?.score || interaction.user.id !== rating.staffId) {
    return replyError(interaction, 'Bu değerlendirme bulunamadı.');
  }
  if (rating.reportedAt) return replyError(interaction, 'Bu değerlendirmeye zaten itiraz edildi.');

  store.updateRating(id, {
    reportedAt: Date.now(),
    reportReason: interaction.fields.getTextInputValue(ui.IDS.reportReason).trim(),
    reportStatus: 'pending',
    leaderRoleId: config.roles.leader,
  });

  const complaintChannel = await fetchTextChannel(interaction.guild, config.channels.complaint);
  if (!complaintChannel) {
    store.updateRating(id, { reportedAt: null, reportReason: null, reportStatus: null });
    return replyError(interaction, 'Şikayet kanalı bulunamadı.', 'Lütfen sunucu yöneticilerine bildir.');
  }

  // Değerlendirme mesajındaki buton "İtiraz Edildi" olur
  await interaction.update({ components: [ui.ratingNotice(rating, interaction.user)], allowedMentions: { parse: [] } });

  // Lider rolü etiketlenir, haberleri olur
  await complaintChannel.send({
    components: [ui.ratingComplaint(rating)],
    flags: core.CV2,
    allowedMentions: { roles: rating.leaderRoleId ? [rating.leaderRoleId] : [] },
  });

  await respond(
    interaction,
    core.alert('İtirazın liderlere iletildi.', 'Sonuç sana DM üzerinden bildirilecek.', 'success'),
  );
}

// Değerlendirme kanalındaki mesajı son duruma göre günceller (bildirim sonucu butonda görünür)
async function refreshRatingNotice(client, rating) {
  if (!rating.messageId) return;
  const channel = await fetchTextChannel(client.guilds.cache.get(rating.guildId), rating.channelId);
  const staff = await client.users.fetch(rating.staffId).catch(() => null);
  await channel?.messages
    .edit(rating.messageId, { components: [ui.ratingNotice(rating, staff)], allowedMentions: { parse: [] } })
    .catch(() => {});
}

// Sicil sistemi çağırır: değerlendirmeyi yetkilinin sicilinden kaldırır, değerlendirme kanalındaki mesaj da
// "Değerlendirme Kaldırıldı" haline gelir
async function removeRating(client, rating, byId, reason) {
  store.updateRating(rating.id, { removedAt: Date.now(), removedBy: byId, removedReason: reason });
  await refreshRatingNotice(client, rating);
}

// Lider görüşme ses kanallarından birindeyse o kanalın ID'si
function meetingChannel(guild, userId) {
  const channelId = guild.voiceStates.cache.get(userId)?.channelId;
  return config.voiceChannels.some((c) => c.id === channelId) ? channelId : null;
}

// Şikayet kanalındaki Onayla / Reddet / Görüşmeye Çağır butonları: sadece lider rolü ve yöneticiler kullanabilir
async function handleReview(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const rating = store.getRating(id);
  if (!rating?.reportedAt) return replyError(interaction, 'Bu itiraz bulunamadı.');

  if (!isStaff(interaction, config.roles.leader)) {
    return replyError(interaction, 'Bu işlemi sadece Sorun Çözücü Liderleri yapabilir.');
  }
  if (rating.reportStatus === 'approved' || rating.reportStatus === 'rejected') {
    return replyError(interaction, 'Bu itiraz zaten sonuçlandırıldı.');
  }

  // Kararlar await'ten önce kaydedilir, aynı anda basan ikinci lider yukarıdaki kontrollere takılır
  const fetchStaff = () => interaction.client.users.fetch(rating.staffId).catch(() => null);

  if (action === 'gorusme') {
    if (rating.meetingBy) return replyError(interaction, 'Yetkili zaten görüşmeye çağrıldı.');
    store.updateRating(id, {
      meetingBy: interaction.user.id,
      meetingAt: Date.now(),
      meetingChannelId: meetingChannel(interaction.guild, interaction.user.id),
    });
    await interaction.update({ components: [ui.ratingComplaint(rating)], allowedMentions: { parse: [] } });

    const staff = await fetchStaff();
    const sent = await staff
      ?.send({ components: [ui.meetingDm(rating, interaction.guild.name)], flags: core.CV2 })
      .catch(() => null);
    const where = rating.meetingChannelId
      ? `kendisinin <#${rating.meetingChannelId}> kanalında beklendiği söylendi`
      : 'bir görüşme kanalında olmadığı için kanallardan birine geçmesi söylendi';
    return respond(
      interaction,
      sent
        ? core.alert('Yetkili görüşmeye çağrıldı.', `Yetkiliye DM üzerinden ${where}.`, 'success')
        : core.alert('Yetkili görüşmeye çağrıldı.', "Yetkilinin DM'si kapalı, kendisine ayrıca ulaşman gerekiyor.", 'warning'),
    );
  }

  store.updateRating(id, {
    reportStatus: action === 'onay' ? 'approved' : 'rejected',
    reviewedBy: interaction.user.id,
    reviewedAt: Date.now(),
  });
  await interaction.update({ components: [ui.ratingComplaint(rating)], allowedMentions: { parse: [] } });
  await refreshRatingNotice(interaction.client, rating);

  // Bildiren yetkiliye sonuç DM ile iletilir (DM'si kapalıysa sessizce geçilir)
  const staff = await fetchStaff();
  await staff?.send({ components: [ui.reviewDm(rating, interaction.guild.name)], flags: core.CV2 }).catch(() => {});
}

module.exports = {
  name: 'degerlendirme',
  createPending,
  requestForApplication,
  requestForPartner,
  removeRating,
  // Puan butonları DM'de de çalışır
  prefixed: [
    [ui.IDS.rate, handleRateButton],
    [ui.IDS.rateModal, handleRateSubmit],
    [ui.IDS.reply, handleReplyButton],
    [ui.IDS.replyModal, handleReplySubmit],
    [ui.IDS.report, handleReportButton],
    [ui.IDS.reportModal, handleReportSubmit],
    [ui.IDS.review, handleReview],
  ],
};
