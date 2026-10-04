// Boost (sunucu takviyesi) logları. GuildMemberUpdate olayının bu kısmı member.js tarafından çağrılır.
const engine = require('../engine');
const ui = require('../ui');

async function checkBoost(oldMember, newMember) {
  if (oldMember.premiumSinceTimestamp === newMember.premiumSinceTimestamp) return;

  if (newMember.premiumSinceTimestamp) {
    await engine.send(newMember.client, 'boost', ui.entry('success', 'Sunucu Takviyesi Başladı', [`**Kullanıcı:** <@${newMember.id}>`]));
  } else {
    await engine.send(newMember.client, 'boost', ui.entry('danger', 'Sunucu Takviyesi Sona Erdi', [`**Kullanıcı:** <@${newMember.id}>`]));
  }
}

module.exports = { checkBoost };
