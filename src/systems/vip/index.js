// VIP sistemi: yetkililer /vip-ver ile bir üyeye VIP rolünü kalıcı olarak verir (bot geri almaz, geri alma Discord
// üzerinden elle yapılır). /vip-siralama o an rolü taşıyan üyeleri VIP olma sırasına göre listeler.
const { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { respond, replyError, isStaff, isMenuOwner } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('vip-ver')
    .setDescription('Bir üyeye VIP rolünü verir.')
    .addUserOption((opt) => opt.setName('kullanici').setDescription('VIP rolü verilecek üyeyi seçer.').setRequired(true))
    .setDefaultMemberPermissions(config.staffRoles.length ? null : PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('vip-siralama')
    .setDescription('VIP üyeleri VIP olma sırasına göre listeler.')
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

// VIP üyeler, VIP olma sırasına göre (en eski ilk)
async function vipRanking(guild) {
  const role = await guild.roles.fetch(config.roleId).catch(() => null);
  return role
    ? [...role.members.values()]
        .map((m) => ({ userId: m.id, grantedAt: store.grantedAt(m.id) ?? 0 }))
        .sort((a, b) => a.grantedAt - b.grantedAt || a.userId.localeCompare(b.userId))
    : [];
}

// /vip-siralama: o an rolü taşıyan üyeler, VIP olma sırasına göre
async function handleTable(interaction) {
  return respond(interaction, ui.table(interaction.guild, await vipRanking(interaction.guild), 0));
}

// Sayfa butonları: vip-sayfa:<sayfa>:<buton yeri>; sadece komutu kullanan kişi sayfa değiştirebilir
async function handlePage(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Bu listeyi sadece komutu kullanan kişi değiştirebilir.', 'Kendi listen için /vip-siralama yazabilirsin.');
  }
  const page = Number(interaction.customId.split(':')[1]) || 0;
  return interaction.update({ components: [ui.table(interaction.guild, await vipRanking(interaction.guild), page)], allowedMentions: { parse: [] } });
}

module.exports = {
  name: 'vip',
  commands,
  help: {
    category: ['siralama', 'Sıralama'],
    member: ['vip-siralama'],
    access: { 'vip-ver': 'Yöneticiler', 'vip-siralama': 'Herkes' },
    need: { 'vip-ver': 'Yöneticiler' },
  },
  slash: { 'vip-ver': handleGive, 'vip-siralama': handleTable },
  prefixed: [[ui.IDS.page, handlePage]],
};
