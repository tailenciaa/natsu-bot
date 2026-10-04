// Log sistemi: sunucudaki ve botteki olayların (mesaj, ses, üye, moderasyon, sunucu, boost) kaydı ana log
// kanalının altındaki kategori alt başlıklarına mesaj olarak atılır. Log paneli kanalındaki menüden bir kategori
// seçilince o alt başlığa giden bağlantı gelir; kanala girip aramaya gerek kalmaz.
// Dosyalar: categories.js (kategori listesi), engine.js (alt başlık açma ve gönderme), events/ (olay dinleyicileri).
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { data, save } = require('../../core/db');
const { respond, replyError, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const categories = require('./categories');
const config = require('./config');
const engine = require('./engine');
const ui = require('./ui');
const message = require('./events/message');
const voice = require('./events/voice');
const member = require('./events/member');
const moderation = require('./events/moderation');
const server = require('./events/server');
const bot = require('./events/bot');

// Bot açılınca alt başlıkları hazırlar ve paneli log paneli kanalına gönderir (değişmediyse dokunmaz)
async function sendPanel(client) {
  await engine.ensureAllThreads(client);
  return syncPanel(client, {
    key: 'log',
    label: 'Log',
    channelId: config.channels.panel,
    buttonId: ui.IDS.select,
    build: ui.panel,
    image: '',
  });
}

// ── Komutlar ─────────────────────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Log sistemini kurar ve yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('kur').setDescription('Log kategorilerinin alt başlıklarını kurar (eksik olanları açar).'))
    .addSubcommand((s) => s.setName('panel').setDescription('Log panelini log paneli kanalına gönderir (varsa yeniler).')),
];

// /log kur: eksik alt başlıkları açar, hepsinin listesini gösterir
async function handleKur(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL });
  const lines = [];
  for (const category of categories) {
    const thread = await engine.ensureThread(interaction.client, category.key).catch(() => null);
    lines.push(`${category.emoji} **${category.label}:** ${thread ? `<#${thread.id}>` : '❌ açılamadı'}`);
  }
  const failed = lines.some((l) => l.includes('❌'));
  return respond(
    interaction,
    core.notice(
      [failed ? '**Bazı alt başlıklar açılamadı.**' : '**Log alt başlıkları hazır.**', lines.join('\n')],
      failed ? 'danger' : 'success',
    ),
  );
}

// /log panel: paneli yeniden gönderir (mesaj silindiyse ya da bozulduysa yenisini kurar)
async function handlePanel(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL });
  const channel = await fetchTextChannel(interaction.guild, config.channels.panel);
  if (!channel) return replyError(interaction, 'Log paneli kanalı bulunamadı.', `Kanal ID'sini kontrol et (${config.channels.panel}).`);

  await engine.ensureAllThreads(interaction.client);
  // Kayıtlı özet silinir: panel kanalda yerinde olsa bile eskisi kaldırılıp yenisi gönderilir
  if (data.panels.log) {
    data.panels.log.hash = '';
    save();
  }
  await sendPanel(interaction.client);
  return respond(interaction, core.alert(`Log paneli <#${channel.id}> kanalına gönderildi.`, null, 'success'));
}

const handleLog = (interaction) =>
  interaction.options.getSubcommand() === 'kur' ? handleKur(interaction) : handlePanel(interaction);

// Panelden kategori seçilince o kategorinin alt başlığına giden bağlantı gönderilir
async function handleSelect(interaction) {
  const category = categories.find((c) => c.key === interaction.values[0]);
  if (!category) return interaction.deferUpdate();

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const thread = await engine.ensureThread(interaction.client, category.key);
  if (!thread) {
    return interaction.editReply({
      components: [core.alert('Bu log kategorisinin alt başlığı açılamadı.', 'Botun ana log kanalında alt başlık açma yetkisini kontrol et.', 'danger')],
      flags: core.CV2,
    });
  }
  return interaction.editReply({ components: [ui.jumpLink(category, thread)], flags: core.CV2 });
}

module.exports = {
  name: 'log',
  commands,
  help: { category: ['log', 'Log'], access: { 'log kur': 'Yöneticiler', 'log panel': 'Yöneticiler' } },
  slash: { log: handleLog },
  // Diğer sistemlerin (ör. sicil) zengin detaylı moderasyon logu göndermesi için
  logModeration: (client, { color, title, lines }) => engine.send(client, 'moderasyon', ui.entry(color, title, lines)),
  prefixed: [[ui.IDS.select, handleSelect]],
  events: {
    [Events.ClientReady]: sendPanel,
    [Events.MessageDelete]: message.handleMessageDelete,
    [Events.MessageBulkDelete]: message.handleBulkDelete,
    [Events.MessageUpdate]: message.handleMessageUpdate,
    [Events.VoiceStateUpdate]: voice.handleVoiceStateUpdate,
    [Events.GuildMemberAdd]: member.handleMemberAdd,
    [Events.GuildMemberRemove]: member.handleMemberRemove,
    [Events.GuildMemberUpdate]: member.handleMemberUpdate,
    [Events.GuildBanAdd]: moderation.handleBanAdd,
    [Events.GuildBanRemove]: moderation.handleBanRemove,
    [Events.ChannelCreate]: server.handleChannelCreate,
    [Events.ChannelDelete]: server.handleChannelDelete,
    [Events.ChannelUpdate]: server.handleChannelUpdate,
    [Events.GuildRoleCreate]: server.handleRoleCreate,
    [Events.GuildRoleDelete]: server.handleRoleDelete,
    [Events.GuildRoleUpdate]: server.handleRoleUpdate,
    [Events.GuildUpdate]: server.handleGuildUpdate,
    [Events.GuildEmojiCreate]: server.handleEmojiCreate,
    [Events.GuildEmojiDelete]: server.handleEmojiDelete,
    [Events.GuildEmojiUpdate]: server.handleEmojiUpdate,
    [Events.GuildStickerCreate]: server.handleStickerCreate,
    [Events.GuildStickerDelete]: server.handleStickerDelete,
    [Events.ThreadCreate]: server.handleThreadCreate,
    [Events.ThreadDelete]: server.handleThreadDelete,
    [Events.InteractionCreate]: bot.handleInteraction,
    [Events.InviteCreate]: server.handleInviteCreate,
    [Events.InviteDelete]: server.handleInviteDelete,
  },
};
