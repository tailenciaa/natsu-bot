// Oto rol: sunucuya katılan üyeye otomatik rol verir.
// Sunucuda kurallar ekranı (üyelik taraması) açıksa rol, üye kuralları kabul ettiğinde verilir.
// Discord Developer Portal'da "Server Members Intent" açık olmalı; botun rolü verilecek rolün üstünde olmalı.
const { Events } = require('discord.js');
const { guildId } = require('../../core/config');
const config = require('./config');

async function giveRole(member) {
  if (member.user.bot && !config.includeBots) return;
  if (member.roles.cache.has(config.roles.member)) return;

  await member.roles
    .add(config.roles.member, 'Oto rol')
    .catch((err) => console.error(`[otorol] ${member.user.username} kullanıcısına rol verilemedi:`, err.message));
}

module.exports = {
  name: 'otorol',
  events: {
    [Events.GuildMemberAdd]: (member) => (member.guild.id === guildId && !member.pending ? giveRole(member) : null),
    // Kurallar ekranını geçen üye (önceki hal önbellekte yoksa da rol eksikse verilir)
    [Events.GuildMemberUpdate]: (before, after) => (after.guild.id === guildId && !after.pending && before.pending !== false ? giveRole(after) : null),
  },
};
