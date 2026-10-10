// Muhabbet kayıtları: sırada bekleyen üyeler (sunucu:üye anahtarı ile), açık odalar (sunucu-numara anahtarı ile)
// ve oda kapandıktan sonra tekrar sıraya girmeyi geciktiren bekleme (sunucu:üye anahtarı ile). Odalar kanal ve üye
// ID'sinden de bulunur; panel işlemleri odanın yazı kanalından, üye ayrılması ve kanal silinme olayı oradan gelir.
const { data, save, guildData } = require('../../core/db');

data.muhabbetQueue ??= {};
data.muhabbetRooms ??= {};
data.muhabbetCooldown ??= {};

const key = (guildId, userId) => `${guildId}:${userId}`;

module.exports = {
  // ── Sıra ─────────────────────────────────────────────────────────────────────
  enqueue(guildId, userId) {
    const entry = { guildId, userId, joinedAt: Date.now() };
    data.muhabbetQueue[key(guildId, userId)] = entry;
    save();
    return entry;
  },

  dequeue(guildId, userId) {
    if (!data.muhabbetQueue[key(guildId, userId)]) return false;
    delete data.muhabbetQueue[key(guildId, userId)];
    save();
    return true;
  },

  inQueue(guildId, userId) {
    return Boolean(data.muhabbetQueue[key(guildId, userId)]);
  },

  // Bekleme süresi en eski olan önde
  queueOf(guildId) {
    return Object.values(data.muhabbetQueue)
      .filter((e) => e.guildId === guildId)
      .sort((a, b) => a.joinedAt - b.joinedAt);
  },

  // Sıradaki yeri (1'den başlar), sırada değilse 0
  position(guildId, userId) {
    return this.queueOf(guildId).findIndex((e) => e.userId === userId) + 1 || 0;
  },

  clearQueue(guildId) {
    const removed = this.queueOf(guildId);
    for (const entry of removed) delete data.muhabbetQueue[key(guildId, entry.userId)];
    if (removed.length) save();
    return removed;
  },

  // ── Yeniden sıraya girme beklemesi ───────────────────────────────────────────
  setCooldown(guildId, userId, ms) {
    data.muhabbetCooldown[key(guildId, userId)] = Date.now() + ms;
    save();
  },

  // Bekleme sürmüşse kalan saniye, yoksa null
  cooldownLeft(guildId, userId) {
    const until = data.muhabbetCooldown[key(guildId, userId)];
    if (!until) return null;
    if (Date.now() >= until) {
      delete data.muhabbetCooldown[key(guildId, userId)];
      save();
      return null;
    }
    return Math.ceil((until - Date.now()) / 1000);
  },

  // ── Odalar ───────────────────────────────────────────────────────────────────
  nextRoomNumber(guildId) {
    const g = guildData(guildId);
    g.muhabbetCounter ??= 0;
    g.muhabbetCounter += 1;
    save();
    return g.muhabbetCounter;
  },

  setRoom(id, room) {
    data.muhabbetRooms[id] = room;
    save();
    return room;
  },

  getRoom(id) {
    return data.muhabbetRooms[id] ?? null;
  },

  updateRoom(id, patch) {
    const room = data.muhabbetRooms[id];
    if (!room) return null;
    Object.assign(room, patch);
    save();
    return room;
  },

  deleteRoom(id) {
    if (!data.muhabbetRooms[id]) return false;
    delete data.muhabbetRooms[id];
    save();
    return true;
  },

  roomsOf(guildId) {
    return Object.values(data.muhabbetRooms).filter((r) => r.guildId === guildId);
  },

  // Bir üye aynı anda en fazla bir muhabbet odasında bulunabilir
  roomOfUser(guildId, userId) {
    return this.roomsOf(guildId).find((r) => r.users.includes(userId)) ?? null;
  },

  roomOfChannel(channelId) {
    return Object.values(data.muhabbetRooms).find((r) => r.voiceChannelId === channelId || r.textChannelId === channelId) ?? null;
  },
};
