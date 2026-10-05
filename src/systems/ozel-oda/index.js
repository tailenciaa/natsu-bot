// Özel oda sistemi (VoiceMaster benzeri): ayarlı "Özel Oda Oluştur" ses kanalına katılan üyeye otomatik kendi ses
// kanalı açılır ve içine alınır. Kanalın kendi metin sohbetine sadece oda sahibinin kullanabildiği bir kontrol
// paneli düşer: kilitle/aç, gizle/göster, kişi limiti, isim değiştir, kullanıcı at, kullanıcı yasakla, sahipliği
// devret. Yasaklanan kullanıcı odadan atılır ve o oda silinene kadar tekrar giremez (at sadece anlık çıkarır,
// kalıcı engellemez). Odada kimse kalmayınca kanal kendiliğinden silinir. Oluştur kanalına her girişte yeni bir
// oda açılır; sahibi eski odasından ayrılıp sahipliği devretmediyse eski oda, içindeki diğer üyeler çıkana kadar
// kendi başına kalır. Trolleri önlemek için her panel işleminin kısa bir beklemesi vardır. Oda sahibine kendi
// odasında ayrı izin verilir, böylece kilitleyince ya da gizleyince kendisi dışarıda kalmaz.
const { ChannelType, Events } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError } = require('../../core/helpers');
const { guildId } = require('../../core/config');
const { syncPanel } = require('../../core/panel');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const creating = new Set();

// Panel işlemlerine art arda basıp trollemeyi (sürekli isim/limit değiştirme vb.) engelleyen bekleme süreleri.
// İsim ve limit değişikliği Discord'da zaten sık değiştirilemiyor, kısa sürede denemek hataya yol açmasın diye uzun tutulur.
const COOLDOWN_MS = {
  [ui.IDS.lock]: 3000,
  [ui.IDS.hide]: 3000,
  [ui.IDS.limit]: 15000,
  [ui.IDS.rename]: 15000,
  [ui.IDS.kick]: 3000,
  [ui.IDS.ban]: 3000,
  [ui.IDS.transfer]: 3000,
};
const cooldowns = new Map(); // `${channelId}:${action}` -> bir sonraki kullanılabileceği zaman

// Beklemedeyse kalan saniyeyi, değilse null döner; null dönünce kullanım anı kaydedilir
function takeCooldown(channelId, action) {
  const key = `${channelId}:${action}`;
  const until = cooldowns.get(key) ?? 0;
  const now = Date.now();
  if (now < until) return Math.ceil((until - now) / 1000);
  cooldowns.set(key, now + (COOLDOWN_MS[action] ?? 3000));
  return null;
}

// Oda silinince bekleme kayıtları da silinir
function clearCooldowns(channelId) {
  for (const key of cooldowns.keys()) if (key.startsWith(`${channelId}:`)) cooldowns.delete(key);
}

const slowDown = (interaction, wait) => replyError(interaction, 'Biraz yavaş ol.', `${wait} saniye sonra tekrar deneyebilirsin.`);

// İzin değişikliklerinin hatası kayda geçer ama akışı kesmez
const logFailure = (what) => (err) => console.error(`[ozel-oda] ${what}:`, err.message);

// ── Oda oluşturma / silme ───────────────────────────────────────────────────────

async function createRoom(member) {
  const { guild } = member;
  if (creating.has(member.id)) return;
  creating.add(member.id);

  try {
    const channel = await guild.channels
      .create({
        name: config.nameOf(member),
        type: ChannelType.GuildVoice,
        parent: member.voice.channel?.parentId || undefined,
        userLimit: config.defaultUserLimit,
        reason: `${member.user.username} için özel oda`,
      })
      .catch((err) => {
        console.error('[ozel-oda] Oda oluşturulamadı:', err.message);
        return null;
      });
    if (!channel) return;

    const room = store.setRoom(channel.id, { guildId: guild.id, ownerId: member.id, createdAt: Date.now() });
    // Sahip kendi odasını kilitlese ya da gizlese bile giriş ve görme izni kalır
    await channel.permissionOverwrites.edit(member.id, { ViewChannel: true, Connect: true }).catch(logFailure('Oda sahibine izin verilemedi'));

    const moved = await member.voice.setChannel(channel).catch(() => false);
    if (moved === false) {
      store.deleteRoom(channel.id);
      return void (await channel.delete().catch(() => {}));
    }

    await channel
      .send({ components: [ui.controlPanel(room, channel)], flags: core.CV2, allowedMentions: { parse: [] } })
      .catch(() => {});
  } finally {
    creating.delete(member.id);
  }
}

async function deleteIfEmpty(channel) {
  if (!channel || !store.getRoom(channel.id)) return;
  if (channel.members.size > 0) return;
  store.deleteRoom(channel.id);
  clearCooldowns(channel.id);
  await channel.delete().catch(() => {});
}

async function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;

  if (newState.channelId === config.createChannelId && newState.member) {
    await createRoom(newState.member);
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    await deleteIfEmpty(oldState.channel);
  }
}

// Bot kapalıyken kimse ayrılmadan kalmış boş odaları, kaydı silinmiş kanalları ve artık var olmayan kanal
// kayıtlarını temizler
async function cleanup(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  for (const [channelId] of store.roomsOf(guild.id)) {
    const channel = await guild.channels.fetch(channelId).catch((err) => (err.code === 10003 ? null : undefined));
    if (channel === null) {
      store.deleteRoom(channelId);
      continue;
    }
    if (channel) await deleteIfEmpty(channel);
  }
}

// ── Kontrol paneli ───────────────────────────────────────────────────────────────

// Hata varsa mesajı, yoksa null döner
function ownerError(interaction, room) {
  if (!room) return 'Burası bir özel oda değil.';
  if (interaction.user.id !== room.ownerId) return 'Bu paneli sadece oda sahibi kullanabilir.';
  return null;
}

// Panel mesajını (izin değişikliğinin önbelleğe geç yansımasına takılmadan) yeni durumla yeniden çizer
const redraw = (interaction, room, state) =>
  interaction.editReply({ components: [ui.controlPanel(room, interaction.channel, state)], allowedMentions: { parse: [] } });

// Panelin butonundan açılan formlar mesajı günceller; 3 saniye dolmadan cevap verilir, yavaş işler sonra yapılır
const acknowledge = (interaction) => (interaction.isFromMessage() ? interaction.deferUpdate() : interaction.deferReply({ flags: core.EPHEMERAL }));
const finishEdit = (interaction, room, confirmation) =>
  interaction.isFromMessage() ? redraw(interaction, room) : respond(interaction, core.alert(confirmation, null, 'success'));

// Kilit ve gizleme @everyone izninden okunur, değişince önbelleği beklemeden yeni durum çizilir
async function handleLockToggle(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const wait = takeCooldown(interaction.channelId, ui.IDS.lock);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const { channel } = interaction;
  const everyone = channel.guild.roles.everyone;
  const locked = channel.permissionOverwrites.cache.get(everyone.id)?.deny.has('Connect') ?? false;
  const changed = await channel.permissionOverwrites.edit(everyone, { Connect: locked ? null : false }).then(() => true, logFailure('Kilit değiştirilemedi'));
  if (!changed) return replyError(interaction, 'Oda kilidi değiştirilemedi.', 'Botun bu kanalı yönetme izni olmalı.');
  return redraw(interaction, room, { locked: !locked });
}

async function handleHideToggle(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const wait = takeCooldown(interaction.channelId, ui.IDS.hide);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const { channel } = interaction;
  const everyone = channel.guild.roles.everyone;
  const hidden = channel.permissionOverwrites.cache.get(everyone.id)?.deny.has('ViewChannel') ?? false;
  const changed = await channel.permissionOverwrites.edit(everyone, { ViewChannel: hidden ? null : false }).then(() => true, logFailure('Görünürlük değiştirilemedi'));
  if (!changed) return replyError(interaction, 'Oda görünürlüğü değiştirilemedi.', 'Botun bu kanalı yönetme izni olmalı.');
  return redraw(interaction, room, { hidden: !hidden });
}

async function handleLimitButton(interaction) {
  const err = ownerError(interaction, store.getRoom(interaction.channelId));
  if (err) return replyError(interaction, err);
  return interaction.showModal(ui.limitModal(interaction.channel.userLimit));
}

async function handleLimitSubmit(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);

  const raw = interaction.fields.getTextInputValue(ui.IDS.limitInput).trim();
  const limit = /^\d{1,2}$/.test(raw) ? Number(raw) : -1;
  if (limit < 0) return replyError(interaction, 'Geçerli bir sayı gir.', '0-99 arası olmalı, 0 sınırsız demektir.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.limit);
  if (wait) return slowDown(interaction, wait);

  await acknowledge(interaction);
  const changed = await interaction.channel.setUserLimit(limit).then(() => true, logFailure('Kişi limiti değiştirilemedi'));
  if (!changed) return replyError(interaction, 'Kişi limiti değiştirilemedi.', 'Botun bu kanalı yönetme izni olmalı.');
  return finishEdit(interaction, room, 'Kişi limiti güncellendi.');
}

async function handleRenameButton(interaction) {
  const err = ownerError(interaction, store.getRoom(interaction.channelId));
  if (err) return replyError(interaction, err);
  return interaction.showModal(ui.renameModal(interaction.channel.name));
}

async function handleRenameSubmit(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);

  const name = interaction.fields.getTextInputValue(ui.IDS.renameInput).trim();
  if (!name) return replyError(interaction, 'Oda ismi boş olamaz.', 'Bir isim yazıp tekrar dene.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.rename);
  if (wait) return slowDown(interaction, wait);

  await acknowledge(interaction);
  // Discord kanal adını 10 dakikada en fazla 2 kez değiştirmeye izin verir; sınıra takılan istek uzun süre bekleyebilir
  const result = await Promise.race([
    interaction.channel.setName(name).then(() => 'ok', (error) => {
      console.error('[ozel-oda] Oda ismi değiştirilemedi:', error.message);
      return 'fail';
    }),
    new Promise((resolve) => setTimeout(() => resolve('slow'), 8000).unref()),
  ]);
  if (result === 'fail') return replyError(interaction, 'Oda ismi değiştirilemedi.', 'Botun bu kanalı yönetme izni olmalı.');
  if (result === 'slow') {
    return respond(interaction, core.alert('Oda ismi sıraya alındı.', 'Discord kanal adını 10 dakikada en fazla 2 kez değiştirmeye izin verir; isim sıra gelince kendiliğinden güncellenir.', 'warning'));
  }
  return finishEdit(interaction, room, 'Oda ismi güncellendi.');
}

async function handleKick(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const targetId = interaction.values[0];
  if (targetId === room.ownerId) return replyError(interaction, 'Kendini odadan atamazsın.', 'Odadan ayrılmak için kanaldan çıkman yeterli.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.kick);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (member?.voice.channelId !== interaction.channelId) return replyError(interaction, 'Bu üye şu an odada değil.', 'Odada bulunan birini seç.');
  await member.voice.disconnect().catch(logFailure('Üye odadan atılamadı'));
  return redraw(interaction, room);
}

async function handleBan(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const targetId = interaction.values[0];
  if (targetId === room.ownerId) return replyError(interaction, 'Kendini odadan yasaklayamazsın.', 'Odadan ayrılmak için kanaldan çıkman yeterli.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.ban);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const banned = await interaction.channel.permissionOverwrites.edit(targetId, { Connect: false }).then(() => true, logFailure('Üye yasaklanamadı'));
  if (!banned) return replyError(interaction, 'Üye yasaklanamadı.', 'Botun bu kanalı yönetme izni olmalı.');
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (member?.voice.channelId === interaction.channelId) await member.voice.disconnect().catch(logFailure('Üye odadan atılamadı'));
  return redraw(interaction, room);
}

async function handleTransfer(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const targetId = interaction.values[0];
  if (targetId === room.ownerId) return replyError(interaction, 'Oda zaten senin.', 'Devretmek için odadaki başka bir üyeyi seç.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.transfer);
  if (wait) return slowDown(interaction, wait);

  await interaction.deferUpdate();
  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (member?.voice.channelId !== interaction.channelId || member.user.bot) {
    return replyError(interaction, 'Sahipliği sadece odanda bulunan bir üyeye devredebilirsin.', 'Odada bulunan bir üye seç.');
  }

  const updated = store.updateRoom(interaction.channelId, { ownerId: targetId });
  // Giriş ve görme izni yeni sahibe geçer, eski sahibin ayrı izni kalkar
  await interaction.channel.permissionOverwrites.delete(room.ownerId).catch(logFailure('Eski sahibin izni kaldırılamadı'));
  await interaction.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, Connect: true }).catch(logFailure('Yeni sahibe izin verilemedi'));
  return redraw(interaction, updated);
}

function sendGuide(client) {
  if (!config.guideChannel) return;
  return syncPanel(client, {
    key: 'ozel-oda-rehber',
    label: 'Özel oda rehberi',
    channelId: config.guideChannel,
    buttonId: ui.GUIDE_TITLE,
    build: ui.guidePanel,
    image: '',
  });
}

module.exports = {
  name: 'ozel-oda',
  buttons: {
    [ui.IDS.lock]: handleLockToggle,
    [ui.IDS.hide]: handleHideToggle,
    [ui.IDS.limit]: handleLimitButton,
    [ui.IDS.rename]: handleRenameButton,
  },
  modals: {
    [ui.IDS.limitModal]: handleLimitSubmit,
    [ui.IDS.renameModal]: handleRenameSubmit,
  },
  prefixed: [
    [ui.IDS.kick, handleKick],
    [ui.IDS.ban, handleBan],
    [ui.IDS.transfer, handleTransfer],
  ],
  events: {
    [Events.ClientReady]: async (client) => {
      await cleanup(client);
      await sendGuide(client);
    },
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.ChannelDelete]: (channel) => {
      store.deleteRoom(channel.id);
      clearCooldowns(channel.id);
    },
  },
};
