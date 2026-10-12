// Saygınlık mesajları: verme bildirimi ve haftalık kazanan duyurusu (ödül bölümüyle birlikte).
// Tüm zamanların tablosu burada değil /siralama'nın saygınlık türünde çizilir.
const { receipt, rows, chip, page } = require('../../core/ui');

// Verme bildirimi (herkese açık): kimin kime verdiği ve hedefin yeni toplamı satırlarda; böylece kanalda
// okuyan da saygınlığın nasıl kazanıldığını görür. haktan: verme Butikte alınan ek hakla yapılmışsa altta okunur.
function given(giverId, targetId, newTotal, haktan = false) {
  return receipt({
    title: 'Saygınlık Verildi',
    sub: `<@${giverId}> bir üyeye saygınlık verdi. Saygınlık **/saygi-ver** ile ya da mesajın içine **+rep @üye** yazarak verilir; haftanın birincisi ödül rolünü alır.`,
    pairs: [
      ['Kişi', `<@${targetId}>`],
      ['Verilen', chip('+1 saygınlık')],
      ['Yeni Toplam', chip(`${newTotal} saygınlık`)],
    ],
    note: haktan ? 'Bu verme Butikten alınan ek saygınlık hakkıyla yapıldı; bekleme süresi yeniden başladı.' : undefined,
  });
}

// results: [{ userId, value }] geçen haftanın ilk 5'i, büyükten küçüğe sıralı; sadece birinci duyurulur
function weeklyAnnounce(guild, results, roleId) {
  const winner = results[0] ?? null;
  const roleText = roleId ? `<@&${roleId}>` : 'Haftanın Saygın Üyesi';
  return page({
    title: 'Haftanın En Saygın Kişisi',
    sub: 'Geçen hafta **en çok saygınlık kazanan üyeyi** açıklıyoruz; kazanan ödül rolünü **bir sonraki pazartesiye kadar** taşır ve rol her hafta yenilenir.',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks: [
      winner
        ? `### Kazanan\n${rows([
            ['Kişi', `<@${winner.userId}>`],
            ['Toplam Saygınlık', chip(winner.value)],
            ['Ödül', `${roleText} rolü`],
          ])}`
        : '### Henüz Kazanan Yok\nGeçen hafta kimse saygınlık kazanmadı.',
    ],
  });
}

module.exports = { given, weeklyAnnounce };
