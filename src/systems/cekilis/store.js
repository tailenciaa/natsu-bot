// Çekiliş kayıtları (data.giveaways, çekiliş numarası ile). Katılımcılar kullanıcı ID listesi olarak tutulur.
//   { no, messageId, channelId, prize, winnerCount, endsAt, hostId, roleId, participants, winners, status }
// status: 'active' (açık), 'ended' (bitti), 'cancelled' (iptal edildi). Bitenler 30 gün sonra temizlenir.
const { data, save } = require('../../core/db');

const all = () => (data.giveaways ??= {});
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

module.exports = {
  create(record) {
    data.giveawayCounter = (data.giveawayCounter ?? 0) + 1;
    const giveaway = { ...record, no: data.giveawayCounter, participants: [], winners: [], status: 'active' };
    all()[giveaway.no] = giveaway;
    save();
    return giveaway;
  },
  get: (no) => all()[no] ?? null,
  byMessage: (messageId) => Object.values(all()).find((g) => g.messageId === messageId) ?? null,
  active: () => Object.values(all()).filter((g) => g.status === 'active'),
  save() {
    const now = Date.now();
    for (const [no, g] of Object.entries(all())) if (g.status !== 'active' && now - g.endsAt > KEEP_MS) delete all()[no];
    save();
  },
};
