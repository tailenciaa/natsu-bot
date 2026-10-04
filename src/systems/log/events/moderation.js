// Moderasyon logları: yasaklama/yasak kaldırma ve bot dışından (Discord'un kendi arayüzünden) uygulanan zaman
// aşımları. Botun /sicil komutlarıyla verdiği cezalar çok daha zengin detayla (sebep, süre, yetkili, sicil
// numarası) doğrudan sicil sisteminden (systems/sicil/moderation.js) loglanır; o yüzden burada sadece dedupe'den
// geçemeyen (yani bot üzerinden yapılmamış) işlemler ele alınır.
const { AuditLogEvent } = require('discord.js');
const engine = require('../engine');
const ui = require('../ui');
const dedupe = require('../dedupe');

async function findExecutor(guild, userId, actionType) {
  const logs = await guild.fetchAuditLogs({ type: actionType, limit: 5 }).catch(() => null);
  return logs?.entries.find((e) => e.target?.id === userId && Date.now() - e.createdTimestamp < 10_000) ?? null;
}

async function handleBanAdd(ban) {
  if (dedupe.consumeHandled(ban.guild.id, ban.user.id, 'ban')) return; // sicil üzerinden verildi, zaten loglandı
  const found = await findExecutor(ban.guild, ban.user.id, AuditLogEvent.MemberBanAdd);
  await engine.send(
    ban.client,
    'moderasyon',
    ui.entry('danger', 'Üye Yasaklandı (bot dışından)', [
      `**Kullanıcı:** ${ban.user.tag} (${ban.user.id})`,
      found?.executor ? `**Yetkili:** <@${found.executor.id}>` : '-# Yetkili tespit edilemedi',
      found?.reason ? `**Sebep:** ${found.reason}` : null,
    ]),
  );
}

async function handleBanRemove(ban) {
  if (dedupe.consumeHandled(ban.guild.id, ban.user.id, 'ban')) return;
  const found = await findExecutor(ban.guild, ban.user.id, AuditLogEvent.MemberBanRemove);
  await engine.send(
    ban.client,
    'moderasyon',
    ui.entry('success', 'Yasak Kaldırıldı (bot dışından)', [
      `**Kullanıcı:** ${ban.user.tag} (${ban.user.id})`,
      found?.executor ? `**Yetkili:** <@${found.executor.id}>` : null,
    ]),
  );
}

// GuildMemberUpdate olayının susturma (timeout) kısmı; member.js tarafından çağrılır
async function checkManualTimeout(oldMember, newMember) {
  if (oldMember.communicationDisabledUntilTimestamp === newMember.communicationDisabledUntilTimestamp) return;
  if (dedupe.consumeHandled(newMember.guild.id, newMember.id, 'mute')) return; // sicil üzerinden verildi/kaldırıldı/uzatıldı

  const until = newMember.communicationDisabledUntilTimestamp;
  if (until && until > Date.now()) {
    await engine.send(
      newMember.client,
      'moderasyon',
      ui.entry('danger', 'Üye Susturuldu (bot dışından)', [
        `**Kullanıcı:** <@${newMember.id}>`,
        `**Süre:** <t:${Math.floor(until / 1000)}:R>'a kadar`,
      ]),
    );
  } else if (!until) {
    await engine.send(
      newMember.client,
      'moderasyon',
      ui.entry('success', 'Susturma Kaldırıldı (bot dışından)', [`**Kullanıcı:** <@${newMember.id}>`]),
    );
  }
}

module.exports = { handleBanAdd, handleBanRemove, checkManualTimeout };
