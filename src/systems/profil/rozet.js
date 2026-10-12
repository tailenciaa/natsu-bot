// Rozetler: profil kartında taşınan, rozet sayfasında ilerlemesi görünen kazanımlar. Hepsi zaten tutulan
// kayıtlardan türetilir; ayrı bir "rozet kazandı" kaydı yoktur. Böylece özellik açılmadan önceki etkinlikler de
// sayılır ve bir kayıt bozulsa bile rozetler yeniden hesaplanabilir.
// Her rozet sayısal bir değere ulaşınca kazanılır: goal 1 olanlar koşullu (rol, sahip olma), diğerleri hedefli.
// `gorev: true` olanlar uzun vadeli hedeflerdir ve config.js'teki karşılığı doluysa kazanılınca rol ödülü de verir.
const aktifStore = require('../aktif/store');
const basvuruConfig = require('../basvuru/config');
const coinStore = require('../coin/store');
const siralamaStore = require('../siralama/store');
const saygiStore = require('../saygi/store');
const seviyeStore = require('../seviye/store');
const { levelFromXp } = require('../seviye/level');
const vipStore = require('../vip/store');
const gorevStore = require('../gorev/store');
const sucStore = require('../hirsizlik/store');
const oyunStore = require('../oyun/store');
const eglenceStore = require('../eglence/store');
const butikStore = require('../butik/store');
const evlilikStore = require('../evlilik/store');
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
  // ── Ekonomi rozetleri ───────────────────────────────────────────────────────
  // Suç dünyası, salon, şakalaşma, butik ve evlilik kayıtlarından türerler: ayrı bir başvuru ya da tutulan
  // durum yoktur. Bir evlilik bittiğinde "Evli" rozeti kendiliğinden düşer, ama dönüm ödülü sayacı kalıcıdır.
  { key: 'sokak-kurtu', label: 'Sokak Kurdu', note: 'On girişimi başarıyla bitirdi', color: '#ff6a4d', goal: 10, value: (c) => c.soygun, icon: 'ates' },
  { key: 'kolay-yem', label: 'Kolay Yem Değil', note: 'Beş pusuya zamanında direndi', color: '#5be08a', goal: 5, value: (c) => c.direnis },
  { key: 'kasa-bekcisi', label: 'Kasa Bekçisi', note: 'Kasayı korurken ikramiye aldı', color: '#f4c95d', goal: 1, value: (c) => (c.ikramiye > 0 ? 1 : 0) },
  { key: 'gezin', label: 'Gezgin', note: 'Yirmi keşif turu tamamladı', color: '#38c6e8', goal: 20, value: (c) => c.kesif },
  { key: 'nese-sacan', label: 'Neşe Saçan', note: 'Yirmi beş şakalaşma kartı', color: '#fde047', goal: 25, value: (c) => c.sakalas },
  { key: 'karsiligin-ver', label: 'Karşılığını Veren', note: 'On şakalaşmaya karşılık verdi', color: '#57f287', goal: 10, value: (c) => c.karsilik },
  { key: 'butik-musterisi', label: 'Butik Müşterisi', note: 'Butikten bir renk aldı', color: '#3ee0a1', goal: 1, value: (c) => (c.renk > 0 ? 1 : 0), icon: 'elmas' },
  { key: 'evli', label: 'Evli', note: 'Sunucuda bir evliliği var', color: '#ff6b9a', goal: 1, value: (c) => (c.evli ? 1 : 0), icon: 'kalp' },
  { key: 'yil-donumu', label: 'Yıl Dönümü', note: 'Yıl dönümü ödülünü topladı', color: '#f97316', goal: 1, value: (c) => c.donum },
  { key: 'bir-omur', label: 'Bir Ömür', note: 'Evlilikte yüz gün', color: '#b57bff', goal: 100, value: (c) => c.evlilikGun },
  // ── Görev rozetleri ─────────────────────────────────────────────────────────
  // Uzun vadeli hedefler: config.js'te karşılığına bir rol ID'si yazılanlar kazanılınca bot üyeye o rolü de verir.
  { key: 'sohbet-efsanesi', label: 'Sohbet Efsanesi', note: 'Yirmi beş bin mesaj', color: '#38c6e8', goal: 25000, value: (c) => c.messageCount, gorev: true },
  { key: 'ses-efsanesi', label: 'Ses Efsanesi', note: 'Beş yüz saat sesli sohbet', color: '#5be08a', goal: 500, value: (c) => c.voiceHours, gorev: true },
  { key: 'yayin-efsanesi', label: 'Yayın Efsanesi', note: 'Yüz saat ekran paylaşımı', color: '#e879f9', goal: 100, value: (c) => c.streamHours, gorev: true },
  { key: 'iki-yuzluk', label: 'İki Yüzlük', note: 'Hem mesaj hem ses seviyesi 50', color: '#ff9b5e', goal: 50, value: (c) => c.ciftLevel, gorev: true },
  { key: 'sadakat', label: 'Sadakat Nişanı', note: 'Üç yıl boyunca sunucuda kalmak', color: '#f4c95d', goal: 1095, value: (c) => c.days, gorev: true },
  { key: 'hazine', label: 'Hazine Avcısı', note: 'Yirmi bin coin kazandı', color: '#b57bff', goal: 20000, value: (c) => c.earned, gorev: true },
  { key: 'muzayede', label: 'Koleksiyon Efsanesi', note: 'Sekiz kozmetik sahibi', color: '#3ee0a1', goal: 8, value: (c) => c.owned, gorev: true },
  { key: 'gorev-ustasi', label: 'Görev Ustası', note: 'Altmış görev ödülü topladı', color: '#57d9a3', goal: 60, value: (c) => c.questsDone, gorev: true },
  { key: 'kutu-kirici', label: 'Kutu Kırıcı', note: 'On kutu açtı', color: '#ffd166', goal: 10, value: (c) => c.chests, gorev: true },
];

// Kartın ve rozet sayfasının ortak ölçüleri: her şey tek bir bağlamdan hesaplanır
function context({ guild, member, userId, messageCount = 0, voiceSeconds = 0, streamSeconds = 0, visits = 0 }) {
  const roles = member?.roles?.cache;
  const staffIds = [basvuruConfig.roles.accept, basvuruConfig.roles.reviewer].filter(Boolean);
  const mesajLevel = levelFromXp(seviyeStore.xpOf('mesaj', userId));
  const sesLevel = levelFromXp(seviyeStore.xpOf('ses', userId));
  // Suç dünyası sayıları ham kayıttan okunur: durumOf her üyede bir kez çağrılırsa bütün sunucunun sicil
  // defteri üye başına yeniden sıralanmış olur.
  const suc = sucStore.rec(userId);
  const sakalas = eglenceStore.durumOf(userId);
  const es = evlilikStore.esOf(userId);
  return {
    owner: guild?.ownerId === userId,
    staff: roles ? staffIds.some((id) => roles.has(id)) : false,
    booster: Boolean(member?.premiumSinceTimestamp),
    vip: Boolean(vipStore.grantedAt(userId)),
    weekly: ['mesaj', 'ses', 'yayin'].some((kind) => aktifStore.holder(kind) === userId),
    days: member?.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / DAY) : 0,
    messageCount,
    mesajLevel,
    sesLevel,
    ciftLevel: Math.min(mesajLevel, sesLevel),
    voiceHours: Math.floor(voiceSeconds / 3600),
    streamHours: Math.floor(streamSeconds / 3600),
    rep: saygiStore.allTotals()[userId] ?? 0,
    streak: coinStore.streak(userId),
    earned: coinStore.earned(userId),
    owned: profileStore.ownedCount(userId),
    questsDone: gorevStore.bitirilenSayisi(userId),
    chests: gorevStore.kutuSayilari(userId).toplam,
    visits,
    soygun: suc.basari,
    direnis: suc.direnis,
    ikramiye: suc.ikramiye,
    kesif: oyunStore.kesifSayilari(userId).toplam,
    sakalas: sakalas.atilanToplam,
    karsilik: sakalas.karsilikVerdi,
    renk: butikStore.rolleri(userId).length,
    evli: Boolean(es),
    esId: es ?? null,
    evlilikGun: es ? evlilikStore.birlikteGun(userId) : 0,
    donum: evlilikStore.bonusDurumu(userId)?.sayi ?? 0,
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

// Kartın, rozet sayfasının ve görev rolü eşitlemesinin ortak ölçüm kaynağı: haritalar bir kez alınıp birçok üye
// için yeniden kullanılır
function measures() {
  return {
    messages: siralamaStore.totals('messages', null),
    voice: siralamaStore.totals('voice', null),
    stream: siralamaStore.totals('stream', null),
  };
}

const contextOfMember = (guild, member, userId, m) =>
  context({
    guild,
    member,
    userId,
    messageCount: m.messages.get(userId) ?? 0,
    voiceSeconds: m.voice.get(userId) ?? 0,
    streamSeconds: m.stream.get(userId) ?? 0,
    visits: profileStore.visits(userId).count,
  });

module.exports = { BADGES, context, contextOfMember, measures, earned, progress };
