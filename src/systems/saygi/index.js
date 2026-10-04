// Saygınlık sistemi: üyeler birbirine günde bir kez +1 saygınlık verebilir (/saygi-ver), tüm zamanların toplam
// tablosu /saygi-siralama ile görülebilir. Her hafta pazartesi, geçen haftanın en çok saygınlık kazanan üyesi
// ayarlı kanala duyurulur ve ayarlı rol verilir (önceki haftanın sahibinden geri alınır).
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
];

const CHECK_INTERVAL = 15 * 60 * 1000;

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

// /saygi-ver: hedefe +1 saygınlık verir; kendine ya da bota verilemez, günde bir kez kullanılabilir
async function handleGive(interaction) {
  const target = interaction.options.getUser('kullanici', true);
  const giverId = interaction.user.id;

  if (target.id === giverId) return replyError(interaction, 'Kendine saygınlık veremezsin.');
  if (target.bot) return replyError(interaction, 'Botlara saygınlık veremezsin.');

  const last = store.lastGiven(giverId);
  const remaining = config.cooldownHours * 60 * 60 * 1000 - (Date.now() - last);
  if (remaining > 0) {
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.ceil((remaining % 3600000) / 60000);
    return replyError(
      interaction,
      'Zaten saygınlık verdin.',
      `Tekrar verebilmen için ${hours > 0 ? `${hours} saat ` : ''}${minutes} dk bekle.`,
    );
  }

  store.add(target.id, weekKey());
  store.setLastGiven(giverId, Date.now());
  const newTotal = store.allTotals()[target.id] ?? 0;
  return respond(interaction, ui.given(giverId, target.id, newTotal), { ephemeral: false, allowedMentions: { users: [target.id] } });
}

// /saygi-siralama: tüm zamanların toplam tablosu
async function handleTable(interaction) {
  const ranking = topUsers(store.allTotals(), 15);
  return respond(interaction, ui.table(interaction.guild, ranking), { ephemeral: false });
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
  help: { category: ['siralama', 'Sıralama'], access: { 'saygi-ver': 'Herkes', 'saygi-siralama': 'Herkes' } },
  slash: { 'saygi-ver': handleGive, 'saygi-siralama': handleTable },
  events: {
    [Events.ClientReady]: handleReady,
  },
};
