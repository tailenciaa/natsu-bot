// Profil puanı: üyenin sunucudaki bütün hareketinin tek sayıda toplanması. Kart, puan sayfası ve sıralama aynı
// fonksiyondan çıkar; böylece hiçbir yerde iki farklı sayı görünmez.
//
// Puan **yalnızca kazanılan şeyleri toplar** (1000 üst sınır), ceza/sicil gibi şeylerden düşmez: kart herkese açık
// olduğu için cezayı puana yansıtmak, üye olmadığı bir şey için halka açık şekilde cezalandırmak olurdu.
// Rütbe tabanları da puandan türer; üyenin bir üst rütbe için ne kadar kaldığı kartta ve sayfada gösterilir ki
// her zaman bir sonraki hedef görünsün.
const rozet = require('./rozet');

// Puan bölümleri. `value(ctx, rozetSayisi)` rozet bağlamından (rozet.js) türeyen ölçümleri kullanır.
const PARTS = [
  {
    key: 'aktivite',
    label: 'Aktivite',
    max: 300,
    note: 'Mesaj ve ses seviyen (her biri en fazla 120) ile seste ve ekran paylaşımında geçen saatlerin.',
    value: (c) =>
      Math.min(120, c.mesajLevel * 3) + Math.min(120, c.sesLevel * 3) + Math.min(30, Math.floor(c.voiceHours / 2)) + Math.min(30, Math.floor(c.streamHours / 2)),
  },
  {
    key: 'saygi',
    label: 'Saygınlık',
    max: 200,
    note: 'Sana verilen her saygınlık 2 puan. En fazla 100 saygınlık sayılır.',
    value: (c) => Math.min(200, c.rep * 2),
  },
  {
    key: 'koleksiyon',
    label: 'Rozetler',
    max: 150,
    note: 'Kazandığın her rozet 6 puan. Rozetler sayfadaki listenin kendisinden gelir.',
    value: (c, rozetSayisi) => Math.min(150, rozetSayisi * 6),
  },
  {
    key: 'urunler',
    label: 'Koleksiyon',
    max: 150,
    note: 'Mağazadan sahip olduğun her çerçeve, tema, arka plan ve sergi rozeti 10 puan.',
    value: (c) => Math.min(150, c.owned * 10),
  },
  {
    key: 'duzen',
    label: 'Giriş Serisi',
    max: 80,
    note: 'Art arda alınan günlük ödülün her günü 4 puan; seri bozulunca sıfırdan başlar.',
    value: (c) => Math.min(80, c.streak * 4),
  },
  {
    key: 'sosyal',
    label: 'Sosyal',
    max: 60,
    note: 'Profil kartını açan kişi sayısı. Ne kadar çok kişi kartına bakıyorsa o kadar görünürsün.',
    value: (c) => Math.min(60, Math.round(Math.sqrt(c.visits) * 6)),
  },
  {
    key: 'sadakat',
    label: 'Sadakat',
    max: 60,
    note: 'Sunucuda geçirdiğin her yıl 20 puan.',
    value: (c) => Math.min(60, Math.round((c.days / 365) * 20)),
  },
];

// Rütbe basamakları: puan eşikleri. Adlar kartta ve sayfalarda aynı sırayla okunur.
const TIERS = [
  { key: 'misafir', label: 'Misafir', min: 0 },
  { key: 'tanidik', label: 'Tanıdık', min: 100 },
  { key: 'aktif', label: 'Aktif Üye', min: 220 },
  { key: 'sevilen', label: 'Sevilen', min: 360 },
  { key: 'saygin', label: 'Saygın', min: 520 },
  { key: 'usta', label: 'Usta', min: 680 },
  { key: 'efsane', label: 'Efsane', min: 820 },
  { key: 'destan', label: 'Destan', min: 930 },
];

const MAX_PUAN = PARTS.reduce((total, p) => total + p.max, 0);

const tierIndex = (total) => {
  let index = 0;
  for (let i = 0; i < TIERS.length; i += 1) if (total >= TIERS[i].min) index = i;
  return index;
};

const tierOf = (total) => TIERS[tierIndex(total)];

// Rozet bağlamından puanı üretir: { total, tier, next, parts: [{ label, max, points, note }] }
// `next` en üst basamakta null'dur; `ratio` rütbe çubuğunun doluluk oranıdır.
function scoreOf(ctx, rozetSayisi = 0) {
  const parts = PARTS.map((p) => ({ key: p.key, label: p.label, max: p.max, note: p.note, points: p.value(ctx, rozetSayisi) }));
  const total = parts.reduce((sum, p) => sum + p.points, 0);
  const index = tierIndex(total);
  const tier = TIERS[index];
  const next = TIERS[index + 1] ?? null;
  return {
    total,
    max: MAX_PUAN,
    parts,
    tier,
    next: next ? { label: next.label, at: next.min, remaining: next.min - total, ratio: (total - tier.min) / (next.min - tier.min) } : null,
  };
}

// ── Sunucu geneli tablo ───────────────────────────────────────────────────────
// Puan herkesin verisinden beslendiği için tek tek hesaplamak yerine bütün sunucu bir geçişte hesaplanır ve
// kısa süre önbellekte tutulur. Kart, puan sayfası ve ilk 10 listesi aynı tabloyu okur; sıra asla şaşmaz.
const TTL = 5 * 60 * 1000;
let cache = { guildId: null, at: 0, entries: null, byUser: null };

async function computeBoard(guild) {
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return { entries: [], byUser: new Map() };
  const m = rozet.measures();
  const entries = [];
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const ctx = rozet.contextOfMember(guild, member, member.id, m);
    const score = scoreOf(ctx, rozet.earned(ctx).length);
    entries.push({ userId: member.id, total: score.total, tier: score.tier.label });
  }
  entries.sort((a, b) => b.total - a.total || a.userId.localeCompare(b.userId));
  const byUser = new Map(entries.map((e, i) => [e.userId, { rank: i + 1, total: e.total, tier: e.tier }]));
  return { entries, byUser };
}

// { entries: [{ userId, total, tier }], byUser: Map(userId -> { rank, total, tier }), size }
async function board(guild) {
  const now = Date.now();
  if (cache.guildId !== guild.id || !cache.entries || now - cache.at > TTL) {
    const fresh = await computeBoard(guild);
    cache = { guildId: guild.id, at: now, ...fresh };
  }
  return { entries: cache.entries, byUser: cache.byUser, size: cache.entries.length };
}

// Üyenin puan sırası ve sıralamadaki üye sayısı; tablo henüz hesaplanmamışsa null döner (kart "-" çizmez)
const rankOf = async (guild, userId) => {
  const b = await board(guild);
  return { rank: b.byUser.get(userId)?.rank ?? null, size: b.size };
};

module.exports = { PARTS, TIERS, MAX_PUAN, tierOf, scoreOf, board, rankOf };
