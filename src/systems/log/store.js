// Log sisteminin verisi: her kategorinin ana log kanalının altında açtığı alt başlığın ID'si
// (data.logThreads, kategori anahtarı ile). Alt başlık silinirse engine.js yeniden oluşturup kaydı günceller.
const { data, save } = require('../../core/db');

const threads = () => (data.logThreads ??= {});

// "Detaylı Bilgi" butonunun gösterdiği veri: log mesajının ID'si ile. Veri şişmesin diye en son 600 kayıt tutulur.
const MAX_DETAILS = 600;
const details = () => (data.logDetails ??= {});

module.exports = {
  getThreadId(key) {
    return threads()[key] ?? null;
  },

  saveDetail(messageId, meta) {
    const all = details();
    all[messageId] = meta;
    const ids = Object.keys(all);
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_DETAILS))) delete all[id];
    save();
  },

  getDetail(messageId) {
    return details()[messageId] ?? null;
  },

  setThreadId(key, threadId) {
    threads()[key] = threadId;
    save();
  },
};
