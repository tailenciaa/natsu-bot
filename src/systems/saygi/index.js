// Saygınlık sistemi: üyeler birbirine günde bir kez +1 saygınlık verebilir (/saygi-ver ya da bir mesajda "+rep
// @kullanıcı" yazarak), tüm zamanların toplam tablosu /saygi-siralama ile görülebilir. Her hafta pazartesi, geçen
// haftanın en çok saygınlık kazanan üyesi ayarlı kanala duyurulur ve ayarlı rol verilir (önceki haftanın sahibinden
// geri alınır). /saygi-onizleme bu haftanın şu anki durumunu gösterir, rol vermez, duyuru atmaz.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, fetchTextChannel } = require('../../core/helpers');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { weekKey, previousWeekKey, isMonday } = require('../aktif/week');

const commands = [
  new SlashCommandBuilder()
    .setName('saygi-ver')
    .setDescription('Bir üyeye +1 saygınlık verir (günde bir kez kullanılabilir).')
    .addUserOption((opt) => opt.setName('kullanici').setDescription('Saygınlık vereceğin üye').setRequired(true))
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('saygi-siralama')
    .setDescription('Tüm zamanların saygınlık tablosunu gösterir.')
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('saygi-onizleme')
    .setDescription('Bu haftanın şu anki saygınlık sıralamasını önizler (test amaçlı, rol vermez, duyuru atmaz).')
    .setContexts(InteractionContextType.Guild),
];

const CHECK_INTERVAL = 15 * 60 * 1000;
// "+rep" ile başlayan mesajlarda tetiklenir (örn: "+rep @kullanıcı")
const REP_TRIGGER = /^\+rep\b/i;

// O haftanın/tüm zamanların toplamlarından en yüksekten düşüğe ilk N kullanıcıyı listeler
function topUsers(totals, limit = 5) {
  return Object.entries(totals)
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

async function announceWeek(guild, target) {
  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) return;

  const results = topUsers(store.weekTotals(target));
  const winner = results[0] ?? null;

  if (config.roleId && winner && winner.userId !== store.holder()) {
    const prevHolder = store.holder();
    if (prevHolder) {
      const prevMember = await guild.members.fetch(prevHolder).catch(() => null);
      await prevMember?.roles.remove(config.roleId, 'Haftanın saygın üyesi değişti').catch(() => {});
    }
    const member = await guild.members.fetch(winner.userId).catch(() => null);
    await member?.roles.add(config.roleId, 'Haftanın saygın üyesi').catch(() => {});
    store.setHolder(winner.userId);
  }

  await channel
    .send({
      components: [ui.weeklyAnnounce(guild, results, config.roleId)],
      flags: core.CV2,
      allowedMentions: { users: winner ? [winner.userId] : [] },
    })
    .catch(() => {});
}

async function checkWeeklyAnnounce(guild) {
  const now = Date.now();
  if (!isMonday(now)) return;
  const target = previousWeekKey(now);
  if (store.lastRun() === target) return;
  await announceWeek(guild, target).catch((err) => console.error('[saygi] Haftalık duyuru gönderilemedi:', err.message));
  store.setLastRun(target);
}

// Saygınlık verme kuralları: kendine/bota verilemez, günde bir kez kullanılabilir. Hem /saygi-ver hem "+rep" bunu kullanır.
function evaluateGive(giverId, target) {
  if (target.id === giverId) return { ok: false, reason: 'self' };
  if (target.bot) return { ok: false, reason: 'bot' };

  const last = store.lastGiven(giverId);
  const remaining = config.cooldownHours * 60 * 60 * 1000 - (Date.now() - last);
  if (remaining > 0) return { ok: false, reason: 'cooldown', remaining };

  store.add(target.id, weekKey());
  store.setLastGiven(giverId, Date.now());
  return { ok: true, newTotal: store.allTotals()[target.id] ?? 0 };
}

function cooldownHint(remaining) {
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.ceil((remaining % 3600000) / 60000);
  return `Tekrar verebilmen için ${hours > 0 ? `${hours} saat ` : ''}${minutes} dk bekle.`;
}

// /saygi-ver: hedefe +1 saygınlık verir
async function handleGive(interaction) {
  const target = interaction.options.getUser('kullanici', true);
  const result = evaluateGive(interaction.user.id, target);

  if (!result.ok) {
    if (result.reason === 'self') return replyError(interaction, 'Kendine saygınlık veremezsin.');
    if (result.reason === 'bot') return replyError(interaction, 'Botlara saygınlık veremezsin.');
    return replyError(interaction, 'Zaten saygınlık verdin.', cooldownHint(result.remaining));
  }

  return respond(interaction, ui.given(interaction.user.id, target.id, result.newTotal), {
    ephemeral: false,
    allowedMentions: { users: [target.id] },
  });
}

// "+rep @kullanıcı" mesajı: /saygi-ver ile aynı kuralları kullanır, sadece mesajla tetiklenir
async function handleMessage(message) {
  if (message.guildId !== guildId || message.author.bot || message.webhookId) return;
  if (!REP_TRIGGER.test(message.content.trim())) return;

  const target = message.mentions.users.find((u) => u.id !== message.author.id);
  if (!target) {
    await message.reply({ components: [core.alert('Kime saygınlık vereceğini belirtmelisin.', 'Örnek: +rep @kullanıcı', 'danger')], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }

  const result = evaluateGive(message.author.id, target);
  if (!result.ok) {
    const text =
      result.reason === 'self'
        ? 'Kendine saygınlık veremezsin.'
        : result.reason === 'bot'
          ? 'Botlara saygınlık veremezsin.'
          : 'Zaten saygınlık verdin.';
    const hint = result.reason === 'cooldown' ? cooldownHint(result.remaining) : null;
    await message.reply({ components: [core.alert(text, hint, 'danger')], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => {});
    return;
  }

  await message
    .reply({
      components: [ui.given(message.author.id, target.id, result.newTotal)],
      flags: core.CV2,
      allowedMentions: { users: [target.id] },
    })
    .catch(() => {});
}

// /saygi-siralama: tüm zamanların toplam tablosu
async function handleTable(interaction) {
  const ranking = topUsers(store.allTotals(), 15);
  return respond(interaction, ui.table(interaction.guild, ranking), { ephemeral: false });
}

// /saygi-onizleme: bu haftanın şimdiye kadarki durumunu gösterir, rol vermez, duyuru atmaz, kimseyi etiketlemez
async function handlePreview(interaction) {
  const results = topUsers(store.weekTotals(weekKey()));
  return respond(interaction, ui.weeklyAnnounce(interaction.guild, results, config.roleId, true), { ephemeral: true });
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  setInterval(() => checkWeeklyAnnounce(guild), CHECK_INTERVAL).unref();
  checkWeeklyAnnounce(guild).catch((err) => console.error('[saygi] Haftalık kontrol hatası:', err.message));
}

module.exports = {
  name: 'saygi',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { 'saygi-ver': 'Herkes', 'saygi-siralama': 'Herkes', 'saygi-onizleme': 'Herkes' } },
  slash: { 'saygi-ver': handleGive, 'saygi-siralama': handleTable, 'saygi-onizleme': handlePreview },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.MessageCreate]: handleMessage,
  },
};
