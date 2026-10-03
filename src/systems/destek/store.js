// Destek taleplerinin kaydı: tickets (açık), history (kapanmış), ikisi de alt başlık ID'si ile
const { data, save, guildData } = require('../../core/db');

module.exports = {
  nextTicketNumber(guildId) {
    const guild = guildData(guildId);
    guild.counter = (guild.counter ?? 0) + 1;
    save();
    return guild.counter;
  },

  getTicket(threadId) {
    return data.tickets[threadId] ?? null;
  },

  setTicket(threadId, ticket) {
    data.tickets[threadId] = ticket;
    save();
    return ticket;
  },

  updateTicket(threadId, patch) {
    if (!data.tickets[threadId]) return null;
    Object.assign(data.tickets[threadId], patch);
    save();
    return data.tickets[threadId];
  },

  deleteTicket(threadId) {
    if (!data.tickets[threadId]) return;
    delete data.tickets[threadId];
    save();
  },

  // Kapanan talebi açık taleplerden çıkarıp geçmişe taşır
  archiveTicket(threadId) {
    const ticket = data.tickets[threadId];
    if (!ticket) return;
    data.history[threadId] = { ...ticket, closedAt: Date.now() };
    delete data.tickets[threadId];
    save();
  },

  // Kullanıcının bu sunucudaki açık taleplerinin alt başlık ID'leri
  openTicketsOf(guildId, userId) {
    return Object.entries(data.tickets)
      .filter(([, t]) => t.guildId === guildId && t.ownerId === userId)
      .map(([threadId]) => threadId);
  },

  // Kullanıcının açtığı tüm talepler (açık + kapanmış), en yeni önce
  ticketsOpenedBy(guildId, userId) {
    return [...Object.values(data.tickets), ...Object.values(data.history)]
      .filter((t) => t.guildId === guildId && t.ownerId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  ticketsClaimedBy(guildId, userId) {
    return [...Object.values(data.tickets), ...Object.values(data.history)].filter(
      (t) => t.guildId === guildId && t.claimedBy === userId,
    );
  },
};
