// Rozetler: profil kartında taşınan, rozet sayfasında ilerlemesi görünen kazanımlar. Hepsi zaten tutulan
// kayıtlardan türetilir; ayrı bir "rozet kazandı" kaydı yoktur. Böylece özellik açılmadan önceki etkinlikler de
// sayılır ve bir kayıt bozulsa bile rozetler yeniden hesaplanabilir.
// Her rozet sayısal bir değere ulaşınca kazanılır: goal 1 olanlar koşullu (rol, sahip olma), diğerleri hedefli.
const aktifStore = require('../aktif/store');
const basvuruConfig = require('../basvuru/config');
const coinStore = require('../coin/store');
const saygiStore = require('../saygi/store');
const seviyeStore = require('../seviye/store');
const { levelFromXp } = require('../seviye/level');
const vipStore = require('../vip/store');
const profileStore = require('./store');

const DAY = 24 * 60 * 60 * 1000;

// Karttaki rozet etiketlerinin renkleri; koyu zeminde okunacak kadar parlak seçilir
const BADGES = [
  { key: 'kurucu', label: 'Kurucu', note: 'Sunucunun sahibi', color: '#f4c95d', goal: 1, value: (c) => (c.owner ? 1 : 0) },
  { key: 'yetkili', label: 'Yetkili', note: 'Yetkili ekibinde yer alıyor', color: '#7c8cff', goal: 1, value: (c) => (c.staff ? 1 : 0) },
  { key: 'takviye', label: 'Takviye', note: 'Sunucuyu takviye ediyor', color: '#ff6b9a', goal: 1, value: (c) => (c.booster ? 1 : 0) },
  { key: 'vip', label: 'VIP', note: 'Yetkililer tarafından VIP olarak işaretlendi', color: '#b57bff', goal: 1, value: (c) => (c.vip ? 1 : 0) },
  { key: 'haftanin-aktifi', label: 'Haftanın Aktifi', note: 'Bir kategoride haftanın birincisi', color: '#ff9b5e', goal: 1, value: (c) => (c.weekly ? 1 : 0) },
  { key: 'eski-uye', label: 'Eski Üye', note: 'Sunucuda bir yılı doldurdu', color: '#c3ccd6', goal: 365, value: (c) => c.days },
  { key: 'sohbet-kusu', label: 'Sohbet Kuşu', note: 'Binden fazla mesaj', color: '#38c6e8', goal: 1000, value: (c) => c.messageCount },
  { key: 'sohbet-ustasi', label: 'Sohbet Ustası', note: 'Mesaj seviyesi 25', color: '#5be08a', goal: 25, value: (c) => c.mesajLevel },
  { key: 'ses-ustasi', label: 'Ses Ustası', note: 'Ses seviyesi 25', color: '#9fe6ff', goal: 25, value: (c) => c.sesLevel },
  { key: 'yayinci', label: 'Yayıncı', note: 'On saat ekran paylaşımı', color: '#e879f9', goal: 10, value: (c) => c.streamHours },
  { key: 'sevilen-uye', label: 'Sevilen Üye', note: 'On saygınlık', color: '#57f287', goal: 10, value: (c) => c.rep },
  { key: 'sunucunun-yuzu', label: 'Sunucunun Yüzü', note: 'Elli saygınlık', color: '#fde047', goal: 50, value: (c) => c.rep },
  { key: 'kararli', label: 'Kararlı', note: 'Yedi günlük giriş serisi', color: '#fb7185', goal: 7, value: (c) => c.streak },
  { key: 'azimli', label: 'Azimli', note: 'Otuz günlük giriş serisi', color: '#f97316', goal: 30, value: (c) => c.streak },
  { key: 'koleksiyoncu', label: 'Koleksiyoncu', note: 'Üç kozmetik sahibi', color: '#a3e635', goal: 3, value: (c) => c.owned },
  { key: 'birikim', label: 'Birikim', note: 'İki bin beş yüz coin kazandı', color: '#fbbf24', goal: 2500, value: (c) => c.earned },
  { key: 'taninmis', label: 'Tanınmış', note: 'Yüz profil ziyareti', color: '#60a5fa', goal: 100, value: (c) => c.visits },
];

// Kartın ve rozet sayfasının ortak ölçüleri: her şey tek bir bağlamdan hesaplanır
function context({ guild, member, userId, messageCount = 0, streamSeconds = 0, visits = 0 }) {
  const roles = member?.roles?.cache;
  const staffIds = [basvuruConfig.roles.accept, basvuruConfig.roles.reviewer].filter(Boolean);
  return {
    owner: guild?.ownerId === userId,
    staff: roles ? staffIds.some((id) => roles.has(id)) : false,
    booster: Boolean(member?.premiumSinceTimestamp),
    vip: Boolean(vipStore.grantedAt(userId)),
    weekly: ['mesaj', 'ses', 'yayin'].some((kind) => aktifStore.holder(kind) === userId),
    days: member?.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / DAY) : 0,
    messageCount,
    mesajLevel: levelFromXp(seviyeStore.xpOf('mesaj', userId)),
    sesLevel: levelFromXp(seviyeStore.xpOf('ses', userId)),
    streamHours: Math.floor(streamSeconds / 3600),
    rep: saygiStore.allTotals()[userId] ?? 0,
    streak: coinStore.streak(userId),
    earned: coinStore.earned(userId),
    owned: profileStore.ownedCount(userId),
    visits,
  };
}

// Kazanılan rozetler, kartta taşınma sırasıyla
const earned = (ctx) => BADGES.filter((b) => b.value(ctx) >= b.goal);

// Rozet sayfası için tamamı: kazanmış/kazanmamış ayrımı ve kalan ilerleme
const progress = (ctx) =>
  BADGES.map((b) => {
    const value = Math.min(b.value(ctx), b.goal);
    return { ...b, value, done: value >= b.goal };
  });

module.exports = { BADGES, context, earned, progress };
