// Sunucu, kanal ve rol logları: kanal/alt başlık, rol, sunucu ayarı, emoji, çıkartma ve davet değişiklikleri.
// Mümkün olduğunda işlemi yapan yetkili denetim kaydından bulunup eklenir.
const { AuditLogEvent, ChannelType } = require('discord.js');
const audit = require('../audit');
const engine = require('../engine');
const ui = require('../ui');
const invites = require('./invite');

const TYPE_NAMES = {
  [ChannelType.GuildText]: 'Yazı kanalı',
  [ChannelType.GuildVoice]: 'Ses kanalı',
  [ChannelType.GuildCategory]: 'Kategori',
  [ChannelType.GuildAnnouncement]: 'Duyuru kanalı',
  [ChannelType.GuildStageVoice]: 'Sahne kanalı',
  [ChannelType.GuildForum]: 'Forum kanalı',
  [ChannelType.GuildMedia]: 'Medya kanalı',
};
const typeOf = (channel) => TYPE_NAMES[channel.type] ?? 'Kanal';
const bool = (value) => (value ? 'açık' : 'kapalı');
const list = (items, max = 10) => (items.length > max ? `${items.slice(0, max).join(', ')} +${items.length - max}` : items.join(', '));

// ── Kanallar ─────────────────────────────────────────────────────────────────

async function handleChannelCreate(channel) {
  if (!channel.guild) return;
  await engine.send(
    channel.client,
    'kanal',
    ui.entry('success', 'Kanal Oluşturuldu', [
      `**Kanal:** <#${channel.id}> (${channel.name})`,
      `**Tür:** ${typeOf(channel)}`,
      channel.parent ? `**Kategori:** ${channel.parent.name}` : null,
      await audit.by(channel.guild, AuditLogEvent.ChannelCreate, channel.id),
    ]),
  );
}

async function handleChannelDelete(channel) {
  if (!channel.guild) return;
  await engine.send(
    channel.client,
    'kanal',
    ui.entry('danger', 'Kanal Silindi', [
      `**Kanal:** #${channel.name}`,
      `**Tür:** ${typeOf(channel)}`,
      channel.parent ? `**Kategori:** ${channel.parent.name}` : null,
      await audit.by(channel.guild, AuditLogEvent.ChannelDelete, channel.id),
    ]),
  );
}

const overwriteMap = (channel) =>
  new Map((channel.permissionOverwrites?.cache ?? []).map((o) => [o.id, { type: o.type, value: `${o.allow.bitfield}:${o.deny.bitfield}` }]));

async function handleChannelUpdate(oldChannel, newChannel) {
  if (!newChannel.guild) return;
  const changes = [];
  if (oldChannel.name !== newChannel.name) changes.push(`**Ad:** ${oldChannel.name} → ${newChannel.name}`);
  if (oldChannel.parentId !== newChannel.parentId) {
    changes.push(`**Kategori:** ${oldChannel.parent?.name ?? 'yok'} → ${newChannel.parent?.name ?? 'yok'}`);
  }
  if ((oldChannel.topic ?? '') !== (newChannel.topic ?? '')) {
    changes.push(`**Konu:** ${oldChannel.topic || '(boş)'} → ${newChannel.topic || '(boş)'}`);
  }
  if (oldChannel.nsfw !== newChannel.nsfw && newChannel.nsfw !== undefined) changes.push(`**Yaş sınırı:** ${bool(newChannel.nsfw)}`);
  if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser && newChannel.rateLimitPerUser !== undefined) {
    changes.push(`**Yavaş mod:** ${oldChannel.rateLimitPerUser ?? 0} sn → ${newChannel.rateLimitPerUser ?? 0} sn`);
  }
  if (oldChannel.bitrate !== newChannel.bitrate && newChannel.bitrate) changes.push(`**Bit hızı:** ${oldChannel.bitrate / 1000} → ${newChannel.bitrate / 1000} kbps`);
  if (oldChannel.userLimit !== newChannel.userLimit && newChannel.userLimit !== undefined) {
    changes.push(`**Kullanıcı sınırı:** ${oldChannel.userLimit || 'yok'} → ${newChannel.userLimit || 'yok'}`);
  }

  const before = overwriteMap(oldChannel);
  const after = overwriteMap(newChannel);
  const touched = [...new Set([...before.keys(), ...after.keys()])].filter((id) => before.get(id)?.value !== after.get(id)?.value);
  if (touched.length) {
    const mention = (id) => ((after.get(id) ?? before.get(id)).type === 0 ? `<@&${id}>` : `<@${id}>`);
    changes.push(`**İzinleri değişenler:** ${list(touched.map(mention))}`);
  }
  if (!changes.length) return; // konum değişikliği gibi önemsiz güncellemeler atlanır

  await engine.send(
    newChannel.client,
    'kanal',
    ui.entry('warning', 'Kanal Güncellendi', [
      `**Kanal:** <#${newChannel.id}>`,
      ...changes,
      await audit.by(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id).then((line) =>
        line ?? (touched.length ? audit.by(newChannel.guild, AuditLogEvent.ChannelOverwriteUpdate, newChannel.id) : null),
      ),
    ]),
  );
}

// Botun kendi açtığı alt başlıklar (destek talepleri, özel odalar, log alt başlıkları) loglanmaz
const botThread = (thread) => thread.ownerId === thread.client.user.id;

async function handleThreadCreate(thread, newlyCreated) {
  if (!newlyCreated || botThread(thread)) return;
  await engine.send(
    thread.client,
    'kanal',
    ui.entry('success', 'Alt Başlık Oluşturuldu', [
      `**Alt başlık:** <#${thread.id}> (${thread.name})`,
      thread.parent ? `**Kanal:** <#${thread.parentId}>` : null,
      thread.ownerId ? `**Açan:** <@${thread.ownerId}>` : null,
    ]),
  );
}

async function handleThreadDelete(thread) {
  if (botThread(thread)) return;
  await engine.send(
    thread.client,
    'kanal',
    ui.entry('danger', 'Alt Başlık Silindi', [
      `**Alt başlık:** ${thread.name}`,
      thread.parent ? `**Kanal:** <#${thread.parentId}>` : null,
      await audit.by(thread.guild, AuditLogEvent.ThreadDelete, thread.id),
    ]),
  );
}

// ── Roller ───────────────────────────────────────────────────────────────────

async function handleRoleCreate(role) {
  await engine.send(
    role.client,
    'rol',
    ui.entry('success', 'Rol Oluşturuldu', [`**Rol:** <@&${role.id}> (${role.name})`, await audit.by(role.guild, AuditLogEvent.RoleCreate, role.id)]),
  );
}

async function handleRoleDelete(role) {
  await engine.send(
    role.client,
    'rol',
    ui.entry('danger', 'Rol Silindi', [`**Rol:** ${role.name}`, await audit.by(role.guild, AuditLogEvent.RoleDelete, role.id)]),
  );
}

async function handleRoleUpdate(oldRole, newRole) {
  const changes = [];
  if (oldRole.name !== newRole.name) changes.push(`**Ad:** ${oldRole.name} → ${newRole.name}`);
  if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Renk:** ${oldRole.hexColor} → ${newRole.hexColor}`);
  if (oldRole.hoist !== newRole.hoist) changes.push(`**Ayrı gösterim:** ${bool(newRole.hoist)}`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Etiketlenebilir:** ${bool(newRole.mentionable)}`);
  const added = oldRole.permissions.missing(newRole.permissions);
  const removed = newRole.permissions.missing(oldRole.permissions);
  if (added.length) changes.push(`**Verilen izinler:** ${list(added.map((p) => `\`${p}\``), 15)}`);
  if (removed.length) changes.push(`**Alınan izinler:** ${list(removed.map((p) => `\`${p}\``), 15)}`);
  if (!changes.length) return; // sıra değişikliği gibi önemsiz güncellemeler atlanır

  await engine.send(
    newRole.client,
    'rol',
    ui.entry('warning', 'Rol Güncellendi', [`**Rol:** <@&${newRole.id}>`, ...changes, await audit.by(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id)]),
  );
}

// ── Sunucu ───────────────────────────────────────────────────────────────────

async function handleGuildUpdate(oldGuild, newGuild) {
  const changes = [];
  if (oldGuild.name !== newGuild.name) changes.push(`**Ad:** ${oldGuild.name} → ${newGuild.name}`);
  if (oldGuild.icon !== newGuild.icon) changes.push('**Sunucu ikonu değişti**');
  if (oldGuild.banner !== newGuild.banner) changes.push('**Sunucu afişi değişti**');
  if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`**Özel davet bağlantısı:** ${oldGuild.vanityURLCode ?? 'yok'} → ${newGuild.vanityURLCode ?? 'yok'}`);
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push('**Doğrulama seviyesi değişti**');
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push(`**AFK kanalı:** ${newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : 'yok'}`);
  if (oldGuild.ownerId !== newGuild.ownerId) changes.push(`**Sunucu sahibi:** <@${newGuild.ownerId}>`);
  if (!changes.length) return;

  await engine.send(
    newGuild.client,
    'sunucu',
    ui.entry('primary', 'Sunucu Ayarları Güncellendi', [...changes, await audit.by(newGuild, AuditLogEvent.GuildUpdate)]),
  );
}

async function handleEmojiCreate(emoji) {
  await engine.send(
    emoji.client,
    'sunucu',
    ui.entry('success', 'Emoji Eklendi', [`**Emoji:** ${emoji} \`:${emoji.name}:\``, await audit.by(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id)]),
  );
}

async function handleEmojiDelete(emoji) {
  await engine.send(
    emoji.client,
    'sunucu',
    ui.entry('danger', 'Emoji Silindi', [`**Emoji:** \`:${emoji.name}:\``, await audit.by(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id)]),
  );
}

async function handleEmojiUpdate(oldEmoji, newEmoji) {
  if (oldEmoji.name === newEmoji.name) return;
  await engine.send(
    newEmoji.client,
    'sunucu',
    ui.entry('warning', 'Emoji Düzenlendi', [
      `**Emoji:** ${newEmoji} \`:${oldEmoji.name}:\` → \`:${newEmoji.name}:\``,
      await audit.by(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id),
    ]),
  );
}

async function handleStickerCreate(sticker) {
  await engine.send(
    sticker.client,
    'sunucu',
    ui.entry('success', 'Çıkartma Eklendi', [`**Çıkartma:** ${sticker.name}`, await audit.by(sticker.guild, AuditLogEvent.StickerCreate, sticker.id)]),
  );
}

async function handleStickerDelete(sticker) {
  await engine.send(
    sticker.client,
    'sunucu',
    ui.entry('danger', 'Çıkartma Silindi', [`**Çıkartma:** ${sticker.name}`, await audit.by(sticker.guild, AuditLogEvent.StickerDelete, sticker.id)]),
  );
}

async function handleInviteCreate(invite) {
  invites.add(invite);
  await engine.send(
    invite.client,
    'sunucu',
    ui.entry('success', 'Davet Oluşturuldu', [
      `**Kod:** ${invite.code}`,
      `**Kanal:** <#${invite.channelId}>`,
      invite.inviter ? `**Oluşturan:** <@${invite.inviter.id}>` : null,
      `**Süre:** ${invite.maxAge ? `${Math.round(invite.maxAge / 3600)} saat` : 'süresiz'}`,
      `**Maksimum kullanım:** ${invite.maxUses || 'sınırsız'}`,
    ]),
  );
}

async function handleInviteDelete(invite) {
  await engine.send(
    invite.client,
    'sunucu',
    ui.entry('danger', 'Davet Silindi', [
      `**Kod:** ${invite.code}`,
      `**Kanal:** <#${invite.channelId}>`,
      invite.guild ? await audit.by(invite.guild, AuditLogEvent.InviteDelete) : null,
    ]),
  );
}

module.exports = {
  handleChannelCreate,
  handleChannelDelete,
  handleChannelUpdate,
  handleThreadCreate,
  handleThreadDelete,
  handleRoleCreate,
  handleRoleDelete,
  handleRoleUpdate,
  handleGuildUpdate,
  handleEmojiCreate,
  handleEmojiDelete,
  handleEmojiUpdate,
  handleStickerCreate,
  handleStickerDelete,
  handleInviteCreate,
  handleInviteDelete,
};
