// Hızlı ceza komutları: /uyari, /mute, /unmute, /jail, /unjail, /ban, /unban, /ceza-kaldir, /ceza-sil.
// Sicildeki "Ceza Ver" akışıyla aynı motoru (moderation.js) kullanır; tek fark bu komutların sonucu doğrudan
// yetkili komut kanalına, herkese açık ve tek adımda gönderilmesidir. Sadece yetkili komut kanalında çalışır.
const { InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');
const { staffCommandChannel, staffPermission } = require('../../core/config');
const { inStaffChannel } = require('../../core/helpers');
const config = require('./config');
const moderation = require('./moderation');
const store = require('./store');
const ui = require('./ui');

const userOpt = (o) => o.setName('kullanici').setDescription('İşlem yapılacak kullanıcı').setRequired(true);
const reasonOpt = (required) => (o) => o.setName('sebep').setDescription('Sebep').setRequired(required).setMaxLength(500);
const durationOpt = (required) => (o) =>
  o.setName('sure').setDescription('Örn: 30dk, 2sa, 7g' + (required ? '' : ' (boş bırakırsan süresiz)')).setRequired(required).setMaxLength(30);
const numberOpt = (o) => o.setName('numara').setDescription('Sicildeki ceza numarası (#ID)').setRequired(true);

// durationRequired: true (zorunlu süre), false (isteğe bağlı süre), null (süre seçeneği hiç yok, ör. uyarı)
const punishCommand = (name, description, permission, durationRequired) => {
  const builder = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDefaultMemberPermissions(permission)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOpt)
    .addStringOption(reasonOpt(true));
  return durationRequired === null ? builder : builder.addStringOption(durationOpt(durationRequired));
};

const liftCommand = (name, description, permission) =>
  new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setDefaultMemberPermissions(permission)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(userOpt)
    .addStringOption(reasonOpt(false));

const commands = [
  punishCommand('uyari', 'Bir kullanıcıya uyarı verir.', staffPermission, null),
  punishCommand('mute', 'Bir kullanıcıyı belirtilen süre boyunca susturur.', staffPermission, true),
  liftCommand('unmute', 'Bir kullanıcının susturma cezasını kaldırır.', staffPermission),
  punishCommand('jail', "Bir kullanıcıyı jail'e atar.", staffPermission, false),
  liftCommand('unjail', "Bir kullanıcıyı jail'den çıkarır.", staffPermission),
  punishCommand('ban', 'Bir kullanıcıyı sunucudan yasaklar.', staffPermission, false),
  liftCommand('unban', 'Bir kullanıcının yasağını kaldırır.', staffPermission),
  new SlashCommandBuilder()
    .setName('ceza-kaldir')
    .setDescription('Numarasıyla, sürmekte olan bir cezayı kaldırır.')
    .setDefaultMemberPermissions(staffPermission)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption(numberOpt)
    .addStringOption(reasonOpt(false)),
  new SlashCommandBuilder()
    .setName('ceza-sil')
    .setDescription('Numarasıyla, bir ceza kaydını sicilden tamamen siler.')
    .setDefaultMemberPermissions(staffPermission)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption(numberOpt)
    .addStringOption(reasonOpt(true)),
];

// Bu komutların tüm mesajları (sonuç ve hata) düz metin, Components V2 kullanılmaz
const quickError = (interaction, message, hint) =>
  interaction.reply({ content: ui.commandError(message, hint), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
const quickStaffChannelError = (interaction) => quickError(interaction, `Bu komut sadece <#${staffCommandChannel}> kanalında kullanılabilir.`);
const errorReply = (interaction, result) =>
  interaction.editReply({ content: ui.commandError(result.error, result.hint), allowedMentions: { parse: [] } });
const successReply = (interaction, content) => interaction.editReply({ content, allowedMentions: { parse: [] } });

// /uyari, /mute, /jail, /ban
async function runPunish(interaction, type) {
  if (!inStaffChannel(interaction)) return quickStaffChannelError(interaction);
  if (!moderation.canPunish(interaction.member, type)) return quickError(interaction, 'Bu cezayı verme yetkin yok.');
  if (type === 'jail' && !config.roles.jail) {
    return quickError(interaction, 'Jail rolü henüz ayarlanmadı.', 'Sicil ayarlarına jail rolünün ID\'si yazılmalı.');
  }
  const targetUser = interaction.options.getUser('kullanici', true);
  const reason = interaction.options.getString('sebep', true).trim();
  const duration = moderation.parseDuration(interaction.options.getString('sure') ?? '');
  if (duration === undefined) return quickError(interaction, 'Süre anlaşılamadı.', 'Örnek: 30dk, 2sa, 7g ya da 1g 12sa');

  await interaction.deferReply();
  const result = await moderation.punish(interaction.guild, interaction.member, targetUser, type, duration, reason);
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandResult(result.punishment));
}

// /unmute, /unjail, /unban
async function runLift(interaction, type) {
  if (!inStaffChannel(interaction)) return quickStaffChannelError(interaction);
  if (!moderation.canPunish(interaction.member, type)) return quickError(interaction, 'Bu cezayı kaldırma yetkin yok.');
  const targetUser = interaction.options.getUser('kullanici', true);
  const punishment = store.activeOf(interaction.guildId, targetUser.id, type);
  if (!punishment) return quickError(interaction, `Bu kişinin aktif bir ${ui.TYPES[type].label.toLocaleLowerCase('tr-TR')} cezası yok.`);
  const reason = (interaction.options.getString('sebep') ?? 'Yetkili tarafından kaldırıldı.').trim();

  await interaction.deferReply();
  const result = await moderation.lift(interaction.guild, punishment, interaction.user.id, reason);
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandLift(result.punishment));
}

// Ceza numarasından kaydı bulur (id "sunucu-numara" şeklinde kurulur)
function findByNumber(interaction) {
  const number = interaction.options.getInteger('numara', true);
  const p = store.get(`${interaction.guildId}-${number}`);
  return p && p.status !== 'deleted' ? p : null;
}

// /ceza-kaldir numara [sebep]
async function handleCezaKaldir(interaction) {
  if (!inStaffChannel(interaction)) return quickStaffChannelError(interaction);
  const punishment = findByNumber(interaction);
  if (!punishment) return quickError(interaction, 'Bu ceza numarası bulunamadı.');
  if (!moderation.canPunish(interaction.member, punishment.type)) return quickError(interaction, 'Bu cezayı kaldırma yetkin yok.');
  if (punishment.status !== 'active') return quickError(interaction, 'Bu ceza zaten sona ermiş.');
  const reason = (interaction.options.getString('sebep') ?? 'Yetkili tarafından kaldırıldı.').trim();

  await interaction.deferReply();
  const result = await moderation.lift(interaction.guild, punishment, interaction.user.id, reason);
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandLift(result.punishment));
}

// /ceza-sil numara sebep
async function handleCezaSil(interaction) {
  if (!inStaffChannel(interaction)) return quickStaffChannelError(interaction);
  const punishment = findByNumber(interaction);
  if (!punishment) return quickError(interaction, 'Bu ceza numarası bulunamadı.');
  if (!moderation.canPunish(interaction.member, punishment.type)) return quickError(interaction, 'Bu cezayı silme yetkin yok.');
  const reason = interaction.options.getString('sebep', true).trim();

  await interaction.deferReply();
  const result = await moderation.remove(interaction.guild, punishment, interaction.user.id, reason);
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandDelete(result.punishment));
}

const staffText = (label) => `${label} verme yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında.`;
const liftText = (label) => `${label} kaldırma yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında.`;

module.exports = {
  name: 'ceza',
  commands,
  help: {
    category: ['yetki', 'Yetkili İşlemleri'],
    access: {
      uyari: staffText('Uyarı'),
      mute: staffText('Susturma'),
      unmute: liftText('Susturma'),
      jail: staffText('Jail'),
      unjail: liftText('Jail'),
      ban: staffText('Yasaklama'),
      unban: liftText('Yasaklama'),
      'ceza-kaldir': `Ceza numarasıyla hızlı kaldırma; yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında.`,
      'ceza-sil': `Ceza numarasıyla sicilden kalıcı silme; yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında.`,
    },
  },
  slash: {
    uyari: (i) => runPunish(i, 'uyari'),
    mute: (i) => runPunish(i, 'mute'),
    unmute: (i) => runLift(i, 'mute'),
    jail: (i) => runPunish(i, 'jail'),
    unjail: (i) => runLift(i, 'jail'),
    ban: (i) => runPunish(i, 'ban'),
    unban: (i) => runLift(i, 'ban'),
    'ceza-kaldir': handleCezaKaldir,
    'ceza-sil': handleCezaSil,
  },
};
