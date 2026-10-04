// Saygınlık mesajları: verme onayı, tüm zamanların tablosu ve haftalık kazanan duyurusu (ödül bölümüyle birlikte)
const { text, page } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];
const PAGE_SIZE = 15;

// Verme onayı: verenin kime ne kadar saygınlık verdiğini ve hedefin yeni toplamını gösterir
function given(giverId, targetId, newTotal) {
  return text(
    `**<@${giverId}>, <@${targetId}> kullanıcısına +1 saygınlık verdi!** 🌟\n` +
      `-# <@${targetId}> şu an toplam **${newTotal}** saygınlığa sahip.`,
  );
}

// ranking: [{ userId, value }] büyükten küçüğe sıralı, tüm zamanlar toplamı
function table(guild, ranking) {
  const lines = ranking
    .slice(0, PAGE_SIZE)
    .map(({ userId, value }, i) => `${i < 3 ? PODIUM[i] : '-# '}${i + 1}. <@${userId}> » \`${value} saygınlık\``);
  return page({
    title: `${guild.name} Saygınlık Tablosu`,
    sub: 'Sunucuda bugüne kadar en çok saygınlık kazanan üyeleri tüm zamanların toplamına göre sıraladık; sen de /saygi-ver ile sevdiğin üyelere +1 saygınlık verebilirsin.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks: [lines.length ? lines.join('\n') : '-# Henüz kimse saygınlık kazanmadı.'],
  });
}

// results: [{ userId, value }] geçen haftanın ilk 5'i, büyükten küçüğe sıralı
function weeklyAnnounce(guild, results, roleId) {
  const lines = results.length
    ? results.map(({ userId, value }, i) => `${i + 1}. <@${userId}> » \`${value} saygınlık\``)
    : ['-# Bu hafta için henüz veri yok.'];
  const blocks = [`**En Çok Saygınlık Kazananlar**\n${lines.join('\n')}`];
  if (results[0]) {
    blocks.push(
      `**🏆 Kazanılan Ödül**\n<@${results[0].userId}> bu haftanın en saygın üyesi oldu ve ${roleId ? `<@&${roleId}>` : 'Haftanın Saygın Üyesi'} rolünü kazandı!`,
    );
  }
  return page({
    title: 'Haftanın Saygın Üyesi',
    sub: 'Geçen hafta en çok saygınlık kazanan üyeleri listeliyoruz; birinci olan üye haftanın en saygın üyesi rolünü kazanır ve bu rol her pazartesi yenilenir.',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks,
  });
}

module.exports = { given, table, weeklyAnnounce };
