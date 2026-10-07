// Elle yetki verme (/yetki-ver) ve alma (/yetki-al) panelleri. Yetki verme paneli: /yetki-ver ile açılır. Rütbe seçilince o rütbenin yetkileri otomatik işaretlenir,
// istenirse ekstra yetki eklenip çıkarılır. Rolü ayarlanmamış (roleId: null) rütbe/yetkiler için rol verilmez.
// Panel herkese açık gönderilir (işlemin kaydı kanalda kalsın diye), ama menü ve butonları sadece yöneticiler kullanabilir.
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId, staffCommandChannel } = require('../../core/config');
const { respond, replyError, inStaffChannel, staffChannelError } = require('../../core/helpers');
const basvuruConfig = require('../basvuru/config');
const access = require('./access');
const config = require('./config');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('yetki-ver')
    .setDescription('Bir üyeye rütbe, yetki ve görev rolü seçerek yetki verir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Yetki verilecek üyeyi seç.').setRequired(true)),
  new SlashCommandBuilder()
    .setName('yetki-al')
    .setDescription('Bir üyenin rütbe, yetki ve görev rollerini tamamen ya da seçerek kaldırır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Yetkisi kaldırılacak üyeyi seç.').setRequired(true)),
];

// Aynı üyeye aynı anda iki kez yetki verilmesin ya da alınmasın (hızlı çift tıklama)
const giving = new Set();
const taking = new Set();

const levelById = (id) => config.levels.find((l) => l.id === id);
const fetchUser = (interaction, userId) => interaction.client.users.fetch(userId).catch(() => null);

// Panel herkese açık olduğu için başkalarının seçim yapmasını engeller
function denyNonAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return null;
  return replyError(interaction, 'Bu paneli sadece yöneticiler kullanabilir.');
}

// /yetki-ver kullanici
async function handleCommand(interaction) {
  if (!inStaffChannel(interaction)) return staffChannelError(interaction);
  const user = interaction.options.getUser('kullanici', true);
  if (user.bot) return replyError(interaction, 'Botlara yetki verilemez.');
  if (!interaction.options.getMember('kullanici')) {
    return replyError(interaction, 'Üye sunucuda değil.', 'Yetki vermek için üyenin sunucuya girmiş olması gerekir.');
  }
  return respond(interaction, ui.staffPanel({ user, levelId: null, permIds: [], dutyIds: [] }), { ephemeral: false });
}

// Seviye menüsü: seviyenin yetkilerini otomatik seçer
async function handleLevel(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Üye bulunamadı.', 'Üye sunucudan ayrılmış olabilir.');
  const level = levelById(interaction.values[0]);
  return interaction.update({
    components: [ui.staffPanel({ user, levelId: level.id, permIds: [...level.perms], dutyIds: [...level.duties] })],
    allowedMentions: { parse: [] },
  });
}

// Yetki menüsü: seçilen rütbenin üstüne ekstra yetki ekleme/çıkarma
async function handlePerms(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId, levelId, dutyMask] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Üye bulunamadı.', 'Üye sunucudan ayrılmış olabilir.');
  return interaction.update({
    components: [ui.staffPanel({ user, levelId, permIds: interaction.values, dutyIds: ui.unmask(dutyMask, config.duties) })],
    allowedMentions: { parse: [] },
  });
}

// Görev rolleri menüsü: ekstra görev rolü ekleme/çıkarma
async function handleDuties(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId, levelId, permMask] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Üye bulunamadı.', 'Üye sunucudan ayrılmış olabilir.');
  return interaction.update({
    components: [ui.staffPanel({ user, levelId, permIds: ui.unmask(permMask, config.perms), dutyIds: interaction.values })],
    allowedMentions: { parse: [] },
  });
}

// "Yetkiyi Ver": rütbenin, yetkilerin ve görev rollerinin ayarlı rollerini verir, kişiye DM ile haber verir
async function handleGive(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId, levelId, permMask, dutyMask] = interaction.customId.split(':');
  const level = levelById(levelId);
  const permIds = ui.unmask(permMask, config.perms);
  const dutyIds = ui.unmask(dutyMask, config.duties);

  if (giving.has(userId)) return replyError(interaction, 'Bu üyenin yetkisi zaten veriliyor.');
  giving.add(userId);
  try {
    // Roller Discord'dan istenip verilirken 3 saniye aşılabilir; önce etkileşim onaylanır
    await interaction.deferUpdate();

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!level || !member) return replyError(interaction, 'Üye sunucuda değil.', 'Yetki vermek için üyenin sunucuya girmiş olması gerekir.');

    const wanted = [level, ...config.perms.filter((p) => permIds.includes(p.id)), ...config.duties.filter((d) => dutyIds.includes(d.id))];
    // Yetkili Ekibi rolü de verilir: yetkili komutlarını görmek ve sicile bakmak için gerekir
    const roleIds = [...new Set([basvuruConfig.roles.accept, ...(level.extraRoleIds ?? []), ...wanted.map((item) => item.roleId)].filter(Boolean))];
    const missingRoles = wanted.some((item) => !item.roleId);

    const added = await member.roles
      .add(roleIds, `Elle yetki verildi (${interaction.user.username})`)
      .then(() => true)
      .catch(() => false);
    if (!added) return replyError(interaction, 'Roller verilemedi.', 'Botun rolü verilecek rollerin üstünde olmalı.');

    await interaction.editReply({
      components: [ui.staffPanel({ user: member.user, levelId, permIds, dutyIds, done: true, missingRoles, by: interaction.user.id, roleIds })],
      allowedMentions: { parse: [] },
    });

    const dmSent = await member
      .send({ components: [ui.grantDm(interaction.guild.name, { level, permIds, dutyIds, by: interaction.user.id })], flags: core.CV2 })
      .then(() => true)
      .catch(() => false);
    if (!dmSent) await respond(interaction, core.alert('Üyeye DM gönderilemedi.', 'DM kutusu kapalı olabilir; **yetki yine de verildi.**', 'warning'));
  } finally {
    giving.delete(userId);
  }
}

async function handleCancel(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  return interaction.update({ components: [core.alert('Yetki verme iptal edildi.', null, 'danger')] });
}

// ── Yetki alma ──────────────────────────────────────────────────────────────

// Üyenin şu an sahip olduğu rütbe, yetki ve görev rolleri
const heldOf = (member) => {
  const owned = (list) => list.filter((item) => item.roleId && member.roles.cache.has(item.roleId)).map((item) => item.id);
  return { levelIds: owned(config.levels), permIds: owned(config.perms), dutyIds: owned(config.duties) };
};

// Alınacak rol ID'leri. Hepsi alınırken Yetkili Ekibi ve takım rolleri de gider; seçerek alınırken geriye hiçbir yetki
// kalmadıysa Yetkili Ekibi rolü, hiçbir kalan rütbe gerektirmiyorsa takım rolü (Yönetim Ekibi) de alınır.
function rolesToTake(member, picked, all) {
  const held = heldOf(member);
  const taken = all ? held : picked;
  const left = {
    levelIds: held.levelIds.filter((id) => !taken.levelIds.includes(id)),
    permIds: held.permIds.filter((id) => !taken.permIds.includes(id)),
    dutyIds: held.dutyIds.filter((id) => !taken.dutyIds.includes(id)),
  };
  const nothingLeft = !left.levelIds.length && !left.permIds.length && !left.dutyIds.length;
  const stillNeeded = new Set(config.levels.filter((l) => left.levelIds.includes(l.id)).flatMap((l) => l.extraRoleIds ?? []));
  const ids = [
    ...config.levels.filter((l) => taken.levelIds.includes(l.id)).map((l) => l.roleId),
    ...config.levels.flatMap((l) => l.extraRoleIds ?? []).filter((id) => !stillNeeded.has(id)),
    ...config.perms.filter((p) => taken.permIds.includes(p.id)).map((p) => p.roleId),
    ...config.duties.filter((d) => taken.dutyIds.includes(d.id)).map((d) => d.roleId),
    ...(all || nothingLeft ? [basvuruConfig.roles.accept] : []),
  ];
  return { held, taken, roleIds: [...new Set(ids.filter((id) => id && member.roles.cache.has(id)))] };
}

const takeState = (parts) => ({
  levelIds: ui.unmask(parts[2], config.levels),
  permIds: ui.unmask(parts[3], config.perms),
  dutyIds: ui.unmask(parts[4], config.duties),
});

// /yetki-al kullanici
async function handleTakeCommand(interaction) {
  if (!inStaffChannel(interaction)) return staffChannelError(interaction);
  const user = interaction.options.getUser('kullanici', true);
  if (user.bot) return replyError(interaction, 'Botlardan yetki alınamaz.');
  const member = interaction.options.getMember('kullanici');
  if (!member) return replyError(interaction, 'Üye sunucuda değil.', 'Yetki almak için üyenin sunucuda olması gerekir.');
  const held = heldOf(member);
  const isStaff = member.roles.cache.has(basvuruConfig.roles.accept) || [held.levelIds, held.permIds, held.dutyIds].some((list) => list.length);
  if (!isStaff) return replyError(interaction, 'Bu üyenin alınacak yetkisi yok.', 'Üyede yetkili rolü bulunmuyor.');
  const picked = { levelIds: [], permIds: [], dutyIds: [] };
  return respond(interaction, ui.takePanel({ user, held, picked }), { ephemeral: false });
}

// Rütbe, yetki ve görev menüleri: sadece kendi seçimini günceller, diğerleri ID'de taşınır
const handleTakeMenu = (field) => async (interaction) => {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const parts = interaction.customId.split(':');
  const member = await interaction.guild.members.fetch(parts[1]).catch(() => null);
  if (!member) return replyError(interaction, 'Üye bulunamadı.', 'Üye sunucudan ayrılmış olabilir.');
  const picked = { ...takeState(parts), [field]: interaction.values };
  return interaction.update({
    components: [ui.takePanel({ user: member.user, held: heldOf(member), picked })],
    allowedMentions: { parse: [] },
  });
};

// "Seçilenleri Al" ve "Hepsini Al": rolleri alır, kayıt panelini bırakır, kişiye DM ile haber verir
const takeRoles = (all) => async (interaction) => {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const parts = interaction.customId.split(':');
  const userId = parts[1];

  if (taking.has(userId)) return replyError(interaction, 'Bu üyenin yetkisi zaten alınıyor.');
  taking.add(userId);
  try {
    // Roller Discord'dan istenip alınırken 3 saniye aşılabilir; önce etkileşim onaylanır
    await interaction.deferUpdate();

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return replyError(interaction, 'Üye sunucuda değil.', 'Yetki almak için üyenin sunucuda olması gerekir.');

    const { held, taken, roleIds } = rolesToTake(member, all ? { levelIds: [], permIds: [], dutyIds: [] } : takeState(parts), all);
    if (!roleIds.length) return replyError(interaction, 'Alınacak rol kalmadı.', 'Üyenin bu rolleri zaten yok; paneli yeniden aç.');

    const removed = await member.roles
      .remove(roleIds, `Yetki alındı (${interaction.user.username})`)
      .then(() => true)
      .catch(() => false);
    if (!removed) return replyError(interaction, 'Roller alınamadı.', 'Botun rolü alınacak rollerin üstünde olmalı.');

    await interaction.editReply({
      components: [ui.takePanel({ user: member.user, held, picked: taken, done: true, all, by: interaction.user.id, roleIds })],
      allowedMentions: { parse: [] },
    });

    const dmSent = await member
      .send({ components: [ui.revokeDm(interaction.guild.name, { taken, by: interaction.user.id, all })], flags: core.CV2 })
      .then(() => true)
      .catch(() => false);
    if (!dmSent) await respond(interaction, core.alert('Üyeye DM gönderilemedi.', 'DM kutusu kapalı olabilir; **yetki yine de alındı.**', 'warning'));
  } finally {
    taking.delete(userId);
  }
};

async function handleTakeCancel(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  return interaction.update({ components: [core.alert('Yetki alma iptal edildi.', null, 'danger')] });
}

module.exports = {
  name: 'yetki',
  commands,
  help: {
    category: ['yetki', 'Yetkili İşlemleri'],
    access: {
      'yetki-ver': `Yöneticiler, sadece <#${staffCommandChannel}> kanalında`,
      'yetki-al': `Yöneticiler, sadece <#${staffCommandChannel}> kanalında`,
    },
  },
  slash: { 'yetki-ver': handleCommand, 'yetki-al': handleTakeCommand },
  events: {
    [Events.ClientReady]: (client) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) access.sync(guild).catch((err) => console.error('[yetki] Yetki izinleri ayarlanamadı:', err.message));
    },
  },
  buttons: { [ui.IDS.cancel]: handleCancel, [ui.IDS.takeCancel]: handleTakeCancel },
  prefixed: [
    [ui.IDS.level, handleLevel],
    [ui.IDS.perms, handlePerms],
    [ui.IDS.duties, handleDuties],
    [ui.IDS.give, handleGive],
    [ui.IDS.takeLevel, handleTakeMenu('levelIds')],
    [ui.IDS.takePerms, handleTakeMenu('permIds')],
    [ui.IDS.takeDuties, handleTakeMenu('dutyIds')],
    [ui.IDS.takeSelected, takeRoles(false)],
    [ui.IDS.takeAll, takeRoles(true)],
  ],
};
