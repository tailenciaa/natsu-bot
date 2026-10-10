// Kalıcı oda sisteminin mesajları: kurallar ve gereksinimler paneli, başvuru formu, yetkilinin karar verdiği
// başvuru kartı, sahibine giden teslim kartı, odanın kendi yazı kanalındaki kontrol paneli ve oda listesi.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { colors, panel, page, rows, chip, quote, stamp, divider, text, pills, hasValue } = require('../../core/ui');
const config = require('./config');

const IDS = {
  apply: 'kalici-oda-basvuru', // paneldeki başvuru butonu
  form: 'kalici-oda-form', // başvuru formu
  question: 'kalici-oda-soru', // kalici-oda-soru:<soru>
  decide: 'kalici-oda-karar', // kalici-oda-karar:<başvuru>:<onayla|ret>
  rejectForm: 'kalici-oda-ret', // kalici-oda-ret:<başvuru>
  rejectInput: 'kalici-oda-ret-sebep',
  rename: 'kalici-oda-isim',
  renameForm: 'kalici-oda-isim-form',
  renameInput: 'kalici-oda-isim-yeni',
  limit: 'kalici-oda-limit',
  limitForm: 'kalici-oda-limit-form',
  limitInput: 'kalici-oda-limit-sayi',
  add: 'kalici-oda-uye-ekle', // kalici-oda-uye-ekle:0 (menünün önekli yönlenmesi için sabit ek)
  remove: 'kalici-oda-uye-cikar', // kalici-oda-uye-cikar:0
  transfer: 'kalici-oda-devret', // kalici-oda-devret:0
};

// Üye seçim menüsü: Discord kendi üye arama listesini gösterir, odadaki üyeleri tek tek saymaya gerek kalmaz
const select = (customId, placeholder) => new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder);

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(' ');
const hoursLabel = (seconds) => `${Math.floor(seconds / 3600)} saat`;
const limitLabel = (limit) => chip(limit ? `${limit} kişi` : 'sınırsız');
const memberTotal = (list) => `${list + 1} kişi`;

// Başvuru paneli: kurallar ve gereksinimler yazılır, başvuru butonu başlığın yanında durur
function applyPanel() {
  const container = panel({
    title: 'Kalıcı Oda Sistemi',
    sub: 'Sunucuda sana ait kalıcı bir ses ve yazı odası olsun istiyorsan **Başvuru Yap** butonuyla formu doldur; yetkililer başvurunu inceler ve onaylarsa odan açılıp sana teslim edilir.',
    button: { id: IDS.apply, label: 'Başvuru Yap' },
  });

  const requirements = rows([
    ['Minimum Üye Sayısı', chip(`${config.minMembers} kişi`)],
    ['Minimum Haftalık Ses Süresi', chip(`${config.minWeeklyVoiceHours} saat`)],
    ['Özel Ekip Rolü', config.roles.team ? `<@&${config.roles.team}>` : chip('Devre Dışı')],
  ]);

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Kurallar**\n${config.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**Gereksinimler**\n${requirements}\nHaftalık ses süresi, odayı kullanacakların son yedi günde birlikte geçirdiği toplam sestir; başvuruda hesaplanır ve yetkililere gösterilir.`,
      ),
    );
  return container;
}

// Başvuru formu: oda adı, odada olacak üyeler ve odanın amacı
function applicationModal() {
  const modal = new ModalBuilder().setCustomId(IDS.form).setTitle('Kalıcı Oda Başvurusu');
  for (const question of config.questions) {
    const input = new TextInputBuilder()
      .setCustomId(`${IDS.question}:${question.id}`)
      .setStyle(question.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setPlaceholder(question.placeholder)
      .setMaxLength(question.max)
      .setRequired(true);
    if (question.min) input.setMinLength(question.min);
    modal.addLabelComponents(
      new LabelBuilder().setLabel(question.label).setDescription(question.description).setTextInputComponent(input),
    );
  }
  return modal;
}

const ACCENT = { pending: colors.warning, approved: colors.success, rejected: colors.danger };

// Karar satırı: bekleyen başvuruda Onayla / Reddet, sonuçlanmış başvuruda geçmiş zamanlı pasif etiket
function decisionRow(app) {
  if (app.status === 'pending') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${IDS.decide}:${app.id}:onayla`).setLabel('Onayla').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${IDS.decide}:${app.id}:ret`).setLabel('Reddet').setStyle(ButtonStyle.Danger),
    );
  }
  const approved = app.status === 'approved';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.decide}:${app.id}:sonuc`)
      .setLabel(approved ? 'Onaylandı' : 'Reddedildi')
      .setStyle(approved ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true),
  );
}

// Yetkililerin gördüğü başvuru kartı. room verilirse (başvuru onaylanmış) açılan kanallar da yazılır.
function applicationCard(app, room) {
  const container = page({
    title: 'Kalıcı Oda Başvurusu',
    sub: 'Bir üye kendine kalıcı bir ses ve yazı odası istiyor; **Onayla** odaları açar ve odayı sahibine teslim eder, **Reddet** ise sebebiyle birlikte başvurana iletilir.',
    accent: ACCENT[app.status],
    blocks: [
      `**Başvuru Bilgileri**\n${rows([
        ['Oda Adı', chip(app.roomName)],
        ['Başvuran', `<@${app.userId}>`],
        ['Kişi Sayısı', chip(memberTotal(app.members.length))],
        ['Haftalık Ses', `${hoursLabel(app.voiceSeconds)} · ${app.voiceOk ? 'gereksinimi karşılıyor' : 'gereksinimin altında'} ${chip(`${config.minWeeklyVoiceHours} saat`)}`],
      ])}`,
      app.members.length ? `**Odayı Kullanacaklar**\n${mentions(app.members)}` : null,
      `**Amaç**\n${quote(app.purpose)}`,
      app.status === 'rejected' && app.note ? `**Ret Sebebi**\n${quote(app.note)}` : null,
      room ? `**Açılan Kanallar**\n<#${room.voiceChannelId}> · <#${room.textChannelId}>` : null,
      stamp(app.createdAt),
    ],
  });
  return container.addActionRowComponents(decisionRow(app));
}

// Reddet formu: sebep başvurana aynen yazılır
function rejectModal(app) {
  return new ModalBuilder()
    .setCustomId(`${IDS.rejectForm}:${app.id}`)
    .setTitle('Başvuruyu Reddet')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Ret sebebi')
        .setDescription('Başvurana aynen iletilir, gerekçeli ve tek cümle yaz.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.rejectInput)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Odayı birlikte kullanacak kadar aktif üye görünmedi.')
            .setMaxLength(300)
            .setRequired(true),
        ),
    );
}

// Sahibine giden teslim kartı
function readyCard(room) {
  return page({
    title: 'Yeni Kalıcı Oda Açıldı!',
    sub: 'Odan başarıyla oluşturuldu ve sana teslim edildi; bundan sonra ismini, kişi limitini ve üyelerini odanın yazı kanalındaki panelden kendin yönetirsin.',
    accent: colors.success,
    blocks: [
      `**Oda Bilgileri**\n${rows([
        ['Oda', chip(room.name)],
        ['Sahibi', `<@${room.ownerId}>`],
        ['Kişi Sayısı', chip(memberTotal(room.members.length))],
        ['Kişi Limiti', limitLabel(room.limit)],
      ])}`,
      `**Kanallar**\n<#${room.voiceChannelId}> · <#${room.textChannelId}>`,
      room.members.length ? `**Üyeler**\n${mentions(room.members)}` : null,
      stamp(room.createdAt),
    ],
  });
}

// Reddedilen başvurunun sahibine giden kartı
function rejectedCard(app) {
  return page({
    title: 'Başvurun Reddedildi',
    sub: 'Kalıcı oda başvurun incelendi ve reddedildi; sebebi aşağıda yazıyor. Gereksinimleri sağladığında panelden tekrar başvurabilirsin.',
    accent: colors.danger,
    blocks: [
      `**Başvuru Bilgileri**\n${rows([
        ['Oda Adı', chip(app.roomName)],
        ['Karar Veren', app.reviewedBy ? `<@${app.reviewedBy}>` : 'Yetkililer'],
      ])}`,
      app.note ? `**Sebep**\n${quote(app.note)}` : null,
      stamp(app.reviewedAt ?? Date.now()),
    ],
  });
}

// Odanın kendi yazı kanalına düşen, sadece sahibinin kullanabildiği kontrol paneli
function roomPanel(room) {
  const container = page({
    title: 'Kalıcı Oda Paneli',
    sub: 'Odanın ismini ve kişi limitini buradan değiştirir, üye ekleyip çıkarır, sahipliği devredersin; bu paneli sadece **oda sahibi** kullanabilir.',
    blocks: [
      `**Oda Bilgisi**\n${rows([
        ['Oda', chip(room.name)],
        ['Sahip', `<@${room.ownerId}>`],
        ['Üye Sayısı', chip(memberTotal(room.members.length))],
        ['Kişi Limiti', limitLabel(room.limit)],
      ])}`,
      'Oda **kalıcıdır**: içinde kimse olmasa bile kapanmaz, yalnızca yetkililer kapatabilir.',
      stamp(room.createdAt),
    ],
  });

  return container
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.rename).setLabel('İsmi Değiştir').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.limit).setLabel('Limiti Ayarla').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(select(`${IDS.add}:0`, 'Odaya eklenecek üyeyi seç')),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(select(`${IDS.remove}:0`, 'Odadan çıkarılacak üyeyi seç')),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(select(`${IDS.transfer}:0`, 'Sahipliği devredeceğin üyeyi seç')),
    );
}

// Kişi limiti formu (0 = sınırsız)
function limitModal(current) {
  return new ModalBuilder()
    .setCustomId(IDS.limitForm)
    .setTitle('Oda Kişi Limiti')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kişi limiti')
        .setDescription('0 = sınırsız, en fazla 99 kişi.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.limitInput)
            .setStyle(TextInputStyle.Short)
            .setValue(String(current ?? 0))
            .setPlaceholder('Örn: 10')
            .setMaxLength(2)
            .setRequired(true),
        ),
    );
}

// Oda ismi formu: kategori, ses ve yazı kanalının adı birlikte değişir
function renameModal(current) {
  const input = new TextInputBuilder().setCustomId(IDS.renameInput).setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true);
  if (current) input.setValue(current);
  return new ModalBuilder()
    .setCustomId(IDS.renameForm)
    .setTitle('Oda İsmini Değiştir')
    .addLabelComponents(new LabelBuilder().setLabel('Yeni isim').setDescription('Kategori ve iki kanalın adı birlikte değişir.').setTextInputComponent(input));
}

// /kalici-oda liste: yetkililerin gördüğü oda dökümü
function roomList(rooms, pendingCount) {
  const line = (room) =>
    [
      `**#${room.no} · ${room.name}**`,
      `${pills([['Üye', room.members.length + 1], ['Limit', room.limit || 'sınırsız']])} · Sahip <@${room.ownerId}>`,
      `<#${room.voiceChannelId}> · <#${room.textChannelId}>`,
    ].join('\n');

  return page({
    title: 'Kalıcı Odalar',
    sub: 'Sunucudaki tüm kalıcı odalar, sahipleri ve kanalları burada listelenir; bir odayı kapatmak ya da sahipsiz bir odayı devretmek için aynı komuttaki diğer adımları kullanabilirsin.',
    blocks: [
      rooms.length ? rooms.map(line).join('\n\n') : '-# Henüz kalıcı oda yok.',
      hasValue(pendingCount) && `**Bekleyen Başvuru** ${chip(`${pendingCount} adet`)}`,
      stamp(),
    ],
  });
}

module.exports = {
  IDS,
  applyPanel,
  applicationModal,
  applicationCard,
  rejectModal,
  readyCard,
  rejectedCard,
  roomPanel,
  limitModal,
  renameModal,
  roomList,
};
