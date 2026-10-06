// Moderasyon logları: yasaklama/yasak kaldırma ve bot dışından (Discord'un kendi arayüzünden) uygulanan zaman
// aşımları. Botun /sicil komutlarıyla verdiği cezalar çok daha zengin detayla (sebep, süre, yetkili, sicil
// numarası) doğrudan sicil sisteminden (systems/sicil/moderation.js) loglanır; o yüzden burada sadece dedupe'den
// geçemeyen (yani bot üzerinden yapılmamış) işlemler ele alınır.
const { AuditLogEvent } = require('discord.js');
const audit = require('../audit');
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
    'ban',
    ui.entry('danger', 'Üye Yasaklandı', [
      `**Kullanıcı:** ${ban.user.tag} (${ban.user.id})`,
      '**Kaynak:** bot dışından',
      found?.executor ? `**Yetkili:** <@${found.executor.id}>` : '**Yetkili:** tespit edilemedi',
      found?.reason ? `**Sebep:** ${found.reason}` : null,
    ]),
  );
}

async function handleBanRemove(ban) {
  if (dedupe.consumeHandled(ban.guild.id, ban.user.id, 'ban')) return;
  const found = await findExecutor(ban.guild, ban.user.id, AuditLogEvent.MemberBanRemove);
  await engine.send(
    ban.client,
    'ban',
    ui.entry('success', 'Yasak Kaldırıldı', [
      `**Kullanıcı:** ${ban.user.tag} (${ban.user.id})`,
      '**Kaynak:** bot dışından',
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
      'susturma',
      ui.entry('danger', 'Üye Susturuldu', [
        `**Kullanıcı:** <@${newMember.id}>`,
        '**Kaynak:** bot dışından',
        `**Bitiş:** <t:${Math.floor(until / 1000)}:F> (<t:${Math.floor(until / 1000)}:R>)`,
      ]),
    );
  } else if (!until) {
    await engine.send(
      newMember.client,
      'susturma',
      ui.entry('success', 'Susturma Kaldırıldı', [`**Kullanıcı:** <@${newMember.id}>`, '**Kaynak:** bot dışından']),
    );
  }
}

// ── AutoMod ──────────────────────────────────────────────────────────────────

const ACTIONS = { 1: 'mesaj engellendi', 2: 'uyarı mesajı gönderildi', 3: 'susturuldu', 4: 'üye etkileşimi engellendi' };

// AutoMod bir mesajı engelleyince / işlem uygulayınca: kim, nerede, hangi kural, ne yazmıştı
async function handleAutoModExecution(execution) {
  const rule = execution.guild.autoModerationRules.cache.get(execution.ruleId);
  await engine.send(
    execution.guild.client,
    'automod',
    ui.entry('danger', 'AutoMod İşlem Yaptı', [
      `**Kullanıcı:** <@${execution.userId}>`,
      execution.channelId ? `**Kanal:** <#${execution.channelId}>` : null,
      `**Kural:** ${rule?.name ?? execution.ruleId}`,
      `**İşlem:** ${ACTIONS[execution.action.type] ?? 'bilinmiyor'}`,
      execution.matchedKeyword ? `**Eşleşen:** ${execution.matchedKeyword}` : null,
      execution.content ? `**Mesaj:**\n> ${execution.content.slice(0, 300).split('\n').join('\n> ')}` : null,
    ]),
  );
}

async function handleAutoModRuleCreate(rule) {
  await engine.send(
    rule.guild.client,
    'automod',
    ui.entry('success', 'AutoMod Kuralı Oluşturuldu', [`**Kural:** ${rule.name}`, await audit.by(rule.guild, AuditLogEvent.AutoModerationRuleCreate, rule.id)]),
  );
}

async function handleAutoModRuleDelete(rule) {
  await engine.send(
    rule.guild.client,
    'automod',
    ui.entry('danger', 'AutoMod Kuralı Silindi', [`**Kural:** ${rule.name}`, await audit.by(rule.guild, AuditLogEvent.AutoModerationRuleDelete, rule.id)]),
  );
}

async function handleAutoModRuleUpdate(oldRule, newRule) {
  const changes = [];
  if (oldRule && oldRule.name !== newRule.name) changes.push(`**Ad:** ${oldRule.name} → ${newRule.name}`);
  if (oldRule && oldRule.enabled !== newRule.enabled) changes.push(`**Durum:** ${newRule.enabled ? 'açıldı' : 'kapatıldı'}`);
  if (!changes.length) return;
  await engine.send(
    newRule.guild.client,
    'automod',
    ui.entry('warning', 'AutoMod Kuralı Güncellendi', [`**Kural:** ${newRule.name}`, ...changes, await audit.by(newRule.guild, AuditLogEvent.AutoModerationRuleUpdate, newRule.id)]),
  );
}

module.exports = {
  handleBanAdd,
  handleBanRemove,
  checkManualTimeout,
  handleAutoModExecution,
  handleAutoModRuleCreate,
  handleAutoModRuleDelete,
  handleAutoModRuleUpdate,
};
