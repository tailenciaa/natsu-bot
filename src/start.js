// Başlangıç: .env varsa okunur, önce veritabanı yüklenir, sonra bot (src/index.js) başlatılır.
// (Railway'de .env yoktur; değişkenler Railway ayarlarından gelir.)
try {
  process.loadEnvFile();
} catch {
  // .env yok, sorun değil
}
require('./core/logger');
const db = require('./core/db');

db.init()
  .then(() => require('./index'))
  .catch((err) => {
    console.error('[hata] Veritabanına bağlanılamadı:', err.message);
    process.exit(1);
  });
