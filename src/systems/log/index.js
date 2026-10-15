// Log sistemi: sunucudaki ve bottaki olayların (mesaj, ses, üye, moderasyon, sunucu, boost) kaydı kategorilere
// ayrılmış alt başlıklara mesaj olarak atılır. Kategoriler dört gruba toplanmıştır (groups.js) ve her grubun
// kendi log kanalı vardır; alt başlıklar o kanalın altında durur. Log paneli kanalındaki menüden grup sekmesi +
// kategori seçilince o alt başlığa giden bağlantı gelir; kanala girip aramaya gerek kalmaz.
// Dosyalar: categories.js (kategori listesi), groups.js (gruplar), engine.js (kanal ve alt başlık açma, gönderme),
// events/ (olay dinleyicileri).
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { data, save } = require('../../core/db');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const categories = require('./categories');
const config = require('./config');
const engine = require('./engine');
const { GROUPS } = require('./groups');
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

// ── /log kurulum menüsü ──────────────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Log kurulum menüsünü açar: alt başlıkların durumunu gösterir, kurar ve sıfırlar.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

// Menünün gösterdiği güncel durum: her grubun kanalı, o gruptaki kategorilerin alt başlıkları, panel mesajı ve
// eski tek kanal düzeninden ana log kanalında kalan alt başlık sayısı
async function setupView(client, guild, note) {
  const groups = [];
  for (const group of GROUPS) {
    const channelId = store.getGroupChannel(group.key);
    const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
    const items = [];
    for (const category of categories.filter((c) => c.group === group.key)) {
      const id = store.getThreadId(category.key);
      items.push({ category, thread: id ? await guild.channels.fetch(id).catch(() => null) : null });
    }
    groups.push({ group, channel, items });
  }
  const saved = data.panels.log;
  const panelChannel = saved ? await fetchTextChannel(guild, saved.channelId) : null;
  const message = panelChannel ? await panelChannel.messages.fetch(saved.messageId).catch(() => null) : null;

  return ui.setupView({
    mainId: config.channels.main,
    panelId: config.channels.panel,
    groups,
    panelUrl: message ? core.messageUrl(guild.id, panelChannel.id, message.id) : null,
    orphans: await engine.orphanThreads(client),
    note,
  });
}

async function handleLog(interaction) {
  await interaction.deferReply({ flags: core.CV2 });
  return respond(interaction, await setupView(interaction.client, interaction.guild));
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
    note = '**Eksik grup kanalları ve alt başlıklar** kuruldu.';
  } else if (action === 'resetyes') {
    for (const { key } of categories) await engine.resetThread(client, key).catch((err) => console.error(`[log] "${key}" sıfırlanamadı:`, err.message));
    note = '**Tüm alt başlıklar** silinip grup kanallarının altında yeniden açıldı.';
  } else if (action === 'panel') {
    await syncLogPanel(client, true);
    note = '**Panel**, log paneli kanalına gönderildi.';
  }

  return interaction.editReply({ components: [await setupView(client, guild, note)], flags: core.CV2 });
}

// Panelden grup sekmesine basınca panel mesajı kendi yerinde o grubun kategorilerine döner.
// SEKME KURALI: sekme kalıcı paneli değiştirir (herkes için aynı panel), kategori seçimi ise sadece seçene
// görünür gizli bir cevap getirir; kalıcı olsaydı panelin altı "şuraya git" mesajlarıyla dolardı.
async function handlePanel(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith(`${ui.IDS.tab}:`)) {
    const key = interaction.customId.slice(ui.IDS.tab.length + 1);
    if (!GROUPS.some((g) => g.key === key)) return interaction.deferUpdate();
    return interaction.update({ components: [ui.panel(key)] });
  }
  return handleSelect(interaction);
}
async function handleSelect(interaction) {
  const category = categories.find((c) => c.key === interaction.values[0]);
  if (!category) return interaction.deferUpdate();

  await interaction.deferReply({ flags: core.EPHEMERAL_CV2 });
  const thread = await engine.ensureThread(interaction.client, category.key);
  if (!thread) {
    return interaction.editReply({
      components: [core.alert('Bu log kategorisinin alt başlığı açılamadı.', 'Botun ana log kanalında **alt başlık açma yetkisi** olduğundan emin ol.', 'danger')],
      flags: core.EPHEMERAL_CV2,
    });
  }
  return interaction.editReply({ components: [ui.jumpLink(category, thread)], flags: core.EPHEMERAL_CV2 });
}

// Log girdisindeki "Detaylı Bilgi" butonu: kayıt log başlığında zaten herkese açık durur, ayrıntıyı açan
// sadece kendisi görsün ki her tıklama log başlığını mesajla doldurmasın
async function handleDetail(interaction) {
  const meta = store.getDetail(interaction.message.id);
  if (!meta) {
    return replyError(interaction, 'Bu logun detayı artık saklanmıyor.', 'Detaylar sadece **en son 600 kayıt** için tutulur.');
  }
  const category = categories.find((c) => c.key === meta.category);
  await interaction.deferReply({ flags: core.EPHEMERAL_CV2 });
  return interaction.editReply({ components: [ui.detail(meta, category ? category.label : 'Log')], flags: core.EPHEMERAL_CV2 });
}

module.exports = {
  name: 'log',
  commands,
  help: { category: ['log', 'Log'], access: { log: 'Yöneticiler' }, },
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
