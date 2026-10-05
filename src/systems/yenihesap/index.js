// Yeni/şüpheli hesap sistemi: Discord hesabı ayarlı süreden (varsayılan 7 gün) daha yeni olan üyeler, ayarlı tek
// kanal dışında sunucudaki hiçbir kanalı göremez (jail'deki kanal görünürlük mantığıyla aynı). Hesap yeterince
// eskiyince kısıtlama otomatik kalkar. Kısıtlama rolü sabittir (config.roleId); bot kendisi rol oluşturmaz.
const { Events } = require('discord.js');
const { guildId } = require('../../core/config');
const { respond } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const config = require('./config');
const ui = require('./ui');

const DAY = 24 * 60 * 60 * 1000;
const isNewAccount = (user) => Date.now() - user.createdTimestamp < config.thresholdDays * DAY;

// Sabit kısıtlama rolünü sunucudan bulur; yoksa/bulunamazsa null döner ve hata loglanır
async function fetchRole(guild) {
  if (!config.roleId) return null;
  const role = guild.roles.cache.get(config.roleId) ?? (await guild.roles.fetch(config.roleId).catch(() => null));
  if (!role) console.error(`[yenihesap] Sabit rol bulunamadı (${config.roleId}).`);
  return role;
}

// Bir kanalın kısıtlama rolü için görünürlüğünü ayarlar: sadece ayarlı kanal görünür, diğer her kanal (kategoriler
// dahil) gizlenir. Yeni açılan kanallarda da çalışır.
async function syncVisibilityFor(channel, roleId) {
  if (!roleId || !channel?.permissionOverwrites) return;
  const allow = channel.id === config.channel;
  await channel.permissionOverwrites
    .edit(roleId, { ViewChannel: allow }, { reason: 'Yeni hesap rolü kanal görünürlüğü senkronize edildi' })
    .catch((err) => console.error(`[yenihesap] "${channel.name}" kanalı ayarlanamadı:`, err.message));
}

async function syncVisibility(guild, roleId) {
  if (!roleId || !config.channel) return;
  const channels = await guild.channels.fetch().catch(() => null);
  if (!channels) return;
  for (const channel of channels.values()) await syncVisibilityFor(channel, roleId);
  console.log(`[yenihesap] Kanal görünürlüğü senkronize edildi (${channels.size} kanal).`);
}

// Üyenin hesap yaşına göre rolü verir ya da alır
async function syncMember(member, roleId) {
  if (!roleId || member.user.bot) return;
  const has = member.roles.cache.has(roleId);
  const shouldHave = isNewAccount(member.user);
  if (shouldHave && !has) await member.roles.add(roleId, `Hesap ${config.thresholdDays} günden yeni`).catch(() => {});
  else if (!shouldHave && has) await member.roles.remove(roleId, 'Hesap artık yeterince eski').catch(() => {});
}

async function syncAllMembers(guild, roleId) {
  if (!roleId) return;
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;
  for (const member of members.values()) await syncMember(member, roleId);
  console.log(`[yenihesap] Üyeler senkronize edildi (${members.size} üye).`);
}

function sendPanel(client) {
  if (!config.channel) return;
  return syncPanel(client, {
    key: 'yenihesap',
    label: 'Yeni hesap bilgilendirme',
    channelId: config.channel,
    buttonId: ui.IDS.sure,
    build: ui.panel,
    image: '',
  });
}

async function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const role = await fetchRole(guild);
  if (!role) return;

  await syncVisibility(guild, role.id);
  await syncAllMembers(guild, role.id);
  // Panel gönderilemese de düzenli tarama kurulur
  await Promise.resolve(sendPanel(client)).catch((err) => console.error('[yenihesap] Panel gönderilemedi:', err.message));

  const run = () =>
    syncAllMembers(guild, role.id).catch((err) => console.error('[yenihesap] Üyeler senkronize edilemedi:', err.message));
  setInterval(run, config.sweepSeconds * 1000).unref();
}

function handleMemberAdd(member) {
  if (member.guild.id !== guildId) return;
  return syncMember(member, config.roleId);
}

function handleChannelCreate(channel) {
  if (channel.guild?.id !== guildId) return;
  return syncVisibilityFor(channel, config.roleId);
}

function handleSure(interaction) {
  const hasRestriction = Boolean(config.roleId && interaction.member?.roles.cache.has(config.roleId));
  return respond(interaction, ui.sureView(interaction.user, hasRestriction));
}

module.exports = {
  name: 'yenihesap',
  buttons: { [ui.IDS.sure]: handleSure },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.GuildMemberAdd]: handleMemberAdd,
    [Events.ChannelCreate]: handleChannelCreate,
  },
};
