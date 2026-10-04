// Log sistemi: sunucudaki ve botteki olayların (mesaj, ses, üye, moderasyon, sunucu, boost) kaydı ana log
// kanalının altındaki kategori alt başlıklarına mesaj olarak atılır. Log paneli kanalındaki menüden bir kategori
// seçilince o alt başlığa giden bağlantı gelir; kanala girip aramaya gerek kalmaz.
// Dosyalar: categories.js (kategori listesi), engine.js (alt başlık açma ve gönderme), events/ (olay dinleyicileri).
const { Events } = require('discord.js');
const core = require('../../core/ui');
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
    [Events.UserUpdate]: member.handleUserUpdate,
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
    [Events.InviteCreate]: server.handleInviteCreate,
    [Events.InviteDelete]: server.handleInviteDelete,
  },
};
