// Log sisteminin verisi: her kategorinin alt başlığının ID'si (data.logThreads) ve her log grubunun kendi
// kanalının ID'si (data.logGroupChannels). Kayıtlar silinirse ya da kanal/alt başlık artık yoksa engine.js
// yeniden oluşturup kaydı günceller.
const { data, save } = require('../../core/db');

const threads = () => (data.logThreads ??= {});
const groupChannels = () => (data.logGroupChannels ??= {});

// "Detaylı Bilgi" butonunun gösterdiği veri: log mesajının ID'si ile. Veri şişmesin diye en son 600 kayıt tutulur.
const MAX_DETAILS = 600;
const details = () => (data.logDetails ??= {});

module.exports = {
  getThreadId(key) {
    return threads()[key] ?? null;
  },

  getGroupChannel(key) {
    return groupChannels()[key] ?? null;
  },

  setGroupChannel(key, channelId) {
    if (channelId === null) delete groupChannels()[key];
    else groupChannels()[key] = channelId;
    save();
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
