// Kalıcı oda kayıtları: başvurular (sunucu-numara ID'si ile) ve açılan odalar (oda numarası ile). Panel işlemleri
// kendi odasını yöneten kişiden yola çıkar, kanal silme olayı ise oda kaydı kanal ID'sinden bulur.
const { data, save, guildData } = require('../../core/db');

data.permanentRoomApplications ??= {};
data.permanentRooms ??= {};

const DAY = 24 * 60 * 60 * 1000;

module.exports = {
  // ── Başvurular ───────────────────────────────────────────────────────────────
  nextApplicationNumber(guildId) {
    const g = guildData(guildId);
    g.permanentRoomCounter ??= { applications: 0, rooms: 0 };
    g.permanentRoomCounter.applications += 1;
    save();
    return g.permanentRoomCounter.applications;
  },

  setApplication(id, app) {
    data.permanentRoomApplications[id] = app;
    save();
    return app;
  },

  getApplication(id) {
    return data.permanentRoomApplications[id] ?? null;
  },

  updateApplication(id, patch) {
    const app = data.permanentRoomApplications[id];
    if (!app) return null;
    Object.assign(app, patch);
    save();
    return app;
  },

  removeApplication(id) {
    if (!data.permanentRoomApplications[id]) return false;
    delete data.permanentRoomApplications[id];
    save();
    return true;
  },

  applicationsOf(guildId, userId) {
    return Object.values(data.permanentRoomApplications)
      .filter((a) => a.guildId === guildId && a.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  pendingApplications(guildId) {
    return Object.values(data.permanentRoomApplications)
      .filter((a) => a.guildId === guildId && a.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  // Son reddedilen başvurunun üstünden kaç gün geçti (reddedilen yoksa null)
  daysSinceRejection(guildId, userId) {
    const last = this.applicationsOf(guildId, userId).find((a) => a.status === 'rejected');
    return last ? (Date.now() - last.reviewedAt) / DAY : null;
  },

  // ── Odalar ───────────────────────────────────────────────────────────────────
  nextRoomNumber(guildId) {
    const g = guildData(guildId);
    g.permanentRoomCounter ??= { applications: 0, rooms: 0 };
    g.permanentRoomCounter.rooms += 1;
    save();
    return g.permanentRoomCounter.rooms;
  },

  setRoom(id, room) {
    data.permanentRooms[id] = room;
    save();
    return room;
  },

  getRoom(id) {
    return data.permanentRooms[id] ?? null;
  },

  roomsOf(guildId) {
    return Object.values(data.permanentRooms).filter((r) => r.guildId === guildId);
  },

  roomsOwned(guildId, userId) {
    return this.roomsOf(guildId).filter((r) => r.ownerId === userId);
  },

  // Odanın kategorisi, ses ya da yazı kanalıyla gelen her olay burada odayı bulur
  roomOfChannel(channelId) {
    return Object.values(data.permanentRooms).find(
      (r) => r.categoryId === channelId || r.voiceChannelId === channelId || r.textChannelId === channelId,
    ) ?? null;
  },

  updateRoom(id, patch) {
    const room = data.permanentRooms[id];
    if (!room) return null;
    Object.assign(room, patch);
    save();
    return room;
  },

  // Biten bir haftanın odadaki toplam sesi (saniye) haftanın pazartesi anahtarıyla yazılır. Oda ay sonu şartını
  // geçmişi üzerinden aşsın diye tutulur; 9 haftadan eski kayıt atılır.
  recordWeek(id, week, seconds) {
    const room = data.permanentRooms[id];
    if (!room) return null;
    room.weeks ??= {};
    room.weeks[week] = seconds;
    const keys = Object.keys(room.weeks).sort();
    for (const key of keys.slice(0, Math.max(0, keys.length - 9))) delete room.weeks[key];
    save();
    return room;
  },

  deleteRoom(id) {
    if (!data.permanentRooms[id]) return false;
    delete data.permanentRooms[id];
    save();
    return true;
  },

  // ── Şart denetimi ────────────────────────────────────────────────────────────
  // Denetimler dönem başına bir kez çalışır: hangi haftanın/ayın işlendiği sunucu kaydında durur.
  lastAudit(guildId, kind) {
    return guildData(guildId).permanentRoomAudit?.[kind] ?? null;
  },

  setLastAudit(guildId, kind, period) {
    const g = guildData(guildId);
    g.permanentRoomAudit ??= {};
    g.permanentRoomAudit[kind] = period;
    save();
  },
};
