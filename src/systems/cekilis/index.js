// Çekiliş sistemi: /cekilis olustur ile ödüllü çekiliş açılır; çekiliş mesajındaki butona basan üye katılır (tekrar
// basınca ayrılma seçeneği çıkar). Süre dolunca bot katılanlar arasından rastgele kazananları seçer, mesajı günceller ve
// kazananları aynı kanalda duyurur. Sunucudan ayrılmış üyeler ve botlar kazanamaz. Bitiş her 15 saniyede kontrol edilir,
// bot kapalıyken süresi dolan çekilişler açılışta hemen sonuçlanır. Duyuru etiketi (rol, @everyone, @here) config.js'teki
// ping ayarına bağlıdır; kapalıyken (test) hiç etiket atılmaz.
// Komutlar sadece yöneticilerindir ve her kanalda kullanılabilir.
const { ChannelType, Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isStaff, fetchTextChannel } = require('../../core/helpers');
const logSystem = require('../log');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const ending = new Set(); // aynı anda iki kez sonuçlanmasın
const UNITS = { dk: 1, sa: 60, g: 60 * 24, hf: 60 * 24 * 7 };

const commands = [
  new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Çekiliş sistemini yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('olustur')
        .setDescription('Yeni bir çekiliş başlatır.')
        .addStringOption((o) => o.setName('odul').setDescription('Çekilişin ödülü').setMaxLength(100).setRequired(true))
        .addStringOption((o) => o.setName('sure').setDescription('Süre: 30dk, 2sa, 1g, 1hf (dakika, saat, gün, hafta)').setRequired(true))
        .addStringOption((o) => o.setName('aciklama').setDescription('Çekilişle ilgili kısa açıklama (isteğe bağlı)').setMaxLength(300))
        .addIntegerOption((o) => o.setName('kazanan').setDescription('Kazanan sayısı (varsayılan 1)').setMinValue(1).setMaxValue(20))
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Çekilişin gönderileceği kanal').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addRoleOption((o) => o.setName('rol').setDescription('Katılmak için gereken rol (isteğe bağlı)')),
    )
    .addSubcommand((s) =>
      s
        .setName('bitir')
        .setDescription('Açık bir çekilişi süresini beklemeden hemen sonuçlandırır.')
        .addIntegerOption((o) => o.setName('no').setDescription('Çekiliş numarası').setMinValue(1).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('yeniden-cek')
        .setDescription('Biten bir çekilişte yeniden kazanan seçer.')
        .addIntegerOption((o) => o.setName('no').setDescription('Çekiliş numarası').setMinValue(1).setRequired(true))
        .addIntegerOption((o) => o.setName('kazanan').setDescription('Yeni seçilecek kazanan sayısı (varsayılan 1)').setMinValue(1).setMaxValue(20)),
    )
    .addSubcommand((s) =>
      s
        .setName('iptal')
        .setDescription('Açık bir çekilişi kazanan seçmeden iptal eder.')
        .addIntegerOption((o) => o.setName('no').setDescription('Çekiliş numarası').setMinValue(1).setRequired(true)),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Açık çekilişleri listeler.')),
];

// "30dk", "2sa", "1g", "1hf" -> dakika; geçersizse null
function parseMinutes(input) {
  const match = /^(\d{1,4})\s*(dk|sa|g|hf)$/i.exec(input.trim());
  return match ? Number(match[1]) * UNITS[match[2].toLowerCase()] : null;
}

// ── Mesajı güncelleme ───────────────────────────────────────────────────────────

async function fetchPanel(client, g) {
  const channel = await fetchTextChannel(client.guilds.cache.get(guildId), g.channelId);
  const message = channel ? await channel.messages.fetch(g.messageId).catch(() => null) : null;
  return { channel, message };
}

async function refreshPanel(client, g) {
  const { message } = await fetchPanel(client, g);
  if (message) await message.edit({ components: [ui.panel(g)], allowedMentions: { parse: [] } }).catch((err) => console.error('[cekilis] Mesaj güncellenemedi:', err.message));
}

// ── Kazanan seçme ───────────────────────────────────────────────────────────────

// Katılanlar arasından, hâlâ sunucuda olan ve bot olmayan, daha önce kazanmamış üyelerden rastgele seçer
async function pickWinners(guild, g, count) {
  const pool = g.participants.filter((id) => !g.winners.includes(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = [];
  for (const id of pool) {
    if (picked.length >= count) break;
    const member = await guild.members.fetch(id).catch(() => null);
    if (member && !member.user.bot) picked.push(id);
  }
  return picked;
}

async function announce(client, g, ids, reroll) {
  const { channel, message } = await fetchPanel(client, g);
  if (!channel) return;
  const payload = ids.length
    ? { components: [ui.winners(g, ids, reroll)], flags: core.CV2, allowedMentions: { users: ids } }
    : { components: [ui.noWinner(g)], flags: core.CV2, allowedMentions: { parse: [] } };
  if (message) payload.reply = { messageReference: message.id, failIfNotExists: false };
  await channel.send(payload).catch((err) => console.error('[cekilis] Duyuru gönderilemedi:', err.message));
}

async function finish(client, g) {
  if (g.status !== 'active' || ending.has(g.no)) return false;
  ending.add(g.no);
  try {
    const guild = client.guilds.cache.get(guildId);
    g.winners = await pickWinners(guild, g, g.winnerCount);
    g.status = 'ended';
    g.endsAt = Math.min(g.endsAt, Date.now());
    store.save();
    await refreshPanel(client, g);
    await announce(client, g, g.winners, false);
    logSystem
      .write(client, 'bot', {
        color: 'success',
        title: 'Çekiliş Sonuçlandı',
        lines: [`**Çekiliş:** #${g.no} ${g.prize}`, `**Katılımcı sayısı:** ${g.participants.length}`, `**Kazananlar:** ${g.winners.length ? g.winners.map((id) => `<@${id}>`).join(', ') : 'yok'}`],
      })
      .catch(() => {});
    return true;
  } finally {
    ending.delete(g.no);
  }
}

async function sweep(client) {
  for (const g of store.active()) {
    if (g.endsAt > Date.now()) continue;
    await finish(client, g).catch((err) => console.error(`[cekilis] #${g.no} sonuçlandırılamadı:`, err.message));
  }
}

// ── Komutlar ────────────────────────────────────────────────────────────────────

async function create(interaction) {
  const minutes = parseMinutes(interaction.options.getString('sure', true));
  if (!minutes || minutes < config.minMinutes || minutes > config.maxMinutes) {
    return replyError(interaction, 'Süre anlaşılamadı.', 'Şöyle yaz: 30dk, 2sa, 1g ya da 1hf (en az 1 dakika, en fazla 30 gün).');
  }
  if (store.active().length >= config.maxActive) return replyError(interaction, `En fazla ${config.maxActive} çekiliş aynı anda açık olabilir.`);

  const target = interaction.options.getChannel('kanal') ?? (config.channel ? await fetchTextChannel(interaction.guild, config.channel) : null);
  if (!target) return replyError(interaction, 'Çekiliş kanalı seçilmedi.', 'Komutta "kanal" seçeneğiyle çekilişin gönderileceği kanalı seç.');
  if (!target.permissionsFor(interaction.guild.members.me)?.has(['ViewChannel', 'SendMessages'])) {
    return replyError(interaction, 'Botun bu kanala mesaj gönderme yetkisi yok.');
  }

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const role = interaction.options.getRole('rol');
  const g = store.create({
    channelId: target.id,
    messageId: null,
    prize: interaction.options.getString('odul', true).trim(),
    description: interaction.options.getString('aciklama')?.trim() || null,
    winnerCount: interaction.options.getInteger('kazanan') ?? 1,
    endsAt: Date.now() + minutes * 60 * 1000,
    hostId: interaction.user.id,
    roleId: role?.id ?? null,
  });

  const message = await target.send({ components: [ui.panel(g)], flags: core.CV2, allowedMentions: { parse: [] } }).catch((err) => {
    console.error('[cekilis] Çekiliş mesajı gönderilemedi:', err.message);
    return null;
  });
  if (!message) {
    g.status = 'cancelled';
    store.save();
    return replyError(interaction, 'Çekiliş mesajı gönderilemedi.', 'Botun kanaldaki yetkilerini kontrol et.');
  }
  g.messageId = message.id;
  store.save();

  // Duyuru etiketi ayrı bir mesajdır (bileşenli mesajlara metin eklenemez); test modunda atılmaz
  const { ping } = config;
  let pinged = false;
  if (ping.enabled) {
    const parts = [ping.roleId && `<@&${ping.roleId}>`, ping.everyone && '@everyone', ping.here && '@here'].filter(Boolean);
    pinged = Boolean(
      await target
        .send({ content: parts.join(' '), allowedMentions: { parse: ping.everyone || ping.here ? ['everyone'] : [], roles: ping.roleId ? [ping.roleId] : [] } })
        .catch(() => null),
    );
  }

  logSystem
    .write(interaction.client, 'bot', {
      color: 'primary',
      title: 'Çekiliş Başlatıldı',
      lines: [`**Çekiliş:** #${g.no} ${g.prize}`, `**Düzenleyen:** <@${interaction.user.id}>`, `**Kanal:** <#${target.id}>`, `**Kazanan sayısı:** ${g.winnerCount}`],
    })
    .catch(() => {});

  return respond(
    interaction,
    core.alert(
      `Çekiliş #${g.no} başlatıldı.`,
      `${target.toString()} kanalına gönderildi, bitiş <t:${core.unix(g.endsAt)}:R>. ${pinged ? 'Etiket mesajı atıldı.' : 'Etiket mesajı kapalı (test modu), kimse etiketlenmedi.'}`,
      'success',
    ),
  );
}

function getGiveaway(interaction) {
  const g = store.get(interaction.options.getInteger('no', true));
  if (!g) replyError(interaction, 'Bu numarada bir çekiliş bulunamadı.', 'Açık çekilişleri /cekilis liste ile görebilirsin.');
  return g;
}

async function end(interaction) {
  const g = getGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Bu çekiliş zaten sonuçlanmış ya da iptal edilmiş.');
  await interaction.deferReply({ flags: core.EPHEMERAL });
  await finish(interaction.client, g);
  return respond(interaction, core.alert(`Çekiliş #${g.no} sonuçlandırıldı.`, g.winners.length ? 'Kazananlar çekiliş kanalında duyuruldu.' : 'Katılan olmadığı için kazanan seçilemedi.', 'success'));
}

async function reroll(interaction) {
  const g = getGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'ended') return replyError(interaction, 'Yeniden çekiliş sadece sonuçlanmış çekilişlerde yapılabilir.');
  await interaction.deferReply({ flags: core.EPHEMERAL });
  const ids = await pickWinners(interaction.guild, g, interaction.options.getInteger('kazanan') ?? 1);
  if (!ids.length) return respond(interaction, core.alert('Seçilecek başka katılımcı kalmadı.', 'Tüm uygun katılımcılar zaten kazandı ya da sunucudan ayrıldı.', 'warning'));
  g.winners.push(...ids);
  store.save();
  await refreshPanel(interaction.client, g);
  await announce(interaction.client, g, ids, true);
  return respond(interaction, core.alert(`Çekiliş #${g.no} için yeni kazanan seçildi.`, undefined, 'success'));
}

async function cancelGiveaway(client, g) {
  g.status = 'cancelled';
  store.save();
  await refreshPanel(client, g);
}

async function cancel(interaction) {
  const g = getGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Sadece açık çekilişler iptal edilebilir.');
  await cancelGiveaway(interaction.client, g);
  return respond(interaction, core.alert(`Çekiliş #${g.no} iptal edildi.`, undefined, 'success'));
}

async function list(interaction) {
  const active = store.active();
  const body = active.length
    ? active.map((g) => `- **#${g.no} ${g.prize}:** <#${g.channelId}>, bitiş <t:${core.unix(g.endsAt)}:R>, ${g.participants.length} katılımcı`).join('\n')
    : 'Şu an açık çekiliş yok.';
  return respond(
    interaction,
    core.page({
      title: 'Açık Çekilişler',
      sub: 'Şu anda devam eden çekilişlerin numarasını, ödülünü, kanalını, bitiş zamanını ve katılımcı sayısını burada görebilirsin; numarayı diğer çekiliş komutlarında kullanabilirsin.',
      blocks: [body],
    }),
  );
}

async function handleCommand(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu komutu sadece yöneticiler kullanabilir.');
  const sub = interaction.options.getSubcommand();
  if (sub === 'olustur') return create(interaction);
  if (sub === 'bitir') return end(interaction);
  if (sub === 'yeniden-cek') return reroll(interaction);
  if (sub === 'iptal') return cancel(interaction);
  return list(interaction);
}

// ── Katılım ─────────────────────────────────────────────────────────────────────

async function handleJoin(interaction) {
  const g = store.byMessage(interaction.message.id);
  if (!g || g.status !== 'active') return replyError(interaction, 'Bu çekiliş artık açık değil.');
  if (g.endsAt <= Date.now()) return replyError(interaction, 'Bu çekilişin süresi doldu.', 'Kazananlar birazdan duyurulacak.');
  if (g.roleId && !interaction.member.roles.cache.has(g.roleId)) {
    return replyError(interaction, 'Bu çekilişe katılmak için gereken role sahip değilsin.', `Gerekli rol: <@&${g.roleId}>`);
  }
  if (g.participants.includes(interaction.user.id)) {
    return interaction.reply({ components: [ui.joined(g)], flags: core.EPHEMERAL_CV2, allowedMentions: { parse: [] } });
  }
  g.participants.push(interaction.user.id);
  store.save();
  // Butondaki sayı güncellenir; katılana ayrıca cevap verilmez
  return interaction.update({ components: [ui.panel(g)], allowedMentions: { parse: [] } });
}

async function handleLeave(interaction) {
  const g = store.get(Number(interaction.customId.split(':')[1]));
  if (!g || g.status !== 'active') return interaction.update({ components: [core.alert('Bu çekiliş artık açık değil.', undefined, 'danger')] });
  g.participants = g.participants.filter((id) => id !== interaction.user.id);
  store.save();
  await interaction.update({ components: [core.alert('Çekilişten ayrıldın.', 'İstersen çekiliş mesajındaki butondan tekrar katılabilirsin.', 'success')] });
  await refreshPanel(interaction.client, g);
}

// ── Çekiliş mesajındaki yönetim butonları (sadece yöneticiler) ───────────────────

function adminGiveaway(interaction) {
  if (!isStaff(interaction)) {
    replyError(interaction, 'Bu butonu sadece yöneticiler kullanabilir.');
    return null;
  }
  const g = store.byMessage(interaction.message.id);
  if (!g) replyError(interaction, 'Bu çekilişin kaydı bulunamadı.');
  return g;
}

async function handleEditButton(interaction) {
  const g = adminGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Sadece açık çekilişler düzenlenebilir.');
  return interaction.showModal(ui.editModal(g));
}

async function handleEditSubmit(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu formu sadece yöneticiler kullanabilir.');
  const g = store.get(Number(interaction.customId.split(':')[1]));
  if (!g || g.status !== 'active') return replyError(interaction, 'Bu çekiliş artık açık değil.');

  const prize = interaction.fields.getTextInputValue('odul').trim();
  const description = interaction.fields.getTextInputValue('aciklama').trim();
  const winnerCount = Number(interaction.fields.getTextInputValue('kazanan').trim());
  const duration = interaction.fields.getTextInputValue('sure').trim();
  if (!prize) return replyError(interaction, 'Ödül boş olamaz.');
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) return replyError(interaction, 'Kazanan sayısı 1 ile 20 arasında olmalı.');
  let endsAt = g.endsAt;
  if (duration) {
    const minutes = parseMinutes(duration);
    if (!minutes || minutes < config.minMinutes || minutes > config.maxMinutes) {
      return replyError(interaction, 'Süre anlaşılamadı.', 'Şöyle yaz: 30dk, 2sa, 1g ya da 1hf (en az 1 dakika, en fazla 30 gün).');
    }
    endsAt = Date.now() + minutes * 60 * 1000;
  }

  Object.assign(g, { prize, description: description || null, winnerCount, endsAt });
  store.save();
  // Form çekiliş mesajındaki butondan açıldığı için mesaj doğrudan güncellenir
  if (interaction.isFromMessage()) return interaction.update({ components: [ui.panel(g)], allowedMentions: { parse: [] } });
  await refreshPanel(interaction.client, g);
  return respond(interaction, core.alert('Çekiliş güncellendi.', undefined, 'success'));
}

async function handleEndButton(interaction) {
  const g = adminGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Bu çekiliş zaten sonuçlanmış ya da iptal edilmiş.');
  return interaction.reply({ components: [ui.confirm('bitir', g)], flags: core.EPHEMERAL_CV2 });
}

async function handleCancelButton(interaction) {
  const g = adminGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Sadece açık çekilişler iptal edilebilir.');
  return interaction.reply({ components: [ui.confirm('iptal', g)], flags: core.EPHEMERAL_CV2 });
}

async function handleConfirm(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu butonu sadece yöneticiler kullanabilir.');
  const [, action, no] = interaction.customId.split(':');
  const g = store.get(Number(no));
  if (!g || g.status !== 'active') return interaction.update({ components: [core.alert('Bu çekiliş artık açık değil.', undefined, 'danger')] });
  await interaction.deferUpdate();
  if (action === 'bitir') await finish(interaction.client, g);
  else await cancelGiveaway(interaction.client, g);
  return interaction.editReply({ components: [core.alert(action === 'bitir' ? `Çekiliş #${g.no} sonuçlandırıldı.` : `Çekiliş #${g.no} iptal edildi.`, undefined, 'success')] });
}

async function handleRerollButton(interaction) {
  const g = adminGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'ended') return replyError(interaction, 'Yeniden çekiliş sadece sonuçlanmış çekilişlerde yapılabilir.');
  await interaction.deferReply({ flags: core.EPHEMERAL });
  const ids = await pickWinners(interaction.guild, g, 1);
  if (!ids.length) return respond(interaction, core.alert('Seçilecek başka katılımcı kalmadı.', 'Tüm uygun katılımcılar zaten kazandı ya da sunucudan ayrıldı.', 'warning'));
  g.winners.push(...ids);
  store.save();
  await refreshPanel(interaction.client, g);
  await announce(interaction.client, g, ids, true);
  return respond(interaction, core.alert(`Çekiliş #${g.no} için yeni kazanan seçildi.`, undefined, 'success'));
}

module.exports = {
  name: 'cekilis',
  commands,
  help: {
    category: ['cekilis', 'Çekiliş'],
    access: {
      'cekilis olustur': 'Yöneticiler',
      'cekilis bitir': 'Yöneticiler',
      'cekilis yeniden-cek': 'Yöneticiler',
      'cekilis iptal': 'Yöneticiler',
      'cekilis liste': 'Yöneticiler',
    },
  },
  slash: { cekilis: handleCommand },
  buttons: {
    [ui.IDS.join]: handleJoin,
    [ui.IDS.edit]: handleEditButton,
    [ui.IDS.end]: handleEndButton,
    [ui.IDS.cancel]: handleCancelButton,
    [ui.IDS.reroll]: handleRerollButton,
  },
  prefixed: [
    [ui.IDS.leave, handleLeave],
    [ui.IDS.confirm, handleConfirm],
    [ui.IDS.form, handleEditSubmit],
  ],
  events: {
    [Events.ClientReady]: (client) => {
      sweep(client);
      setInterval(() => sweep(client), config.checkSeconds * 1000).unref();
    },
  },
};
