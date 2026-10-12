// VIP sistemi: yetkililer /vip-ver ile bir üyeye VIP rolünü kalıcı olarak verir (bot geri almaz, geri alma Discord
// üzerinden elle yapılır). VIP listesi ayrı bir komut değil, /siralama menüsünün bir türüdür.
const { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { respond, replyError, isStaff } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('vip-ver')
    .setDescription('Bir üyeye VIP rolünü kalıcı olarak verir; üye profilinde ve sıralamada VIP görünür.')
    .addUserOption((opt) => opt.setName('kullanici').setDescription('VIP rolü verilecek üyeyi seçer.').setRequired(true))
    .setDefaultMemberPermissions(config.staffRoles.length ? null : PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),
];

// /vip-ver: hedefe VIP rolünü kalıcı olarak verir, sadece yöneticiler (ya da ayarlı yetkili rolleri) kullanabilir
async function handleGive(interaction) {
  if (!isStaff(interaction, config.staffRoles)) return replyError(interaction, 'Bu komutu sadece yöneticiler kullanabilir.');

  const target = interaction.options.getUser('kullanici', true);
  if (target.bot) return replyError(interaction, 'Botlara VIP verilemez.');

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return replyError(interaction, 'Bu üye sunucuda bulunamadı.');
  if (member.roles.cache.has(config.roleId)) return replyError(interaction, 'Bu üye zaten VIP.');

  // Rol gerçekten verilemediyse kayıt tutulmaz ve duyuru yapılmaz
  const added = await member.roles.add(config.roleId, `VIP verildi (${interaction.user.tag})`).then(
    () => true,
    (err) => {
      console.error('[vip] VIP rolü verilemedi:', err.message);
      return false;
    },
  );
  if (!added) return replyError(interaction, 'VIP rolü verilemedi.', 'Botun rolünün VIP rolünden üstte olduğundan ve rol yönetme izni olduğundan emin ol.');
  store.grant(target.id, interaction.user.id);

  return respond(interaction, ui.given(interaction.user.id, target.id, config.roleId), {
    allowedMentions: { users: [target.id] },
  });
}

module.exports = {
  name: 'vip',
  commands,
  help: {
    category: ['siralama', 'Sıralama'],
    member: [],
    access: { 'vip-ver': 'Yöneticiler' },
  },
  slash: { 'vip-ver': handleGive },
};
