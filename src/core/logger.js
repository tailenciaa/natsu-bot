const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

// Konsol çıktısı terminalin yanında bot.log dosyasına da yazılır, hatalar sonradan incelenebilsin diye
const FILE = path.join(__dirname, '..', '..', 'bot.log');
const MAX_BYTES = 5 * 1024 * 1024;

// Dosya şişmesin: açılışta 5 MB'ı aşmışsa eskisi bot.log.1 olarak saklanıp yenisi başlatılır
try {
  if (fs.statSync(FILE).size > MAX_BYTES) fs.renameSync(FILE, `${FILE}.1`);
} catch {
  // dosya yok ya da taşınamadı, sorun değil
}

const stream = fs.createWriteStream(FILE, { flags: 'a' });
// Dosya yazılamazsa (kilitli, disk dolu) bot çökmesin; konsol çıktısı yine de çalışır
stream.on('error', () => {});

for (const level of ['log', 'info', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    stream.write(`[${time}] ${util.format(...args)}\n`);
  };
}
