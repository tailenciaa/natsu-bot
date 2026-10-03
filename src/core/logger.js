const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

// Konsol çıktısı terminalin yanında bot.log dosyasına da yazılır, hatalar sonradan incelenebilsin diye
const stream = fs.createWriteStream(path.join(__dirname, '..', '..', 'bot.log'), { flags: 'a' });

for (const level of ['log', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    stream.write(`[${time}] ${util.format(...args)}\n`);
  };
}
