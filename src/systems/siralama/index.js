// Sıralama: üyelerin mesaj sayısı, ses süresi ve yayın (ekran paylaşımı) süresi sayılır, /siralama ile
// sıralaması gösterilir. Sıralama rol ile filtrelenebilir, türü (mesaj / ses / yayın) ve dönemi (genel, haftalık,
// son X gün) seçilebilir. Botlar ve AFK kanalı sayılmaz. Sayım bu sistem kurulduğundan itibaren başlar.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const { guildId } = require('../../core/config');
const { respond, replyError, isMenuOwner, stillMember } = require('../../core/helpers');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('siralama')
    .setDescription('Sunucunun mesaj, ses ve yayın sıralamasını gösterir.')
    .setContexts(InteractionContextType.Guild),
];

// Ses ve yayın süresi: kanaldaki üyelere her dakika geçen süre eklenir; çıkınca (ya da paylaşım bitince) kalan süre eklenir
const TICK = 60 * 1000;
const voiceSince = new Map();
const streamSince = new Map();

const countsVoice = (state) =>
  Boolean(state?.channelId) && !state.member?.user.bot && state.channelId !== state.guild.afkChannelId;
// Yayın sayılması için ses kanalında olmak şart; ekran paylaşımı olmayan birinin süresi yalnızca ses sayılır
const countsStream = (state) => countsVoice(state) && Boolean(state.streaming);

function credit(map, kind, userId, now = Date.now()) {
  const since = map.get(userId);
  if (since === undefined) return;
  // Bilgisayar uyku vb. yüzünden araya giren uzun boşluklar sayılmaz; saniye tam sayı olarak tutulur
  store.add(kind, userId, Math.round(Math.min(now - since, 2 * TICK) / 1000), now);
}

// Sayım çizelgesi: süre kesilirse kalan yazılır, yeni başlamışsa zaman damgası konur
function track(map, kind, was, is, userId) {
  if (was && !is) {
    credit(map, kind, userId);
    map.delete(userId);
  } else if (!was && is) {
    map.set(userId, Date.now());
  }
}

function tickVoice(guild) {
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (countsVoice(state)) {
      credit(voiceSince, 'voice', state.id, now);
      voiceSince.set(state.id, now);
    }
    if (countsStream(state)) {
      credit(streamSince, 'stream', state.id, now);
      streamSince.set(state.id, now);
    }
  }
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  // Rol filtresi ve ayrılan üyelerin ayıklanması üye önbelleğine dayanır; önbelleği açılışta diğer sistemler doldurur (ikinci bir toplu istek Discord sınırına takılır)
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (countsVoice(state)) voiceSince.set(state.id, now);
    if (countsStream(state)) streamSince.set(state.id, now);
  }
  setInterval(() => tickVoice(guild), TICK).unref();
}

function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;
  const userId = newState.id;
  // Ekran paylaşımı kanala girdikten sonra da açılıp kapanabildiği için iki sayım ayrı ayrı izlenir
  track(voiceSince, 'voice', countsVoice(oldState), countsVoice(newState), userId);
  track(streamSince, 'stream', countsStream(oldState), countsStream(newState), userId);
}

function handleMessage(message) {
  if (message.guildId !== guildId || message.author.bot || message.webhookId) return;
  store.add('messages', message.author.id, 1, message.createdTimestamp);
}

// Sıralama türünün store'daki karşılığı
const STAT_KIND = { mesaj: 'messages', ses: 'voice', yayin: 'stream' };

// Sıralamayı hesaplar: türün dönemdeki toplamları (sunucudan ayrılanlar hariç), rol seçildiyse sadece o roldeki üyeler
function ranking(guild, type, period, days, roleId) {
  const totals = store.totals(STAT_KIND[type], period === 'genel' ? null : period === 'haftalik' ? 7 : days);
  return [...totals]
    .filter(([userId]) => (roleId === '0' ? stillMember(guild, userId) : guild.members.cache.get(userId)?.roles.cache.has(roleId)))
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value);
}

function view(interaction, type, period, days, roleId, page) {
  const { guild } = interaction;
  return ui.leaderboard({
    guild,
    viewerId: interaction.user.id,
    type,
    period,
    days: Number(days) || 0,
    roleId,
    page: Number(page) || 0,
    ranking: ranking(guild, type, period, Number(days) || 0, roleId),
  });
}

const notOwner = (interaction) =>
  replyError(interaction, 'Bu sıralamayı sadece komutu kullanan kişi değiştirebilir.', 'Kendi sıralaman için /siralama yazabilirsin.');
const show = (interaction, container) => interaction.update({ components: [container], allowedMentions: { parse: [] } });

async function handleCommand(interaction) {
  return respond(interaction, view(interaction, 'mesaj', 'genel', 0, '0', 0), { ephemeral: false });
}

// Dönem ve sayfa butonları: siralama:<tür>:<dönem>:<gün>:<rol>:<sayfa>:<buton yeri>
async function handleNavigate(interaction) {
  if (!isMenuOwner(interaction)) return notOwner(interaction);
  const [, type, period, days, roleId, page] = interaction.customId.split(':');
  return show(interaction, view(interaction, type, period, days, roleId, page));
}

// Rol filtresi: siralama-rol:<tür>:<dönem>:<gün>; seçim kaldırılırsa tüm sunucu
async function handleRole(interaction) {
  if (!isMenuOwner(interaction)) return notOwner(interaction);
  const [, type, period, days] = interaction.customId.split(':');
  return show(interaction, view(interaction, type, period, days, interaction.values[0] ?? '0', 0));
}

// Sıralama türü: siralama-tur:<dönem>:<gün>:<rol>
async function handleType(interaction) {
  if (!isMenuOwner(interaction)) return notOwner(interaction);
  const [, period, days, roleId] = interaction.customId.split(':');
  return show(interaction, view(interaction, interaction.values[0], period, days, roleId, 0));
}

// "Özel Süre" butonu ve formu
async function handleCustom(interaction) {
  if (!isMenuOwner(interaction)) return notOwner(interaction);
  const [, type, roleId] = interaction.customId.split(':');
  return interaction.showModal(ui.customModal(type, roleId));
}

async function handleCustomSubmit(interaction) {
  const [, type, roleId] = interaction.customId.split(':');
  const raw = interaction.fields.getTextInputValue(ui.IDS.days).trim();
  const days = /^\d{1,3}$/.test(raw) ? Number(raw) : 0;
  if (days < 1 || days > 365) {
    return replyError(interaction, 'Geçerli bir gün sayısı yazmalısın.', '1 ile 365 arasında bir tam sayı gir.');
  }
  return show(interaction, view(interaction, type, 'ozel', days, roleId, 0));
}

module.exports = {
  name: 'siralama',
  commands,
  help: { category: ['siralama', 'Sıralama'], member: ['siralama'], access: { siralama: 'Herkes' } },
  slash: { siralama: handleCommand },
  prefixed: [
    [ui.IDS.navigate, handleNavigate],
    [ui.IDS.role, handleRole],
    [ui.IDS.type, handleType],
    [ui.IDS.custom, handleCustom],
    [ui.IDS.customModal, handleCustomSubmit],
  ],
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.MessageCreate]: handleMessage,
  },
};
