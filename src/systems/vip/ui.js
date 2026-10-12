// VIP mesajı: rol verildiğinde kanala düşen onay kartı. VIP listesi artık /siralama menüsünün bir türü.
const { alert } = require('../../core/ui');

// Verme onayı (herkese açık)
function given(giverId, targetId, roleId) {
  return alert(`<@${giverId}>, <@${targetId}> üyesine VIP rolünü verdi.`, `<@${targetId}> artık <@&${roleId}> rolüne sahip.`, 'success');
}

module.exports = { given };
