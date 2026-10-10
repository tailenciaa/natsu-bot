// Kalıcı oda kayıtları: başvurular (sunucu-numara ID'si ile) ve açılan odalar (oda numarası ile). Odalar kanal
// ID'lerinden de bulunur, çünkü panel işlemleri odanın kendi yazı kanalından, kanal silme olayı ise kanaldan gelir.
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

  deleteRoom(id) {
    if (!data.permanentRooms[id]) return false;
    delete data.permanentRooms[id];
    save();
    return true;
  },
};
