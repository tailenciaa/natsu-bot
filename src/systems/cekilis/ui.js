// Çekiliş sisteminin mesajları: çekiliş paneli (katıl butonlu), yönetim paneli, bitiş duyurusu ve katılımdan ayrılma onayı.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { colors, alert, page, quote, stamp, text, unix, rows, chip, rel } = require('../../core/ui');

// cekilis-ayril:<no>, cekilis-onay:<eylem>:<no>, cekilis-form:<no>, cekilis-yeni:<kanalID>:<rolID>
const IDS = {
  join: 'cekilis-katil',
  leave: 'cekilis-ayril',
  edit: 'cekilis-duzenle',
  end: 'cekilis-bitir',
  cancel: 'cekilis-iptal',
  reroll: 'cekilis-yeniden',
  confirm: 'cekilis-onay',
  form: 'cekilis-form',
  create: 'cekilis-yeni', // cekilis-yeni:<kanalID>:<rolID|0> (formu açan modalın kimliği)
  start: 'cekilis-baslat', // yönetim panelindeki buton: bu kanal için formu açar
};

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(', ');

// Kazanan çıkmamasının sebebi: kimse katılmadıysa ya da katılanların hiçbiri uygun değilse (sunucudan ayrılmış, bot)
const noWinnerReason = (g) => (g.participants.length ? 'Katılanların hiçbiri sunucuda değil ya da uygun değil.' : 'Çekilişe kimse katılmadı.');

const SUB = {
  active:
    '**Katıl** butonuna basarak çekilişe katılabilirsin; süre dolunca katılanlar arasından kazananlar rastgele seçilip bu kanalda duyurulur, butona tekrar basarak katılımdan ayrılabilirsin.',
  ended: '**Çekiliş sona erdi**; kazananlar katılanlar arasından rastgele seçildi ve duyuruldu, katılım kapandı.',
  cancelled: 'Bu çekiliş **iptal edildi** ve kazanan seçilmedi; yeni çekilişleri bu kanaldan takip edebilirsin.',
};

// Çekiliş mesajı: başlık, ödül, bilgiler; açıkken katıl butonu ve (yöneticiler için) yönetim butonları, bitince kazananlar
function panel(g) {
  const title = { active: `Çekiliş #${g.no}`, ended: `Çekiliş #${g.no} Sona Erdi`, cancelled: `Çekiliş #${g.no} İptal Edildi` }[g.status];
  const closedLabel = { ended: 'Çekiliş Bitti', cancelled: 'Çekiliş İptal Edildi' }[g.status];
  const info = rows([
    g.status === 'ended' && ['Kazananlar', g.winners.length ? mentions(g.winners) : 'kazanan seçilemedi'],
    (g.status === 'ended' || g.status === 'cancelled') && ['Katılımcı', chip(g.participants.length)],
    g.status === 'active' && ['Bitiş', rel(g.endsAt)],
    g.status === 'active' && ['Kazanan Sayısı', chip(g.winnerCount)],
    g.status === 'active' && g.roleId && ['Gerekli Rol', `<@&${g.roleId}>`],
    ['Düzenleyen', `<@${g.hostId}>`],
  ]);

  const container = page({
    title,
    sub: SUB[g.status],
    accent: g.status === 'cancelled' ? colors.danger : undefined,
    blocks: [`**${g.prize}**${g.description ? `\n${quote(g.description)}` : ''}`, info],
  });
  if (g.status === 'ended') container.addTextDisplayComponents(text(stamp(g.endsAt, 'f')));

  // Katıl butonunun altındaki yönetim butonlarını sadece yöneticiler kullanabilir (basınca kontrol edilir)
  const button = (id, label, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(IDS.join)
      .setLabel(g.status === 'active' ? `Katıl (${g.participants.length})` : closedLabel)
      .setStyle(g.status === 'active' ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(g.status !== 'active'),
  );
  // Yeniden Çek: iptal edilen çekilişte hiç kazanan seçilmediği için gösterilmez; açıkken pasif, bitince aktif
  if (g.status !== 'cancelled') joinRow.addComponents(button(IDS.reroll, 'Yeniden Çek', ButtonStyle.Secondary).setDisabled(g.status !== 'ended'));
  container.addActionRowComponents(joinRow);
  if (g.status === 'active') {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(button(IDS.edit, 'Düzenle', ButtonStyle.Secondary), button(IDS.end, 'Bitir', ButtonStyle.Primary), button(IDS.cancel, 'İptal Et', ButtonStyle.Danger)),
    );
  }
  return container;
}

// Boş değer ve yer tutucu hiç gönderilmez (Discord boş dizgeyi reddedebilir)
function field(label, id, style, { value, required = false, max = 100, placeholder, description } = {}) {
  const input = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required).setMaxLength(max);
  if (value) input.setValue(value);
  if (placeholder) input.setPlaceholder(placeholder);
  const wrapper = new LabelBuilder().setLabel(label);
  if (description) wrapper.setDescription(description);
  return wrapper.setTextInputComponent(input);
}

const DURATION_HINT = 'Örn: 30 dakika, 2 saat, 1 gün, 1 hafta.';

// Çekiliş oluşturma formu (/cekilis baslat ile açılır); kanal ve rol form numarasında taşınır
function createModal(channelId, roleId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.create}:${channelId}:${roleId ?? 0}`)
    .setTitle('Çekiliş Oluştur')
    .addLabelComponents(
      field('Ödül', 'odul', TextInputStyle.Short, { required: true, placeholder: 'Örn: 1 Aylık Discord Nitro' }),
      field('Açıklama', 'aciklama', TextInputStyle.Paragraph, { max: 300, placeholder: 'İsteğe bağlı: ödül ya da çekiliş hakkında kısa bilgi' }),
      field('Kazanan Sayısı', 'kazanan', TextInputStyle.Short, { required: true, max: 2, value: '1' }),
      field('Süre', 'sure', TextInputStyle.Short, { required: true, max: 12, placeholder: 'Örn: 2 saat', description: DURATION_HINT }),
    );
}

// Düzenleme formu: ödül, açıklama, kazanan sayısı ve isteğe bağlı yeni süre
function editModal(g) {
  return new ModalBuilder()
    .setCustomId(`${IDS.form}:${g.no}`)
    .setTitle('Çekilişi Düzenle')
    .addLabelComponents(
      field('Ödül', 'odul', TextInputStyle.Short, { required: true, value: g.prize }),
      field('Açıklama', 'aciklama', TextInputStyle.Paragraph, { max: 300, value: g.description, placeholder: 'İsteğe bağlı' }),
      field('Kazanan Sayısı', 'kazanan', TextInputStyle.Short, { required: true, max: 2, value: String(g.winnerCount) }),
      field('Yeni Süre', 'sure', TextInputStyle.Short, {
        max: 12,
        placeholder: 'Boş bırakırsan değişmez',
        description: `Şu andan itibaren sayılır. ${DURATION_HINT}`,
      }),
    );
}

// Bitirme/iptal için yönetici onayı (yanlışlıkla basmaya karşı)
function confirm(action, g) {
  const end = action === 'bitir';
  return alert(
    end ? `Çekiliş #${g.no} şimdi bitirilsin mi?` : `Çekiliş #${g.no} iptal edilsin mi?`,
    end ? 'Süre beklenmeden **kazananlar hemen seçilip duyurulur**.' : 'Kazanan seçilmeden çekiliş kapatılır, **geri alınamaz**.',
    'warning',
  ).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${IDS.confirm}:${action}:${g.no}`)
        .setLabel(end ? 'Çekilişi Bitir' : 'Çekilişi İptal Et')
        .setStyle(end ? ButtonStyle.Success : ButtonStyle.Danger),
    ),
  );
}

// Süre dolunca (ya da yeniden çekilince) çekiliş mesajına yanıt olarak giden kazanan duyurusu; panelin tekrarı değil, sadece kutlama
function winners(g, ids, reroll = false) {
  return page({
    title: 'Çekiliş Sona Erdi!',
    sub: 'Kazananlar çekilişe katılanlar arasından rastgele seçildi. Katılan herkese teşekkürler, yeni çekilişleri bu kanaldan takip edebilirsin.',
    accent: colors.success,
    blocks: [
      `**Tebrikler ${mentions(ids)}!**`,
      `**Ödül**\n${quote(g.prize)}`,
      rows([
        ['Çekilişi Başlatan', `<@${g.hostId}>`],
        ['Katılımcı', chip(g.participants.length)],
        ['Toplam Kazanan', chip(g.winners.length)],
        reroll && ['Seçim', chip('yeniden çekiliş')],
      ]),
      stamp(g.endsAt, 'R'),
    ],
  });
}

// Kazanan çıkmadıysa kanala giden bildirim: sebebiyle birlikte, aynı kutlama kartının düzeninde
function noWinner(g) {
  return page({
    title: 'Çekiliş Sona Erdi!',
    sub: 'Çekiliş tamamlandı ama kazanan seçilemedi.',
    accent: colors.warning,
    blocks: [
      `**Ödül**\n${quote(g.prize)}`,
      rows([
        ['Sebep', noWinnerReason(g)],
        ['Çekilişi Başlatan', `<@${g.hostId}>`],
        ['Katılımcı', chip(g.participants.length)],
      ]),
      stamp(g.endsAt, 'R'),
    ],
  });
}

// Katılınca (ya da butona tekrar basınca) sadece basana görünen, ayrılma butonlu cevap
function joined(g) {
  return alert('Bu çekilişe katıldın.', 'Çekilişten çıkmak istersen **Katılımdan Ayrıl** butonuna bas.', 'success').addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${IDS.leave}:${g.no}`).setLabel('Katılımdan Ayrıl').setStyle(ButtonStyle.Danger)),
  );
}

module.exports = { IDS, panel, createModal, editModal, confirm, winners, noWinner, noWinnerReason, joined };
