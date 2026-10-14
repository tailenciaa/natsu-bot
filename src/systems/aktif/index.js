// Haftanın aktifleri: mesaj, ses ve yayın (ekran paylaşımı) süresi haftalık olarak ayrı ayrı sayılır. Her hafta
// pazartesi, geçen haftanın üç kategorisinin de birincisi #haftalık kanalına duyurulur ve kategorisine özel rol
// verilir; rol önceki haftanın sahibinden geri alınır. Botlar ve AFK kanalı sayılmaz, ses/yayın dakikada bir kredi
// verilir. Botlar ve AFK kanalı sayılmaz, ses/yayın dakikada bir kredi verilir. Kontrol 15 dakikada bir tekrarlanır
// ve kaydı olan bitmiş haftalar eskiden yeniye yakalanır; bot kapalıyken geçen hafta duyurulsuz kalmaz.
// /haftalik pazartesiyi beklemeden aynı duyuruyu hemen yaptırır; her deneme konsola tek satır yazılır.
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { fetchTextChannel, stillMember, isStaff, respond, replyError } = require('../../core/helpers');
const coin = require('../coin/store');
const coinConfig = require('../coin/config');
const saygi = require('../saygi');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');
const { weekKey, previousWeekKey, pendingWeeks } = require('./week');

const KINDS = ['ses', 'mesaj', 'yayin'];

const commands = [
  new SlashCommandBuilder()
    .setName('haftalik')
    .setDescription('Geçen haftanın aktif ve saygınlık birincilerini pazartesiyi beklemeden hemen duyurur.')
    .addStringOption((opt) =>
      opt
        .setName('hafta')
        .setDescription('Hangi haftanın sonuçları duyurulacak?')
        .addChoices(
          { name: 'Geçen hafta (ödülleriyle)', value: 'gecen' },
          { name: 'Bu hafta (sadece önizleme)', value: 'bu' },
        ))
    .setContexts(InteractionContextType.Guild),
];

const CHECK_INTERVAL = 15 * 60 * 1000;
const TICK = 60 * 1000;

const countsVoice = (state) => Boolean(state?.channelId) && !state.member?.user.bot && state.channelId !== state.guild.afkChannelId;
const countsStream = (state) => countsVoice(state) && Boolean(state.streaming);

const sesSince = new Map();
const yayinSince = new Map();

function credit(map, kind, userId, now) {
  const since = map.get(userId);
  if (since === undefined) return;
  const minutes = Math.min(now - since, 2 * TICK) / TICK;
  if (minutes <= 0) return;
  store.add(kind, userId, Math.round(minutes * 60), weekKey(now));
}

function tickVoice(guild) {
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (countsVoice(state)) {
      credit(sesSince, 'ses', state.id, now);
      sesSince.set(state.id, now);
    }
    if (countsStream(state)) {
      credit(yayinSince, 'yayin', state.id, now);
      yayinSince.set(state.id, now);
    }
  }
}

function handleVoiceUpdate(oldState, newState) {
  if (newState.guild.id !== guildId) return;
  const userId = newState.id;

  const wasStream = countsStream(oldState);
  const isStream = countsStream(newState);
  if (wasStream && !isStream) {
    credit(yayinSince, 'yayin', userId, Date.now());
    yayinSince.delete(userId);
  } else if (!wasStream && isStream) {
    yayinSince.set(userId, Date.now());
  }

  const wasVoice = countsVoice(oldState);
  const isVoice = countsVoice(newState);
  if (wasVoice && !isVoice) {
    credit(sesSince, 'ses', userId, Date.now());
    sesSince.delete(userId);
  } else if (!wasVoice && isVoice) {
    sesSince.set(userId, Date.now());
  }
}

function handleMessage(message) {
  if (message.guildId !== guildId || message.author.bot || message.webhookId) return;
  store.add('mesaj', message.author.id, 1, weekKey(message.createdTimestamp));
}

// O haftanın toplamlarından en yüksekten düşüğe ilk 5 kullanıcıyı listeler (sunucudan ayrılanlar hariç)
function topUsers(guild, totals, limit = 5) {
  return Object.entries(totals)
    .filter(([userId]) => stillMember(guild, userId))
    .map(([userId, value]) => ({ userId, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Kategorinin rolünü önceki sahibinden alıp yeni birinciye verir; rol gerçekten verilemezse sahip kaydedilmez
async function passRole(guild, kind, winnerId) {
  const roleId = config.roles[kind];
  const prevHolder = store.holder(kind);
  if (!roleId || winnerId === prevHolder) return;

  if (prevHolder) {
    const prevMember = await guild.members.fetch(prevHolder).catch(() => null);
    await prevMember?.roles.remove(roleId, 'Haftanın aktifi değişti').catch((err) => console.error(`[aktif] Rol önceki sahibinden alınamadı (${kind}):`, err.message));
  }
  if (!winnerId) return store.setHolder(kind, null);
  const member = await guild.members.fetch(winnerId).catch(() => null);
  const given = member ? await member.roles.add(roleId, 'Haftanın aktifi').then(() => true, (err) => {
    console.error(`[aktif] Haftanın aktifi rolü verilemedi (${kind}):`, err.message);
    return false;
  }) : false;
  store.setHolder(kind, given ? winnerId : null);
}

// Duyuruyu gönderir ve rolleri devreder. Döner: { ok, mark, durum, not } — ok kartta başarı yazılır, mark ise
// haftanın "artık duyuruldu" sayılıp işaretin ilerletilebileceğini taşır. Kayıt bulunamazsa ok true kalır
// (şikâyet edilecek bir durum yok) ama mark false'tur: veri henüz görünmüyorsa (ör. bot yeni başladı ve
// sayımlar daha yüklenmedi) hafta tüketilmemeli, sonraki kontrolde tekrar denenmelidir.
// pay=false coin ödüllerini yatırmaz: aynı hafta ikinci kez çalıştırıldığında ödeme tekrarlanmaz.
async function announceWeek(guild, target, pay = true) {
  const results = {};
  for (const kind of KINDS) results[kind] = topUsers(guild, store.totals(kind, target));
  const winnerIds = KINDS.map((kind) => results[kind][0]?.userId).filter(Boolean);

  // Rol devri kayıt varken yapılır: boş bir haftada mevcut sahiplerin rolleri haksızca geri alınmasın
  if (!winnerIds.length) return { ok: true, mark: false, durum: 'kayıt yok', not: `${target} haftasının mesaj, ses ve yayın kaydı bulunamadı.` };

  for (const kind of KINDS) await passRole(guild, kind, results[kind][0]?.userId ?? null);

  const channel = await fetchTextChannel(guild, config.channel);
  if (!channel) return { ok: false, mark: false, durum: 'kanal yok', not: `Duyuru kanalı (ID ${config.channel}) bulunamadı; bot kanalı göremiyor ya da kanal silinmiş olabilir.` };

  try {
    await channel.send({ components: [ui.weeklyAnnounce(guild, results)], flags: core.CV2, allowedMentions: { users: winnerIds } });
  } catch (err) {
    return { ok: false, mark: false, durum: 'gönderilemedi', not: `Kanala gönderilemedi: ${err.message}` };
  }

  // Coin ödülleri duyuru gerçekten gönderildikten sonra verilir: duyuru tekrar denenirse aynı hafta iki kez ödenmez
  if (pay) {
    for (const kind of KINDS) {
      results[kind].slice(0, coinConfig.awards.weekly.length).forEach((entry, index) =>
        coin.add(entry.userId, coinConfig.awards.weekly[index], `haftanın ${kind} ${index + 1}.si`),
      );
    }
  }
  const kayit = KINDS.map((kind) => `${kind}: ${results[kind].length}`).join(' · ');
  return { ok: true, durum: 'gönderildi', not: `${target} · ${kayit} · ${pay ? 'ödüller yattı' : 'bu çalıştırmada ödül yatırılmadı'}` };
}

// Hedef haftanın duyurusunu yapar ve loglar. Ödül ve "bu hafta duyuruldu" işareti YALNIZCA bitmiş ve işareti o
// haftayı henüz geçmemiş bir haftada devreye girer: tekrar çalıştırma ödülü iki kez yatırmaz, bu haftanın
// önizlemesi pazartesi yapılacak asıl duyuruyu tüketmez. auto=true zamansal kontrol demektir; sonucu store'a
// yazar ki yetkili /haftalik kartından zamanlayıcının çalışıp çalışmadığını görebilsin.
async function runWeekly(guild, target, { auto = false } = {}) {
  const sonIsaret = store.lastRun();
  const pay = target < weekKey(Date.now()) && (!sonIsaret || sonIsaret < target);
  const sonuc = await announceWeek(guild, target, pay).catch((err) => ({ ok: false, mark: false, durum: 'hata', not: err.message }));
  if (pay && sonuc.mark) store.setLastRun(target);
  if (auto) store.setLastAttempt({ week: target, at: Date.now(), durum: sonuc.durum, not: sonuc.not });
  console.log(`[aktif] Haftalık duyuru (${target}) ${sonuc.durum} — ${sonuc.not}`);
  return { ...sonuc, pay };
}

// Bitmiş haftaların duyurusu: kaydı olan ve işareti ilerlememiş haftalar eskiden yeniye yakalanır. Bot bir hafta
// kapalı kaldıysa, kanal geçici olarak göndermeyi reddettiyse ya da sistem kurulduğunda eski haftalar hiç
// duyurulmadıysa eksikler sonraki 15 dakikalık kontrolde tamamlanır.
async function checkWeeklyAnnounce(guild) {
  for (const target of pendingWeeks(store.weekKeys(), store.lastRun())) await runWeekly(guild, target, { auto: true });
}

// /haftalik: pazartesiyi beklemeden duyuruyu hemen gönderir; aktif ve saygınlık birincileri tek kartta özetlenir
async function handleWeekly(interaction) {
  if (!isStaff(interaction)) return replyError(interaction, 'Bu komutu sadece yöneticiler kullanabilir.');

  await interaction.deferReply();
  const secim = interaction.options.getString('hafta') ?? 'gecen';
  const target = secim === 'bu' ? weekKey(Date.now()) : previousWeekKey(Date.now());

  const aktif = await runWeekly(interaction.guild, target);
  const saygiSonuc = await saygi.runWeekly(interaction.guild, target);
  await respond(
    interaction,
    ui.weeklyRunCard({
      target,
      aktif,
      saygi: saygiSonuc,
      user: interaction.user,
      denemeler: { aktif: store.lastAttempt(), saygi: saygi.lastAttempt() },
    }),
  );
}

function handleReady(client) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const now = Date.now();
  for (const state of guild.voiceStates.cache.values()) {
    if (countsVoice(state)) sesSince.set(state.id, now);
    if (countsStream(state)) yayinSince.set(state.id, now);
  }
  setInterval(() => tickVoice(guild), TICK).unref();
  setInterval(() => checkWeeklyAnnounce(guild), CHECK_INTERVAL).unref();
  checkWeeklyAnnounce(guild).catch((err) => console.error('[aktif] Haftalık kontrol hatası:', err.message));
}

module.exports = {
  name: 'aktif',
  runWeekly,
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { haftalik: 'Yöneticiler' } },
  slash: { haftalik: handleWeekly },
  events: {
    [Events.ClientReady]: handleReady,
    [Events.VoiceStateUpdate]: handleVoiceUpdate,
    [Events.MessageCreate]: handleMessage,
  },
};
