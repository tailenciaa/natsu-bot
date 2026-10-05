// Yetki rollerinin Discord'daki gerçek izinlerini bot açılırken ayarlar (config.discord). Sadece eksik izinleri ekler,
// hiçbir rolden ya da kanaldan izin almaz; her açılışta tekrar çalışması güvenlidir.
const config = require('./config');

const roleOf = (item) => item.roleId ?? config.perms.find((p) => p.id === item.perm)?.roleId ?? null;

async function syncRolePerms(guild) {
  for (const item of config.discord.rolePerms) {
    const role = guild.roles.cache.get(roleOf(item));
    if (!role) continue;
    const missing = item.allow.filter((flag) => !role.permissions.has(flag));
    if (!missing.length) continue;
    await role
      .setPermissions(role.permissions.add(missing), 'Yetki rolü izinleri ayarlandı')
      .then(() => console.log(`[yetki] ${role.name} rolüne ${missing.join(', ')} izni eklendi.`))
      .catch((err) => console.error(`[yetki] ${role.name} rolü izinleri ayarlanamadı:`, err.message));
  }
}

async function syncChannelPerms(guild) {
  for (const item of config.discord.channelPerms) {
    const roleId = roleOf(item);
    if (!roleId || !guild.roles.cache.has(roleId)) continue;
    for (const channelId of item.channels) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.permissionOverwrites) continue;
      const current = channel.permissionOverwrites.cache.get(roleId);
      if (item.allow.every((flag) => current?.allow.has(flag))) continue;
      await channel.permissionOverwrites
        .edit(roleId, Object.fromEntries(item.allow.map((flag) => [flag, true])), { reason: 'Yetki rolü kanal izni ayarlandı' })
        .catch((err) => console.error(`[yetki] #${channel.name} kanal izni ayarlanamadı:`, err.message));
    }
  }
}

async function sync(guild) {
  await guild.roles.fetch().catch(() => null);
  await syncRolePerms(guild);
  await syncChannelPerms(guild);
}

module.exports = { sync };
