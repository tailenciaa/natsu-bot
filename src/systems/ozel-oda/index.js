// Özel oda sistemi (VoiceMaster benzeri): ayarlı "Özel Oda Oluştur" ses kanalına katılan üyeye otomatik kendi ses
// kanalı açılır ve içine alınır. Kanalın kendi metin sohbetine sadece oda sahibinin kullanabildiği bir kontrol
// paneli düşer: kilitle/aç, gizle/göster, kişi limiti, isim değiştir, kullanıcı at, kullanıcı yasakla, sahipliği
// devret. At/yasakla/devret menüleri sadece o an odada bulunan üyeleri listeler. Yasaklanan kullanıcı odadan atılır
// ve o oda silinene kadar tekrar giremez (at sadece anlık çıkarır, kalıcı engellemez). Odada kimse kalmayınca kanal
// kendiliğinden silinir. Oluştur kanalına her girişte yeni bir oda açılır; sahibi eski odasından ayrılıp sahipliği
// devretmediyse eski oda, içindeki diğer üyeler çıkana kadar kendi başına kalır. Trolleri önlemek için her panel
// işleminin kısa bir beklemesi vardır.
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

async function handleLockToggle(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const wait = takeCooldown(interaction.channelId, ui.IDS.lock);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const { channel } = interaction;
  const everyone = channel.guild.roles.everyone;
  const locked = channel.permissionOverwrites.cache.get(everyone.id)?.deny.has('Connect') ?? false;
  await channel.permissionOverwrites.edit(everyone, { Connect: locked ? null : false });
  return interaction.update({ components: [ui.controlPanel(room, channel)] });
}

async function handleHideToggle(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const wait = takeCooldown(interaction.channelId, ui.IDS.hide);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const { channel } = interaction;
  const everyone = channel.guild.roles.everyone;
  const hidden = channel.permissionOverwrites.cache.get(everyone.id)?.deny.has('ViewChannel') ?? false;
  await channel.permissionOverwrites.edit(everyone, { ViewChannel: hidden ? null : false });
  return interaction.update({ components: [ui.controlPanel(room, channel)] });
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
  const wait = takeCooldown(interaction.channelId, ui.IDS.limit);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const limit = Number(interaction.fields.getTextInputValue(ui.IDS.limitInput).trim());
  if (!Number.isInteger(limit) || limit < 0 || limit > 99) {
    return replyError(interaction, 'Geçerli bir sayı gir.', '0-99 arası olmalı, 0 sınırsız demektir.');
  }

  await interaction.channel.setUserLimit(limit).catch(() => {});
  if (interaction.isFromMessage()) return interaction.update({ components: [ui.controlPanel(room, interaction.channel)] });
  return respond(interaction, core.alert('Kişi limiti güncellendi.', null, 'success'));
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
  const wait = takeCooldown(interaction.channelId, ui.IDS.rename);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const name = interaction.fields.getTextInputValue(ui.IDS.renameInput).trim();
  await interaction.channel.setName(name).catch(() => {});
  if (interaction.isFromMessage()) return interaction.update({ components: [ui.controlPanel(room, interaction.channel)] });
  return respond(interaction, core.alert('Oda ismi güncellendi.', null, 'success'));
}

async function handleKick(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const targetId = interaction.values[0];
  if (targetId === ui.NONE) return replyError(interaction, 'Odada atılacak kimse yok.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.kick);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (member?.voice.channelId === interaction.channelId) await member.voice.disconnect().catch(() => {});

  return interaction.update({ components: [ui.controlPanel(room, interaction.channel)] });
}

async function handleBan(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const targetId = interaction.values[0];
  if (targetId === ui.NONE) return replyError(interaction, 'Odada yasaklanacak kimse yok.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.ban);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (member?.voice.channelId === interaction.channelId) await member.voice.disconnect().catch(() => {});
  await interaction.channel.permissionOverwrites.edit(targetId, { Connect: false }).catch(() => {});

  return interaction.update({ components: [ui.controlPanel(room, interaction.channel)] });
}

async function handleTransfer(interaction) {
  const room = store.getRoom(interaction.channelId);
  const err = ownerError(interaction, room);
  if (err) return replyError(interaction, err);
  const targetId = interaction.values[0];
  if (targetId === ui.NONE) return replyError(interaction, 'Odada devredilecek kimse yok.');
  const wait = takeCooldown(interaction.channelId, ui.IDS.transfer);
  if (wait) return replyError(interaction, `Çok hızlısın, ${wait} saniye sonra tekrar dene.`);

  const member = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (member?.voice.channelId !== interaction.channelId) {
    return replyError(interaction, 'Sahipliği sadece odanda bulunan birine devredebilirsin.');
  }

  const updated = store.updateRoom(interaction.channelId, { ownerId: targetId });
  return interaction.update({ components: [ui.controlPanel(updated, interaction.channel)] });
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
    [Events.ChannelDelete]: (channel) => store.deleteRoom(channel.id),
  },
};
