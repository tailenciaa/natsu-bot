// Cezaların Discord'a uygulanması: uyarı (sadece kayıt), susturma (Discord zaman aşımı), jail (rol) ve yasaklama.
// Süreli cezalar süresi dolunca kendiliğinden kalkar; bot kapalıyken dolanlar açılışta kaldırılır.
// Jail'deyken sunucudan çıkıp giren üyeye jail rolü tekrar verilir.
const { PermissionFlagsBits } = require('discord.js');
const core = require('../../core/ui');
const config = require('./config');
const store = require('./store');
const logSystem = require('../log');
const dedupe = require('../log/dedupe');
const ui = require('./ui');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Discord zaman aşımı en fazla 28 gün olabilir
const MAX_TIMEOUT = 28 * DAY;

const UNITS = [
  [/^(dk|dakika|m|min)$/, MINUTE],
  [/^(sa|saat|h)$/, HOUR],
  [/^(g|gün|gun|d)$/, DAY],
  [/^(hf|hafta|w)$/, 7 * DAY],
];

// "30dk", "2sa", "1g 12sa", "45" (dakika) gibi süreleri milisaniyeye çevirir.
// Boş ya da "kalıcı" ise null (süresiz), anlaşılmazsa undefined döner.
function parseDuration(input) {
  const value = (input ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!value || ['kalıcı', 'kalici', 'süresiz', 'suresiz'].includes(value)) return null;
  if (/^\d+$/.test(value)) return Number(value) * MINUTE || undefined;

  let total = 0;
  const rest = value.replace(/(\d+)\s*([a-zçğıöşü]+)/g, (_, amount, unit) => {
    const match = UNITS.find(([pattern]) => pattern.test(unit));
    total += match ? Number(amount) * match[1] : NaN;
    return '';
  });
  return rest.trim() || !(total > 0) ? undefined : total;
}

const fetchMember = (guild, userId) => guild.members.fetch(userId).catch(() => null);

// Kullanıcının sicildeki toplam ceza puanı (silinen kayıtlar hariç, kaldırılan/süresi dolan cezalar dahil kalıcı toplam)
const totalPoints = (guildId, userId) => store.of(guildId, userId).reduce((sum, p) => sum + (config.penaltyPoints[p.type] ?? 0), 0);

// Ceza puanı eşiklerine göre kısıtlama rollerini günceller: eşiği geçen rolü alır, altına düşen kaybeder.
// Rollerin izinlerini (mesaj atamama, ses kısıtlaması vb.) sen Discord'da ayarlarsın, bot sadece rolü yönetir.
async function syncRestrictions(guild, userId) {
  const tiers = config.pointTiers.filter((t) => t.roleId);
  if (!tiers.length) return;
  const member = await fetchMember(guild, userId);
  if (!member) return;
  const points = totalPoints(guild.id, userId);
  for (const tier of tiers) {
    const has = member.roles.cache.has(tier.roleId);
    if (points >= tier.points && !has) await member.roles.add(tier.roleId, `Ceza puanı ${points}, ${tier.label} eşiğini geçti`).catch(() => {});
    else if (points < tier.points && has) await member.roles.remove(tier.roleId, `Ceza puanı ${points}, ${tier.label} eşiğinin altına düştü`).catch(() => {});
  }
}

// Yetkilinin bu türde ceza verme izni var mı
function canPunish(member, type) {
  const perms = member?.permissions;
  if (!perms) return false;
  if (perms.has(PermissionFlagsBits.Administrator)) return true;
  return type === 'ban' ? perms.has(PermissionFlagsBits.BanMembers) : perms.has(PermissionFlagsBits.ModerateMembers);
}

// Yetkili hedef üyenin üstünde mi (sunucu sahibi her zaman üstte)
function outranks(guild, actor, target) {
  if (!target) return true;
  if (target.id === guild.ownerId) return false;
  if (actor.id === guild.ownerId) return true;
  return actor.roles.highest.position > target.roles.highest.position;
}

async function dm(guild, userId, container) {
  const user = await guild.client.users.fetch(userId).catch(() => null);
  return user?.send({ components: [container], flags: core.CV2 }).catch(() => null);
}

// Ceza verir; sorun varsa { error }, başarılıysa { punishment } döner
async function punish(guild, actor, targetUser, type, duration, reason) {
  const target = await fetchMember(guild, targetUser.id);
  if (targetUser.id === actor.id) return { error: 'Kendine ceza veremezsin.' };
  if (targetUser.bot) return { error: 'Botlara ceza verilemez.' };
  if (!outranks(guild, actor, target)) return { error: 'Bu kişi senden üst ya da aynı seviyede, ceza veremezsin.' };
  if (type !== 'uyari' && store.activeOf(guild.id, targetUser.id, type)) {
    return { error: `Bu kişinin zaten aktif bir ${ui.TYPES[type].label.toLocaleLowerCase('tr-TR')} cezası var.`, hint: 'Sicilden süresini uzatabilir ya da kaldırabilirsin.' };
  }

  if (type === 'mute') {
    if (!target) return { error: 'Kişi sunucuda değil, susturulamaz.' };
    if (!duration) return { error: 'Susturma için süre yazmalısın.' };
    if (duration > MAX_TIMEOUT) return { error: 'Susturma en fazla 28 gün olabilir.' };
    if (!target.moderatable) return { error: 'Botun rolü bu kişiyi susturmaya yetmiyor.' };
  }
  if (type === 'jail') {
    if (!config.roles.jail) return { error: 'Jail rolü henüz ayarlanmadı.', hint: 'Sicil ayarlarına jail rolünün ID\'si yazılmalı.' };
    if (!target) return { error: 'Kişi sunucuda değil, jail\'e atılamaz.' };
    if (!target.manageable) return { error: 'Botun rolü bu kişinin rollerini değiştirmeye yetmiyor.' };
  }
  if (type === 'ban' && target && !target.bannable) return { error: 'Botun rolü bu kişiyi yasaklamaya yetmiyor.' };

  const number = store.nextNumber(guild.id);
  const punishment = {
    id: `${guild.id}-${number}`,
    number,
    guildId: guild.id,
    userId: targetUser.id,
    username: targetUser.username,
    type,
    reason,
    by: actor.id,
    createdAt: Date.now(),
    duration: duration ?? null,
    expiresAt: duration ? Date.now() + duration : null,
    status: 'active',
    extensions: [],
    savedRoles: null,
  };
  const auditReason = `${ui.TYPES[type].label} #${core.pad(number)} - ${actor.user.username}: ${reason}`.slice(0, 500);

  try {
    if (type === 'mute') {
      dedupe.markHandled(guild.id, targetUser.id, 'mute');
      await target.timeout(duration, auditReason);
    }
    if (type === 'jail') {
      // Yönetilemeyen roller (sunucu takviyesi, bot rolleri) üyede kalır, diğerleri saklanıp jail rolüyle değiştirilir
      const keep = target.roles.cache.filter((r) => r.managed).map((r) => r.id);
      punishment.savedRoles = target.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed && r.id !== config.roles.jail)
        .map((r) => r.id);
      await target.roles.set([...keep, config.roles.jail], auditReason);
    }
    // Yasaklanan kişiye sunucudan çıkmadan önce haber verilir
    if (type === 'ban') {
      await dm(guild, targetUser.id, ui.punishDm(punishment, guild.name));
      dedupe.markHandled(guild.id, targetUser.id, 'ban');
      await guild.members.ban(targetUser.id, { reason: auditReason });
    }
  } catch (err) {
    console.error(`[sicil] ${ui.TYPES[type].label} uygulanamadı:`, err.message);
    return { error: 'Ceza Discord üzerinde uygulanamadı.', hint: 'Botun yetkilerini ve rol sırasını kontrol et.' };
  }

  store.create(punishment);
  if (type !== 'ban') await dm(guild, targetUser.id, ui.punishDm(punishment, guild.name));
  await syncRestrictions(guild, targetUser.id);
  logSystem
    .logModeration(guild.client, {
      type: type,
      color: 'danger',
      title: `${ui.TYPES[type].label} Verildi - #${core.pad(number)}`,
      lines: [
        `**Kullanıcı:** <@${targetUser.id}> (${targetUser.username})`,
        `**Yetkili:** <@${actor.id}>`,
        `**Sebep:** ${reason}`,
        `**Süre:** ${punishment.expiresAt ? `<t:${Math.floor(punishment.expiresAt / 1000)}:R> sona erer` : 'Kalıcı'}`,
      ],
    })
    .catch(() => {});
  return { punishment };
}

// Cezayı Discord'dan kaldırır (süre dolunca ya da bir yetkili kaldırınca). actorId yoksa süre dolmuştur.
async function lift(guild, punishment, actorId, reason) {
  const target = await fetchMember(guild, punishment.userId);
  try {
    if (punishment.type === 'mute' && target?.isCommunicationDisabled()) {
      dedupe.markHandled(guild.id, punishment.userId, 'mute');
      await target.timeout(null, reason);
    }
    if (punishment.type === 'jail' && target) {
      const keep = target.roles.cache.filter((r) => r.managed).map((r) => r.id);
      const restore = (punishment.savedRoles ?? []).filter((id) => guild.roles.cache.has(id));
      await target.roles.set([...new Set([...keep, ...restore])], reason);
    }
    if (punishment.type === 'ban') {
      dedupe.markHandled(guild.id, punishment.userId, 'ban');
      await guild.members.unban(punishment.userId, reason).catch(() => {});
    }
  } catch (err) {
    console.error(`[sicil] ${ui.TYPES[punishment.type].label} kaldırılamadı:`, err.message);
    return { error: 'Ceza Discord üzerinde kaldırılamadı.', hint: 'Botun yetkilerini ve rol sırasını kontrol et.' };
  }

  store.update(punishment.id, {
    status: actorId ? 'lifted' : 'expired',
    endedAt: Date.now(),
    liftedBy: actorId ?? null,
    liftReason: actorId ? reason : null,
  });
  if (punishment.type !== 'uyari' || punishment.expiresAt) await dm(guild, punishment.userId, ui.liftDm(punishment, guild.name));
  logSystem
    .logModeration(guild.client, {
      type: punishment.type,
      color: 'success',
      title: `${ui.TYPES[punishment.type].label} Kaldırıldı - #${core.pad(punishment.number)}`,
      lines: [
        `**Kullanıcı:** <@${punishment.userId}>`,
        actorId ? `**Yetkili:** <@${actorId}>` : '**Otomatik:** süre doldu',
        actorId && reason ? `**Sebep:** ${reason}` : null,
      ],
    })
    .catch(() => {});
  return { punishment };
}

// Aktif süreli cezaya süre ekler
async function extend(guild, punishment, actor, extra) {
  if (punishment.status !== 'active' || !punishment.expiresAt) return { error: 'Sadece süren, süreli cezalara süre eklenebilir.' };
  const expiresAt = punishment.expiresAt + extra;

  if (punishment.type === 'mute') {
    if (expiresAt - Date.now() > MAX_TIMEOUT) return { error: 'Susturma en fazla 28 gün olabilir.' };
    const target = await fetchMember(guild, punishment.userId);
    if (!target?.moderatable) return { error: 'Kişi sunucuda değil ya da botun rolü yetmiyor.' };
    dedupe.markHandled(guild.id, punishment.userId, 'mute');
    const ok = await target
      .timeout(expiresAt - Date.now(), `Susturma #${core.pad(punishment.number)} uzatıldı (${actor.user.username})`)
      .then(() => true)
      .catch(() => false);
    if (!ok) return { error: 'Susturma Discord üzerinde uzatılamadı.' };
  }

  store.update(punishment.id, {
    expiresAt,
    duration: punishment.duration + extra,
    extensions: [...punishment.extensions, { by: actor.id, at: Date.now(), added: extra }],
  });
  await dm(guild, punishment.userId, ui.extendDm(punishment, extra, guild.name));
  logSystem
    .logModeration(guild.client, {
      type: punishment.type,
      color: 'warning',
      title: `${ui.TYPES[punishment.type].label} Süresi Uzatıldı - #${core.pad(punishment.number)}`,
      lines: [
        `**Kullanıcı:** <@${punishment.userId}>`,
        `**Yetkili:** <@${actor.id}>`,
        `**Eklenen süre:** ${Math.round(extra / MINUTE)} dakika`,
      ],
    })
    .catch(() => {});
  return { punishment };
}

// Kaydı sicilden siler (yanlış verilen ceza); sürüyorsa önce kaldırır
async function remove(guild, punishment, actorId, reason) {
  if (punishment.status === 'active' && punishment.type !== 'uyari') {
    const result = await lift(guild, punishment, actorId, reason);
    if (result.error) return result;
  }
  store.update(punishment.id, { status: 'deleted', deletedBy: actorId, deletedAt: Date.now(), deleteReason: reason });
  await syncRestrictions(guild, punishment.userId);
  logSystem
    .logModeration(guild.client, {
      type: punishment.type,
      color: 'danger',
      title: `Sicil Kaydı Silindi - #${core.pad(punishment.number)}`,
      lines: [`**Kullanıcı:** <@${punishment.userId}>`, `**Yetkili:** <@${actorId}>`, reason ? `**Sebep:** ${reason}` : null],
    })
    .catch(() => {});
  return { punishment };
}

// Süresi dolan cezaları kaldırır
async function sweep(client) {
  for (const punishment of store.expired()) {
    const guild = client.guilds.cache.get(punishment.guildId);
    if (guild) await lift(guild, punishment, null, 'Ceza süresi doldu');
  }
}

function startSweeper(client) {
  const run = () => sweep(client).catch((err) => console.error('[sicil] Süreli cezalar kontrol edilemedi:', err.message));
  run();
  setInterval(run, config.sweepSeconds * 1000).unref();
}

// Jail'deyken çıkıp giren üyeye jail rolü tekrar verilir
async function handleMemberAdd(member) {
  const jail = store.activeOf(member.guild.id, member.id, 'jail');
  if (jail && config.roles.jail) await member.roles.add(config.roles.jail, `Jail #${core.pad(jail.number)} sürüyor`).catch(() => {});
  await syncRestrictions(member.guild, member.id);
}

// Jail rolünün bir kanaldaki görünürlüğünü ayarlar: sadece ayarlı jail kanalı görünür, diğer her kanal (kategoriler
// dahil) gizlenir. Yeni açılan kanallarda da çalışır, böylece jail rolü yeni kanalları otomatik görmez.
async function syncJailVisibilityFor(channel) {
  if (!config.roles.jail || !config.channels.jail || !channel?.permissionOverwrites) return;
  const allow = channel.id === config.channels.jail;
  await channel.permissionOverwrites
    .edit(config.roles.jail, { ViewChannel: allow }, { reason: 'Jail rolü kanal görünürlüğü senkronize edildi' })
    .catch((err) => console.error(`[sicil] "${channel.name}" kanalı jail için ayarlanamadı:`, err.message));
}

// Sunucudaki tüm kanalları jail rolü için senkronize eder (bot açılınca bir kez çalışır)
async function syncJailVisibility(guild) {
  if (!config.roles.jail || !config.channels.jail) return;
  const channels = await guild.channels.fetch().catch(() => null);
  if (!channels) return;
  for (const channel of channels.values()) await syncJailVisibilityFor(channel);
  console.log(`[sicil] Jail rolünün kanal görünürlüğü senkronize edildi (${channels.size} kanal).`);
}

module.exports = {
  parseDuration,
  canPunish,
  punish,
  lift,
  extend,
  remove,
  startSweeper,
  handleMemberAdd,
  totalPoints,
  syncJailVisibility,
  syncJailVisibilityFor,
};
