// Denetim kaydından (audit log) bir işlemi yapan yetkiliyi bulur. Discord kaydı olaydan biraz sonra yazdığı için
// kısa süre beklenir; botun "Denetim Kaydını Görüntüle" yetkisi yoksa ya da kayıt bulunamazsa null döner.
const WAIT = 1200;
const MAX_AGE = 15_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function entryOf(guild, type, targetId, filter) {
  await sleep(WAIT);
  const logs = await guild.fetchAuditLogs({ type, limit: 8 }).catch(() => null);
  return logs?.entries.find((e) => (!targetId || e.targetId === targetId) && (!filter || filter(e)) && Date.now() - e.createdTimestamp < MAX_AGE) ?? null;
}

// Log satırı olarak yetkili: "**Yetkili:** <@id>" (bulunamazsa null, satır eklenmez)
async function by(guild, type, targetId, filter) {
  const entry = await entryOf(guild, type, targetId, filter);
  return entry?.executor ? `**Yetkili:** <@${entry.executor.id}>` : null;
}

module.exports = { entryOf, by };
