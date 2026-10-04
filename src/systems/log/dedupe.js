// Sicil sisteminin bot üzerinden verdiği susturma ve yasaklamalar, Discord'un kendi "üye güncellendi" / "yasaklama"
// olaylarını da tetikler; bu olaylar ham olarak da loglanırsa aynı işlem iki kez (biri zengin detaylı, biri
// "bot dışından" diyerek) loglanır. Sicil, Discord'a işlemi uygulamadan hemen önce burada kısa süreliğine
// "bu kullanıcı için bu türde bir şey bekleniyor" diye işaretler; ham olay dinleyicisi geldiğinde bunu görüp
// kendi (daha az detaylı) logunu atlar. 10 saniye içinde olay gelmezse işaret kendiliğinden silinir.
const TTL = 10_000;
const pending = new Set();

function key(guildId, userId, kind) {
  return `${guildId}:${userId}:${kind}`;
}

function markHandled(guildId, userId, kind) {
  const k = key(guildId, userId, kind);
  pending.add(k);
  setTimeout(() => pending.delete(k), TTL);
}

// İşareti varsa tüketir (bir kez kullanılır) ve true döner; yoksa false döner.
function consumeHandled(guildId, userId, kind) {
  const k = key(guildId, userId, kind);
  if (!pending.has(k)) return false;
  pending.delete(k);
  return true;
}

module.exports = { markHandled, consumeHandled };
