// Başlangıç: .env varsa okunur, önce veritabanı yüklenir, sonra bot (src/index.js) başlatılır.
// (Railway'de .env yoktur; değişkenler Railway ayarlarından gelir.)
try {
  process.loadEnvFile();
} catch {
  // .env yok, sorun değil
}
require('./core/logger');
const db = require('./core/db');

async function start() {
  try {
    await db.init();
  } catch (err) {
    console.error('[hata] Veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  }

  try {
    require('./index');
  } catch (err) {
    // Botun yüklenmesindeki (sistem dosyaları, ayarlar) hatalar veritabanı hatasıyla karışmasın
    console.error('[hata] Bot başlatılamadı:', err);
    process.exit(1);
  }
}

start();
