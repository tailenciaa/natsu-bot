// VIP sistemi: yetkililer /vip-ver ile bir üyeye VIP rolünü kalıcı olarak verir (bot geri almaz, geri alma Discord
// üzerinden elle yapılır). /vip-siralama o an rolü taşıyan üyeleri VIP olma sırasına göre listeler.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const { respond, replyError, isStaff } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('vip-ver')
    .setDescription('Bir üyeye VIP rolünü verir.')
    .addUserOption((opt) => opt.setName('kullanici').setDescription('VIP verilecek üye').setRequired(true))
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('vip-siralama')
    .setDescription('VIP üyeleri, VIP olma sırasına göre listeler.')
    .setContexts(InteractionContextType.Guild),
];

// /vip-ver: hedefe VIP rolünü kalıcı olarak verir, sadece yetkililer kullanabilir
async function handleGive(interaction) {
  if (!isStaff(interaction, config.staffRoles)) return replyError(interaction, 'Bu komutu sadece yetkililer kullanabilir.');

  const target = interaction.options.getUser('kullanici', true);
  if (target.bot) return replyError(interaction, 'Botlara VIP verilemez.');

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return replyError(interaction, 'Bu üye sunucuda bulunamadı.');
  if (member.roles.cache.has(config.roleId)) return replyError(interaction, 'Bu üye zaten VIP.');

  await member.roles.add(config.roleId, `VIP verildi (${interaction.user.tag})`).catch(() => null);
  store.grant(target.id, interaction.user.id);

  return respond(interaction, ui.given(interaction.user.id, target.id, config.roleId), {
    ephemeral: false,
    allowedMentions: { users: [target.id] },
  });
}

// /vip-siralama: o an rolü taşıyan üyeler, VIP olma sırasına göre (en eski ilk)
async function handleTable(interaction) {
  const role = await interaction.guild.roles.fetch(config.roleId).catch(() => null);
  const ranking = role
    ? [...role.members.values()]
        .map((m) => ({ userId: m.id, grantedAt: store.grantedAt(m.id) ?? 0 }))
        .sort((a, b) => a.grantedAt - b.grantedAt)
    : [];

  return respond(interaction, ui.table(interaction.guild, ranking, config.roleId), { ephemeral: false });
}

module.exports = {
  name: 'vip',
  commands,
  help: {
    category: ['siralama', 'Sıralama'],
    access: { 'vip-ver': 'Sadece yetkililer', 'vip-siralama': 'Herkes' },
  },
  slash: { 'vip-ver': handleGive, 'vip-siralama': handleTable },
};
