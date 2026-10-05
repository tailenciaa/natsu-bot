// Saygınlık mesajları: verme onayı, tüm zamanların tablosu ve haftalık kazanan duyurusu (ödül bölümüyle birlikte)
const { alert, page } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];
const PAGE_SIZE = 15;

// Verme onayı (herkese açık): kime +1 verildiğini ve hedefin yeni toplamını gösterir
function given(giverId, targetId, newTotal) {
  return alert(`<@${giverId}>, <@${targetId}> üyesine +1 saygınlık verdi.`, `<@${targetId}> şu an toplam **${newTotal}** saygınlığa sahip.`, 'success');
}

// ranking: [{ userId, value }] büyükten küçüğe sıralı, tüm zamanlar toplamı
function table(guild, ranking) {
  const lines = ranking
    .slice(0, PAGE_SIZE)
    .map(({ userId, value }, i) => `${i < 3 ? PODIUM[i] : '-# '}${i + 1}. <@${userId}> » \`${value} saygınlık\``);
  return page({
    title: 'Saygınlık Tablosu',
    sub: 'Sunucuda bugüne kadar en çok saygınlık kazanan üyeleri tüm zamanların toplamına göre sıraladık; sen de `/saygi-ver` ile ya da mesajına `+rep @üye` yazarak +1 saygınlık verebilirsin.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks: [lines.length ? lines.join('\n') : '**Henüz kayıt yok.**\n-# İlk saygınlığı sen ver.'],
  });
}

// results: [{ userId, value }] geçen haftanın ilk 5'i, büyükten küçüğe sıralı
function weeklyAnnounce(guild, results, roleId) {
  const lines = results.map(({ userId, value }, i) => `${i + 1}. <@${userId}> » \`${value} saygınlık\``);
  const blocks = [`**En Çok Saygınlık Kazananlar**\n${lines.join('\n')}`];
  if (results[0]) {
    blocks.push(`**Kazanılan Rol**\n<@${results[0].userId}> ${roleId ? `<@&${roleId}>` : 'Haftanın Saygın Üyesi'} rolünü aldı.`);
  }
  return page({
    title: 'Haftanın Saygın Üyesi',
    sub: 'Geçen hafta en çok saygınlık kazanan üyeleri açıklıyoruz; birinci olan üye haftanın en saygın üyesi olur ve rolünü bir sonraki pazartesiye kadar taşır.',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks,
  });
}

module.exports = { given, table, weeklyAnnounce };
