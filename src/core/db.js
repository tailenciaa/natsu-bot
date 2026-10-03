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
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', '..', 'data', 'db.json');
const EMPTY = { guilds: {}, tickets: {}, history: {}, ratings: {}, applications: {}, panels: {} };

const data = { ...EMPTY };

if (fs.existsSync(FILE)) {
  try {
    Object.assign(data, JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (err) {
    console.error('[db] db.json okunamadı, boş veritabanı ile başlanıyor:', err.message);
  }
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

// Sunucu kaydı yoksa oluşturur (sayaçlar için)
const guildData = (guildId) => (data.guilds[guildId] ??= {});

module.exports = { data, save, guildData };
