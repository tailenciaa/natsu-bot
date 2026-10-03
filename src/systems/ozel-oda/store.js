// Açık özel odaların kaydı: bot yeniden başlasa da kimin hangi odanın sahibi olduğu kaybolmasın diye tutulur.
const { data, save } = require('../../core/db');

data.privateRooms ??= {};

module.exports = {
  setRoom(channelId, room) {
    data.privateRooms[channelId] = room;
    save();
    return room;
  },

  getRoom(channelId) {
    return data.privateRooms[channelId] ?? null;
  },

  updateRoom(channelId, patch) {
    if (!data.privateRooms[channelId]) return null;
    Object.assign(data.privateRooms[channelId], patch);
    save();
    return data.privateRooms[channelId];
  },

  deleteRoom(channelId) {
    if (!data.privateRooms[channelId]) return false;
    delete data.privateRooms[channelId];
    save();
    return true;
  },

  roomsOf(guildId) {
    return Object.entries(data.privateRooms).filter(([, room]) => room.guildId === guildId);
  },
};
