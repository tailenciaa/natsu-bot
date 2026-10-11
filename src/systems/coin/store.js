// Coin cüzdanları: kullanıcı ID'si -> { coins: harcanabilir bakiye, earned: hiç harcanmadan biriken toplam,
// streak: art arda günlük ödül alınan gün sayısı, lastClaimDay/lastClaimAt: en son ödülün gün anahtarı ve anı,
// wins: gün anahtarı -> o gün tavana sayılı olarak kazanılan coin }.
// Kazançlar az sayıda ve kullanıcı etkinliğine bağlı olduğu için her değişiklikte doğrudan kaydedilir (debounce'a gerek yok).
// Satın almalar (purchases) aynı dosyada durur: harcanan coin'in neye gittiği üyenin kendisine gösterilir.
const { data, save } = require('../../core/db');
const config = require('./config');

data.coins ??= {};
data.purchases ??= {};

const DAY = 24 * 60 * 60 * 1000;
// Oyun tavanı gün anahtarıyla sayılır; karşılaştırma bugün ve dünü gördüğü için üç gün yeter, fazlası atılır
const WIN_KEEP = 3;

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

  // Günlük ödülün bir sonraki hazır olacağı an: bugün alındıysa günün sonu, değilse şu an
  dailyReadyAt(userId, at = Date.now()) {
    const w = data.coins[userId];
    if (!w || w.lastClaimDay !== dayKey(at)) return at;
    return dayStart(w.lastClaimAt) + DAY;
  },

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

  // ── Oyun ve eğlence tavanı ──────────────────────────────────────────────────
  // Keşif ganimeti, eğlence karşılığı ve kasa soygunu tek sayaca yazılır: gün başına config.winCap kadar coin
  // ödenir, fazlası ödenmez. Kumarhane bahsi sayaca girmez — orada üye kendi parasını risk eder, yeni coin doğmaz.
  // Sayıç gün anahtarıyla tutulur, gece bekçisi yoktur; eski günler atılır.
  winStatus(userId, at = Date.now()) {
    const gun = dayKey(at);
    const kazanilan = data.coins[userId]?.wins?.[gun] ?? 0;
    return { gun, kazanilan, kalan: Math.max(0, config.winCap - kazanilan), tavan: config.winCap };
  },

  // Tavana kadar öder. Talep tavanı aşıyorsa yalnızca kalan kadarı yatar, kesen dönen kayıtta görünür ki
  // ödeyen sistem üyeye "tavanın doldu" diyebilsin.
  addWin(userId, amount, reason = 'oyun', at = Date.now()) {
    const istenen = Math.max(0, Math.floor(amount));
    const { gun, kazanilan, kalan } = this.winStatus(userId, at);
    const odenen = Math.min(istenen, kalan);
    if (!odenen) return { istenen, odenen: 0, kesilen: istenen, kalan: 0, balance: this.balance(userId) };

    const w = wallet(userId);
    w.coins += odenen;
    w.earned += odenen;
    const wins = { ...(w.wins ?? {}), [gun]: kazanilan + odenen };
    w.wins = Object.fromEntries(Object.entries(wins).sort((a, b) => b[0].localeCompare(a[0])).slice(0, WIN_KEEP));
    save();
    console.log(`[coin] ${userId}: +${odenen} (${reason}), bakiye ${w.coins}`);
    return { istenen, odenen, kesilen: istenen - odenen, kalan: Math.max(0, config.winCap - (kazanilan + odenen)), balance: w.coins };
  },

  // Üye→üye para taşıma (soygun, ödül bahsi): alan tarafın "kazanç" hanesine yazılmaz, böylece rozetler ve
  // birikim sayacı çalıntı parayı kendi emeği saymaz. Bakiye yetmiyorsa hiçbir şey taşınmaz.
  transfer(fromId, toId, amount, reason = 'el değiştirme') {
    const miktar = Math.floor(amount);
    const source = data.coins[fromId];
    if (!(miktar > 0) || !source || source.coins < miktar) return false;
    source.coins -= miktar;
    wallet(toId).coins += miktar;
    save();
    console.log(`[coin] ${fromId} -> ${toId}: ${miktar} (${reason})`);
    return true;
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
