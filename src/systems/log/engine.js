// Log motoru: kategoriler kendi gruplarının (groups.js) kanalında, o kanalın altında bir alt başlığa yazar.
// Alt başlık ilk ihtiyaç anında (ya da bot açılışında, sendPanel ile) açılır; silinmişse ya da arşivdeyse
// otomatik düzeltilir.
// Alt başlıklar "herkese açık" (PublicThread) türünde açılır: böylece grubun log kanalını görebilen (yani ana
// log kanalı gibi sadece yetkililerin erişebildiği bir kanalda tutulan) herkes alt başlıkları da görebilir;
// "özel" alt başlık (PrivateThread) sunucunun 2. seviye takviye olmasını gerektirdiği için burada kullanılmıyor.
const { ChannelType, ThreadAutoArchiveDuration } = require('discord.js');
const { guildId } = require('../../core/config');
const { fetchTextChannel } = require('../../core/helpers');
const core = require('../../core/ui');
const categories = require('./categories');
const config = require('./config');
const { GROUPS, groupOf } = require('./groups');
const store = require('./store');

const UNKNOWN_CHANNEL = 10003;
const FALLBACK_MS = 10 * 60 * 1000; // grup kanalı açılamazsa yeniden denemeden önce beklenecek süre
const creating = new Map(); // kategori/grup anahtarı -> oluşturma Promise'i (aynı anda iki kez açılmasın diye)
const fallbackUntil = new Map(); // grup anahtarı -> kanal kurulumu denenmeyecek zaman

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

// Kanalın erişim izinleri kopyalanır: log grupları da ana log kanalı gibi sadece yetkililere görünür.
const cloneOverwrites = (channel) =>
  [...channel.permissionOverwrites.cache.values()].map((o) => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny }));

// Grubun log kanalını getirir, yoksa ana kanalın bulunduğu klasörde ve onun izinleriyle açar.
// Ana log kanalı (config.channels.main) her zaman son sığınaktır: grup kanalı açılamazsa loglar orada akmaya
// devam eder, yoksa bütün log yazımları sessizce düşer.
async function ensureGroupChannel(client, groupKey) {
  const group = groupOf(groupKey);
  const guild = client.guilds.cache.get(guildId);
  const main = await fetchTextChannel(guild, config.channels.main);
  if (!main) {
    console.error(`[log] Ana log kanalı bulunamadı (${config.channels.main}).`);
    return null;
  }

  const savedId = store.getGroupChannel(group.key);
  if (savedId) {
    const channel = await guild.channels.fetch(savedId).catch((err) => (err.code === UNKNOWN_CHANNEL ? null : undefined));
    if (channel) {
      if (channel.name !== group.channelName) await channel.setName(group.channelName, 'Log grubu kanalı yeniden adlandırıldı').catch(() => {});
      return channel;
    }
    if (channel === null) store.setGroupChannel(group.key, null);
  }

  if (fallbackUntil.get(group.key) > Date.now()) return main;
  if (creating.has(group.key)) return creating.get(group.key);

  const promise = (async () => {
    const existing = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === group.channelName);
    if (existing) {
      store.setGroupChannel(group.key, existing.id);
      return existing;
    }
    try {
      const channel = await guild.channels.create({
        name: group.channelName,
        type: ChannelType.GuildText,
        parent: main.parentId ?? undefined,
        permissionOverwrites: cloneOverwrites(main),
        reason: `${group.label} log grubu kanalı`,
      });
      store.setGroupChannel(group.key, channel.id);
      console.log(`[log] "${group.label}" grubunun log kanalı açıldı: #${channel.name}`);
      return channel;
    } catch (err) {
      fallbackUntil.set(group.key, Date.now() + FALLBACK_MS);
      console.error(`[log] "${group.label}" log kanalı açılamadı, loglar ana log kanalına yazılıyor:`, err.message);
      return main;
    }
  })();

  creating.set(group.key, promise);
  try {
    return await promise;
  } finally {
    creating.delete(group.key);
  }
}

// Kategorinin alt başlığını getirir, yoksa grubunun kanalında açar. Aynı anda birden fazla çağrı gelirse tek sefer oluşturulur.
async function ensureThread(client, key) {
  const category = categoryOf(key);
  const guild = client.guilds.cache.get(guildId);
  const parent = await ensureGroupChannel(client, category.group);
  if (!parent) return null;

  const savedId = store.getThreadId(key);
  if (savedId) {
    const thread = await guild.channels.fetch(savedId).catch((err) => (err.code === UNKNOWN_CHANNEL ? null : undefined));
    // Alt başlık başka bir kanalın altındaysa (eski tek kanal düzeni) taşınmaz: yerinde arşiv olarak kalır,
    // kaydı bırakılır ve yenisi grubunun kanalında açılır. Kayıt artık yoksa da bırakılır.
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

// Kategorinin alt başlığını (içindeki eski loglarla birlikte) siler ve grubunun kanalında yenisini açar
async function resetThread(client, key) {
  const category = categoryOf(key);
  const guild = client.guilds.cache.get(guildId);
  const parent = await ensureGroupChannel(client, category.group);
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
