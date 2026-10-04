// Sunucu logları: kanal, rol, sunucu ayarı, emoji ve davet değişiklikleri.
const engine = require('../engine');
const ui = require('../ui');

async function handleChannelCreate(channel) {
  if (!channel.guild) return;
  await engine.send(
    channel.client,
    'sunucu',
    ui.entry('success', 'Kanal Oluşturuldu', [`**Kanal:** ${channel.name} (<#${channel.id}>)`, channel.parent ? `**Kategori:** ${channel.parent.name}` : null]),
  );
}

async function handleChannelDelete(channel) {
  if (!channel.guild) return;
  await engine.send(
    channel.client,
    'sunucu',
    ui.entry('danger', 'Kanal Silindi', [`**Kanal:** #${channel.name}`, channel.parent ? `**Kategori:** ${channel.parent.name}` : null]),
  );
}

async function handleChannelUpdate(oldChannel, newChannel) {
  if (!newChannel.guild || oldChannel.name === newChannel.name) return;
  await engine.send(
    newChannel.client,
    'sunucu',
    ui.entry('warning', 'Kanal Adı Değişti', [`**Önceki:** #${oldChannel.name}`, `**Yeni:** <#${newChannel.id}>`]),
  );
}

async function handleRoleCreate(role) {
  await engine.send(role.client, 'sunucu', ui.entry('success', 'Rol Oluşturuldu', [`**Rol:** <@&${role.id}>`]));
}

async function handleRoleDelete(role) {
  await engine.send(role.client, 'sunucu', ui.entry('danger', 'Rol Silindi', [`**Rol:** ${role.name}`]));
}

async function handleRoleUpdate(oldRole, newRole) {
  if (oldRole.name === newRole.name && oldRole.hexColor === newRole.hexColor) return;
  await engine.send(
    newRole.client,
    'sunucu',
    ui.entry('warning', 'Rol Güncellendi', [
      `**Rol:** <@&${newRole.id}>`,
      oldRole.name !== newRole.name ? `**Ad:** ${oldRole.name} → ${newRole.name}` : null,
      oldRole.hexColor !== newRole.hexColor ? `**Renk:** ${oldRole.hexColor} → ${newRole.hexColor}` : null,
    ]),
  );
}

async function handleGuildUpdate(oldGuild, newGuild) {
  if (oldGuild.name === newGuild.name && oldGuild.iconURL() === newGuild.iconURL()) return;
  await engine.send(
    newGuild.client,
    'sunucu',
    ui.entry('primary', 'Sunucu Ayarları Güncellendi', [
      oldGuild.name !== newGuild.name ? `**Ad:** ${oldGuild.name} → ${newGuild.name}` : null,
      oldGuild.iconURL() !== newGuild.iconURL() ? '**Sunucu ikonu değişti**' : null,
    ]),
  );
}

async function handleEmojiCreate(emoji) {
  await engine.send(emoji.client, 'sunucu', ui.entry('success', 'Emoji Eklendi', [`**Emoji:** ${emoji} \`:${emoji.name}:\``]));
}

async function handleEmojiDelete(emoji) {
  await engine.send(emoji.client, 'sunucu', ui.entry('danger', 'Emoji Silindi', [`**Emoji:** :${emoji.name}:`]));
}

async function handleInviteCreate(invite) {
  await engine.send(
    invite.client,
    'sunucu',
    ui.entry('success', 'Davet Oluşturuldu', [
      `**Kod:** ${invite.code}`,
      `**Kanal:** <#${invite.channelId}>`,
      invite.inviter ? `**Oluşturan:** <@${invite.inviter.id}>` : null,
      invite.maxUses ? `**Maksimum kullanım:** ${invite.maxUses}` : null,
    ]),
  );
}

async function handleInviteDelete(invite) {
  await engine.send(
    invite.client,
    'sunucu',
    ui.entry('danger', 'Davet Silindi', [`**Kod:** ${invite.code}`, `**Kanal:** <#${invite.channelId}>`]),
  );
}

module.exports = {
  handleChannelCreate,
  handleChannelDelete,
  handleChannelUpdate,
  handleRoleCreate,
  handleRoleDelete,
  handleRoleUpdate,
  handleGuildUpdate,
  handleEmojiCreate,
  handleEmojiDelete,
  handleInviteCreate,
  handleInviteDelete,
};
