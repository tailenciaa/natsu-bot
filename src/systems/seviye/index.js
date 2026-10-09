// Seviye sistemi: mesaj ve ses aktivitesiyle ayrı ayrı XP kazanılır, her seviye atlamada kanala kart duyurusu gider;
// rol verme ve üye etiketleme (bildirim) sadece ana seviyelerde (5'in katları, 100'e kadar) olur, ara seviyelerde kart
// bildirimsiz gider. Üyede her türden (mesaj/ses) sadece ulaştığı en yüksek ana seviyenin rolü durur (düşük olanlar
// alınır); bot açılırken ve üye sunucuya (tekrar) girince roller XP'ye göre otomatik eşitlenir. XP kalıcıdır; sıralama
// sistemindeki günlük istatistiklerden bağımsızdır ama ses süresi aynı yöntemle sayılır: botlar ve AFK kanalı
// sayılmaz, dakikada bir kredi verilir.
const { AttachmentBuilder, Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { fetchTextChannel, respond, replyError } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const { levelFromXp } = require('./level');
const ui = require('./ui');
const { buildLevelCard } = require('./card');
const { buildLevelUpCard } = require('./levelup-card');
const profileStore = require('../profil/store');
const rankingStore = require('../siralama/store');

const commands = [
  new SlashCommandBuilder()
    .setName('seviye')
    .setDescription('Mesaj ve ses seviyeni gösterir.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Seviyesine bakılacak üyeyi seçer, boş bırakırsan kendi seviyen gösterilir.'))
    .addBooleanOption((o) => o.setName('test').setDescription('Yöneticiler için seviye atlama duyurusunun örneğini duyuru kanalına gönderir.')),
];

// Üyenin XP'sine göre o türdeki (mesaj/ses) seviye rolünü eşitler: ulaştığı en yüksek ana seviyenin rolü verilir,
// aynı türdeki diğer seviye rolleri alınır. Döndürdüğü değer: verilen rol ID'si (yoksa ya da verilemediyse null).
async function syncKindRole(member, kind) {
  const level = levelFromXp(store.xpOf(kind, member.id));
  const reached = config.milestones.filter((m) => m <= level && config.roles[kind][m]);
  const targetId = reached.length ? config.roles[kind][reached[reached.length - 1]] : null;
  const allIds = Object.values(config.roles[kind]);

  const stale = member.roles.cache.filter((r) => allIds.includes(r.id) && r.id !== targetId);
  if (stale.size) {
    await member.roles
      .remove([...stale.keys()], `Seviye rolü eşitlendi (${kind})`)
      .catch((err) => console.error(`[seviye] Eski seviye rolü alınamadı (${member.id}):`, err.message));
  }
  if (targetId && !member.roles.cache.has(targetId)) {
    const added = await member.roles.add(targetId, `Seviye rolü eşitlendi (${kind})`).then(
      () => true,
      (err) => {
        console.error(`[seviye] Seviye rolü verilemedi (${member.id}):`, err.message);
        return false;
      },
    );
    if (!added) return null;
  }
  return targetId;
}

const syncMemberRoles = async (member) => {
  if (member.user.bot) return;
  for (const kind of ['mesaj', 'ses']) await syncKindRole(member, kind);
};

// Bot açılırken XP'si olan herkesin rolleri eşitlenir (roller sonradan tanımlanmış ya da kaçmış olabilir)
async function syncAllRoles(guild) {
  const ids = new Set([...Object.keys(store.allXp('mesaj')), ...Object.keys(store.allXp('ses'))]);
  let done = 0;
  for (const id of ids) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (!member) continue;
    await syncMemberRoles(member).catch((err) => console.error('[seviye] Rol eşitlenemedi:', err.message));
    done++;
    await new Promise((resolve) => setTimeout(resolve, 250)); // Discord istek sınırına takılmamak için
  }
  console.log(`[seviye] Seviye rolleri eşitlendi (${done} üye).`);
}

// Duyuru: üyeyi etiketleyen kısa satır ve altında seviye atlama kartı (kart çizilemezse eski metin duyurusu gider).
// ping false ise (örnek duyuru ya da ara seviye) etiket görünür ama kimseye bildirim gitmez. Gönderildiyse true döner.
async function sendLevelUp(channel, user, kind, level, role, { ping = true } = {}) {
  const allowedMentions = ping ? { users: [user.id] } : { parse: [] };
  try {
    const member = await channel.guild.members.fetch(user.id).catch(() => null);
    const image = await buildLevelUpCard(user, {
      kind,
      from: level - 1,
      to: level,
      custom: profileStore.get(user.id),
      roleColor: member?.displayColor ?? 0,
      roleName: role?.name ?? null,
      roleDotColor: role?.color ?? 0,
      nextMilestone: config.milestones.find((m) => m > level) ?? null,
    });
    await channel.send({
      content: `<@${user.id}>`,
      files: [{ attachment: image, name: 'seviye-atladi.png', description: `${user.username}, ${level}. seviyeye ulaştı` }],
      allowedMentions,
    });
    return true;
  } catch (err) {
    console.error('[seviye] Duyuru kartı gönderilemedi:', err.message);
    return channel.send({ components: [ui.levelUpAnnounce(user, kind, level, role)], flags: core.CV2, allowedMentions }).then(
      () => true,
      () => false,
    );
  }
}

// XP ekler; atlanan her seviye duyurulur. Rol verme ve etiket bildirimi sadece ana seviyelerde (5, 10, 15...);
// ara seviyelerde kart yine gider ama üye bildirimsiz etiketlenir (spam olmasın diye)
async function grantXp(guild, userId, kind, amount) {
  const before = levelFromXp(store.xpOf(kind, userId));
  const after = levelFromXp(store.addXp(kind, userId, amount));
  if (after <= before) return;

  let channel;
  let user;

  for (let level = before + 1; level <= after; level++) {
    if (level <= store.announcedLevel(kind, userId)) continue;
    store.markAnnounced(kind, userId, level);

    // Rol işlemleri sadece ana seviyelerde; ara seviyede role null kalır, kartta "sıradaki rol" paneli gösterilir
    let role = null;
    if (config.milestones.includes(level)) {
      const roleId = config.roles[kind][level];
      const member = roleId ? await guild.members.fetch(userId).catch(() => null) : null;
      const given = member ? await syncKindRole(member, kind) : null;
      // Rol gerçekten verilemediyse duyuruda "kazanılan rol" olarak gösterilmez
      role = roleId && given === roleId ? (guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null))) : null;
    }

    channel ??= await fetchTextChannel(guild, config.channel);
    user ??= await guild.client.users.fetch(userId).catch(() => null);

    if (user && channel) {
      await sendLevelUp(channel, user, kind, level, role, { ping: config.milestones.includes(level) });
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
  syncAllRoles(guild).catch((err) => console.error('[seviye] Roller eşitlenemedi:', err.message));
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

const lastContent = new Map(); // kullanıcı -> XP kazandıran son mesajın metni

function handleMessage(message) {
  if (message.guildId !== guildId || message.author.bot || message.webhookId) return;
  // Anlamsız kısa mesajlar ve bir öncekiyle aynı mesaj XP vermez (sadece "a", "." ya da kopyala-yapıştır spam'i)
  const content = message.content.trim().toLowerCase();
  if (content.length < 3 && !message.attachments.size) return;
  if (content && lastContent.get(message.author.id) === content) return;
  const last = messageCooldown.get(message.author.id) ?? 0;
  if (message.createdTimestamp - last < config.message.cooldownSeconds * 1000) return;
  messageCooldown.set(message.author.id, message.createdTimestamp);
  lastContent.set(message.author.id, content);

  const { xpMin, xpMax } = config.message;
  const amount = xpMin + Math.floor(Math.random() * (xpMax - xpMin + 1));
  grantXp(message.guild, message.author.id, 'mesaj', amount).catch((err) => console.error('[seviye] Mesaj XP verilemedi:', err.message));
}

// /seviye test:True (sadece yöneticiler): komutu kullanan üye için örnek duyuruyu gerçek duyuru kanalına gönderir;
// etiket görünür ama kimseye bildirim gitmez, sonuç sadece yöneticiye gösterilir
async function sendTestAnnounce(interaction) {
  if (!interaction.memberPermissions?.has('Administrator')) {
    return replyError(interaction, 'Test duyurusunu sadece yöneticiler gönderebilir.', 'Kendi seviyeni görmek için komutu **test** seçeneği olmadan kullan.');
  }
  await interaction.deferReply({ flags: core.EPHEMERAL });
  const channel = await fetchTextChannel(interaction.guild, config.channel);
  if (!channel) return replyError(interaction, 'Duyuru kanalı bulunamadı.', 'Kanalın **silinmediğinden** ve botun görebildiğinden emin ol.');
  const roleId = config.roles.mesaj[15];
  const role = roleId ? (interaction.guild.roles.cache.get(roleId) ?? null) : null;
  const sent = await sendLevelUp(channel, interaction.user, 'mesaj', 15, role, { ping: false });
  if (!sent) return replyError(interaction, 'Örnek duyuru gönderilemedi.', 'Botun duyuru kanalında **mesaj** ve **dosya gönderme** izni olmalı.');
  return respond(interaction, core.alert('Örnek duyuru gönderildi.', `<#${channel.id}> kanalına bakabilirsin. **Kimseye bildirim gitmedi.**`, 'success'));
}

// /seviye [kullanici]: mesaj ve ses seviyesi tek görsel kartta
async function handleCommand(interaction) {
  if (interaction.options.getBoolean('test')) return sendTestAnnounce(interaction);
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  if (user.bot) return replyError(interaction, 'Botların seviyesi bulunmaz.', 'Bir üye seçerek tekrar dene.');
  await interaction.deferReply();
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const buffer = await buildLevelCard(user, {
    custom: profileStore.get(user.id),
    roleColor: member?.displayColor ?? 0,
    mesajXp: store.xpOf('mesaj', user.id),
    sesXp: store.xpOf('ses', user.id),
    mesajRank: rankingStore.rankOf('messages', user.id),
    sesRank: rankingStore.rankOf('voice', user.id),
  });
  return interaction.editReply({
    components: [ui.levelImage('seviye.png', `${user.username} seviye kartı`)],
    files: [new AttachmentBuilder(buffer, { name: 'seviye.png' })],
    flags: core.CV2,
    allowedMentions: { parse: [] },
  });
}

module.exports = {
  name: 'seviye',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { seviye: 'Herkes' } },
  slash: { seviye: handleCommand },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.GuildMemberAdd]: (member) => (member.guild.id === guildId ? syncMemberRoles(member).catch(() => {}) : undefined),
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.MessageCreate]: handleMessage,
  },
};
