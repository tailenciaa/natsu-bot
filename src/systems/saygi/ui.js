// Saygınlık mesajları: verme onayı, tüm zamanların tablosu ve haftalık kazanan duyurusu (ödül bölümüyle birlikte)
const { ContainerBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');

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
  const headerText = text(`## ${guild.name} Saygınlık Tablosu\n-# Tüm zamanların toplam saygınlık sıralaması`);
  const icon = guild.iconURL({ size: 256 });
  const container = new ContainerBuilder();
  if (icon) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(headerText).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)),
    );
  } else {
    container.addTextDisplayComponents(headerText);
  }

  container.addSeparatorComponents(divider());
  const page = ranking.slice(0, PAGE_SIZE);
  const lines = page.length
    ? page.map(({ userId, value }, i) => `${i < 3 ? PODIUM[i] : '-# '}${i + 1}. <@${userId}> » \`${value} saygınlık\``)
    : ['-# Henüz kimse saygınlık kazanmadı.'];
  container.addTextDisplayComponents(text(lines.join('\n')));

  return container;
}

// results: [{ userId, value }] bu/geçen haftanın ilk 5'i, büyükten küçüğe sıralı
// live: /saygi-onizleme'den çağrıldıysa true, bu hafta henüz bitmemiştir, ödül bölümü gösterilmez
function weeklyAnnounce(guild, results, roleId, live = false) {
  const subtitle = live ? 'Bu haftanın şu anki durumu (önizleme)' : 'Geçen haftanın en saygın üyeleri';
  const headerText = text(`## Haftanın Saygın Üyesi\n-# ${subtitle}`);
  const icon = guild?.iconURL({ size: 256 });
  const container = new ContainerBuilder();
  if (icon) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(headerText).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)),
    );
  } else {
    container.addTextDisplayComponents(headerText);
  }

  const lines = results.length
    ? results.map(({ userId, value }, i) => `${i + 1}. <@${userId}> » \`${value} saygınlık\``)
    : ['-# Bu hafta için henüz veri yok.'];
  container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**En Çok Saygınlık Kazananlar**\n${lines.join('\n')}`));

  if (!live && results[0]) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          `**🏆 Kazanılan Ödül**\n<@${results[0].userId}> bu haftanın en saygın üyesi oldu ve ${roleId ? `<@&${roleId}>` : 'Haftanın Saygın Üyesi'} rolünü kazandı!`,
        ),
      );
  }

  return container;
}

module.exports = { given, table, weeklyAnnounce };
