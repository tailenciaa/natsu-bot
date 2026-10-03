// Ceza kayıtları: punishments, sunucu-numara ID'si ile. Silinen kayıtlar tutulur ama sicilde görünmez.
// status: active (sürüyor) | expired (süresi doldu) | lifted (bir yetkili kaldırdı) | deleted (sicilden silindi)
const { data, save, guildData } = require('../../core/db');

data.punishments ??= {};

const visible = (p) => p.status !== 'deleted';

module.exports = {
  nextNumber(guildId) {
    const guild = guildData(guildId);
    guild.punishmentCounter = (guild.punishmentCounter ?? 0) + 1;
    save();
    return guild.punishmentCounter;
  },

  create(punishment) {
    data.punishments[punishment.id] = punishment;
    save();
    return punishment;
  },

  get(id) {
    return data.punishments[id] ?? null;
  },

  update(id, patch) {
    if (!data.punishments[id]) return null;
    Object.assign(data.punishments[id], patch);
    save();
    return data.punishments[id];
  },

  // Kullanıcının sicildeki cezaları: önce aktifler, sonra en yeniler
  of(guildId, userId) {
    return Object.values(data.punishments)
      .filter((p) => p.guildId === guildId && p.userId === userId && visible(p))
      .sort((a, b) => (b.status === 'active') - (a.status === 'active') || b.createdAt - a.createdAt);
  },

  // Kişinin yetkili olarak verdiği cezaların sayısı (silinenler hariç)
  givenCount(guildId, userId) {
    return Object.values(data.punishments).filter((p) => p.guildId === guildId && p.by === userId && visible(p)).length;
  },

  // Aynı türden sürmekte olan ceza (uyarılar hariç)
  activeOf(guildId, userId, type) {
    return (
      Object.values(data.punishments).find(
        (p) => p.guildId === guildId && p.userId === userId && p.type === type && p.status === 'active',
      ) ?? null
    );
  },

  // Süresi dolmuş, hâlâ aktif görünen süreli cezalar
  expired() {
    return Object.values(data.punishments).filter((p) => p.status === 'active' && p.expiresAt && p.expiresAt <= Date.now());
  },
};
