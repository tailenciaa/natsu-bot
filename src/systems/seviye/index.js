// Seviye sistemi: mesaj ve ses aktivitesiyle ayrı ayrı XP kazanılır, sadece ana seviyelerde (5'in katları, 100'e
// kadar) rol verilir, kanala duyurulur ve üye etiketlenir; ara seviyeler sessizce geçilir. XP kalıcıdır; sıralama
// sistemindeki günlük istatistiklerden bağımsızdır ama ses süresi aynı yöntemle sayılır: botlar ve AFK kanalı
// sayılmaz, dakikada bir kredi verilir.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, fetchTextChannel } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const { levelFromXp } = require('./level');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('seviye')
    .setDescription('Mesaj ve ses seviyeni gösterir.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Seviyesi görüntülenecek kullanıcı (boş bırakırsan kendi seviyen)')),
];

// XP ekler; her seviye atlandığında kanala duyurur ama sadece ana seviyelerde (5, 10, 15...) rol verir ve üyeyi etiketler
async function grantXp(guild, userId, kind, amount) {
  const before = levelFromXp(store.xpOf(kind, userId));
  const after = levelFromXp(store.addXp(kind, userId, amount));
  if (after <= before) return;

  const channel = await fetchTextChannel(guild, config.channel);
  const user = await guild.client.users.fetch(userId).catch(() => null);

  for (let level = before + 1; level <= after; level++) {
    if (level <= store.announcedLevel(kind, userId)) continue;
    store.markAnnounced(kind, userId, level);

    const isMilestone = config.milestones.includes(level);
    let role = null;
    if (isMilestone) {
      const roleId = config.roles[kind][level];
      if (roleId) {
        const member = await guild.members.fetch(userId).catch(() => null);
        await member?.roles.add(roleId, `Seviye ${level} (${kind})`).catch(() => {});
        role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
      }
    }

    if (user && channel) {
      await channel
        .send({
          components: [ui.levelUpAnnounce(user, kind, level, role)],
          flags: core.CV2,
          allowedMentions: isMilestone ? { users: [userId] } : { parse: [] },
        })
        .catch(() => {});
    }
  }
}

// ── Ses XP: siralama sistemiyle aynı yöntem (dakikada bir kredi, bot/AFK sayılmaz) ────

const TICK = 60 * 1000;
const voiceSince = new Map();
const countsVoice = (state) => Boolean(state?.channelId) && !state.member?.user.bot && state.channelId !== state.guild.afkChannelId;

function creditVoice(guild, userId, now = Date.now()) {
  const since = voiceSince.get(userId);
  if (since === undefined) return;
  // Bilgisayar uyku vb. yüzünden araya giren uzun boşluklar sayılmaz
  const minutes = Math.min(now - since, 2 * TICK) / TICK;
  if (minutes <= 0) return;
  grantXp(guild, userId, 'ses', Math.round(minutes * config.voice.xpPerMinute)).catch((err) =>
    console.error('[seviye] Ses XP verilemedi:', err.message),
  );
}

function tickVoice(guild) {
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (!countsVoice(state)) continue;
    creditVoice(guild, state.id, now);
    voiceSince.set(state.id, now);
  }
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  for (const state of guild.voiceStates.cache.values()) if (countsVoice(state)) voiceSince.set(state.id, Date.now());
  setInterval(() => tickVoice(guild), TICK).unref();
}

function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;
  const was = countsVoice(oldState);
  const is = countsVoice(newState);
  if (was && !is) {
    creditVoice(newState.guild, newState.id);
    voiceSince.delete(newState.id);
  } else if (!was && is) {
    voiceSince.set(newState.id, Date.now());
  }
}

// ── Mesaj XP: spam'i önlemek için üye başına bekleme süresi ───────────────────────────

const messageCooldown = new Map();

function handleMessage(message) {
  if (message.guildId !== guildId || message.author.bot || message.webhookId) return;
  const last = messageCooldown.get(message.author.id) ?? 0;
  if (message.createdTimestamp - last < config.message.cooldownSeconds * 1000) return;
  messageCooldown.set(message.author.id, message.createdTimestamp);

  const { xpMin, xpMax } = config.message;
  const amount = xpMin + Math.floor(Math.random() * (xpMax - xpMin + 1));
  grantXp(message.guild, message.author.id, 'mesaj', amount).catch((err) => console.error('[seviye] Mesaj XP verilemedi:', err.message));
}

// /seviye [kullanici]
async function handleCommand(interaction) {
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  return respond(interaction, ui.levelCard(user, store.xpOf('mesaj', user.id), store.xpOf('ses', user.id)), { ephemeral: false });
}

module.exports = {
  name: 'seviye',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { seviye: 'Herkes' } },
  slash: { seviye: handleCommand },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.MessageCreate]: handleMessage,
  },
};
