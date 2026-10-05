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
const { colors, notice, alert, unix, messageUrl } = require('../../core/ui');
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

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(', ');
const quote = (lines) => lines.map((line) => `> ${line}`).join('\n');

// Çekiliş mesajı: sade bir kutu (başlık, ödül, açıklama, bilgi satırları); açıkken katıl butonu, bitince kazananlar
function panel(g) {
  const head = { active: `## Çekiliş #${g.no}`, ended: `## Çekiliş #${g.no} Sona Erdi`, cancelled: `## Çekiliş #${g.no} İptal Edildi` }[g.status];
  const info = [];
  if (g.status === 'ended') info.push(`**Kazananlar:** ${g.winners.length ? mentions(g.winners) : 'katılan olmadı'}`);
  if (g.status === 'active') info.push(`**Bitiş:** <t:${unix(g.endsAt)}:R>`, `**Kazanan sayısı:** ${g.winnerCount}`);
  if (g.status === 'active' && g.roleId) info.push(`**Şart:** <@&${g.roleId}>`);
  info.push(`**Düzenleyen:** <@${g.hostId}>`);

  const lines = [head, `**${g.prize}**`];
  if (g.description) lines.push(g.description);
  lines.push(quote(info));
  if (g.status === 'ended') lines.push(`-# <t:${unix(g.endsAt)}:f> tarihinde sona erdi`);
  const container = notice(lines.join('\n'), g.status === 'cancelled' ? 'danger' : undefined);

  const label = { active: `Katıl (${g.participants.length})`, ended: `Çekiliş Bitti (${g.participants.length} katılımcı)`, cancelled: 'Çekiliş İptal Edildi' }[g.status];
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
  const lines = [`## Çekiliş #${g.no} ${reroll ? 'Yeni Kazanan' : 'Sona Erdi'}`, `**${g.prize}**`, quote([`**Kazananlar:** ${mentions(ids)}`, `**Düzenleyen:** <@${g.hostId}>`]), `-# [Çekilişe git](${url})`];
  return notice(lines.join('\n'));
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
