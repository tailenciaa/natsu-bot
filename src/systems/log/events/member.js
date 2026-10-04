// Üye logları: katılma, ayrılma/atılma, takma ad ve rol değişiklikleri, kullanıcı adı/profil fotoğrafı değişiklikleri.
// Aynı GuildMemberUpdate olayının susturma ve boost kısımları moderation.js ve boost.js'e devredilir.
const { AuditLogEvent } = require('discord.js');
const { guildId } = require('../../../core/config');
const { unix } = require('../../../core/ui');
const engine = require('../engine');
const ui = require('../ui');
const moderationEvents = require('./moderation');
const boostEvents = require('./boost');

async function findKickExecutor(guild, userId) {
  const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 }).catch(() => null);
  return logs?.entries.find((e) => e.target?.id === userId && Date.now() - e.createdTimestamp < 10_000) ?? null;
}

async function handleMemberAdd(member) {
  const newAccount = Date.now() - member.user.createdTimestamp < 7 * 24 * 60 * 60 * 1000;
  await engine.send(
    member.client,
    'uye',
    ui.entry('success', 'Üye Katıldı', [
      `**Kullanıcı:** <@${member.id}> (${member.user.tag})`,
      `**Hesap oluşturma:** <t:${unix(member.user.createdTimestamp)}:R>${newAccount ? ' • ⚠️ yeni hesap' : ''}`,
      `**Üye sayısı:** ${member.guild.memberCount}`,
    ]),
  );
}

async function handleMemberRemove(member) {
  const kick = await findKickExecutor(member.guild, member.id);
  if (kick) {
    await engine.send(
      member.client,
      'moderasyon',
      ui.entry('danger', 'Üye Sunucudan Atıldı', [
        `**Kullanıcı:** ${member.user.tag} (${member.id})`,
        kick.executor ? `**Yetkili:** <@${kick.executor.id}>` : null,
        kick.reason ? `**Sebep:** ${kick.reason}` : null,
      ]),
    );
    return;
  }

  await engine.send(
    member.client,
    'uye',
    ui.entry('danger', 'Üye Ayrıldı', [
      `**Kullanıcı:** ${member.user.tag} (${member.id})`,
      member.joinedTimestamp ? `**Katılma tarihi:** <t:${unix(member.joinedTimestamp)}:R>` : null,
    ]),
  );
}

async function handleMemberUpdate(oldMember, newMember) {
  if (oldMember.nickname !== newMember.nickname) {
    await engine.send(
      newMember.client,
      'uye',
      ui.entry('warning', 'Takma Ad Değişti', [
        `**Kullanıcı:** <@${newMember.id}>`,
        `**Önceki:** ${oldMember.nickname ?? '(yoktu)'}`,
        `**Yeni:** ${newMember.nickname ?? '(kaldırıldı)'}`,
      ]),
    );
  }

  const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
  const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
  if (added.size || removed.size) {
    await engine.send(
      newMember.client,
      'uye',
      ui.entry('primary', 'Üye Rolleri Değişti', [
        `**Kullanıcı:** <@${newMember.id}>`,
        added.size ? `**Eklenen:** ${added.map((r) => `<@&${r.id}>`).join(', ')}` : null,
        removed.size ? `**Alınan:** ${removed.map((r) => `<@&${r.id}>`).join(', ')}` : null,
      ]),
    );
  }

  await moderationEvents.checkManualTimeout(oldMember, newMember);
  await boostEvents.checkBoost(oldMember, newMember);
}

async function handleUserUpdate(oldUser, newUser) {
  const guild = newUser.client.guilds.cache.get(guildId);
  if (!guild?.members.cache.has(newUser.id)) return; // sadece sunucu üyeleri için

  if (oldUser.tag !== newUser.tag) {
    await engine.send(
      newUser.client,
      'uye',
      ui.entry('warning', 'Kullanıcı Adı Değişti', [`**Kullanıcı:** <@${newUser.id}>`, `**Önceki:** ${oldUser.tag}`, `**Yeni:** ${newUser.tag}`]),
    );
  }
  if (oldUser.avatar !== newUser.avatar) {
    await engine.send(newUser.client, 'uye', ui.entry('primary', 'Profil Fotoğrafı Değişti', [`**Kullanıcı:** <@${newUser.id}>`]));
  }
}

module.exports = { handleMemberAdd, handleMemberRemove, handleMemberUpdate, handleUserUpdate };
