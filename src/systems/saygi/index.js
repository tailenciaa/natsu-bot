// Saygınlık sistemi: üyeler birbirine günde bir kez +1 saygınlık verebilir (/saygi-ver, bir mesajda "+rep
// @kullanıcı" yazarak ya da bir değerlendirmenin altındaki saygınlık butonuyla); tüm zamanların toplam tablosu
// /siralama menüsünün saygınlık türüdür. Her verme ayarlı kayıt kanalında (bot komutları) herkese açık bir
// kayıtla görünür. Her hafta pazartesi, geçen haftanın en çok saygınlık kazanan üyesi ayarlı kanala duyurulur ve
// ayarlı rol verilir (önceki haftanın sahibinden geri alınır). Kontrol 15 dakikada bir tekrarlanır ve kaydı olan
// bitmiş haftalar eskiden yeniye yakalanır; bot kapalıyken geçen hafta duyurulsuz kalmaz.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, fetchTextChannel, stillMember } = require('../../core/helpers');
const coin = require('../coin/store');
const coinConfig = require('../coin/config');
const butik = require('../butik/store'); // ek saygınlık hakkı Butikte satılır; bekleme takıldığında oradan yanar
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { weekKey, pendingWeeks } = require('../aktif/week');

const commands = [
  new SlashCommandBuilder()
    .setName('saygi-ver')
    .setDescription('Bir üyeye +1 saygınlık verirsin; günde bir kez verilir, haftanın birincisi ödül rolünü alır.')
    .addUserOption((opt) => opt.setName('kullanici').setDescription('Saygınlık verilecek üyeyi seçer.').setRequired(true))
    .setContexts(InteractionContextType.Guild),
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

// Duyuruyu gönderir ve rolü devreder. Döner: { ok, mark, durum, not } — aktif ile aynı biçim, /haftalik iki sonucu
// tek kartta gösterir. ok kartın rengini, mark ise haftanın "duyuruldu" sayılıp sayılmayacağını taşır: kayıt
// bulunamazsa hafta tüketilmez, sayım görünür olduğu anda (ör. bot yeniden başladığında) tekrar denenir.
async function announceWeek(guild, target) {
  const results = topUsers(guild, store.weekTotals(target));
  const winner = results[0] ?? null;

  // Rol devri kayıt varken yapılır: boş haftada mevcut sahibinin rolü haksızca geri alınmasın
  if (!winner) return { ok: true, mark: false, durum: 'kayıt yok', not: `${target} haftasında saygınlık kaydı bulunamadı.` };

  await passRole(guild, winner.userId);

  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) return { ok: false, mark: false, durum: 'kanal yok', not: `Duyuru kanalı (ID ${config.channel}) bulunamadı; bot kanalı göremiyor ya da kanal silinmiş olabilir.` };

  try {
    await channel.send({
      components: [ui.weeklyAnnounce(guild, results, config.roleId)],
      flags: core.CV2,
      allowedMentions: { users: [winner.userId] },
    });
  } catch (err) {
    return { ok: false, mark: false, durum: 'gönderilemedi', not: `Kanala gönderilemedi: ${err.message}` };
  }
  return { ok: true, mark: true, durum: 'gönderildi', not: `${target} · birinci ${winner.value} saygınlıkla kazandı` };
}

// Hedef haftanın duyurusunu yapar ve loglar. Hafta işareti yalnızca bitmiş ve kendisini henüz geçmemiş bir
// haftada ilerler: tekrar çalıştırma aynı haftayı iki kez duyurmaz, bu haftanın önizlemesi pazartesinin hakkını
// yemez. auto=true olduğunda sonuç store'a yazılır ki yetkili /haftalik kartından zamanlayıcıyı denetleyebilsin.
async function runWeekly(guild, target, { auto = false } = {}) {
  const sonIsaret = store.lastRun();
  const ilk = target < weekKey(Date.now()) && (!sonIsaret || sonIsaret < target);
  const sonuc = await announceWeek(guild, target).catch((err) => ({ ok: false, mark: false, durum: 'hata', not: err.message }));
  if (ilk && sonuc.mark) store.setLastRun(target);
  if (auto) store.setLastAttempt({ week: target, at: Date.now(), durum: sonuc.durum, not: sonuc.not });
  console.log(`[saygi] Haftalık duyuru (${target}) ${sonuc.durum} — ${sonuc.not}`);
  return sonuc;
}

// Bitmiş haftaların duyurusu: kaydı olan ve işareti ilerlememiş haftalar eskiden yeniye yakalanır. Bot bir hafta
// kapalı kaldıysa ya da kanal göndermeyi geçici olarak reddettiyse eksikler sonraki kontrolde tamamlanır.
async function checkWeeklyAnnounce(guild) {
  for (const target of pendingWeeks(store.weekKeys(), store.lastRun())) await runWeekly(guild, target, { auto: true });
}

// Saygınlık verme kuralları: kendine/bota verilemez, günde bir kez verilir. Üç verme yolu da (/saygi-ver, "+rep",
// değerlendirme butonu) bu fonksiyondan geçer.
function evaluateGive(giverId, target) {
  if (target.id === giverId) return { ok: false, reason: 'self' };
  if (target.bot) return { ok: false, reason: 'bot' };

  const last = store.lastGiven(giverId);
  const remaining = config.cooldownHours * 60 * 60 * 1000 - (Date.now() - last);
  // Butik hakkı: bekleme dolmamışsa elde duran bir ek hak yanar ve verme açılır. Hak yalnızca beklemeye takıldığı
  // anda harcanır, süresi zaten dolmuş bir vermede boşa gitmez.
  const haktan = remaining > 0 && butik.hakYak(giverId);
  if (remaining > 0 && !haktan) return { ok: false, reason: 'cooldown', remaining };

  store.add(target.id, weekKey());
  store.setLastGiven(giverId, Date.now());
  // Saygınlık veren de ödül alır: sosyal etkileşimi büyüten taraf teşvik edilsin
  coin.add(giverId, coinConfig.awards.repGiven, 'saygınlık verdi');
  return { ok: true, newTotal: store.allTotals()[target.id] ?? 0, haktan };
}

// Kalan süre cümlede açık yazılır: "3 saat 5 dakika", tam saat ya da tam dakika olunca 0'lı kısım yazılmaz
function cooldownHint(remaining) {
  const total = Math.max(1, Math.ceil(remaining / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return (
    `Tekrar saygınlık verebilmek için ${[hours ? `${hours} saat` : '', minutes ? `${minutes} dakika` : ''].filter(Boolean).join(' ')} bekle.` +
    ' Beklemeden bir kez daha vermek istersen Butikteki ek saygınlık hakkını al: /bakiye > Butik.'
  );
}

// Ret sebebinin cümlesi ve ipucu: üç verme yolu da üyeye aynı sözlerle haber verir
function rejection(result) {
  const message =
    result.reason === 'self'
      ? 'Kendine saygınlık veremezsin.'
      : result.reason === 'bot'
        ? 'Botlara saygınlık veremezsin.'
        : 'Zaten saygınlık verdin.';
  return { message, hint: result.reason === 'cooldown' ? cooldownHint(result.remaining) : null };
}

// Her verme kayıt kanalında herkese açık bir kayıtla görünür. Verme zaten o kanaldaysa cevap mesajının kendisi
// kayıt olduğu için ikinci mesaj atılmaz; kanal bulunamazsa verme yine geçerlidir (saygınlık çoktan eklendi).
async function announceFeed(client, giverId, targetId, { newTotal, haktan }, source, fromChannelId) {
  if (!config.feed || fromChannelId === config.feed) return;
  const channel = await fetchTextChannel(client.guilds.cache.get(guildId), config.feed);
  await channel
    ?.send({
      components: [ui.given(giverId, targetId, newTotal, haktan, source)],
      flags: core.CV2,
      allowedMentions: { users: [targetId] },
    })
    .catch((err) => console.error('[saygi] Saygınlık kaydı gönderilemedi:', err.message));
}

// Saygınlık vermenin tek kapısı: kuralı uygular, toplamı kaydeder, herkese açık kaydı yazar ve istenirse
// saygınlığı alan kişiye DM atar. opts: fromChannelId vermenin yapıldığı kanal, source Kaynak satırı,
// notifyDm alana bildirim gönderilsin mi (değerlendirme butonunda gerekir).
async function give(client, giverId, target, { fromChannelId = null, source = null, notifyDm = false } = {}) {
  const result = evaluateGive(giverId, target);
  if (!result.ok) return result;

  await announceFeed(client, giverId, target.id, result, source, fromChannelId);
  if (notifyDm) {
    await target.send({ components: [ui.givenDm(giverId, result.newTotal, source)], flags: core.CV2 }).catch(() => null);
  }
  return result;
}

// /saygi-ver: hedefe +1 saygınlık verir
async function handleGive(interaction) {
  const target = interaction.options.getUser('kullanici', true);
  const result = await give(interaction.client, interaction.user.id, target, { fromChannelId: interaction.channelId });

  if (!result.ok) {
    const { message, hint } = rejection(result);
    return replyError(interaction, message, hint);
  }

  return respond(interaction, ui.given(interaction.user.id, target.id, result.newTotal, result.haktan), {
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

  const result = await give(message.client, message.author.id, target, { fromChannelId: message.channelId });
  if (!result.ok) {
    const { message: text, hint } = rejection(result);
    await replyBrief(core.alert(text, hint, 'danger'));
    return;
  }

  await message
    .reply({
      components: [ui.given(message.author.id, target.id, result.newTotal, result.haktan)],
      flags: core.CV2,
      allowedMentions: { users: [target.id] },
    })
    .catch(() => {});
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  setInterval(() => checkWeeklyAnnounce(guild), CHECK_INTERVAL).unref();
  checkWeeklyAnnounce(guild).catch((err) => console.error('[saygi] Haftalık kontrol hatası:', err.message));
}

module.exports = {
  name: 'saygi',
  give,
  rejection,
  runWeekly,
  lastAttempt: store.lastAttempt,
  commands,
  help: {
    category: ['siralama', 'Sıralama'],
    member: ['saygi-ver'],
    access: { 'saygi-ver': 'Herkes' },
  },
  slash: { 'saygi-ver': handleGive },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.MessageCreate]: handleMessage,
  },
};
