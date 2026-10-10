// Saygınlık mesajları: verme bildirimi, tüm zamanların tablosu ve haftalık kazanan duyurusu (ödül bölümüyle birlikte)
const { receipt, rows, chip, page } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];
const PAGE_SIZE = 15;

// Verme bildirimi (herkese açık): kimin kime verdiği ve hedefin yeni toplamı satırlarda; böylece kanalda
// okuyan da saygınlığın nasıl kazanıldığını görür
function given(giverId, targetId, newTotal) {
  return receipt({
    title: 'Saygınlık Verildi',
    sub: `<@${giverId}> bir üyeye saygınlık verdi. Saygınlık **/saygi-ver** ile ya da mesajın içine **+rep @üye** yazarak verilir; haftanın birincisi ödül rolünü alır.`,
    pairs: [
      ['Kişi', `<@${targetId}>`],
      ['Verilen', chip('+1 saygınlık')],
      ['Yeni Toplam', chip(`${newTotal} saygınlık`)],
    ],
  });
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
    title:
      'Haftanın En Saygın Kişisi\nGeçen hafta **en çok saygınlık kazanan üyeyi** açıklıyoruz; **haftanın en saygın üyesi** bu ödülü kazanır ve rolünü **bir sonraki pazartesiye kadar** taşır.',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks: [
      winner
        ? rows([
            ['Kişi', `<@${winner.userId}>`],
            ['Toplam Saygınlık', chip(winner.value)],
            ['Ödül', `${roleText} rolü`],
          ])
        : '**Henüz Kazanan Yok**\nGeçen hafta kimse saygınlık kazanmadı.',
    ],
  });
}

module.exports = { given, table, weeklyAnnounce };
