// Görev rozetlerinin rol ödülleri: uzun vadeli hedefleri (rozet.js'te `gorev: true`) tamamlayan üyeye bot
// config.js'te karşılığı yazılı rolü verir; hedef gerilerse (kayıt silinmesi, rolün yanlışlığı gibi) rol geri alınır.
// Kontrol noktaları: bot açılırken bütün sunucu, üye sunucuya girerken ve üye kendi rozet sayfasını açtığında.
const config = require('./config');
const rozet = require('./rozet');

// Rol ID'si doldurulmuş görevler; hepsi boşsa özellik sessizce devre dışı kalır
const ROLE_KEYS = Object.entries(config.gorevRolleri).filter(([, id]) => id);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Üyenin görev durumunu hesaplayıp rolleri eşitler; değiştiği rol sayısı döner
async function syncMember(member, m = rozet.measures()) {
  if (member.user.bot || !ROLE_KEYS.length) return 0;
  const won = new Set(rozet.earned(rozet.contextOfMember(member.guild, member, member.id, m)).filter((b) => b.gorev).map((b) => b.key));

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
  const m = rozet.measures();
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
