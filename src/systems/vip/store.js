// VIP verileri: kullanıcı ID'si -> ne zaman ve kim tarafından VIP verildiği. Rolün kendisi tek doğru kaynaktır
// (bot kapanıp açılsa da Discord'daki rol kaybolmaz); bu kayıt sadece /vip-siralama'da sıralama için kullanılır.
const { data, save } = require('../../core/db');

data.vip ??= {};

function grant(userId, byId) {
  data.vip[userId] = { grantedAt: Date.now(), grantedBy: byId };
  save();
}

const grantedAt = (userId) => data.vip[userId]?.grantedAt ?? null;

module.exports = { grant, grantedAt };
