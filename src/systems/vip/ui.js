// VIP mesajı: rol verildiğinde kanala düşen onay kartı. VIP listesi artık /siralama menüsünün bir türü.
const { alert } = require('../../core/ui');

// Verme onayı (herkese açık)
function given(giverId, targetId) {
  return alert(`<@${giverId}>, <@${targetId}> üyesine VIP rolünü verdi.`, null, 'success');
}

module.exports = { given };
