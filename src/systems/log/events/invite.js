// Davet takibi: her davetin kullanım sayısı bellekte tutulur; bir üye katılınca sayısı artan davet, katılanın
// hangi davetle geldiğini gösterir. Botun "Sunucuyu Yönet" yetkisi yoksa davetler okunamaz, takip sessizce kapalı kalır.
const { guildId } = require('../../../core/config');

const cache = new Map(); // guildId -> Map(kod -> { uses, inviterId, maxUses })

const snapshot = (invites) =>
  new Map([...invites.values()].map((i) => [i.code, { uses: i.uses ?? 0, inviterId: i.inviter?.id ?? null, maxUses: i.maxUses }]));

async function load(guild) {
  const invites = await guild.invites.fetch().catch(() => null);
  if (invites) cache.set(guild.id, snapshot(invites));
  return invites;
}

// Bot açılınca mevcut davetlerin sayılarını kaydeder
async function init(client) {
  const guild = client.guilds.cache.get(guildId);
  if (guild) await load(guild);
}

// Yeni davet oluşturulunca kayda eklenir (silinenler bilerek kayıttan çıkarılmaz, bkz. findUsed)
function add(invite) {
  const guildCache = cache.get(invite.guild?.id);
  guildCache?.set(invite.code, { uses: invite.uses ?? 0, inviterId: invite.inviter?.id ?? null, maxUses: invite.maxUses });
}

// Üye katılınca çağrılır: kullanım sayısı artan daveti döner; bulunamazsa null
async function findUsed(guild) {
  const before = cache.get(guild.id);
  const invites = await guild.invites.fetch().catch(() => null);
  if (!invites) return null;
  const after = snapshot(invites);
  cache.set(guild.id, after);
  if (!before) return null;

  for (const [code, now] of after) {
    if (now.uses > (before.get(code)?.uses ?? 0)) return { code, inviterId: now.inviterId, uses: now.uses };
  }
  // Son kullanımıyla kendiliğinden silinen (sınırlı kullanımlı) davet
  for (const [code, old] of before) {
    if (!after.has(code) && old.maxUses && old.uses + 1 === old.maxUses) return { code, inviterId: old.inviterId, uses: old.maxUses };
  }
  return null;
}

module.exports = { init, add, findUsed };
