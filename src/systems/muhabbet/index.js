// Muhabbet odası sistemi: üye sıra panelinden sıraya girer. Sırada iki kişi olunca en eski ikisi eşleşir ve
// yalnızca kendilerinin görebildiği bir ses ve yazı odası açılır; eşleşme DM ile bildirilir, odanın yazı
// kanalına iki üyenin de kullanabildiği kontrol paneli düşer. Muhabbet paneldeki "Muhabbeti Bitir" butonuyla
// biter; kanal silinir, iklili bekleme sonrası tekrar sıraya girilebilir. Ses kanalında kimse kalmazsa ya da
// en uzun oda süresi dolarsa oda kendiliğinden kapanır, sırada gereğinden uzun bekleyen üye sıradan düşer.
// Yetkililer /muhabbet ile odaları ve sırayı görür, bir odayı kapatır, sırayı tamamen boşaltabilir.
const { ChannelType, Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const logSystem = require('../log');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const MIN = 60 * 1000;
const matching = new Set(); // eşleştirme sürerken aynı iki üyenin iki kez eşleşmemesi için sunucu kilidi
const closing = new Set(); // aynı oda iki kez kapanmasın diye oda kilidi
let sweeper = null;

// Kanal ve izin işlemlerinin hatası kayda geçer, akışı kesmez
const hata = (what) => (err) => {
  console.error(`[muhabbet] ${what}:`, err.message);
  return null;
};

// Karta ulaşan üye olmazsa akış devam eder: DM kapalı üyelere hiçbir şey yazılmaz
async function dm(client, userId, container) {
  const user = await client.users.fetch(userId).catch(() => null);
  return user?.send({ components: [container], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => null) ?? null;
}

// Log kanalı tanımsızsa ya da yazılamasa bile muhabbet akışı kesilmez
const yazLog = (client, payload) => logSystem.write(client, 'bot', payload).catch(hata('Muhabbet logu yazılamadı'));

const commands = [
  new SlashCommandBuilder()
    .setName('muhabbet')
    .setDescription('Muhabbet odalarını ve muhabbet sırasını yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('liste').setDescription('Açık muhabbet odalarını ve sırada bekleyen üyeleri listeler.'))
    .addSubcommand((s) =>
      s
        .setName('kapat')
        .setDescription('Bir muhabbet odasını kapatır ve iki kanalını siler.')
        .addIntegerOption((o) => o.setName('no').setDescription('Oda numarasını girer.').setMinValue(1).setRequired(true))
        .addStringOption((o) => o.setName('sebep').setDescription('Üyelere yazılacak kapatma sebebini girer.').setMaxLength(200)),
    )
    .addSubcommand((s) => s.setName('sirayi-temizle').setDescription('Sırada bekleyen tüm üyeleri sıradan çıkarır.')),
];

// ── Sıra ───────────────────────────────────────────────────────────────────────

// Sıraya girilemiyorsa [mesaj, açıklama] döner, girilebiliyorsa null
function queueError(interaction) {
  if (interaction.user.bot) return ['Botlar muhabbet sırasına giremez.', 'Bu sistem sunucu üyelerinin birbirleriyle konuşması için var.'];
  if (store.roomOfUser(interaction.guildId, interaction.user.id)) {
    return ['Zaten bir muhabbet odan var.', 'Önce odanı bitir, sonra tekrar sıraya girebilirsin.'];
  }
  const left = store.cooldownLeft(interaction.guildId, interaction.user.id);
  if (left) {
    return ['Yeni bir muhabbet için biraz beklemen gerekiyor.', `<t:${core.unix(Date.now() + left * 1000)}:R> tekrar sıraya girebilirsin.`];
  }
  if (store.queueOf(interaction.guildId).length >= config.maxQueue) {
    return ['Muhabbet sırası şu an dolu.', 'Bir oda kapandığında tekrar deneyebilirsin.'];
  }
  return null;
}

// Paneldeki "Muhabbet Başlat": ya sıraya girilir ya da sırada kalındığı sürede yeri öğrenilir
async function handleStart(interaction) {
  const error = queueError(interaction);
  if (error) return replyError(interaction, ...error);

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const { guild } = interaction;
  const already = store.inQueue(guild.id, interaction.user.id);
  if (!already) store.enqueue(guild.id, interaction.user.id);

  await matchPair(guild, interaction.user.id);

  // Eşleşen üye olabilir (rakip bekliyordu ya da eşleşmeyi başka birinin dokunuşu tamamladı)
  const room = store.roomOfUser(guild.id, interaction.user.id);
  if (room) return respond(interaction, ui.matchedCard(room));

  return respond(interaction, ui.queuedCard(store.position(guild.id, interaction.user.id), store.queueOf(guild.id).length, already));
}

// Paneldeki "Sıradan Ayrıl"
async function handleLeave(interaction) {
  if (!store.inQueue(interaction.guildId, interaction.user.id)) {
    return replyError(interaction, 'Şu an sırada değilsin.', 'Sıraya girmek için **Muhabbet Başlat** butonunu kullan.');
  }
  await interaction.deferReply({ flags: core.EPHEMERAL });
  store.dequeue(interaction.guildId, interaction.user.id);
  return respond(interaction, core.alert('Sıradan çıktın.', 'İstediğin zaman tekrar sıraya girebilirsin.', 'primary'));
}

// ── Oda açma / kapama ──────────────────────────────────────────────────────────

// Sırada iki kişi varsa en eski ikisini eşleştirir; odası olan ya da kanalı açılamayan üyeler sıradan düşer
async function matchPair(guild, skipUserId) {
  if (matching.has(guild.id)) return null;
  const queue = store.queueOf(guild.id);
  if (queue.length < 2) return null;

  matching.add(guild.id);
  const [first, second] = queue;
  try {
    store.dequeue(guild.id, first.userId);
    store.dequeue(guild.id, second.userId);
    const room = await openRoom(guild, [first.userId, second.userId]);
    if (!room) {
      for (const userId of [first.userId, second.userId]) {
        await dm(guild.client, userId, core.alert('Muhabbet odası açılamadı.', 'Bot bu sunucuda kanal oluşturamadı; yetkililerin kanal izinlerini kontrol etmesi gerekir.', 'danger'));
      }
      return null;
    }
    for (const userId of room.users) if (userId !== skipUserId) await dm(guild.client, userId, ui.matchedCard(room));
    yazLog(guild.client, {
      color: 'success',
      title: 'Muhabbet Odası Açıldı',
      lines: [
        `**Oda:** #${core.pad(room.no)}`,
        `**Üyeler:** ${room.users.map((id) => `<@${id}>`).join(', ')}`,
        `**Kanallar:** <#${room.voiceChannelId}> · <#${room.textChannelId}>`,
      ],
    });
    return room;
  } finally {
    matching.delete(guild.id);
  }
}

// Odanın iki kanalı açılır: @everyone göremez, yalnızca üyeler, bot ve ekip rolü görür
async function openRoom(guild, userIds) {
  const no = store.nextRoomNumber(guild.id);
  const name = `muhabbet-${core.pad(no)}`;
  const reason = `Muhabbet odası #${core.pad(no)}`;
  const overwrites = [
    { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
    { id: guild.members.me?.id ?? guild.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] },
    config.roles.team && { id: config.roles.team, allow: ['ViewChannel', 'Connect', 'SendMessages'] },
    ...userIds.map((id) => ({ id, allow: ['ViewChannel', 'Connect', 'SendMessages'] })),
  ].filter(Boolean);

  const voice = await guild.channels
    .create({ name, type: ChannelType.GuildVoice, parent: config.categoryId || undefined, userLimit: config.userLimit, permissionOverwrites: overwrites, reason })
    .catch(hata('Muhabbet odasının ses kanalı açılamadı'));
  if (!voice) return null;

  const text = await guild.channels
    .create({
      name,
      type: ChannelType.GuildText,
      parent: config.categoryId || undefined,
      permissionOverwrites: overwrites,
      topic: `Muhabbet odası #${core.pad(no)}`,
      reason,
    })
    .catch(hata('Muhabbet odasının yazı kanalı açılamadı'));
  if (!text) {
    await voice.delete().catch(() => {});
    return null;
  }

  const id = `${guild.id}-${no}`;
  const room = store.setRoom(id, {
    id,
    no,
    guildId: guild.id,
    users: userIds,
    voiceChannelId: voice.id,
    textChannelId: text.id,
    panelMessageId: null,
    emptySince: null,
    createdAt: Date.now(),
  });

  const panel = await text
    .send({ components: [ui.roomPanel(room)], flags: core.CV2, allowedMentions: { parse: [] } })
    .catch(hata('Muhabbet odası paneli gönderilemedi'));
  if (panel) store.updateRoom(id, { panelMessageId: panel.id });
  return room;
}

// Oda kaydı silinir, iki kanal kapatılır, üyelere bekleme konur ve durum loglanır
async function closeRoom(guild, room, reason) {
  if (closing.has(room.id)) return false;
  closing.add(room.id);

  try {
    store.deleteRoom(room.id);
    for (const key of ['voiceChannelId', 'textChannelId']) {
      const channel = await guild.channels.fetch(room[key]).catch(() => null);
      if (channel) await channel.delete(reason).catch(hata('Muhabbet odası kanalı silinemedi'));
    }
    for (const userId of room.users) store.setCooldown(guild.id, userId, config.requeueCooldownSeconds * 1000);
    for (const userId of room.users) await dm(guild.client, userId, ui.endedCard(room, reason));

    yazLog(guild.client, {
      color: 'warning',
      title: 'Muhabbet Odası Kapatıldı',
      lines: [
        `**Oda:** #${core.pad(room.no)}`,
        `**Üyeler:** ${room.users.map((id) => `<@${id}>`).join(', ')}`,
        `**Sebep:** ${reason}`,
      ],
    });
    return true;
  } finally {
    closing.delete(room.id);
  }
}

// Odanın kendi panelinde "Muhabbeti Bitir": sadece odadaki iki üye kullanabilir
async function handleEnd(interaction) {
  const room = store.roomOfChannel(interaction.channelId);
  if (!room) {
    return replyError(interaction, 'Burası bir muhabbet odası değil.', 'Panel yalnızca odanın kendi yazı kanalında çalışır.');
  }
  if (!room.users.includes(interaction.user.id)) {
    return replyError(interaction, 'Odayı sadece odadaki üyeler kapatabilir.', 'Yetkili isen /muhabbet kapat komutunu kullan.');
  }
  await interaction.deferUpdate();
  await closeRoom(interaction.guild, room, `${interaction.user.username} muhabbeti bitirdi.`);
}

// ── Yetkili komutları ──────────────────────────────────────────────────────────

const roomByNumber = (guild, no) => store.roomsOf(guild.id).find((r) => r.no === no) ?? null;

async function handleList(interaction) {
  return respond(interaction, ui.roomList(store.roomsOf(interaction.guildId), store.queueOf(interaction.guildId)));
}

async function handleClose(interaction) {
  const room = roomByNumber(interaction.guild, interaction.options.getInteger('no'));
  if (!room) return replyError(interaction, 'Bu numarada açık bir muhabbet odası yok.', '/muhabbet liste ile açık odaları görebilirsin.');

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const closed = await closeRoom(interaction.guild, room, interaction.options.getString('sebep') ?? 'Bir yetkili odayı kapattı.');
  if (!closed) return replyError(interaction, 'Oda kapatılamadı.', 'Oda zaten kapanmış olabilir, /muhabbet liste ile kontrol et.');
  return respond(interaction, core.alert(`Oda #${core.pad(room.no)} kapatıldı.`, 'İki üye bilgilendirildi, kanallar silindi.', 'success'));
}

async function handleClearQueue(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL });
  const removed = store.clearQueue(interaction.guildId);
  return respond(
    interaction,
    core.alert(
      removed.length ? `Sıra temizlendi, ${core.chip(`${removed.length} üye`)} sıradan çıkarıldı.` : 'Sırada bekleyen üye zaten yok.',
      'Çıkarılan üyeler istediği zaman tekrar sıraya girebilir.',
      'success',
    ),
  );
}

async function handleCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'liste') return handleList(interaction);
  if (sub === 'kapat') return handleClose(interaction);
  return handleClearQueue(interaction);
}

// ── Denetim turu ve açılış ─────────────────────────────────────────────────────

// Sırada çok bekleyenleri düşürür, boşalan ve süresi dolan odaları kapatır
async function sweep(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  for (const entry of store.queueOf(guild.id)) {
    if (Date.now() - entry.joinedAt <= config.queueTimeoutMinutes * MIN) continue;
    store.dequeue(guild.id, entry.userId);
    await dm(client, entry.userId, core.alert('Sıran doldu.', `Sırada ${config.queueTimeoutMinutes} dakikadan fazla bekledin; istediğin zaman tekrar girebilirsin.`, 'warning'));
  }

  for (const room of store.roomsOf(guild.id)) {
    const voice = await guild.channels.fetch(room.voiceChannelId).catch(() => null);
    if (!voice) {
      store.deleteRoom(room.id);
      continue;
    }
    const empty = (voice.members?.size ?? 0) === 0;
    if (!empty) {
      if (room.emptySince) store.updateRoom(room.id, { emptySince: null });
    } else if (!room.emptySince) {
      store.updateRoom(room.id, { emptySince: Date.now() });
    } else if (Date.now() - room.emptySince >= config.idleCloseMinutes * MIN) {
      await closeRoom(guild, room, `Ses kanalında ${config.idleCloseMinutes} dakikadır kimse kalmadı.`);
      continue;
    }
    if (Date.now() - room.createdAt >= config.maxRoomMinutes * MIN) {
      await closeRoom(guild, room, `Odanın en uzun süresi olan ${config.maxRoomMinutes} dakika doldu.`);
    }
  }
}

// Bot kapalıyken silinmiş oda kanallarının kaydını temizler, denetim turunu başlatır ve paneli gönderir
async function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (guild) {
    for (const room of store.roomsOf(guild.id)) {
      const voice = await guild.channels.fetch(room.voiceChannelId).catch(() => null);
      if (!voice) {
        store.deleteRoom(room.id);
        continue;
      }
      // Bot kapalıyken oda boşalmışsa boşalma anı açılışta not edilir; üye girmezse tur oda kapanır
      if ((voice.members?.size ?? 0) === 0 && !room.emptySince) store.updateRoom(room.id, { emptySince: Date.now() });
    }
  }

  if (!sweeper) sweeper = setInterval(() => sweep(client), config.checkSeconds * 1000).unref();

  if (!config.channels.panel) return undefined;
  return syncPanel(client, {
    key: 'muhabbet',
    label: 'Muhabbet odası sırası',
    channelId: config.channels.panel,
    buttonId: ui.IDS.start,
    build: () => ui.queuePanel(),
    image: '',
  });
}

// Kanallardan biri elle silinirse oda kapanmış sayılır: kalan kanal da silinir, kayıt düşürülür
async function handleChannelDelete(channel) {
  const room = store.roomOfChannel(channel.id);
  if (!room) return;
  store.deleteRoom(room.id);
  for (const key of ['voiceChannelId', 'textChannelId']) {
    if (room[key] === channel.id) continue;
    const leftover = await channel.guild.channels.fetch(room[key]).catch(() => null);
    if (leftover) await leftover.delete('Muhabbet odası kapandı').catch(() => {});
  }
}

// Üye sunucudan ayrılırsa sıradan düşer, odası varsa oda kapanır
async function handleMemberRemove(member) {
  if (member.guild.id !== guildId) return;
  store.dequeue(member.guild.id, member.id);
  const room = store.roomOfUser(member.guild.id, member.id);
  if (room) await closeRoom(member.guild, room, 'Odadaki üyelerden biri sunucudan ayrıldı.');
}

module.exports = {
  name: 'muhabbet',
  commands,
  help: {
    category: ['oda', 'Odalar'],
    access: {
      'muhabbet liste': 'Yöneticiler',
      'muhabbet kapat': 'Yöneticiler',
      'muhabbet sirayi-temizle': 'Yöneticiler',
    },
    need: {
      'muhabbet liste': 'Yöneticiler',
      'muhabbet kapat': 'Yöneticiler',
      'muhabbet sirayi-temizle': 'Yöneticiler',
    },
  },
  slash: { muhabbet: handleCommand },
  buttons: {
    [ui.IDS.start]: handleStart,
    [ui.IDS.leave]: handleLeave,
    [ui.IDS.end]: handleEnd,
  },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.ChannelDelete]: handleChannelDelete,
    [Events.GuildMemberRemove]: handleMemberRemove,
  },
};
