// Log sisteminin verisi: her kategorinin ana log kanalının altında açtığı alt başlığın ID'si
// (data.logThreads, kategori anahtarı ile). Alt başlık silinirse engine.js yeniden oluşturup kaydı günceller.
const { data, save } = require('../../core/db');

const threads = () => (data.logThreads ??= {});

module.exports = {
  getThreadId(key) {
    return threads()[key] ?? null;
  },

  setThreadId(key, threadId) {
    threads()[key] = threadId;
    save();
  },
};
