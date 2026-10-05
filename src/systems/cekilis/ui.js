// Çekiliş sisteminin mesajları: çekiliş paneli (katıl butonlu), bitiş duyurusu ve katılımdan ayrılma onayı.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, page, alert, unix, messageUrl } = require('../../core/ui');
const { guildId } = require('../../core/config');

const IDS = { join: 'cekilis-katil', leave: 'cekilis-ayril' }; // cekilis-ayril:<no>

const PANEL_SUB =
  'Aşağıdaki butona basarak çekilişe katılabilirsin; süre dolunca kazananlar katılanlar arasından rastgele seçilir ve bu kanalda duyurulur. İstersen butona tekrar basıp katılımdan ayrılabilirsin.';

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(', ');

// Çekiliş mesajı: açıkken katıl butonu, bitince kazananlar ve devre dışı buton
function panel(g) {
  const info = [];
  if (g.status === 'active') info.push(`- **Bitiş:** <t:${unix(g.endsAt)}:R> (<t:${unix(g.endsAt)}:f>)`);
  if (g.status === 'ended') info.push(`- **Bitti:** <t:${unix(g.endsAt)}:f>`);
  info.push(`- **Kazanan sayısı:** ${g.winnerCount}`, `- **Katılımcı sayısı:** ${g.participants.length}`, `- **Düzenleyen:** <@${g.hostId}>`);
  if (g.roleId) info.push(`- **Katılım şartı:** <@&${g.roleId}> rolüne sahip olmak`);

  const blocks = [`**Ödül**\n${g.prize}`];
  if (g.description) blocks.push(`**Açıklama**\n${g.description}`);
  blocks.push(`**Çekiliş Bilgileri**\n${info.join('\n')}`);
  if (g.status === 'ended') blocks.push(`**Kazananlar**\n${g.winners.length ? mentions(g.winners) : 'Katılan olmadığı için kazanan yok.'}`);

  const label = { active: `Katıl (${g.participants.length})`, ended: `Çekiliş Bitti (${g.participants.length} katılımcı)`, cancelled: 'Çekiliş İptal Edildi' }[g.status];
  const container = page({
    title: g.status === 'cancelled' ? 'Çekiliş İptal Edildi' : g.status === 'ended' ? 'Çekiliş Sona Erdi' : 'Çekiliş',
    sub: PANEL_SUB,
    accent: g.status === 'cancelled' ? colors.danger : undefined,
    blocks,
  });
  return container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(IDS.join)
        .setLabel(label)
        .setStyle(g.status === 'active' ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(g.status !== 'active'),
    ),
  );
}

// Süre dolunca (ya da yeniden çekilince) kanala giden kazanan duyurusu
function winners(g, ids, reroll = false) {
  const url = messageUrl(guildId, g.channelId, g.messageId);
  return page({
    title: reroll ? 'Yeni Kazanan Seçildi' : 'Çekiliş Sona Erdi',
    sub: 'Çekilişe katılanlar arasından kazananlar rastgele seçildi; tebrikler! Ödülünü almak için yetkililerle iletişime geçebilirsin, çekiliş mesajına gitmek için aşağıdaki bağlantıyı kullan.',
    blocks: [
      `**${g.prize}**\n- **Kazananlar:** ${mentions(ids)}\n- **Katılımcı sayısı:** ${g.participants.length}\n- **Çekiliş:** [mesaja git](${url})`,
    ],
  });
}

// Kazanan çıkmadıysa kanala giden kısa bildirim
const noWinner = (g) => alert('Çekilişte kazanan çıkmadı.', `${g.prize} çekilişine kimse katılmadığı için kazanan seçilemedi.`, 'warning');

// Katılmış üyenin butona tekrar basınca gördüğü, ayrılma butonlu cevap
function joined(g) {
  return alert('Bu çekilişe zaten katıldın.', 'Katılımdan ayrılmak istersen aşağıdaki butonu kullanabilirsin.', 'success').addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${IDS.leave}:${g.no}`).setLabel('Katılımdan Ayrıl').setStyle(ButtonStyle.Danger)),
  );
}

module.exports = { IDS, panel, winners, noWinner, joined };
