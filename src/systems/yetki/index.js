// Elle yetki verme paneli: /yetki-ver ile açılır. Seviye seçilince o seviyenin yetkileri otomatik işaretlenir,
// istenirse ekstra yetki eklenip çıkarılır. Rolü ayarlanmamış (roleId: null) seviye/yetkiler için rol verilmez.
// Panel herkese açık gönderilir, ama menü ve butonları sadece yöneticiler kullanabilir.
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { staffCommandChannel } = require('../../core/config');
const { respond, replyError, inStaffChannel, staffChannelError } = require('../../core/helpers');
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
  return respond(interaction, ui.staffPanel({ user, levelId: null, permIds: [] }), { ephemeral: false });
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
    components: [ui.staffPanel({ user, levelId: level.id, permIds: [...level.perms] })],
    allowedMentions: { parse: [] },
  });
}

// Yetki menüsü: seçilen seviyenin üstüne ekstra yetki ekleme/çıkarma
async function handlePerms(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId, levelId] = interaction.customId.split(':');
  const user = await fetchUser(interaction, userId);
  if (!user) return replyError(interaction, 'Kullanıcı bulunamadı.');
  return interaction.update({
    components: [ui.staffPanel({ user, levelId, permIds: interaction.values })],
    allowedMentions: { parse: [] },
  });
}

// "Yetkiyi Ver": seviye ve yetkilerin ayarlı rollerini verir, kişiye DM ile haber verir
async function handleGive(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  const [, userId, levelId, permList] = interaction.customId.split(':');
  const level = levelById(levelId);
  const permIds = permList ? permList.split(',') : [];
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!level || !member) return replyError(interaction, 'Kullanıcı sunucuda bulunamadı.');

  const selectedPerms = config.perms.filter((p) => permIds.includes(p.id));
  const wanted = [level, ...selectedPerms];
  const roleIds = wanted.map((item) => item.roleId).filter(Boolean);
  const missingRoles = roleIds.length < wanted.length;

  if (roleIds.length) {
    const added = await member.roles
      .add(roleIds, `Elle yetki verildi (${interaction.user.username})`)
      .then(() => true)
      .catch(() => false);
    if (!added) {
      return replyError(interaction, 'Roller verilemedi.', 'Botun rolü verilecek rollerin üstünde olmalı.');
    }
  }

  await interaction.update({
    components: [ui.staffPanel({ user: member.user, levelId, permIds, done: true, missingRoles })],
    allowedMentions: { parse: [] },
  });

  await member.send({ components: [ui.grantDm(interaction.guild.name)], flags: core.CV2 }).catch(() => {});
}

async function handleCancel(interaction) {
  const denied = denyNonAdmin(interaction);
  if (denied) return denied;
  return interaction.update({ components: [core.alert('Yetki verme iptal edildi.', null, 'danger')] });
}

// Açılışta sunucudaki rollerin adını ve ID'sini loga yazar; yetki/oryantasyon ayarlarına rol ID'si girerken kullanılır
function listRoles(client) {
  const guild = client.guilds.cache.get(require('../../core/config').guildId);
  if (!guild) return;
  const roles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
  console.log(`[roller] ${roles.length} rol (üstten alta):`);
  for (const role of roles) console.log(`[roller] ${role.position} | ${role.name} | ${role.id}${role.managed ? ' | bot/entegrasyon' : ''}`);
  const me = guild.members.me;
  console.log(`[roller] Botun en yüksek rolü: ${me?.roles.highest.name} (${me?.roles.highest.position}), Rolleri Yönet: ${me?.permissions.has('ManageRoles')}`);
}

module.exports = {
  name: 'yetki',
  events: { [Events.ClientReady]: listRoles },
  commands,
  help: { category: ['yetki', 'Yetkili İşlemleri'], access: { 'yetki-ver': `Yöneticiler, sadece <#${staffCommandChannel}> kanalında.` } },
  slash: { 'yetki-ver': handleCommand },
  buttons: { [ui.IDS.cancel]: handleCancel },
  prefixed: [
    [ui.IDS.level, handleLevel],
    [ui.IDS.perms, handlePerms],
    [ui.IDS.give, handleGive],
  ],
};
