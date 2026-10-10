// Profil özelleştirmesi: biyografi, unvan, renk, tema, kapak efekti ve kapak görselinin konumu/ölçeği ile vitrin
// (zamir, bağlantılar, öne çıkan istatistik) ve coin ile alınan kozmetiklerin sahipliği. Ziyaret kaydı ayrı tutulur:
// profiles üyenin kendi yazdığı şeyleri, profileVisits başkalarının kartına ne kadar bakıldığını taşır. Coin
// bakiyesi ayrı bir sistemde (coins) tutulur, buraya sadece alınan kozmetiklerin listesi yazılır.
const { data, save } = require('../../core/db');

data.profiles ??= {};
data.profileVisits ??= {};

// Son ziyaret listesinde tutulan kişi sayısı
const RECENT_KEEP = 8;

// Satın alınabilen kozmetik grupları (mağazadaki sekmelerle aynı sırayı izler)
const OWNED_FIELDS = ['ownedFrames', 'ownedThemes', 'ownedCovers', 'ownedBadges'];

module.exports = {
  get(userId) {
    return data.profiles[userId] ?? {};
  },

  set(userId, patch) {
    data.profiles[userId] = { ...(data.profiles[userId] ?? {}), ...patch };
    save();
    return data.profiles[userId];
  },

  // ── Kozmetik sahipliği ──────────────────────────────────────────────────────
  owns(userId, field, key) {
    return (this.get(userId)[field] ?? []).includes(key);
  },

  // Satın alma: zaten sahipse false döner, para bu durumda alınmaz
  addOwned(userId, field, key) {
    const owned = this.get(userId)[field] ?? [];
    if (owned.includes(key)) return false;
    this.set(userId, { [field]: [...owned, key] });
    return true;
  },

  // Sahip olunan kozmetik sayısı (koleksiyon rozetleri bunu kullanır)
  ownedCount(userId) {
    const custom = this.get(userId);
    return OWNED_FIELDS.reduce((total, field) => total + (custom[field]?.length ?? 0), 0);
  },

  // ── Profil ziyareti ─────────────────────────────────────────────────────────
  // Kartı başkası tarafından açıldığında sayar; kendi kartını açan ziyaret sayılmaz (çağıran taraf karar verir)
  addVisit(userId, visitorId, at = Date.now()) {
    const record = (data.profileVisits[userId] ??= { count: 0, recent: [] });
    record.count += 1;
    record.recent = [{ by: visitorId, at }, ...(record.recent ?? []).filter((r) => r.by !== visitorId)].slice(0, RECENT_KEEP);
    save();
  },

  visits(userId) {
    const record = data.profileVisits[userId];
    return { count: record?.count ?? 0, recent: record?.recent ?? [] };
  },
};
