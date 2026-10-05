// Çekiliş sisteminin mesajları: çekiliş paneli (katıl butonlu), bitiş duyurusu ve katılımdan ayrılma onayı.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { colors, page, alert, unix, messageUrl } = require('../../core/ui');
const { guildId } = require('../../core/config');

// cekilis-ayril:<no>, cekilis-onay:<eylem>:<no>, cekilis-form:<no>
const IDS = {
  join: 'cekilis-katil',
  leave: 'cekilis-ayril',
  edit: 'cekilis-duzenle',
  end: 'cekilis-bitir',
  cancel: 'cekilis-iptal',
  reroll: 'cekilis-yeniden',
  confirm: 'cekilis-onay',
  form: 'cekilis-form',
  create: 'cekilis-yeni', // cekilis-yeni:<kanalID>:<rolID|0>
};

const PANEL_SUB =
  'Aşağıdaki butona basarak çekilişe katılabilirsin; süre dolunca kazananlar katılanlar arasından rastgele seçilir ve bu kanalda duyurulur. İstersen butona tekrar basıp katılımdan ayrılabilirsin.';

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(', ');

// Çekiliş mesajı: açıkken katıl butonu, bitince kazananlar ve devre dışı buton
function panel(g) {
  const info = [`**Kazanacak kişi:** ${g.winnerCount} kişi`, `**Katılan kişi:** ${g.participants.length} kişi`];
  if (g.status === 'active') info.push(`**Bitiş:** <t:${unix(g.endsAt)}:R> (<t:${unix(g.endsAt)}:f>)`);
  if (g.status === 'ended') info.push(`**Bitti:** <t:${unix(g.endsAt)}:f>`);
  if (g.roleId) info.push(`**Katılım şartı:** <@&${g.roleId}> rolüne sahip olmak`);
  info.push(`**Düzenleyen:** <@${g.hostId}>`);

  const blocks = [`**Ödül**\n${g.prize}`];
  if (g.description) blocks.push(`**Açıklama**\n${g.description}`);
  blocks.push(`**Çekiliş Bilgileri**\n${info.join('\n')}`);
  if (g.status === 'ended') blocks.push(`**Kazananlar**\n${g.winners.length ? mentions(g.winners) : 'Katılan olmadığı için kazanan yok.'}`);

  const label = { active: `Katıl (${g.participants.length})`, ended: `Çekiliş Bitti (${g.participants.length} katılımcı)`, cancelled: 'Çekiliş İptal Edildi' }[g.status];
  const container = page({
    title: `Çekiliş #${g.no}${g.status === 'cancelled' ? ' İptal Edildi' : g.status === 'ended' ? ' Sona Erdi' : ''}`,
    sub: PANEL_SUB,
    accent: g.status === 'cancelled' ? colors.danger : undefined,
    blocks,
  });
  // Katıl butonunun yanındaki yönetim butonlarını sadece yöneticiler kullanabilir (basınca kontrol edilir)
  const button = (id, text, style) => new ButtonBuilder().setCustomId(id).setLabel(text).setStyle(style);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.join)
      .setLabel(label)
      .setStyle(g.status === 'active' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(g.status !== 'active'),
  );
  if (g.status === 'active') {
    row.addComponents(button(IDS.edit, 'Düzenle', ButtonStyle.Secondary), button(IDS.end, 'Çekilişi Bitir', ButtonStyle.Primary), button(IDS.cancel, 'İptal Et', ButtonStyle.Danger));
  } else if (g.status === 'ended') {
    row.addComponents(button(IDS.reroll, 'Yeniden Çek', ButtonStyle.Secondary));
  }
  return container.addActionRowComponents(row);
}

// Çekiliş oluşturma formu (/cekilis baslat ile açılır); kanal ve rol form numarasında taşınır
function createModal(channelId, roleId) {
  const field = (label, id, style, extra = {}) =>
    new LabelBuilder()
      .setLabel(label)
      .setTextInputComponent(
        new TextInputBuilder().setCustomId(id).setStyle(style).setValue(extra.value ?? '').setRequired(Boolean(extra.required)).setMaxLength(extra.max ?? 100).setPlaceholder(extra.placeholder ?? ''),
      );
  return new ModalBuilder()
    .setCustomId(`${IDS.create}:${channelId}:${roleId ?? 0}`)
    .setTitle('Çekiliş Oluştur')
    .addLabelComponents(
      field('Ödül', 'odul', TextInputStyle.Short, { required: true, placeholder: 'Örn: 1 Aylık Discord Nitro' }),
      field('Açıklama', 'aciklama', TextInputStyle.Paragraph, { max: 300, placeholder: 'İsteğe bağlı: ödül ya da çekiliş hakkında kısa bilgi' }),
      field('Kazanan Sayısı', 'kazanan', TextInputStyle.Short, { required: true, max: 2, value: '1' }),
      field('Süre', 'sure', TextInputStyle.Short, { required: true, max: 6, placeholder: 'Örn: 30dk, 2sa, 1g, 1hf (dakika, saat, gün, hafta)' }),
    );
}

// Düzenleme formu: ödül, açıklama, kazanan sayısı ve isteğe bağlı yeni süre
function editModal(g) {
  const field = (label, id, style, value, extra = {}) =>
    new LabelBuilder()
      .setLabel(label)
      .setTextInputComponent(
        new TextInputBuilder().setCustomId(id).setStyle(style).setValue(value ?? '').setRequired(Boolean(extra.required)).setMaxLength(extra.max ?? 100).setPlaceholder(extra.placeholder ?? ''),
      );
  return new ModalBuilder()
    .setCustomId(`${IDS.form}:${g.no}`)
    .setTitle(`Çekiliş #${g.no} Düzenle`)
    .addLabelComponents(
      field('Ödül', 'odul', TextInputStyle.Short, g.prize, { required: true }),
      field('Açıklama', 'aciklama', TextInputStyle.Paragraph, g.description, { max: 300, placeholder: 'İsteğe bağlı' }),
      field('Kazanan Sayısı', 'kazanan', TextInputStyle.Short, String(g.winnerCount), { required: true, max: 2 }),
      field('Yeni Süre', 'sure', TextInputStyle.Short, '', { max: 6, placeholder: 'Boş bırakırsan değişmez. Örn: 30dk, 2sa, 1g, 1hf (şu andan itibaren)' }),
    );
}

// Bitirme/iptal için yönetici onayı (yanlışlıkla basmaya karşı)
function confirm(action, g) {
  const end = action === 'bitir';
  return alert(
    end ? `Çekiliş #${g.no} şimdi bitirilsin mi?` : `Çekiliş #${g.no} iptal edilsin mi?`,
    end ? 'Süre beklenmeden kazananlar hemen seçilip duyurulur.' : 'Kazanan seçilmeden çekiliş kapatılır, geri alınamaz.',
    'warning',
  ).addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${IDS.confirm}:${action}:${g.no}`).setLabel(end ? 'Evet, Bitir' : 'Evet, İptal Et').setStyle(ButtonStyle.Danger)),
  );
}

// Süre dolunca (ya da yeniden çekilince) kanala giden kazanan duyurusu
function winners(g, ids, reroll = false) {
  const url = messageUrl(guildId, g.channelId, g.messageId);
  return page({
    title: reroll ? `Çekiliş #${g.no} Yeni Kazanan` : `Çekiliş #${g.no} Sona Erdi`,
    sub: 'Çekilişe katılanlar arasından kazananlar rastgele seçildi; tebrikler! Ödülünü almak için yetkililerle iletişime geçebilirsin, çekiliş mesajına gitmek için aşağıdaki bağlantıyı kullan.',
    blocks: [
      `**${g.prize}**\n**Kazananlar:** ${mentions(ids)}\n**Katılımcı sayısı:** ${g.participants.length}\n**Çekiliş:** [mesaja git](${url})`,
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

module.exports = { IDS, panel, createModal, editModal, confirm, winners, noWinner, joined };
