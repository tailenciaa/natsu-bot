// Coin cüzdanları: kullanıcı ID'si -> { coins: harcanabilir bakiye, earned: hiç harcanmadan biriken toplam,
// streak: art arda günlük ödül alınan gün sayısı, lastClaimDay/lastClaimAt: en son ödülün gün anahtarı ve anı }.
// Kazançlar az sayıda ve kullanıcı etkinliğine bağlı olduğu için her değişiklikte doğrudan kaydedilir (debounce'a gerek yok).
// Satın almalar (purchases) aynı dosyada durur: harcanan coin'in neye gittiği üyenin kendisine gösterilir.
const { data, save } = require('../../core/db');
const config = require('./config');

data.coins ??= {};
data.purchases ??= {};

const DAY = 24 * 60 * 60 * 1000;

// Gün anahtarı ve gün başlangıcı İstanbul saatiyle (Türkiye kalıcı saat dilimi kullandığı için +03:00 sabit)
const dayKey = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const dayStart = (ms) => Date.parse(`${dayKey(ms)}T00:00:00+03:00`);

const wallet = (userId) => (data.coins[userId] ??= { coins: 0, earned: 0, streak: 0, lastClaimDay: null, lastClaimAt: 0 });

module.exports = {
  dayKey,

  balance: (userId) => data.coins[userId]?.coins ?? 0,

  earned: (userId) => data.coins[userId]?.earned ?? 0,

  streak: (userId) => data.coins[userId]?.streak ?? 0,

  lastClaimAt: (userId) => data.coins[userId]?.lastClaimAt ?? 0,

  // Ödül ekler; kazandıran olayın adı sadece log için kullanılır
  add(userId, amount, reason = 'ödül') {
    if (!(amount > 0)) return this.balance(userId);
    const w = wallet(userId);
    w.coins += amount;
    w.earned += amount;
    save();
    console.log(`[coin] ${userId}: +${amount} (${reason}), bakiye ${w.coins}`);
    return w.coins;
  },

  // Kozmetik alımı: bakiye yetiyorsa düşer ve true döner
  spend(userId, amount) {
    const w = data.coins[userId];
    if (!w || w.coins < amount) return false;
    w.coins -= amount;
    save();
    return true;
  },

  // Satın alma kaydı: coin düştürülüp ürün sahipliğe geçtikten sonra yazılır
  recordPurchase(userId, { tur, key, name, price }) {
    const list = data.purchases[userId] ??= [];
    const purchase = { id: `${userId}-${Date.now()}`, userId, tur, key, name, price, at: Date.now() };
    list.push(purchase);
    save();
    return purchase;
  },

  // Üyenin siparişleri: en yeni başta
  purchasesOf(userId) {
    return [...(data.purchases[userId] ?? [])].reverse();
  },

  // Bugüne kadar harcanan toplam
  spent(userId) {
    return (data.purchases[userId] ?? []).reduce((sum, p) => sum + p.price, 0);
  },

  // Günlük ödül. Bugün alındıysa { ok: false, nextAt } döner. level: üyenin ulaştığı en yüksek mesaj/ses seviyesi.
  claim(userId, level = 0, at = Date.now()) {
    const w = wallet(userId);
    const today = dayKey(at);
    if (w.lastClaimDay === today) return { ok: false, nextAt: dayStart(w.lastClaimAt) + DAY };

    const yesterday = dayKey(at - DAY);
    w.streak = w.lastClaimDay === yesterday ? w.streak + 1 : 1;
    const streakBonus = Math.min(w.streak - 1, config.daily.streakMax) * config.daily.streakBonus;
    const levelBonus = Math.min(level, config.daily.levelCap) * config.daily.perLevel;
    const amount = config.daily.base + streakBonus + levelBonus;

    w.coins += amount;
    w.earned += amount;
    w.lastClaimDay = today;
    w.lastClaimAt = at;
    save();
    return { ok: true, amount, streak: w.streak, bonus: streakBonus + levelBonus, balance: w.coins };
  },
};
