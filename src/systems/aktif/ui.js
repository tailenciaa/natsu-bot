// Haftanın aktifleri duyurusu: ses, mesaj ve yayın kategorilerinde ilk 5'i gösteren liste, sıralama panelinin düzeninde
const { ContainerBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');

const formatDuration = (seconds) => {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} saat ${m} dk` : `${m} dk`;
};

const KIND_META = {
  ses: { title: 'En Çok Seste Duranlar', format: formatDuration },
  mesaj: { title: 'En Çok Mesaj Yazanlar', format: (n) => `${n} mesaj` },
  yayin: { title: 'En Çok Yayın Açanlar', format: formatDuration },
};

// entries: [{ userId, value }] büyükten küçüğe sıralı, en fazla 5
function section(kind, entries) {
  const meta = KIND_META[kind];
  const lines = entries.length
    ? entries.map(({ userId, value }, i) => `${i + 1}. <@${userId}> » \`${meta.format(value)}\``)
    : ['-# Bu hafta için henüz veri yok.'];
  return `**${meta.title}**\n${lines.join('\n')}`;
}

// results: { ses, mesaj, yayin } -> [{ userId, value }] (en fazla 5, sıralı)
// live: /haftalik-onizleme'den çağrıldıysa true, bu hafta henüz bitmemiştir ve rol/duyuru içermez
function weeklyAnnounce(guild, results, live = false) {
  const subtitle = live ? 'Bu haftanın şu anki durumu (önizleme)' : 'Geçen haftanın en aktif üyeleri';
  const headerText = text(`## Haftanın Aktifleri\n-# ${subtitle}`);
  const icon = guild?.iconURL({ size: 256 });
  const container = new ContainerBuilder();
  if (icon) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(headerText).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)));
  } else {
    container.addTextDisplayComponents(headerText);
  }

  for (const kind of ['ses', 'mesaj', 'yayin']) {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(text(section(kind, results[kind])));
  }

  return container;
}

module.exports = { weeklyAnnounce };
