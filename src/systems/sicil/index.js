// Sicil: /sicil ile açılır, kişinin sunucudaki tüm geçmişi tek mesajda: cezalar, destek talepleri, başvurular ve
// (yetkililer için) aldığı değerlendirmeler. Bölümler butonla seçilir, her bölümdeki menüden kaydın detayı seçen kişiye
// ayrı mesaj olarak açılır. Yetkililer yetkili komut kanalında ceza verir (Genel'deki "Ceza Ver"), cezanın detayından
// süre ekler, kaldırır ya da sicilden siler, değerlendirmenin detayından değerlendirmeyi kaldırır; işlemden sonra sicil
// mesajının tablosu da güncellenir. Kimin ne yapabileceği config.js'te.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId, staffCommandChannel } = require('../../core/config');
const { respond, replyError, isStaff, isMenuOwner, fetchTextChannel, inStaffChannel, staffChannelError } = require('../../core/helpers');
const destekConfig = require('../destek/config');
const destekStore = require('../destek/store');
const destekUi = require('../destek/ui');
const basvuruStore = require('../basvuru/store');
const basvuruUi = require('../basvuru/ui');
const ratings = require('../degerlendirme');
const degerlendirmeStore = require('../degerlendirme/store');
const degerlendirmeUi = require('../degerlendirme/ui');
const config = require('./config');
const moderation = require('./moderation');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('sicil')
    .setDescription('Bir kullanıcının sunucu sicilini gösterir.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) =>
      o.setName('kullanici').setDescription('Sicili görüntülenecek kullanıcı (boş bırakırsan kendi sicilin)'),
    ),
];

// Yetkiler; işlemler sadece yetkili komut kanalında yapılabilir
const allowedTypes = (interaction) =>
  inStaffChannel(interaction) ? Object.keys(ui.TYPES).filter((type) => moderation.canPunish(interaction.member, type)) : [];
const canRemoveRatings = (interaction) => inStaffChannel(interaction) && isStaff(interaction, config.ratingManagers);
const canEditPunishment = (interaction, p) => inStaffChannel(interaction) && moderation.canPunish(interaction.member, p.type);
const canView = (interaction) =>
  Object.keys(ui.TYPES).some((type) => moderation.canPunish(interaction.member, type)) ||
  isStaff(interaction, [...config.viewerRoles, ...config.ratingManagers]);

const fetchUser = (interaction, userId) => interaction.client.users.fetch(userId).catch(() => null);

async function buildView(interaction, user, tab, page, banner) {
  const { guild } = interaction;
  const member = await guild.members.fetch(user.id).catch(() => null);
  const userRatings = degerlendirmeStore.ratingsOf(guild.id, user.id);
  const givenCount = store.givenCount(guild.id, user.id);
  return {
    user,
    tab,
    page,
    banner,
    punishments: store.of(guild.id, user.id),
    tickets: destekStore.ticketsOpenedBy(guild.id, user.id),
    applications: basvuruStore.applicationsOf(guild.id, user.id),
    claimedCount: destekStore.ticketsClaimedBy(guild.id, user.id).length,
    givenCount,
    ratings: userRatings,
    // Yetkili puanı ve Değerlendirmeler bölümü destek yetkililerinde ya da değerlendirme almış / ceza vermiş kişilerde görünür
    showRatings: userRatings.length > 0 || givenCount > 0 || Boolean(member?.roles.cache.has(destekConfig.roles.staff)),
    allowedTypes: allowedTypes(interaction),
  };
}

const sicilView = async (interaction, user, tab, page, banner) => ui.sicil(await buildView(interaction, user, tab, page, banner));

// Bölümdeki kaydın detayı (bulunamazsa null). Talep, başvuru ve değerlendirmede kaydın kendi kanalındaki mesajı
// salt okunur olarak gösterilir; cezanın başka yerde mesajı olmadığı için kendi detayı vardır.
// messageId: işlemden sonra tablosu güncellenecek sicil mesajı
async function detail(interaction, user, tab, id, messageId) {
  const { guildId: gid, client } = interaction;
  if (tab === 'genel') {
    const p = store.get(id);
    return p && p.status !== 'deleted' ? ui.punishmentDetail(p, messageId, canEditPunishment(interaction, p)) : null;
  }
  if (tab === 'talepler') {
    const t = destekStore.ticketsOpenedBy(gid, user.id).find((ticket) => ticket.threadId === id);
    return t ? ui.readOnly(destekUi.claimRequest(t)) : null;
  }
  if (tab === 'basvurular') {
    const a = basvuruStore.getApplication(id);
    return a && a.userId === user.id ? ui.readOnly(basvuruUi.applicationNotice(a, user)) : null;
  }
  const r = degerlendirmeStore.getRating(id);
  if (!r || r.removedAt) return null;
  const staff = await client.users.fetch(r.staffId).catch(() => null);
  return ui.readOnly(degerlendirmeUi.ratingNotice(r, staff), canRemoveRatings(interaction) ? [ui.ratingRemoveButton(user.id, r, messageId)] : []);
}

// İşlemden sonra sicil mesajının tablosunu günceller
async function refreshSicil(interaction, user, messageId, tab) {
  const channel = await fetchTextChannel(interaction.guild, interaction.channelId);
  await channel?.messages
    .edit(messageId, { components: [await sicilView(interaction, user, tab, 0)], allowedMentions: { parse: [] } })
    .catch(() => {});
}

const notOwner = (interaction) =>
  replyError(interaction, 'Bu sicili sadece komutu kullanan kişi gezebilir.', 'Kendi sicilin için /sicil yazabilirsin.');

// /sicil [kullanici]: yetkililer herkesin sicilini sadece yetkili komut kanalında açabilir, orada sicil herkese açık
// gönderilir. Üyeler kendi sicillerini her kanalda görebilir; yetkili kanalı dışında sicil sadece kendilerine görünür.
async function handleCommand(interaction) {
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  if (user.bot) return replyError(interaction, 'Botların sicili bulunmaz.');
  const staffChannel = inStaffChannel(interaction);
  if (user.id !== interaction.user.id) {
    if (!canView(interaction)) return replyError(interaction, 'Başkalarının sicilini sadece yetkililer görüntüleyebilir.');
    if (!staffChannel) return staffChannelError(interaction);
  }
  return respond(interaction, await sicilView(interaction, user, 'genel', 0), { ephemeral: !staffChannel });
}

// Bölüm, sayfa ve geri butonları: sicil:<kullanıcı>:<bölüm>:<sayfa>:<buton yeri>
async function handleNavigate(interaction) {
  if (!isMenuOwner(interaction)) return notOwner(interaction);
  const [, userId, tab, page] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');
  return interaction.update({ components: [await sicilView(interaction, user, tab, Number(page) || 0)], allowedMentions: { parse: [] } });
}

// Bölümdeki kaydın detayı: sicil-detay:<kullanıcı>:<bölüm>:<sayfa>. Detay, seçen kişiye ayrı ve sadece ona görünen
// mesaj olarak gelir; sicil mesajı değişmez, bu yüzden sicili gören herkes detay açabilir.
async function handleDetail(interaction) {
  const [, userId, tab] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  const view = user && (await detail(interaction, user, tab, interaction.values[0], interaction.message.id));
  if (!view) return replyError(interaction, 'Bu kayıt bulunamadı.');
  await respond(interaction, view);
  // Sicil mesajı aynen yeniden kaydedilir ki menü son seçilen kayıtta kalmasın, yine "…seçin" yazsın
  await interaction.message.edit({ components: interaction.message.components }).catch(() => {});
}

// İşlem butonları: sicil-y:<kullanıcı>:<işlem>:<kayıt>:<sicil mesajı>. Yetki her işlemde ayrıca kontrol edilir.
async function handleAction(interaction) {
  if (!inStaffChannel(interaction)) return staffChannelError(interaction);
  const [, userId, action, id, messageId] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');

  // "Ceza Ver": tür seçimi sadece yetkiliye görünür, işlem bitince sicil mesajı güncellenir
  if (action === 'ver') {
    const types = allowedTypes(interaction);
    if (!types.length) return replyError(interaction, 'Ceza verme yetkin yok.');
    return respond(interaction, ui.typePicker(user, interaction.message.id, types));
  }
  if (action === 'tur') {
    const type = interaction.values[0];
    if (!moderation.canPunish(interaction.member, type)) return replyError(interaction, 'Bu cezayı verme yetkin yok.');
    if (type === 'jail' && !config.roles.jail) {
      return replyError(interaction, 'Jail rolü henüz ayarlanmadı.', 'Sicil ayarlarına jail rolünün ID\'si yazılmalı.');
    }
    return interaction.showModal(ui.punishModal(user, type, messageId));
  }

  if (action === 'puansil') {
    const rating = degerlendirmeStore.getRating(id);
    if (!rating || rating.removedAt) return replyError(interaction, 'Bu değerlendirme bulunamadı.');
    if (!canRemoveRatings(interaction)) return replyError(interaction, 'Değerlendirme kaldırma yetkin yok.');
    return interaction.showModal(ui.ratingRemoveModal(user.id, rating, messageId));
  }

  const punishment = store.get(id);
  if (!punishment || punishment.status === 'deleted') return replyError(interaction, 'Bu ceza kaydı bulunamadı.');
  if (!canEditPunishment(interaction, punishment)) return replyError(interaction, 'Bu cezayı düzenleme yetkin yok.');
  if (action === 'sure') return interaction.showModal(ui.extendModal(punishment, messageId));
  if (action === 'kaldir') return interaction.showModal(ui.liftModal(punishment, messageId));
  if (action === 'sil') return interaction.showModal(ui.deleteModal(punishment, messageId));
}

const failed = (interaction, result) =>
  interaction.followUp({
    components: [core.alert(result.error, result.hint, 'danger')],
    flags: core.EPHEMERAL_CV2,
    allowedMentions: { parse: [] },
  });

// Ceza verme formu: sicil-f:<kullanıcı>:ceza:<tür>:<sicil mesajı>. Tür seçimi mesajı sonuçla, sicil mesajı yeni
// cezayla güncellenir.
async function handlePunishForm(interaction, user, type, messageId) {
  if (!moderation.canPunish(interaction.member, type)) return replyError(interaction, 'Bu cezayı verme yetkin yok.');
  const field = interaction.fields.fields.get(ui.IDS.duration);
  const duration = field ? moderation.parseDuration(field.value) : null;
  if (duration === undefined) return replyError(interaction, 'Süre anlaşılamadı.', 'Örnek: 30dk, 2sa, 7g ya da 1g 12sa');

  await interaction.deferUpdate();
  const reason = interaction.fields.getTextInputValue(ui.IDS.reason).trim();
  const result = await moderation.punish(interaction.guild, interaction.member, user, type, duration, reason);
  if (result.error) return failed(interaction, result);

  const p = result.punishment;
  const banner =
    `**${ui.TYPES[type].label} verildi - Ceza #${p.number}**\n-# ` +
    (type === 'uyari' ? 'Uyarı sicile işlendi.' : p.expiresAt ? `${ui.formatDuration(p.duration)} sonra kendiliğinden kalkacak.` : 'Süresiz.');
  await interaction.editReply({ components: [core.notice(banner, 'success')], allowedMentions: { parse: [] } });
  await refreshSicil(interaction, user, messageId, 'genel');
}

// İşlem formları: sicil-f:<kullanıcı>:<işlem>:<kayıt>:<sicil mesajı>. Form detay mesajından açılır; işlem bitince detay
// mesajı sonucu gösterir, sicil mesajının tablosu da güncellenir.
async function handleForm(interaction) {
  if (!inStaffChannel(interaction)) return staffChannelError(interaction);
  const [, userId, action, id, messageId] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');
  if (action === 'ceza') return handlePunishForm(interaction, user, id, messageId);

  const reason = () => interaction.fields.getTextInputValue(ui.IDS.reason).trim();
  const update = (components) => interaction.editReply({ components: [components], allowedMentions: { parse: [] } });

  if (action === 'puansil') {
    const rating = degerlendirmeStore.getRating(id);
    if (!rating || rating.removedAt) return replyError(interaction, 'Bu değerlendirme bulunamadı.');
    if (!canRemoveRatings(interaction)) return replyError(interaction, 'Değerlendirme kaldırma yetkin yok.');
    await interaction.deferUpdate();
    await ratings.removeRating(interaction.client, rating, interaction.user.id, reason());
    await update(core.alert('Değerlendirme kaldırıldı.', 'Sicilden çıkarıldı, değerlendirme kanalındaki mesajı da güncellendi.', 'success'));
    return refreshSicil(interaction, user, messageId, 'puan');
  }

  const punishment = store.get(id);
  if (!punishment || punishment.status === 'deleted') return replyError(interaction, 'Bu ceza kaydı bulunamadı.');
  if (!canEditPunishment(interaction, punishment)) return replyError(interaction, 'Bu cezayı düzenleme yetkin yok.');
  const label = `Ceza #${punishment.number}`;

  let result;
  let banner;
  if (action === 'sure') {
    const extra = moderation.parseDuration(interaction.fields.getTextInputValue(ui.IDS.duration));
    if (!extra) return replyError(interaction, 'Süre anlaşılamadı.', 'Örnek: 30dk, 2sa, 7g ya da 1g 12sa');
    await interaction.deferUpdate();
    result = await moderation.extend(interaction.guild, punishment, interaction.member, extra);
    banner = `**Süre eklendi - ${label}**\n-# +${ui.formatDuration(extra)}`;
  } else if (action === 'kaldir') {
    if (punishment.status !== 'active') return replyError(interaction, 'Bu ceza zaten sona ermiş.');
    await interaction.deferUpdate();
    result = await moderation.lift(interaction.guild, punishment, interaction.user.id, reason());
    banner = `**Ceza kaldırıldı - ${label}**`;
  } else if (action === 'sil') {
    await interaction.deferUpdate();
    result = await moderation.remove(interaction.guild, punishment, interaction.user.id, reason());
  }
  if (result?.error) return failed(interaction, result);

  await update(
    action === 'sil'
      ? core.alert(`${label} sicilden silindi.`, 'Sicildeki tablodan da kaldırıldı.', 'success')
      : ui.punishmentDetail(punishment, messageId, true, banner),
  );
  return refreshSicil(interaction, user, messageId, 'genel');
}

module.exports = {
  name: 'sicil',
  commands,
  help: {
    category: ['yetki', 'Yetkili İşlemleri'],
    access: {
      sicil: `Herkes kendi sicilini görebilir. Başkalarının sicili ve ceza işlemleri yetkililer için, sadece <#${staffCommandChannel}> kanalında.`,
    },
  },
  slash: { sicil: handleCommand },
  prefixed: [
    [ui.IDS.navigate, handleNavigate],
    [ui.IDS.detail, handleDetail],
    [ui.IDS.action, handleAction],
    [ui.IDS.form, handleForm],
  ],
  events: {
    [Events.ClientReady]: (client) => {
      moderation.startSweeper(client);
      const guild = client.guilds.cache.get(guildId);
      if (guild) moderation.syncJailVisibility(guild).catch((err) => console.error('[sicil] Jail kanal görünürlüğü ayarlanamadı:', err.message));
    },
    [Events.GuildMemberAdd]: (member) => (member.guild.id === guildId ? moderation.handleMemberAdd(member) : null),
    [Events.ChannelCreate]: (channel) => (channel.guild?.id === guildId ? moderation.syncJailVisibilityFor(channel) : null),
  },
};
