// Profil özelleştirmesi: biyografi, unvan, renk, tema ve kapak görselinin yanında vitrin (zamir, bağlantılar, öne
// çıkan istatistik) ile coin ile alınan kozmetiklerin sahipliği. Ziyaret kaydı ayrı tutulur: profiles üyenin
// kendi yazdığı şeyleri, profileVisits başkalarının kartına ne kadar bakıldığını taşır.
// İleride coin/para sistemi de buraya eklenecek.
const { data, save } = require('../../core/db');

data.profiles ??= {};
data.profileVisits ??= {};

// Son ziyaret listesinde tutulan kişi sayısı
const RECENT_KEEP = 8;

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
  ownsFrame(userId, key) {
    return (this.get(userId).ownedFrames ?? []).includes(key);
  },

  ownsTheme(userId, key) {
    return (this.get(userId).ownedThemes ?? []).includes(key);
  },

  // Satın alma: zaten sahipse false döner, para bu durumda alınmaz
  addFrame(userId, key) {
    const owned = this.get(userId).ownedFrames ?? [];
    if (owned.includes(key)) return false;
    this.set(userId, { ownedFrames: [...owned, key] });
    return true;
  },

  addTheme(userId, key) {
    const owned = this.get(userId).ownedThemes ?? [];
    if (owned.includes(key)) return false;
    this.set(userId, { ownedThemes: [...owned, key] });
    return true;
  },

  // Sahip olunan kozmetik sayısı (koleksiyoncu rozeti bunu kullanır)
  ownedCount(userId) {
    const custom = this.get(userId);
    return (custom.ownedFrames?.length ?? 0) + (custom.ownedThemes?.length ?? 0);
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
