// VIP mesajları: verme onayı ve VIP listesi (olma sırasına göre)
const { alert, divider, text, pageInfo, pagerRow, page: pageLayout } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];

// Verme onayı (herkese açık)
function given(giverId, targetId, roleId) {
  return alert(`<@${giverId}>, <@${targetId}> üyesine VIP rolünü verdi.`, `<@${targetId}> artık <@&${roleId}> rolüne sahip.`, 'success');
}

const IDS = { page: 'vip-sayfa' }; // vip-sayfa:<sayfa>:<buton yeri>
const PAGE_SIZE = 15;

// ranking: [{ userId, grantedAt }] VIP olma sırasına göre (en eski ilk; grantedAt 0 ise kayıt dışı verilmiş); page: 0'dan başlayan sayfa
function table(guild, ranking, page = 0) {
  const pageCount = Math.max(1, Math.ceil(ranking.length / PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * PAGE_SIZE;
  const items = ranking.slice(start, start + PAGE_SIZE);
  // İlk sayfadaki ilk üç sıra büyük yazılır; kaydı olanların satırına VIP olma tarihi eklenir
  const lines = items.map(
    ({ userId, grantedAt }, i) => `${current === 0 && i < 3 ? PODIUM[i] : ''}${start + i + 1}. <@${userId}>${grantedAt ? ` » <t:${Math.floor(grantedAt / 1000)}:D>` : ''}`,
  );
  const container = pageLayout({
    title: 'VIP Listesi',
    sub: 'VIP rolüne sahip üyeleri VIP olma sırasına göre listeliyoruz; bu rolü yöneticiler sunucuya katkısı olan üyelere kalıcı olarak verir ve geri almak da onların elindedir.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks: [lines.length ? lines.join('\n') : '**Henüz VIP üye yok.**\nVIP rolünü yöneticiler verir.'],
  });
  if (pageCount > 1) {
    const nav = (target, slot) => `${IDS.page}:${target}:${slot}`;
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(`-# ${pageInfo(current, pageCount, ranking.length)}`))
      .addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));
  }
  return container;
}

module.exports = { IDS, given, table };
