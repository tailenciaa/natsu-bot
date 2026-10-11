// Profil verisinin tek kaynağı. Kart (card.js), vitrin sayfası ve rozet sayfası ihtiyaç duyduğu bütün ölçümleri
// buradan alır: seviye, sıralama, coin, saygınlık, sicil, takviye, ziyaret ve kozmetik kayıtları tek geçişte
// toplanır. Böylece kartla paneller hiçbir zaman farklı sayıyı göstermez ve yeni bir sistem veri ürettiğinde
// profil onu yalnızca buradan okuyarak büyütür.
const coinStore = require('../coin/store');
const saygiStore = require('../saygi/store');
const seviyeStore = require('../seviye/store');
const sicilStore = require('../sicil/store');
const siralamaStore = require('../siralama/store');
const kozmetik = require('./kozmetik');
const rozet = require('./rozet');
const store = require('./store');

const number = (n) => Number(n).toLocaleString('tr-TR');

function duration(seconds) {
  const minutes = Math.floor((seconds ?? 0) / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${number(h)} sa ${minutes % 60} dk` : `${minutes} dk`;
}

// Vitrinde öne çıkarılabilen istatistikler; değeri üretmeyen (henüz kaydı olmayan) seçenek kartta boş kalır
const FEATURED = [
  { key: 'mesaj', label: 'Mesaj sıralaması', note: 'Tüm zamanların mesaj sıran', value: (v) => (v.mesajRank ? `# ${v.mesajRank}` : null) },
  { key: 'ses', label: 'Ses sıralaması', note: 'Tüm zamanların ses sıran', value: (v) => (v.sesRank ? `# ${v.sesRank}` : null) },
  { key: 'yayin', label: 'Yayın süresi', note: 'Toplam ekran paylaşımı', value: (v) => (v.streamSeconds >= 3600 ? duration(v.streamSeconds) : null) },
  { key: 'saygi', label: 'Saygınlık', note: 'Toplam aldığın saygınlık', value: (v) => (v.rep ? `${v.rep} saygınlık` : null) },
  { key: 'seri', label: 'Giriş serisi', note: 'Art arda günlük ödül', value: (v) => (v.streak ? `${v.streak} günlük seri` : null) },
  { key: 'coin', label: 'Coin bakiyesi', note: 'Harcayabileceğin coin', value: (v) => `${number(v.balance)} coin` },
];

const featuredOptions = FEATURED.map(({ key, label, note }) => ({ key, label, note }));

// Bağlantı kartında kısa yazılır: protokol ve www atılır, yol küçük tutulur
function linkLabel(url) {
  const host = String(url).replace(/^https?:\/\//, '').replace(/^www\./, '');
  const short = host.replace(/\/$/, '');
  return short.length > 34 ? `${short.slice(0, 33)}…` : short;
}

// Kartın çizim verisi: ölçümler, rozet bağlamı ve vitrin alanları tek geçişte üretilir
async function profileView(guild, userId) {
  const measures = rozet.measures();
  const member = await guild.members.fetch(userId).catch(() => null);
  const custom = store.get(userId);
  const visits = store.visits(userId);
  const messageCount = measures.messages.get(userId) ?? 0;
  const voiceSeconds = measures.voice.get(userId) ?? 0;
  const streamSeconds = measures.stream.get(userId) ?? 0;
  const cezalar = sicilStore.of(guild.id, userId);

  const stats = {
    mesajRank: siralamaStore.rankIn(measures.messages, userId),
    sesRank: siralamaStore.rankIn(measures.voice, userId),
    streamSeconds,
    rep: saygiStore.allTotals()[userId] ?? 0,
    streak: coinStore.streak(userId),
    balance: coinStore.balance(userId),
    earnedCoins: coinStore.earned(userId),
  };
  const ctx = rozet.context({ guild, member, userId, messageCount, voiceSeconds, streamSeconds, visits: visits.count });
  // Satın alınan sergi rozetleri başa yazılır: kartta iki satır yer olduğu için kazanılan rozetlerin arasında kaybolmasınlar
  const badges = [...kozmetik.badgesOf(custom.ownedBadges), ...rozet.earned(ctx)];
  const featured = FEATURED.find((o) => o.key === custom.featured);

  return {
    custom,
    roleColor: member?.displayColor ?? 0,
    mesajXp: seviyeStore.xpOf('mesaj', userId),
    sesXp: seviyeStore.xpOf('ses', userId),
    joinedAt: member?.joinedTimestamp ?? null,
    // Üyenin Discord hesabının açılış tarihi: kartta "hesap yaşı" olarak gösterilir
    accountAt: member?.user?.createdTimestamp ?? null,
    premiumSince: member?.premiumSinceTimestamp ?? null,
    messageCount,
    voiceSeconds,
    badges,
    featured: featured ? { label: featured.label, value: featured.value(stats) ?? 'kayıt yok' } : null,
    links: ['twitch', 'youtube', 'github', 'site'].map((key) => custom.links?.[key]).filter(Boolean).slice(0, 3).map(linkLabel),
    visits: visits.count,
    coins: stats.balance,
    punishments: { total: cezalar.length, active: cezalar.filter((p) => p.status === 'active').length },
    ownedCount: store.ownedCount(userId),
    frame: kozmetik.frameOf(custom.frame),
    ...stats,
  };
}

// Yalnızca kapağı çizmek için gerekenler: tema/renk seçimi ve üyenin rol rengi (pahalı ölçümler toplanmaz)
async function headerView(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  return { custom: store.get(userId), roleColor: member?.displayColor ?? 0 };
}

module.exports = { FEATURED, featuredOptions, linkLabel, duration, number, profileView, headerView };
