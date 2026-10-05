// Tüm sistemlerin verisi tek bir dosyada (data/db.json) tutulur; her sistem kendi bölümünü
// kendi klasöründeki store.js üzerinden okur ve yazar.
//   guilds[id].counter             : destek talebi sayacı
//   guilds[id].application.counter : başvuru sayacı
//   tickets / history              : açık / kapanmış destek talepleri (alt başlık ID'si ile)
//   ratings                        : yetkili değerlendirmeleri (talebin alt başlık ID'si ile)
//   applications                   : yetkili başvuruları (sunucu-numara ID'si ile)
//   panels                         : botun kendi gönderdiği panel mesajları (panel adı ile)
//   tagThanks                      : sunucu etiketi için teşekkür edilen üyeler (kullanıcı ID'si ile son mesaj zamanı)
//   punishments                    : sicildeki cezalar (sunucu-numara ID'si ile); guilds[id].punishmentCounter sayacı
//   stats.messages / stats.voice   : sıralama için kullanıcı başına günlük mesaj sayısı ve ses süresi (saniye)
//   weeklyActive / weeklyHolders   : haftalık en aktif üye takibi (mesaj/ses/yayın) ve o anki unvan sahipleri
//   weeklyLastRun                  : haftalık en aktif ödülünün en son ne zaman dağıtıldığı
//   boosterPerks                   : takviye eden üyelerin kullandığı ücretsiz emoji/çıkartma hakkı (kullanıcı ID'si ile)
//   boosterRoles / boosterNicks    : takviye süresince geçerli özel rol ve değiştirilen takma ad (takviye bitince geri alınır)
//   levelXp / levelAnnounced       : seviye sisteminin kalıcı XP'si ve duyurulan seviyeler, mesaj ve ses için ayrı (kullanıcı ID'si ile)
//   profiles                       : profil özelleştirmesi, biyografi ve profil rengi (kullanıcı ID'si ile)
//   newAccountRole                 : yeni/şüpheli hesap kısıtlama rolünün ID'si (sunucu ID'si ile)
//   privateRooms                   : açık özel odalar, sahibiyle birlikte (ses kanalı ID'si ile)
//   partnerRequests                : oto ya da elle yapılan tüm partner talepleri (talep ID'si ile)
//   trustedPartners                : güvenilir partnerler listesi (kayıt ID'si ile)
//   partnerTermsAccepted           : partner şartlarını kabul etmiş kullanıcılar (kullanıcı ID'si ile)
//   partnerStaffStatus             : partner yetkililerinin aktif/meşgul durumu (kullanıcı ID'si ile)
//   partnerRenewalOffers           : sürmekte olan "Teklifte Bulun" süreçleri (güvenilir kayıt ID'si ile)
//   partnerBans                    : partner sisteminden yasaklanan kullanıcılar (kullanıcı ID'si ile)
// Kalıcı kayıt: MONGODB_URI tanımlıysa veriler MongoDB'de (kazuki veritabanı, "state" koleksiyonu) tutulur,
// her üst düzey alan (tickets, history, guilds...) ayrı bir belge olarak: { _id: alan adı, value: veri }. Yerel data/db.json da yedek olarak yazılmaya devam eder.
// MONGODB_URI yoksa bot eskisi gibi sadece data/db.json ile çalışır.
// Önemli: init() sistemler yüklenmeden ÖNCE çağrılmalı (src/start.js bunu yapar), çünkü bazı store.js dosyaları
// açılışta data üzerinde alan oluşturuyor.
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'db.json');
const EMPTY = { guilds: {}, tickets: {}, history: {}, ratings: {}, applications: {}, panels: {} };
const MONGO_URI = process.env.MONGODB_URI?.trim();
const MONGO_DB = process.env.MONGODB_DB?.trim() || 'kazuki';
const FLUSH_DELAY = 2000; // ms; art arda gelen kayıtlar tek seferde gönderilir
const LOCAL_DELAY = 1000; // ms; yerel dosya yazımı da birleştirilir (her mesajda XP kaydı yüzlerce kez tam yazım yapmasın)
const RETRY_DELAY = 10000; // ms; MongoDB yazımı başarısız olursa yeniden deneme aralığı

const data = { ...EMPTY };

let collection = null; // MongoDB koleksiyonu (bağlıysa)
let mongoClient = null;
const lastSaved = new Map(); // alan adı -> MongoDB'ye en son yazılan JSON (sadece değişenleri göndermek için)
let flushTimer = null;
let localTimer = null;
let flushing = Promise.resolve();
let ready = false; // init() bitmeden save() yazmaz: yüklenmemiş boş veri mevcut db.json'un üstüne yazılmasın
const unreadable = new Set(); // MongoDB'de okunamayan belgelerin anahtarları; bozuk belgenin üstüne varsayılan değer yazılmaz

function readLocalFile() {
  if (!fs.existsSync(FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    console.error('[db] db.json okunamadı:', err.message);
    return null;
  }
}

function writeLocalFile() {
  clearTimeout(localTimer);
  localTimer = null;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error('[db] db.json yazılamadı:', err.message);
  }
}

async function init() {
  if (!MONGO_URI) {
    const local = readLocalFile();
    if (local) Object.assign(data, local);
    console.log('[db] MONGODB_URI yok, veriler data/db.json dosyasında tutuluyor.');
    ready = true;
    return;
  }

  const { MongoClient } = require('mongodb');
  mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongoClient.connect();
  collection = mongoClient.db(MONGO_DB).collection('state');

  const docs = await collection.find({}).toArray();
  if (docs.length > 0) {
    for (const doc of docs) {
      try {
        const value = doc.value !== undefined ? doc.value : JSON.parse(doc.json ?? 'null');
        data[doc._id] = value;
        lastSaved.set(doc._id, JSON.stringify(value ?? null));
      } catch (err) {
        unreadable.add(doc._id);
        console.error(`[db] "${doc._id}" alanı okunamadı, üzerine yazılmayacak:`, err.message);
      }
    }
    console.log(`[db] MongoDB'ye bağlanıldı, ${docs.length} veri bölümü yüklendi.`);
  } else {
    // Veritabanı boşsa yerel db.json varsa onu içeri aktar (ilk geçiş)
    const local = readLocalFile();
    if (local) Object.assign(data, local);
    await flushRemote();
    console.log(
      `[db] MongoDB'ye bağlanıldı (boştu). ${local ? 'Yerel db.json içeri aktarıldı.' : 'Boş veritabanı ile başlanıyor.'}`,
    );
  }
  ready = true;
}

// Değişen alanları MongoDB'ye yazar
function flushRemote() {
  if (!collection) return Promise.resolve();
  clearTimeout(flushTimer);
  flushTimer = null;
  flushing = flushing.then(async () => {
    const ops = [];
    for (const [key, value] of Object.entries(data)) {
      if (unreadable.has(key)) continue;
      const json = JSON.stringify(value ?? null);
      if (lastSaved.get(key) === json) continue;
      ops.push({ key, json, value });
    }
    for (const key of lastSaved.keys()) {
      if (!(key in data)) ops.push({ key, json: null });
    }
    if (ops.length === 0) return;
    try {
      await collection.bulkWrite(
        ops.map(({ key, json, value }) =>
          json === null
            ? { deleteOne: { filter: { _id: key } } }
            : { replaceOne: { filter: { _id: key }, replacement: { value: value ?? null }, upsert: true } },
        ),
        { ordered: false },
      );
      for (const { key, json } of ops) {
        if (json === null) lastSaved.delete(key);
        else lastSaved.set(key, json);
      }
    } catch (err) {
      console.error(`[db] MongoDB'ye yazılamadı, ${RETRY_DELAY / 1000} saniye sonra tekrar denenecek:`, err.message);
      if (!flushTimer) flushTimer = setTimeout(flushRemote, RETRY_DELAY);
    }
  });
  return flushing;
}

function save() {
  if (!ready) return; // yükleme bitmeden yazılırsa mevcut kayıtların üstüne boş veri yazılırdı
  if (!localTimer) localTimer = setTimeout(writeLocalFile, LOCAL_DELAY);
  if (collection && !flushTimer) flushTimer = setTimeout(flushRemote, FLUSH_DELAY);
}

// Kapanışta bekleyen kayıtları gönderip bağlantıyı kapatır
async function close() {
  if (ready) writeLocalFile();
  await flushRemote();
  await mongoClient?.close().catch(() => {});
}

// Sunucu kaydı yoksa oluşturur (sayaçlar için)
const guildData = (guildId) => (data.guilds[guildId] ??= {});

module.exports = { data, save, guildData, init, flushRemote, close };
