// Log motoru: her kategorinin ana log kanalının altında bir alt başlığı olur, ilk ihtiyaç anında (ya da bot
// açılışında, sendPanel ile) açılır. Alt başlık silinmişse, arşivdeyse ya da yanlış bir kanalın altına düşmüşse
// otomatik düzeltilir.
// Alt başlıklar "herkese açık" (PublicThread) türünde açılır: böylece ana log kanalını görebilen (yani sadece
// yetkililerin erişebildiği bir kanal olarak ayarlanmış) herkes alt başlıkları da görebilir; "özel" alt başlık
// (PrivateThread) sunucunun 2. seviye takviye olmasını gerektirdiği için burada kullanılmıyor.
const { ChannelType, ThreadAutoArchiveDuration } = require('discord.js');
const { guildId } = require('../../core/config');
const { fetchTextChannel } = require('../../core/helpers');
const core = require('../../core/ui');
const categories = require('./categories');
const config = require('./config');
const store = require('./store');

const UNKNOWN_CHANNEL = 10003;
const creating = new Map(); // kategori anahtarı -> oluşturma Promise'i (aynı anda iki kez açılmasın diye)

function categoryOf(key) {
  const category = categories.find((c) => c.key === key);
  if (!category) throw new Error(`[log] Tanımsız log kategorisi: ${key}`);
  return category;
}

async function findExistingThread(parent, name) {
  const active = await parent.threads.fetchActive().catch(() => null);
  const inActive = active?.threads.find((t) => t.name === name);
  if (inActive) return inActive;
  const archived = await parent.threads.fetchArchived().catch(() => null);
  return archived?.threads.find((t) => t.name === name) ?? null;
}

// Kategorinin alt başlığını getirir, yoksa ana log kanalının altında açar. Aynı anda birden fazla çağrı gelirse
// tek sefer oluşturulur.
async function ensureThread(client, key) {
  const category = categoryOf(key);
  const guild = client.guilds.cache.get(guildId);
  const parent = await fetchTextChannel(guild, config.channels.main);
  if (!parent) {
    console.error(`[log] Ana log kanalı bulunamadı (${config.channels.main}).`);
    return null;
  }

  const savedId = store.getThreadId(key);
  if (savedId) {
    const thread = await guild.channels.fetch(savedId).catch((err) => (err.code === UNKNOWN_CHANNEL ? null : undefined));
    // Alt başlık ana log kanalının dışında bir yerdeyse Discord onu geri taşımaz: kaydı bırakılır ve ana
    // kanalın altındaki doğru adlı alt başlık bulunup ona yazılır.
    if (thread && thread.parentId === parent.id) {
      if (thread.archived) await thread.setArchived(false).catch(() => {});
      if (thread.name !== category.threadName) await thread.setName(category.threadName, 'Log alt başlığı yeniden adlandırıldı').catch(() => {});
      return thread;
    }
    if (thread !== undefined) store.setThreadId(key, null);
  }

  if (creating.has(key)) return creating.get(key);

  const promise = (async () => {
    const existing = await findExistingThread(parent, category.threadName);
    if (existing) {
      store.setThreadId(key, existing.id);
      if (existing.archived) await existing.setArchived(false).catch(() => {});
      return existing;
    }

    const thread = await parent.threads.create({
      name: category.threadName,
      type: ChannelType.PublicThread,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `${category.label} için log alt başlığı`,
    });
    store.setThreadId(key, thread.id);
    console.log(`[log] "${category.label}" için alt başlık açıldı: #${thread.name}`);
    return thread;
  })();

  creating.set(key, promise);
  try {
    return await promise;
  } finally {
    creating.delete(key);
  }
}

// Kategorinin alt başlığını (içindeki eski loglarla birlikte) siler ve yenisini açar
async function resetThread(client, key) {
  const category = categoryOf(key);
  const guild = client.guilds.cache.get(guildId);
  const parent = await fetchTextChannel(guild, config.channels.main);
  if (!parent) return null;

  const savedId = store.getThreadId(key);
  const saved = savedId ? await guild.channels.fetch(savedId).catch(() => null) : null;
  // Kayıtlı alt başlığa ek olarak aynı adlı eski alt başlık da silinir (kayıt kaybolmuş olabilir)
  const same = await findExistingThread(parent, category.threadName);
  for (const thread of new Set([saved, same].filter(Boolean))) await thread.delete('Log alt başlığı sıfırlandı').catch(() => {});
  store.setThreadId(key, null);
  return ensureThread(client, key);
}

// Bot açılırken grup kanallarını ve tüm kategorilerin alt başlıklarını önceden hazırlar; böylece log paneli ilk
// andan itibaren kullanılabilir.
async function ensureAllThreads(client) {
  for (const group of GROUPS) await ensureGroupChannel(client, group.key).catch(() => null);
  for (const { key } of categories) {
    await ensureThread(client, key).catch((err) => console.error(`[log] "${key}" alt başlığı hazırlanamadı:`, err.message));
  }
}

// Ana log kanalında kalan, artık hiçbir kategorinin kullanmadığı alt başlık sayısı (eski düzenin arşivi).
// Silinmez, sadece kurulum menüsünde gösterilir.
async function orphanThreads(client) {
  const guild = client.guilds.cache.get(guildId);
  const main = await fetchTextChannel(guild, config.channels.main);
  if (!main) return 0;
  const used = new Set(categories.map((c) => store.getThreadId(c.key)).filter(Boolean));
  const active = await main.threads.fetchActive().catch(() => null);
  return [...(active?.threads.values() ?? [])].filter((thread) => !used.has(thread.id)).length;
}

async function send(client, key, container) {
  const thread = await ensureThread(client, key);
  if (!thread) return null;
  const message = await thread.send({ components: [container], flags: core.CV2, allowedMentions: { parse: [] } }).catch((err) => {
    console.error(`[log] "${key}" kategorisine log gönderilemedi:`, err.message);
    return null;
  });
  // "Detaylı Bilgi" butonunun göstereceği veri log mesajının ID'siyle saklanır
  if (message && container.logMeta) store.saveDetail(message.id, { ...container.logMeta, category: key });
  return message;
}

module.exports = { ensureThread, ensureGroupChannel, resetThread, ensureAllThreads, orphanThreads, send, categoryOf };
