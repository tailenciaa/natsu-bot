// Oto rol: sunucuya katılan üyeye otomatik rol verir.
// Sunucuda kurallar ekranı (üyelik taraması) açıksa rol, üye kuralları kabul ettiğinde verilir.
// Discord Developer Portal'da "Server Members Intent" açık olmalı; botun rolü verilecek rolün üstünde olmalı.
const { Events } = require('discord.js');
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
    [Events.GuildMemberAdd]: (member) => (member.pending ? null : giveRole(member)),
    // Kurallar ekranını geçen üye
    [Events.GuildMemberUpdate]: (before, after) => (before.pending && !after.pending ? giveRole(after) : null),
  },
};
