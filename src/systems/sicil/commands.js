// Hızlı ceza komutları: /uyari, /mute, /unmute, /jail, /unjail, /ban, /unban, /ceza-kaldir, /ceza-sil.
// Sicildeki "Ceza Ver" akışıyla aynı motoru (moderation.js) kullanır; tek fark bu komutların sonucu doğrudan
// yetkili komut kanalına, herkese açık ve tek adımda gönderilmesidir. Sadece yetkili komut kanalında çalışır.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const { staffCommandChannel, staffPermission } = require('../../core/config');
const core = require('../../core/ui');
const { inStaffChannel, respond, replyError } = require('../../core/helpers');
const config = require('./config');
const yetkiConfig = require('../yetki/config');
const moderation = require('./moderation');
const store = require('./store');
const ui = require('./ui');

const userOpt = (o) => o.setName('kullanici').setDescription('İşlem yapılacak üyeyi seç.').setRequired(true);
const reasonOpt = (required) => (o) => o.setName('sebep').setDescription('İşlemin sebebini yaz.').setRequired(required).setMinLength(3).setMaxLength(500);
const durationOpt = (required) => (o) =>
  o
    .setName('sure')
    .setDescription(required ? 'Süreyi yaz. Örn: 30dk, 2sa, 7g.' : 'Süreyi yaz, boş bırakırsan süresiz olur. Örn: 30dk, 2sa, 7g.')
    .setRequired(required)
    .setMaxLength(30);
const numberOpt = (o) => o.setName('numara').setDescription('Sicildeki ceza numarasını yaz.').setRequired(true);

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
  punishCommand('uyari', 'Bir üyeye uyarı verir.', staffPermission, null),
  punishCommand('mute', 'Bir üyeyi belirtilen süre boyunca susturur.', staffPermission, true),
  liftCommand('unmute', 'Bir üyenin susturmasını kaldırır.', staffPermission),
  punishCommand('jail', "Bir üyeyi jail'e atar.", staffPermission, false),
  liftCommand('unjail', "Bir üyeyi jail'den çıkarır.", staffPermission),
  punishCommand('ban', 'Bir üyeyi sunucudan yasaklar.', staffPermission, false),
  liftCommand('unban', 'Bir üyenin yasağını kaldırır.', staffPermission),
  new SlashCommandBuilder()
    .setName('ceza-kaldir')
    .setDescription('Numarasıyla, sürmekte olan bir cezayı kaldırır.')
    .setDefaultMemberPermissions(staffPermission)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption(numberOpt)
    .addStringOption(reasonOpt(false)),
  new SlashCommandBuilder()
    .setName('ceza-sil')
    .setDescription('Numarasıyla bir ceza kaydını sicilden siler; sürüyorsa önce kaldırır.')
    .setDefaultMemberPermissions(staffPermission)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption(numberOpt)
    .addStringOption(reasonOpt(true)),
];

// Bu komutların mesajları Components V2: hatalar sadece komutu kullanana görünür, sonuçlar herkese açık gönderilir
const quickError = (interaction, message, hint) => replyError(interaction, message, hint);
const quickStaffChannelError = (interaction) => quickError(interaction, `Bu komut sadece <#${staffCommandChannel}> kanalında kullanılabilir.`);
// Cevap herkese açık ertelendiği için (sonuç herkese gösterilecek) hata mesajı için önce ertelenen cevap silinir, sonra sadece
// komutu kullanana görünen ayrı bir mesaj gönderilir
async function errorReply(interaction, result) {
  await interaction.deleteReply().catch(() => {});
  return interaction.followUp({
    components: [core.alert(result.error, result.hint, 'danger')],
    flags: core.EPHEMERAL_CV2,
    allowedMentions: { parse: [] },
  });
}
const successReply = (interaction, container) => respond(interaction, container, { ephemeral: false });

// /uyari, /mute, /jail, /ban
async function runPunish(interaction, type) {
  if (!inStaffChannel(interaction)) return quickStaffChannelError(interaction);
  if (!moderation.canPunish(interaction.member, type)) return quickError(interaction, 'Bu cezayı verme yetkin yok.');
  if (type === 'jail' && !config.roles.jail) {
    return quickError(interaction, 'Jail rolü henüz ayarlanmadı.', 'Jail rolünün ayarlara eklenmesi gerekiyor.');
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
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandLift(result.punishment, interaction.user.id, reason));
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
  if (punishment.type === 'uyari') return quickError(interaction, 'Uyarılar kaldırılamaz.', 'Yanlış verildiyse /ceza-sil ile sicilden silebilirsin.');
  if (punishment.status !== 'active') return quickError(interaction, 'Bu ceza zaten sona ermiş.');
  const reason = (interaction.options.getString('sebep') ?? 'Yetkili tarafından kaldırıldı.').trim();

  await interaction.deferReply();
  const result = await moderation.lift(interaction.guild, punishment, interaction.user.id, reason);
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandLift(result.punishment, interaction.user.id, reason));
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
  return result.error ? errorReply(interaction, result) : successReply(interaction, ui.commandDelete(result.punishment, interaction.user.id, reason));
}

const staffText = (label) => `${label} verme yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında`;
const liftText = (label) => `${label} kaldırma yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında`;

// Yardım menüsündeki gereksinim yazısı: cezayı verebilen en düşük yetki rolü (üst rütbeler onu da içerir) ve
// ceza işlemlerinin yapılabildiği kanal
const staffChannelText = `sadece <#${staffCommandChannel}>`;
const permRole = (type) => {
  const perm = config.punishPerms[type]?.[0];
  const roleId = yetkiConfig.perms.find((p) => p.id === perm)?.roleId;
  return `${roleId ? `<@&${roleId}> rolü` : 'yetkili rolü'} · ${staffChannelText}`;
};
const typeText = `Ceza türünün yetkisi · ${staffChannelText}`;

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
      'ceza-kaldir': `Ceza numarasıyla hızlı kaldırma; yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında`,
      'ceza-sil': `Ceza numarasıyla sicilden silme (sürüyorsa önce kaldırır); yetkisi olanlar, sadece <#${staffCommandChannel}> kanalında`,
    },
    need: {
      uyari: permRole('uyari'),
      mute: permRole('mute'),
      unmute: permRole('mute'),
      jail: permRole('jail'),
      unjail: permRole('jail'),
      ban: permRole('ban'),
      unban: permRole('ban'),
      'ceza-kaldir': typeText,
      'ceza-sil': typeText,
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
