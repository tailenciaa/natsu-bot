// Kalıcı oda sisteminin mesajları: kurallar ve gereksinimler paneli, başvuru formu, yöneticinin karar verdiği
// başvuru kartı, sahibine giden teslim kartı, /kalici-oda odam komutuyla açılan oda kontrol paneli, şart uyarı
// kartları, oda listesi ve duyuru kanalına düşen açılış/kapanış kayıtları.
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
const { colors, pad, unix, panel, page, rows, chip, pills, quote, receipt, stamp, divider, text } = require('../../core/ui');
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
const hoursLabel = (seconds) => `${Math.round((seconds ?? 0) / 3600)} saat`;
const limitLabel = (limit) => chip(limit ? `${limit} kişi` : 'sınırsız');
const memberTotal = (list) => `${list + 1} kişi`;
const roomTag = (room) => chip(`#${pad(room.no)} · ${room.name}`);

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
// Hafta ('2026-10-05') ve ay ('2026-09') anahtarlarını okunur tarihe çevirir
function monthLabel(key) {
  const [year, month] = String(key).split('-');
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

// Başvuru paneli: kurallar ve gereksinimler alt alta düzenli satırlar, başvuru butonu başlığın yanında durur
function applyPanel() {
  const container = panel({
    title: 'Kalıcı Oda Sistemi',
    sub: 'Sunucuda sana ait kalıcı bir ses ve yazı odası olsun istiyorsan **Başvuru Yap** butonuyla formu doldur. Onay yetkisi sadece yöneticilerde.',
    button: { id: IDS.apply, label: 'Başvuru Yap' },
  });

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Kurallar**\n${config.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          '**Gereksinimler**',
          rows([
            ['Üye Sayısı', chip(`${config.minMembers} kişi ve üzeri`)],
            ['Başvuruda Ses Şartı', chip(`${config.minWeeklyVoiceHours} saat / hafta`)],
            ['Odayı Koruma Şartı', chip(`${config.activity.weeklyHours} saat / hafta · ${config.activity.monthlyHours} saat / ay`)],
            ['Onayı Veren', 'Yalnızca yöneticiler'],
          ]),
          `-# Ses şartı, odayı kullanacakların birlikte geçirdiği toplam süredir; başvuruda hesaplanır, oda açık kaldıkça her hafta yeniden ölçülür.`,
        ].join('\n'),
      ),
    );
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

// Yöneticinin gördüğü başvuru kartı. room verilirse (başvuru onaylanmış) açılan kanallar da yazılır.
function applicationCard(app, room) {
  const container = page({
    title: 'Kalıcı Oda Başvurusu',
    sub: 'Onay odaları açıp sahibine teslim eder; ret gerekçesi başvurana doğrudan mesaj olarak gider. Butonlar yalnızca yöneticilerde çalışır.',
    accent: ACCENT[app.status],
    blocks: [
      `**Başvuru**\n${rows([
        ['Oda Adı', chip(app.roomName)],
        ['Başvuran', `<@${app.userId}>`],
        ['Kişi Sayısı', chip(memberTotal(app.members.length))],
        ['Son 7 Günün Sesi', chip(hoursLabel(app.voiceSeconds))],
        ['Haftalık Hedef', `${chip(`${config.minWeeklyVoiceHours} saat`)} · ${app.voiceOk ? 'karşılandı' : 'karşılanmadı'}`],
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
    sub: 'Kalıcı oda başvurun incelendi ve reddedildi; kararın gerekçesi kartta yazıyor. Gereksinimleri sağladığında panelden tekrar başvurabilirsin.',
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
      pendingCount ? `**Bekleyen Başvuru** ${chip(`${pendingCount} adet`)}` : null,
      stamp(),
    ],
  });
}

// Başvuru sahibinin kendi aldığını gördüğü özet: sonucu sadece başvuran görür, yetkililer zaten kanaldaki kartı izliyor
function submitted({ user, app, memberCount }) {
  return receipt({
    title: 'Başvuru Alındı',
    sub: `<@${user.id}> kalıcı oda başvurusu gönderdi; başvuru inceleme sırasına girdi. Karar başvuran üyeye **DM** üzerinden bildirilecek.`,
    user,
    pairs: [
      ['Başvuru', chip(`#${app.number}`)],
      ['Oda Adı', `**${app.roomName}**`],
      ['Üye', chip(`${memberCount} kişi`)],
    ],
    note: 'Aynı anda tek bir başvuru bekleyebilir.',
  });
}

// ── Duyuru kanalı kartları ────────────────────────────────────────────────────
// config.channels.notifications'a düşen herkese açık kayıtlar: odanın açıldığını ve kapandığını sunucu görür.

function openedNotice(room) {
  return receipt({
    title: 'Kalıcı Oda Açıldı',
    sub: `<@${room.ownerId}> için **${room.name}** odası açıldı.`,
    accent: 'success',
    pairs: [
      ['Oda', chip(`#${pad(room.no)} · ${room.name}`)],
      ['Ses Kanalı', `<#${room.voiceChannelId}>`],
      ['Yazı Kanalı', `<#${room.textChannelId}>`],
      ['Üye', chip(memberTotal(room.members.length))],
    ],
    at: room.createdAt,
  });
}

function closedNotice(room, reason) {
  return receipt({
    title: 'Kalıcı Oda Kapatıldı',
    sub: `**${room.name}** odası kapatıldı, kanalları silindi.`,
    accent: 'danger',
    pairs: [
      ['Oda', chip(`#${pad(room.no)} · ${room.name}`)],
      ['Sahip', `<@${room.ownerId}>`],
      reason ? ['Sebep', reason] : null,
    ].filter(Boolean),
  });
}

module.exports = {
  IDS,
  applyPanel,
  applicationModal,
  applicationCard,
  submitted,
  rejectModal,
  readyCard,
  rejectedCard,
  roomPanel,
  limitModal,
  renameModal,
  roomList,
  openedNotice,
  closedNotice,
};
