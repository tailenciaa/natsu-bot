// Saygınlık sistemi: üyeler birbirine günde bir kez +1 saygınlık verebilir (/saygi-ver ya da bir mesajda "+rep
// @kullanıcı" yazarak), tüm zamanların toplam tablosu /saygi-siralama ile görülebilir. Her hafta pazartesi, geçen
// haftanın en çok saygınlık kazanan üyesi ayarlı kanala duyurulur ve ayarlı rol verilir (önceki haftanın sahibinden
// geri alınır).
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, fetchTextChannel, stillMember } = require('../../core/helpers');
const coin = require('../coin/store');
const coinConfig = require('../coin/config');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { weekKey, previousWeekKey } = require('../aktif/week');

const commands = [
  new SlashCommandBuilder()
    .setName('saygi-ver')
    .setDescription('Bir üyeye +1 saygınlık verir, günde bir kez kullanılabilir.')
    .addUserOption((opt) => opt.setName('kullanici').setDescription('Saygınlık verilecek üyeyi seçer.').setRequired(true))
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('saygi-siralama')
    .setDescription('Tüm zamanların saygınlık tablosunu gösterir.')
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('saygi-onizleme')
    .setDescription('Haftanın saygın üyesi duyurusunun önizlemesini sadece sana gösterir.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

const CHECK_INTERVAL = 15 * 60 * 1000;
// "+rep" ile başlayan mesajlarda tetiklenir (örn: "+rep @kullanıcı")
const REP_TRIGGER = /^\+rep\b/i;

// O haftanın/tüm zamanların toplamlarından en yüksekten düşüğe ilk N kullanıcıyı listeler (sunucudan ayrılanlar hariç)
function topUsers(guild, totals, limit = 5) {
  return Object.entries(totals)
    .filter(([userId]) => stillMember(guild, userId))
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Rolü önceki sahibinden alıp yeni birinciye verir; rol gerçekten verilemezse sahip kaydedilmez
async function passRole(guild, winnerId) {
  const prevHolder = store.holder();
  if (!config.roleId || winnerId === prevHolder) return;

  if (prevHolder) {
    const prevMember = await guild.members.fetch(prevHolder).catch(() => null);
    await prevMember?.roles.remove(config.roleId, 'Haftanın saygın üyesi değişti').catch((err) => console.error('[saygi] Rol önceki sahibinden alınamadı:', err.message));
  }
  if (!winnerId) return store.setHolder(null);
  const member = await guild.members.fetch(winnerId).catch(() => null);
  const given = member ? await member.roles.add(config.roleId, 'Haftanın saygın üyesi').then(() => true, (err) => {
    console.error('[saygi] Haftanın saygın üyesi rolü verilemedi:', err.message);
    return false;
  }) : false;
  store.setHolder(given ? winnerId : null);
}

// Duyuruyu gönderir ve rolü devreder; duyuru atıldıysa (ya da duyurulacak kayıt yoksa) true, tekrar denenmesi gerekiyorsa false döner
async function announceWeek(guild, target) {
  const results = topUsers(guild, store.weekTotals(target));
  const winner = results[0] ?? null;

  await passRole(guild, winner?.userId ?? null);
  if (!winner) return true; // kimse saygınlık kazanmadıysa boş duyuru atılmaz

  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) {
    console.error('[saygi] Haftalık duyuru kanalı bulunamadı.');
    return false;
  }
  return channel
    .send({
      components: [ui.weeklyAnnounce(guild, results, config.roleId)],
      flags: core.CV2,
      allowedMentions: { users: [winner.userId] },
    })
    .then(
      () => true,
      (err) => {
        console.error('[saygi] Haftalık duyuru gönderilemedi:', err.message);
        return false;
      },
    );
}

// Bir önceki haftanın duyurusu yapılmadıysa yapar; bot pazartesi kapalıysa ya da kanal sorunluysa sonraki kontrolde yakalar
async function checkWeeklyAnnounce(guild) {
  const target = previousWeekKey(Date.now());
  if (store.lastRun() === target) return;
  const done = await announceWeek(guild, target).catch((err) => {
    console.error('[saygi] Haftalık duyuru hatası:', err.message);
    return false;
  });
  if (done) store.setLastRun(target);
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
  // Saygınlık veren de ödül alır: sosyal etkileşimi büyüten taraf teşvik edilsin
  coin.add(giverId, coinConfig.awards.repGiven, 'saygınlık verdi');
  return { ok: true, newTotal: store.allTotals()[target.id] ?? 0 };
}

// Kalan süre cümlede açık yazılır: "3 saat 5 dakika", tam saat ya da tam dakika olunca 0'lı kısım yazılmaz
function cooldownHint(remaining) {
  const total = Math.max(1, Math.ceil(remaining / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `Tekrar saygınlık verebilmek için ${[hours ? `${hours} saat` : '', minutes ? `${minutes} dakika` : ''].filter(Boolean).join(' ')} bekle.`;
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

  // Hata cevapları kanalı kirletmesin diye kısa süre sonra silinir
  const replyBrief = async (container) => {
    const sent = await message.reply({ components: [container], flags: core.CV2, allowedMentions: { parse: [] } }).catch(() => null);
    if (sent) setTimeout(() => sent.delete().catch(() => {}), 10 * 1000).unref();
  };

  // Botlar ve yazarın kendisi hedef sayılmaz; etiketlenenler arasında geçerli ilk üye seçilir
  const target = message.mentions.users.find((u) => !u.bot && u.id !== message.author.id);
  if (!target) {
    const attempted = message.mentions.users.size > 0;
    await replyBrief(
      core.alert(attempted ? 'Bu kişiye saygınlık veremezsin.' : 'Kime saygınlık vereceğini yazmalısın.', 'Örn: +rep @üye', 'danger'),
    );
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
    await replyBrief(core.alert(text, result.reason === 'cooldown' ? cooldownHint(result.remaining) : null, 'danger'));
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
  const ranking = topUsers(interaction.guild, store.allTotals(), 15);
  return respond(interaction, ui.table(interaction.guild, ranking), { ephemeral: false });
}

// /saygi-onizleme: bu haftanın şu ana kadarki durumuna göre duyurunun örneğini sadece komutu kullanana gösterir
async function handlePreview(interaction) {
  const results = topUsers(interaction.guild, store.weekTotals(weekKey()));
  return respond(interaction, ui.weeklyAnnounce(interaction.guild, results, config.roleId));
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
  help: {
    category: ['siralama', 'Sıralama'],
    member: ['saygi-ver', 'saygi-siralama'],
    access: { 'saygi-ver': 'Herkes', 'saygi-siralama': 'Herkes', 'saygi-onizleme': 'Yöneticiler' },
  },
  slash: { 'saygi-ver': handleGive, 'saygi-siralama': handleTable, 'saygi-onizleme': handlePreview },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.MessageCreate]: handleMessage,
  },
};
