// Saygınlık mesajları: verme onayı, tüm zamanların tablosu ve haftalık kazanan duyurusu (ödül bölümüyle birlikte)
const { alert, field, fields, page } = require('../../core/ui');

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
    .map(({ userId, value }, i) => `${i < 3 ? PODIUM[i] : ''}${i + 1}. <@${userId}> » \`${value} saygınlık\``);
  return page({
    title: 'Saygınlık Tablosu',
    sub: 'Sunucuda bugüne kadar en çok saygınlık kazanan üyeleri tüm zamanların toplamına göre sıraladık; sen de `/saygi-ver` ile ya da mesajına `+rep @üye` yazarak +1 saygınlık verebilirsin.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks: [lines.length ? lines.join('\n') : '**Henüz kayıt yok.**\nİlk saygınlığı sen ver.'],
  });
}

// results: [{ userId, value }] geçen haftanın ilk 5'i, büyükten küçüğe sıralı; sadece birinci duyurulur
function weeklyAnnounce(guild, results, roleId) {
  const winner = results[0] ?? null;
  const roleText = roleId ? `<@&${roleId}>` : 'Haftanın Saygın Üyesi';
  return page({
    title: 'Haftanın Saygın Üyesi',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks: [
      'Geçen hafta **en çok saygınlık kazanan üyeyi** açıklıyoruz; **haftanın en saygın üyesi** bu ödülü kazanır ve rolünü **bir sonraki pazartesiye kadar** taşır.',
      winner
        ? `**Tebrikler <@${winner.userId}>!**\nBu hafta **${winner.value} saygınlık** toplayarak **haftanın en saygın üyesi** oldun ve ${roleText} rolünü kazandın.`
        : '**Henüz Kazanan Yok**\nGeçen hafta kimse saygınlık kazanmadı.',
    ],
  });
}

module.exports = { given, table, weeklyAnnounce };
