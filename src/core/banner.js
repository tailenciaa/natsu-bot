// Panel afişleri. Afişler Discord'a yüklenmiş görsellerin cdn.discordapp.com bağlantılarıyla ayarlanır; ama bu bağlantılar
// imzalıdır (?ex=...&is=...&hm=...) ve yaklaşık 24 saat sonra süresi dolar, afiş görünmez olur. Bu yüzden panel gönderilmeden
// önce görsel bir kez indirilip yerel olarak saklanır ve panele mesajın kendi eki (attachment://) olarak eklenir; ek hiç
// süresi dolmaz. Önce assets/banners/<dosya adı> aranır (elle koyulan kalıcı kopya), sonra data/banners/ önbelleği,
// yoksa bot tokeniyle bağlantı yenilenip indirilir. İndirilemezse eski bağlantı olduğu gibi kullanılır (bugünkü davranış).
const fs = require('node:fs');
const path = require('node:path');

const CDN = /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/(\d+)\/(\d+)\/([^/?#]+)/i;
const ASSET_DIR = path.join(__dirname, '..', '..', 'assets', 'banners');
const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'banners');
const MAX_BYTES = 8 * 1024 * 1024;
const RETRY_AFTER = 10 * 60 * 1000; // indirilemeyen görsel için yeniden deneme aralığı

const failedAt = new Map(); // bağlantı anahtarı -> son başarısız deneme zamanı
const warned = new Set();

// Bağlantıdan { key, id, filename } çıkarır; imza parametreleri (?ex...) anahtara dahil değildir, bu yüzden bağlantı yenilense de aynı kalır
function parse(url) {
  const match = typeof url === 'string' ? url.match(CDN) : null;
  if (!match) return null;
  const [, channelId, id, rawName] = match;
  const filename = decodeURIComponent(rawName).toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return { key: `${channelId}/${id}/${rawName}`, id, filename };
}

const candidates = (parsed) => [path.join(ASSET_DIR, parsed.filename), path.join(CACHE_DIR, `${parsed.id}-${parsed.filename}`)];

// Yerel kopyası varsa { file, name } döndürür (name: attachment:// adı)
function find(url) {
  const parsed = parse(url);
  if (!parsed) return null;
  const file = candidates(parsed).find((candidate) => fs.existsSync(candidate));
  return file ? { file, name: path.basename(file) } : null;
}

// Mesajdaki afiş bağlantısı için "attachment://dosya" ya da (yerel kopya yoksa) null
const localUrl = (url) => {
  const found = find(url);
  return found ? `attachment://${found.name}` : null;
};

// Bağlantıdaki imza parametrelerini atar (panel özetinin her bağlantı yenilemede değişmemesi için)
const stripSignature = (value) => String(value).replace(/(https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/\d+\/\d+\/[^?"\s]+)\?[^"\s]*/gi, '$1');

async function download(client, url, parsed) {
  let source = url;
  try {
    const result = await client.rest.post('/attachments/refresh-urls', { body: { attachment_urls: [url] } });
    source = result?.refreshed_urls?.[0]?.refreshed ?? url;
  } catch {
    // yenilenemediyse asıl bağlantı denenir
  }

  const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`görsel değil (${type || 'bilinmiyor'})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error(`geçersiz boyut (${buffer.length} bayt)`);

  const target = candidates(parsed)[1];
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(`${target}.tmp`, buffer);
  fs.renameSync(`${target}.tmp`, target);
}

// Verilen bağlantılardan yerel kopyası olmayanları indirir. Hata fırlatmaz, hep devam eder.
async function ensure(client, urls) {
  const seen = new Set();
  for (const url of urls) {
    const parsed = parse(url);
    if (!parsed || seen.has(parsed.key) || find(url)) continue;
    seen.add(parsed.key);

    if (Date.now() - (failedAt.get(parsed.key) ?? 0) < RETRY_AFTER) continue;
    try {
      await download(client, url, parsed);
      console.log(`[afis] ${parsed.filename} indirilip kaydedildi.`);
    } catch (err) {
      failedAt.set(parsed.key, Date.now());
      if (!warned.has(parsed.key)) {
        warned.add(parsed.key);
        console.error(`[afis] ${parsed.filename} indirilemedi, eski bağlantı kullanılacak: ${err.message}`);
      }
    }
  }
}

// Mesaj JSON'undaki attachment:// adlarından yerel dosyaları bulup { name, buffer } listesi verir
function attachmentsFor(names) {
  const out = [];
  for (const name of new Set(names)) {
    const file = [path.join(ASSET_DIR, name), path.join(CACHE_DIR, name)].find((candidate) => fs.existsSync(candidate));
    if (file) out.push({ name, buffer: fs.readFileSync(file) });
  }
  return out;
}

module.exports = { parse, find, localUrl, stripSignature, ensure, attachmentsFor };
