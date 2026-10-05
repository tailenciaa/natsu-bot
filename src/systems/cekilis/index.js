// Çekiliş sistemi: /cekilis baslat ile ödüllü çekiliş açılır; çekiliş mesajındaki butona basan üye katılır (tekrar
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
const UNITS = { dk: 1, dakika: 1, sa: 60, saat: 60, g: 60 * 24, gun: 60 * 24, gün: 60 * 24, hf: 60 * 24 * 7, hafta: 60 * 24 * 7 };
const DURATION_HINT = 'Şöyle yaz: 30 dakika, 2 saat, 1 gün ya da 1 hafta (en az 1 dakika, en fazla 30 gün).';

const commands = [
  new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Çekiliş sistemini yönetir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('baslat')
        .setDescription('Yeni bir çekiliş başlatır; ödül, süre ve kazanan sayısı açılan formda girilir.')
        .addChannelOption((o) =>
          o.setName('kanal').setDescription('Çekilişin gönderileceği kanalı seçer.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
        )
        .addRoleOption((o) => o.setName('rol').setDescription('Katılmak için gereken rolü seçer, boş bırakırsan herkes katılır.')),
    )
    .addSubcommand((s) =>
      s
        .setName('bitir')
        .setDescription('Açık bir çekilişi süresini beklemeden hemen sonuçlandırır.')
        .addIntegerOption((o) => o.setName('no').setDescription('Çekiliş numarasını girer.').setMinValue(1).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('yeniden-cek')
        .setDescription('Biten bir çekilişte yeniden kazanan seçer.')
        .addIntegerOption((o) => o.setName('no').setDescription('Çekiliş numarasını girer.').setMinValue(1).setRequired(true))
        .addIntegerOption((o) => o.setName('kazanan').setDescription('Yeni seçilecek kazanan sayısını girer, boş bırakırsan 1 seçilir.').setMinValue(1).setMaxValue(20)),
    )
    .addSubcommand((s) =>
      s
        .setName('iptal')
        .setDescription('Açık bir çekilişi kazanan seçmeden iptal eder.')
        .addIntegerOption((o) => o.setName('no').setDescription('Çekiliş numarasını girer.').setMinValue(1).setRequired(true)),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Açık ve yeni biten çekilişleri listeler.')),
];

// "30 dakika", "2 saat", "1 gün", "1 hafta" (ya da kısaca 30dk, 2sa, 1g, 1hf) -> dakika; geçersizse null
function parseMinutes(input) {
  const match = /^(\d{1,4})\s*(dakika|dk|saat|sa|gün|gun|g|hafta|hf)$/i.exec(input.trim());
  const unit = match ? UNITS[match[2].toLowerCase()] : null;
  return unit ? Number(match[1]) * unit : null;
}

// ── Mesajı güncelleme ───────────────────────────────────────────────────────────

async function fetchPanel(client, g) {
  const channel = await fetchTextChannel(client.guilds.cache.get(guildId), g.channelId);
  const message = channel && g.messageId ? await channel.messages.fetch(g.messageId).catch(() => null) : null;
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
    // Çekiliş kaydı açılıp mesajı hiç gönderilemediyse (süreç aradan çöktü) kayıt iptal edilir
    if (!g.messageId) {
      g.status = 'cancelled';
      store.save();
      continue;
    }
    if (g.endsAt > Date.now()) continue;
    await finish(client, g).catch((err) => console.error(`[cekilis] #${g.no} sonuçlandırılamadı:`, err.message));
  }
}

// ── Komutlar ────────────────────────────────────────────────────────────────────

const maxActiveError = (interaction) =>
  replyError(interaction, `En fazla ${config.maxActive} çekiliş aynı anda açık olabilir.`, 'Yeni çekiliş açmak için birini bitir ya da iptal et.');

// /cekilis baslat: kanal ve rol kontrol edilip bilgilerin girileceği form açılır
async function start(interaction) {
  if (store.active().length >= config.maxActive) return maxActiveError(interaction);
  const target = interaction.options.getChannel('kanal') ?? (config.channel ? await fetchTextChannel(interaction.guild, config.channel) : null);
  if (!target) return replyError(interaction, 'Çekiliş kanalı seçilmedi.', 'Komutta "kanal" seçeneğiyle çekilişin gönderileceği kanalı seç.');
  if (!target.permissionsFor(interaction.guild.members.me)?.has(['ViewChannel', 'SendMessages'])) {
    return replyError(interaction, 'Botun bu kanala mesaj gönderme yetkisi yok.', 'Botun kanalı görme ve mesaj gönderme izni olmalı, ya da komutta başka bir kanal seç.');
  }
  return interaction.showModal(ui.createModal(target.id, interaction.options.getRole('rol')?.id));
}

// Form gönderilince çekiliş oluşturulup kanala gönderilir
async function create(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu formu sadece yöneticiler kullanabilir.');
  const [, channelId, rawRole] = interaction.customId.split(':');
  const roleId = rawRole && rawRole !== '0' ? rawRole : null;
  const field = (id) => interaction.fields.getTextInputValue(id).trim();

  const prize = field('odul');
  const winnerCount = Number(field('kazanan'));
  const minutes = parseMinutes(field('sure'));
  if (!prize) return replyError(interaction, 'Ödül boş olamaz.', 'Ödül alanına bir ad yaz.');
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) return replyError(interaction, 'Kazanan sayısı 1 ile 20 arasında olmalı.', 'Kazanan sayısına tam sayı yaz.');
  if (!minutes || minutes < config.minMinutes || minutes > config.maxMinutes) return replyError(interaction, 'Süre anlaşılamadı.', DURATION_HINT);
  if (store.active().length >= config.maxActive) return maxActiveError(interaction);
  const target = await fetchTextChannel(interaction.guild, channelId);
  if (!target) return replyError(interaction, 'Çekiliş kanalı bulunamadı.', 'Komutu tekrar çalıştırıp başka bir kanal seçebilirsin.');

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const g = store.create({
    channelId: target.id,
    messageId: null,
    prize,
    description: field('aciklama') || null,
    winnerCount,
    endsAt: Date.now() + minutes * 60 * 1000,
    hostId: interaction.user.id,
    roleId,
  });

  // Duyuru etiketi çekiliş mesajının üst satırı olarak gider (aynı mesaj, tek bildirim); sonraki güncellemelerde satır kalkar.
  // Test modunda (ping.enabled false) hiç etiket atılmaz.
  const { ping } = config;
  const pingParts = ping.enabled ? [ping.roleId && `<@&${ping.roleId}>`, ping.everyone && '@everyone', ping.here && '@here'].filter(Boolean) : [];
  const message = await target
    .send({
      components: [...(pingParts.length ? [core.text(pingParts.join(' '))] : []), ui.panel(g)],
      flags: core.CV2,
      allowedMentions: pingParts.length
        ? { parse: ping.everyone || ping.here ? ['everyone'] : [], roles: ping.roleId ? [ping.roleId] : [] }
        : { parse: [] },
    })
    .catch((err) => {
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
      `${target.toString()} kanalına gönderildi, bitiş <t:${core.unix(g.endsAt)}:R>. ${pingParts.length ? 'Duyuru etiketi atıldı.' : 'Duyuru etiketi kapalı, kimse etiketlenmedi.'}`,
      'success',
    ),
  );
}

async function getGiveaway(interaction) {
  const g = store.get(interaction.options.getInteger('no', true));
  if (!g) await replyError(interaction, 'Bu numarada bir çekiliş bulunamadı.', 'Açık ve yeni biten çekilişleri /cekilis liste ile görebilirsin.');
  return g;
}

async function end(interaction) {
  const g = await getGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Bu çekiliş zaten sonuçlanmış ya da iptal edilmiş.', 'Sonuçlanmış çekilişte /cekilis yeniden-cek ile yeni kazanan seçebilirsin.');
  await interaction.deferReply({ flags: core.EPHEMERAL });
  if (!(await finish(interaction.client, g))) return respond(interaction, core.alert('Çekiliş zaten sonuçlanıyor.', 'Birkaç saniye sonra çekiliş mesajına bakabilirsin.', 'warning'));
  return respond(interaction, core.alert(`Çekiliş #${g.no} sonuçlandırıldı.`, g.winners.length ? 'Kazananlar çekiliş kanalında duyuruldu.' : ui.noWinnerReason(g), 'success'));
}

async function reroll(interaction) {
  const g = await getGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'ended') return replyError(interaction, 'Yeniden çekiliş sadece sonuçlanmış çekilişlerde yapılabilir.', 'Açık bir çekilişi önce /cekilis bitir ile sonuçlandır.');
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
  g.endsAt = Math.min(g.endsAt, Date.now()); // kayıt temizliği bitiş tarihine göre yapılır
  store.save();
  await refreshPanel(client, g);
}

async function cancel(interaction) {
  const g = await getGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Sadece açık çekilişler iptal edilebilir.', 'Biten bir çekilişte /cekilis yeniden-cek ile yeni kazanan seçebilirsin.');
  await cancelGiveaway(interaction.client, g);
  return respond(interaction, core.alert(`Çekiliş #${g.no} iptal edildi.`, undefined, 'success'));
}

async function list(interaction) {
  const url = (g) => core.messageUrl(guildId, g.channelId, g.messageId);
  const active = store.active().map((g) => `**#${g.no} ${g.prize}**\n**Kanal:** <#${g.channelId}>\n**Bitiş:** <t:${core.unix(g.endsAt)}:R>\n**Katılımcı:** ${g.participants.length}\n[Çekilişe git](${url(g)})`);
  const ended = store.recentEnded().map((g) => `**#${g.no} ${g.prize}:** ${g.winners.length ? g.winners.map((id) => `<@${id}>`).join(', ') : 'kazanan yok'}`);
  return respond(
    interaction,
    core.page({
      title: 'Çekilişler',
      sub: 'Şu an açık olan çekilişleri ve yeni bitenleri görüyorsun; bitenlerde /cekilis yeniden-cek komutuyla numarasını yazarak yeni kazanan seçebilirsin.',
      blocks: [
        ...(active.length ? active : ['**Şu an açık çekiliş yok.**']),
        ended.length ? `**Son Biten Çekilişler**\n${ended.join('\n')}` : null,
      ],
    }),
  );
}

async function handleCommand(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu komutu sadece yöneticiler kullanabilir.');
  const sub = interaction.options.getSubcommand();
  if (sub === 'baslat') return start(interaction);
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

async function adminGiveaway(interaction) {
  if (!isStaff(interaction)) {
    await replyError(interaction, 'Bu butonu sadece yöneticiler kullanabilir.');
    return null;
  }
  const g = store.byMessage(interaction.message.id);
  if (!g) await replyError(interaction, 'Bu çekilişin kaydı bulunamadı.', 'Kayıtlar bitiş tarihinden 30 gün sonra silinir.');
  return g;
}

async function handleEditButton(interaction) {
  const g = await adminGiveaway(interaction);
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
  if (!prize) return replyError(interaction, 'Ödül boş olamaz.', 'Ödül alanına bir ad yaz.');
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 20) return replyError(interaction, 'Kazanan sayısı 1 ile 20 arasında olmalı.', 'Kazanan sayısına tam sayı yaz.');
  let endsAt = g.endsAt;
  if (duration) {
    const minutes = parseMinutes(duration);
    if (!minutes || minutes < config.minMinutes || minutes > config.maxMinutes) return replyError(interaction, 'Süre anlaşılamadı.', DURATION_HINT);
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
  const g = await adminGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Bu çekiliş zaten sonuçlanmış ya da iptal edilmiş.');
  return interaction.reply({ components: [ui.confirm('bitir', g)], flags: core.EPHEMERAL_CV2 });
}

async function handleCancelButton(interaction) {
  const g = await adminGiveaway(interaction);
  if (!g) return;
  if (g.status !== 'active') return replyError(interaction, 'Sadece açık çekilişler iptal edilebilir.');
  return interaction.reply({ components: [ui.confirm('iptal', g)], flags: core.EPHEMERAL_CV2 });
}

async function handleConfirm(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu butonu sadece yöneticiler kullanabilir.');
  const [, action, no] = interaction.customId.split(':');
  const g = store.get(Number(no));
  if (!g || g.status !== 'active') return interaction.update({ components: [core.alert('Bu çekiliş artık açık değil.', undefined, 'danger')] });
  if (action !== 'bitir' && action !== 'iptal') return interaction.deferUpdate();
  await interaction.deferUpdate();
  if (action === 'bitir') {
    if (!(await finish(interaction.client, g))) return interaction.editReply({ components: [core.alert('Çekiliş zaten sonuçlanıyor.', 'Birkaç saniye sonra çekiliş mesajına bakabilirsin.', 'warning')] });
  } else {
    await cancelGiveaway(interaction.client, g);
  }
  return interaction.editReply({ components: [core.alert(action === 'bitir' ? `Çekiliş #${g.no} sonuçlandırıldı.` : `Çekiliş #${g.no} iptal edildi.`, undefined, 'success')] });
}

async function handleRerollButton(interaction) {
  const g = await adminGiveaway(interaction);
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
      'cekilis baslat': 'Yöneticiler',
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
    [ui.IDS.create, create],
  ],
  events: {
    [Events.ClientReady]: (client) => {
      sweep(client);
      setInterval(() => sweep(client), config.checkSeconds * 1000).unref();
    },
  },
};
