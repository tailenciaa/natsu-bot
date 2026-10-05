// Log sistemi: sunucudaki ve botteki olayların (mesaj, ses, üye, moderasyon, sunucu, boost) kaydı ana log
// kanalının altındaki kategori alt başlıklarına mesaj olarak atılır. Log paneli kanalındaki menüden bir kategori
// seçilince o alt başlığa giden bağlantı gelir; kanala girip aramaya gerek kalmaz.
// Dosyalar: categories.js (kategori listesi), engine.js (alt başlık açma ve gönderme), events/ (olay dinleyicileri).
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { data, save } = require('../../core/db');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const categories = require('./categories');
const config = require('./config');
const engine = require('./engine');
const store = require('./store');
const ui = require('./ui');
const message = require('./events/message');
const voice = require('./events/voice');
const member = require('./events/member');
const moderation = require('./events/moderation');
const server = require('./events/server');
const bot = require('./events/bot');
const invites = require('./events/invite');

const MODERATION_CATEGORY = { ban: 'ban', mute: 'susturma', jail: 'jail', uyari: 'uyari' };

// Paneli log paneli kanalına gönderir (değişmediyse dokunmaz); force ile eskisi kaldırılıp yenisi gönderilir
function syncLogPanel(client, force = false) {
  // Kayıtlı özet silinir: panel kanalda yerinde olsa bile eskisi kaldırılıp yenisi gönderilir
  if (force && data.panels.log) {
    data.panels.log.hash = '';
    save();
  }
  return syncPanel(client, {
    key: 'log',
    label: 'Log',
    channelId: config.channels.panel,
    buttonId: ui.IDS.select,
    build: ui.panel,
    image: '',
  });
}

// Bot açılınca alt başlıkları hazırlar ve paneli gönderir
async function sendPanel(client) {
  await engine.ensureAllThreads(client);
  return syncLogPanel(client);
}

// ── /log kur menüsü ──────────────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Log sistemini yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('kur').setDescription('Log kurulum menüsünü açar: durumu gösterir, kurar, sıfırlar.')),
];

// Menünün gösterdiği güncel durum: her kategorinin alt başlığı var mı, panel mesajı yerinde mi
async function setupView(guild, note) {
  const rows = [];
  for (const category of categories) {
    const id = store.getThreadId(category.key);
    const thread = id ? await guild.channels.fetch(id).catch(() => null) : null;
    rows.push({ category, thread });
  }
  const saved = data.panels.log;
  const channel = saved ? await fetchTextChannel(guild, saved.channelId) : null;
  const message = channel ? await channel.messages.fetch(saved.messageId).catch(() => null) : null;

  return ui.setupView({
    mainId: config.channels.main,
    panelId: config.channels.panel,
    rows,
    panelUrl: message ? core.messageUrl(guild.id, channel.id, message.id) : null,
    note,
  });
}

async function handleLog(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL });
  return respond(interaction, await setupView(interaction.guild));
}

// Menü butonları: logkur:<eylem> (setup, panel, reset, resetyes, refresh)
async function handleSetupButton(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu menüyü sadece yöneticiler kullanabilir.');

  const action = interaction.customId.split(':')[1];
  if (action === 'reset') return interaction.update({ components: [ui.resetConfirm()] });

  await interaction.deferUpdate();
  const { client, guild } = interaction;
  let note = null;

  if (action === 'setup') {
    await engine.ensureAllThreads(client);
    note = 'Eksik alt başlıklar kuruldu.';
  } else if (action === 'resetyes') {
    for (const { key } of categories) await engine.resetThread(client, key).catch((err) => console.error(`[log] "${key}" sıfırlanamadı:`, err.message));
    note = 'Tüm alt başlıklar silinip yeniden açıldı.';
  } else if (action === 'panel') {
    await syncLogPanel(client, true);
    note = 'Panel log paneli kanalına gönderildi.';
  }

  return interaction.editReply({ components: [await setupView(guild, note)], flags: core.CV2 });
}

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

// Log girdisindeki "Detaylı Bilgi" butonu: kaydedilen ayrıntıları sadece basana gösterir
async function handleDetail(interaction) {
  const meta = store.getDetail(interaction.message.id);
  if (!meta) {
    return replyError(interaction, 'Bu logun detayı artık saklanmıyor.', 'Detaylar sadece en son kayıtlar için tutulur.');
  }
  const category = categories.find((c) => c.key === meta.category);
  await interaction.deferReply({ flags: core.EPHEMERAL });
  return interaction.editReply({ components: [ui.detail(meta, category ? category.label : 'Log')], flags: core.CV2 });
}

module.exports = {
  name: 'log',
  commands,
  help: { category: ['log', 'Log'], access: { 'log kur': 'Yöneticiler' } },
  slash: { log: handleLog },
  // Diğer sistemlerin (ör. sicil) zengin detaylı moderasyon logu göndermesi için
  // type: ceza türü (ban, mute, jail, uyari); her tür kendi log alt başlığına gider
  logModeration: (client, { type, color, title, lines }) => engine.send(client, MODERATION_CATEGORY[type] ?? 'uyari', ui.entry(color, title, lines)),
  // Herhangi bir kategoriye log yazar: write(client, 'bot', { color, title, lines }); yeni sistemler logları buradan atar
  write: (client, key, { color, title, lines }) => engine.send(client, key, ui.entry(color, title, lines)),
  prefixed: [
    [ui.IDS.select, handleSelect],
    [ui.IDS.setup, handleSetupButton],
    [ui.IDS.detail, handleDetail],
  ],
  events: {
    [Events.ClientReady]: async (client) => {
      await invites.init(client);
      await sendPanel(client);
    },
    [Events.MessageDelete]: message.handleMessageDelete,
    [Events.MessageBulkDelete]: message.handleBulkDelete,
    [Events.MessageUpdate]: message.handleMessageUpdate,
    [Events.VoiceStateUpdate]: voice.handleVoiceStateUpdate,
    [Events.GuildMemberAdd]: member.handleMemberAdd,
    [Events.GuildMemberRemove]: member.handleMemberRemove,
    [Events.GuildMemberUpdate]: member.handleMemberUpdate,
    [Events.GuildBanAdd]: moderation.handleBanAdd,
    [Events.GuildBanRemove]: moderation.handleBanRemove,
    [Events.AutoModerationActionExecution]: moderation.handleAutoModExecution,
    [Events.AutoModerationRuleCreate]: moderation.handleAutoModRuleCreate,
    [Events.AutoModerationRuleDelete]: moderation.handleAutoModRuleDelete,
    [Events.AutoModerationRuleUpdate]: moderation.handleAutoModRuleUpdate,
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
