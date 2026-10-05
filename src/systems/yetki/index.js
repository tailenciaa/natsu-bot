// Elle yetki verme paneli: /yetki-ver ile açılır. Seviye seçilince o seviyenin yetkileri otomatik işaretlenir,
// istenirse ekstra yetki eklenip çıkarılır. Rolü ayarlanmamış (roleId: null) seviye/yetkiler için rol verilmez.
// Panel herkese açık gönderilir, ama menü ve butonları sadece yöneticiler kullanabilir.
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
    .setDescription('Bir kullanıcıya panelden seviye ve yetki seçerek elle yetki verir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Yetki verilecek kullanıcı').setRequired(true)),
];

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
  return respond(interaction, ui.staffPanel({ user, levelId: null, permIds: [], dutyIds: [] }), { ephemeral: false });
}

// Seviye menüsü: seviyenin yetkilerini otomatik seçer
async function handleLevel(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');
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
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');
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
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');
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
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!level || !member) return replyError(interaction, 'Kullanıcı sunucuda bulunamadı.');

  const wanted = [level, ...config.perms.filter((p) => permIds.includes(p.id)), ...config.duties.filter((d) => dutyIds.includes(d.id))];
  // Yetkili Ekibi rolü de verilir: yetkili komutlarını görmek ve sicile bakmak için gerekir
  const roleIds = [...new Set([basvuruConfig.roles.accept, ...(level.extraRoleIds ?? []), ...wanted.map((item) => item.roleId)].filter(Boolean))];
  const missingRoles = wanted.some((item) => !item.roleId);

  const added = await member.roles
    .add(roleIds, `Elle yetki verildi (${interaction.user.username})`)
    .then(() => true)
    .catch(() => false);
  if (!added) return replyError(interaction, 'Roller verilemedi.', 'Botun rolü verilecek rollerin üstünde olmalı.');

  await interaction.update({
    components: [ui.staffPanel({ user: member.user, levelId, permIds, dutyIds, done: true, missingRoles })],
    allowedMentions: { parse: [] },
  });

  await member.send({ components: [ui.grantDm(interaction.guild.name)], flags: core.CV2 }).catch(() => {});
}

async function handleCancel(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  return interaction.update({ components: [core.alert('Yetki verme iptal edildi.', null, 'danger')] });
}

module.exports = {
  name: 'yetki',
  commands,
  help: { category: ['yetki', 'Yetkili İşlemleri'], access: { 'yetki-ver': `Yöneticiler, sadece <#${staffCommandChannel}> kanalında.` } },
  slash: { 'yetki-ver': handleCommand },
  events: {
    [Events.ClientReady]: (client) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) access.sync(guild).catch((err) => console.error('[yetki] Yetki izinleri ayarlanamadı:', err.message));
    },
  },
  buttons: { [ui.IDS.cancel]: handleCancel },
  prefixed: [
    [ui.IDS.level, handleLevel],
    [ui.IDS.perms, handlePerms],
    [ui.IDS.duties, handleDuties],
    [ui.IDS.give, handleGive],
  ],
};
