// Görev rozetlerinin rol ödülleri: uzun vadeli hedefleri (rozet.js'te `gorev: true`) tamamlayan üyeye bot
// config.js'te karşılığı yazılı rolü verir; hedef gerilerse (kayıt silinmesi, rolün yanlışlığı gibi) rol geri alınır.
// Kontrol noktaları: bot açılırken bütün sunucu, üye sunucuya girerken ve üye kendi rozet sayfasını açtığında.
const config = require('./config');
const rozet = require('./rozet');
const store = require('./store');
const siralamaStore = require('../siralama/store');

// Rol ID'si doldurulmuş görevler; hepsi boşsa özellik sessizce devre dışı kalır
const ROLE_KEYS = Object.entries(config.gorevRolleri).filter(([, id]) => id);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ölçümler tek tek üye için de bütün sunucu için de aynı haritalardan okunur
function measures() {
  return {
    messages: siralamaStore.totals('messages', null),
    voice: siralamaStore.totals('voice', null),
    stream: siralamaStore.totals('stream', null),
  };
}

// Üyenin görev durumunu hesaplayıp rolleri eşitler; değiştiği rol sayısı döner
async function syncMember(member, m = measures()) {
  if (member.user.bot || !ROLE_KEYS.length) return 0;
  const userId = member.id;
  const ctx = rozet.context({
    guild: member.guild,
    member,
    userId,
    messageCount: m.messages.get(userId) ?? 0,
    voiceSeconds: m.voice.get(userId) ?? 0,
    streamSeconds: m.stream.get(userId) ?? 0,
    visits: store.visits(userId).count,
  });
  const won = new Set(rozet.earned(ctx).filter((b) => b.gorev).map((b) => b.key));

  let changed = 0;
  for (const [key, id] of ROLE_KEYS) {
    const has = member.roles.cache.has(id);
    if (won.has(key) && !has) {
      try {
        await member.roles.add(id, 'Görev rozeti ödülü');
        changed++;
      } catch (err) {
        console.error(`[profil] Görev rolü verilemedi (${key}):`, err.message);
      }
    } else if (!won.has(key) && has) {
      try {
        await member.roles.remove(id, 'Görev hedefi artık taşınmıyor');
        changed++;
      } catch (err) {
        console.error(`[profil] Görev rolü kaldırılamadı (${key}):`, err.message);
      }
    }
  }
  return changed;
}

// Bütün sunucuyu tarar; yalnızca gerçekten rol işlemi yapıldığında Discord sınırına takmamak için kısa bekler
async function syncAll(guild) {
  if (!ROLE_KEYS.length) return;
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return console.error('[profil] Görev rolleri eşitlenemedi: üye listesi alınamadı.');
  const m = measures();
  let checked = 0;
  let changed = 0;
  for (const member of members.values()) {
    const n = await syncMember(member, m).catch((err) => {
      console.error('[profil] Görev rolü eşitlenemedi:', err.message);
      return 0;
    });
    checked++;
    if (n) {
      changed += n;
      await sleep(300);
    }
  }
  console.log(`[profil] Görev rolleri eşitlendi (${checked} üye kontrol edildi, ${changed} rol güncellendi).`);
}

module.exports = { syncMember, syncAll, ROLE_KEYS };
