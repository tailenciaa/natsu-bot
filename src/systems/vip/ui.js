// VIP mesajları: verme onayı ve VIP listesi (olma sırasına göre)
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { text, page: pageLayout } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];

// Verme onayı
function given(giverId, targetId, roleId) {
  return text(`**<@${giverId}>, <@${targetId}> kullanıcısına VIP verdi!** 👑\n-# <@${targetId}> artık <@&${roleId}> rolüne sahip.`);
}

const IDS = { page: 'vip-sayfa' }; // vip-sayfa:<sayfa>:<buton yeri>
const PAGE_SIZE = 15;
const number = (value) => value.toLocaleString('tr-TR');

// ranking: [{ userId }] VIP olma sırasına göre (en eski ilk); page: 0'dan başlayan sayfa
function table(guild, ranking, page = 0) {
  const pageCount = Math.max(1, Math.ceil(ranking.length / PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * PAGE_SIZE;
  const items = ranking.slice(start, start + PAGE_SIZE);
  // İlk sayfadaki ilk üç sıra büyük yazılır
  const lines = items.map(({ userId }, i) => `${current === 0 && i < 3 ? PODIUM[i] : '-# '}${start + i + 1}. <@${userId}>`);
  const blocks = [lines.length ? lines.join('\n') : '-# Henüz VIP üye yok.'];
  if (ranking.length) {
    blocks.push(
      `**Sayfa Bilgisi**\n` +
        `-# Toplam **${number(ranking.length)}** kayıt arasından **${start + 1}-${start + items.length}** arası gösteriliyor.\n` +
        `-# Sayfa: \`${current + 1} / ${pageCount}\``,
    );
  }
  const container = pageLayout({
    title: `${guild.name} VIP Listesi`,
    sub: 'VIP rolüne sahip üyeleri VIP olma sırasına göre listeliyoruz; VIP rolü yetkililer tarafından özel üyelere verilen kalıcı bir roldür ve sunucuya katkısı olanlara tanınır.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks,
  });
  if (ranking.length) {
    const nav = (target, slot) => `${IDS.page}:${target}:${slot}`;
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(nav(current - 1, 'prev')).setLabel('«').setStyle(ButtonStyle.Primary).setDisabled(current === 0),
        new ButtonBuilder().setCustomId(nav(current + 1, 'next')).setLabel('»').setStyle(ButtonStyle.Primary).setDisabled(current >= pageCount - 1),
      ),
    );
  }
  return container;
}

module.exports = { IDS, given, table };
