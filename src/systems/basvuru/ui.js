// Başvuru sisteminin mesajları: panel, başvuru formu, başvurular kanalı mesajı ve başvurana giden DM'ler
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  SectionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
} = require('discord.js');
const { colors, text, divider, pad, unix, quote, notice, panelMessage } = require('../../core/ui');
const orientationUi = require('../oryantasyon/ui');
const config = require('./config');

const IDS = {
  apply: 'basvuru:yap',
  applyModal: 'basvuru:form',
  applyQuestion: 'basvuru:soru', // sonuna soru ID'si eklenir
  review: 'basvuru-karar', // basvuru-karar:<başvuru>:<onay|red|gorusme>
  reviewModal: 'basvuru-karar-form', // basvuru-karar-form:<başvuru>:<onay|red>
  reviewNote: 'basvuru-karar-not',
};

const STATUS = { pending: 'İnceleniyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
const answersText = (answers) => answers.map(({ title, answer }) => `**${title}:**\n${quote(answer)}`).join('\n\n');

function panel(imageName) {
  return panelMessage(config.panel, IDS.apply, imageName);
}

// "Başvuru Yap" ile açılan form; sorular config.js'ten gelir
function applicationModal() {
  return new ModalBuilder()
    .setCustomId(IDS.applyModal)
    .setTitle('Yetkili Başvurusu')
    .addLabelComponents(
      config.questions.map((question) => {
        const input = new TextInputBuilder()
          .setCustomId(`${IDS.applyQuestion}:${question.id}`)
          .setStyle(question.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setMaxLength(question.max)
          .setRequired(question.required !== false);
        if (question.min) input.setMinLength(question.min);
        if (question.placeholder) input.setPlaceholder(question.placeholder);

        const label = new LabelBuilder().setLabel(question.label).setTextInputComponent(input);
        if (question.description) label.setDescription(question.description);
        return label;
      }),
    );
}

// Onaylanan başvurunun oryantasyon durumu: [durum yazısı, renk]
function orientationStatus(app) {
  const o = app.orientation;
  if (o.status === 'waiting') {
    return [
      `**Durum: Oryantasyon bekleniyor**\n-# <@${app.reviewedBy}> onayladı, oryantasyonu <@${o.staffId}> verecek. ` +
        'İkisi aynı görüşme kanalına girince oryantasyon kendiliğinden başlar.',
      colors.primary,
    ];
  }
  if (o.status === 'active') {
    const waiting = o.staffNeeded ? '\n-# Yetkili ayrıldı, oryantasyonu devralacak başka bir yetkili bekleniyor.' : '';
    return [
      `**Durum: Oryantasyonda**\n-# <@${o.staffId}> şu an <#${o.channelId}> kanalında oryantasyon veriyor.${waiting}`,
      o.staffNeeded ? colors.warning : colors.primary,
    ];
  }
  if (o.status === 'completed') {
    return [
      `**Durum: Ekibe katıldı**\n-# <@${o.staffId}> oryantasyonu tamamladı, **${o.levelLabel}** yetkisiyle ekibe başladı.\n` +
        `-# ${o.areaLabels.length > 1 ? 'Görev alanları' : 'Görev alanı'}: ${o.areaLabels.join(', ')}`,
      colors.success,
    ];
  }
  const by = o.cancelledBy ? `<@${o.cancelledBy}> iptal etti.` : 'Otomatik olarak iptal edildi.';
  const penalty = app.penaltyUntil ? `\n-# Başvuru cezası: <t:${unix(app.penaltyUntil)}:D> tarihine kadar yeniden başvuru yapamaz.` : '';
  return [`**Durum: Oryantasyon iptal edildi**\n-# ${by}\n${quote(o.cancelReason)}${penalty}`, colors.danger];
}

// Sicil gibi yerlerde görünen kısa durum
function statusLabel(app) {
  if (app.status !== 'approved' || !app.orientation) return STATUS[app.status];
  return { waiting: 'Oryantasyonda', active: 'Oryantasyonda', completed: 'Ekibe Katıldı', cancelled: 'Oryantasyon İptal Edildi' }[
    app.orientation.status
  ];
}

// Başvurular kanalına giden mesaj: sağ üstte başvuranın fotoğrafı, inceleyen rol etiketlenir,
// karar verilene kadar Onayla / Reddet / Görüşmeye Çağır butonları durur. Onaylanınca oryantasyonun durumunu gösterir,
// oryantasyon sürerken aktarma ve iptal butonları çıkar.
function applicationNotice(app, applicantUser) {
  const pending = app.status === 'pending';
  const orienting = ['waiting', 'active'].includes(app.orientation?.status);

  let status;
  let color;
  if (app.status === 'approved' && app.orientation) {
    [status, color] = orientationStatus(app);
  } else if (app.status === 'approved') {
    const role = app.acceptRoleId
      ? app.roleGiven
        ? ` <@&${app.acceptRoleId}> rolü verildi.`
        : ' Rol verilemedi, elle verilmesi gerekiyor.'
      : '';
    status = `**Durum: Onaylandı**\n-# <@${app.reviewedBy}> onayladı.${role}`;
    color = colors.success;
  } else if (app.status === 'rejected') {
    status = `**Durum: Reddedildi**\n-# <@${app.reviewedBy}> reddetti.`;
    color = colors.danger;
  } else if (app.meetingBy) {
    const where = app.meetingChannelId ? `, <#${app.meetingChannelId}> kanalında bekliyor` : '';
    status =
      `**Durum: Görüşme bekleniyor**\n-# <@${app.meetingBy}> başvuranı görüşmeye çağırdı${where}.\n` +
      '-# Başvuruyla o ilgileniyor, kararı da o verecek.';
    color = colors.primary;
  } else {
    status = '**Durum: İnceleniyor**\n-# Karar verildiğinde sonuç başvurana DM ile iletilir.';
    color = colors.warning;
  }
  if (app.note) status += `\n${quote(app.note)}`;

  const previous = app.previous?.total
    ? `${app.previous.total} başvuru${app.previous.rejected ? ` · ${app.previous.rejected} reddedildi` : ''}`
    : 'Yok';

  const header = text(
    pending
      ? `### Yeni Başvuru #${pad(app.number)}\n` +
          `**${app.reviewerRoleId ? `<@&${app.reviewerRoleId}>, ` : ''}<@${app.userId}> ekibe katılmak için başvurdu.**\n` +
          '-# Cevapları inceleyip başvuruyu onaylayabilir, reddedebilir ya da mülakata çağırabilirsin.'
      : // Başvurunun nerede olduğu aşağıdaki "Durum" bölümünde
        `### Başvuru #${pad(app.number)}\n**<@${app.userId}> ekibe katılmak için başvurdu.**`,
  );

  const container = new ContainerBuilder().setAccentColor(color);
  if (applicantUser) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(header)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(applicantUser.displayAvatarURL({ size: 256 }))),
    );
  } else {
    container.addTextDisplayComponents(header);
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          // Başvuran başlıkta etiketli, burada sadece kullanıcı adı
          `**Kullanıcı Adı:** \`${app.username}\``,
          `**Hesap Oluşturma:** <t:${unix(app.accountCreatedAt)}:R>`,
          `**Sunucuya Katılma:** ${app.joinedAt ? `<t:${unix(app.joinedAt)}:R>` : 'Bilinmiyor'}`,
          `**Önceki Başvuruları:** ${previous}`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(answersText(app.answers)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(status));

  if (pending) {
    const reviewId = (action) => `${IDS.review}:${app.id}:${action}`;
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(reviewId('onay')).setStyle(ButtonStyle.Success).setLabel('Onayla'),
        new ButtonBuilder().setCustomId(reviewId('red')).setStyle(ButtonStyle.Danger).setLabel('Reddet'),
        new ButtonBuilder()
          .setCustomId(reviewId('gorusme'))
          .setStyle(ButtonStyle.Primary)
          .setLabel(app.meetingBy ? 'Görüşmeye Çağrıldı' : 'Görüşmeye Çağır')
          .setDisabled(Boolean(app.meetingBy)),
      ),
    );
  }
  // Oryantasyon yönetimi (Aktar/İptal), başvuru kararından farklı bir iş yaptığı için çizgiyle ayrılır
  if (orienting) container.addSeparatorComponents(divider()).addActionRowComponents(orientationUi.noticeRow(app));

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# <t:${unix(app.createdAt)}:F>`));
}

// Onayla / Reddet ile açılan form: onayda not isteğe bağlı, redde sebep zorunlu. İkisi de başvurana iletilir.
function reviewModal(app, action) {
  const approve = action === 'onay';
  const approveInfo =
    'Başvuru sana atanacak ve oryantasyonu sen vereceksin. Başvurana ve sana DM ile boş bir görüşme kanalı bildirilecek; ' +
    'ikiniz de kanala girince oryantasyon kendiliğinden başlar. Roller oryantasyon sonunda verilir.';
  return new ModalBuilder()
    .setCustomId(`${IDS.reviewModal}:${app.id}:${action}`)
    .setTitle(approve ? 'Başvuruyu Onayla' : 'Başvuruyu Reddet')
    .addTextDisplayComponents(
      text(
        approve
          ? `**#${pad(app.number)} numaralı başvuruyu onaylıyorsun.**\n${approveInfo}`
          : `**#${pad(app.number)} numaralı başvuruyu reddediyorsun.**\nYazdığın sebep başvurana DM ile iletilecek.`,
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel(approve ? 'Not' : 'Red sebebi')
        .setDescription(approve ? 'İsteğe bağlı, başvurana iletilir.' : 'Başvurana iletilir.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.reviewNote)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(approve ? 'Örn: Mülakatta çok iyiydin, oryantasyonda görüşmek üzere!' : 'Örn: Aktiflik süren şu an için yeterli değil.')
            .setMinLength(approve ? 0 : 5)
            .setMaxLength(500)
            .setRequired(!approve),
        ),
    );
}

const channelUrl = (guildId, channelId) => `https://discord.com/channels/${guildId}/${channelId}`;

// DM'lerdeki görüşme ses kanalı bölümü.
// voice: { staffId, waitingIn, until } — waitingIn: yetkilinin şu an beklediği kanal (yoksa null), until: erişimin kapanacağı zaman.
// Yetkili bir kanalda bekliyorsa o kanala, beklemiyorsa üç kanala da katılma butonu çıkar.
function voiceSection(container, app, voice) {
  const expiry =
    'Görüşme kanalları senin için açıldı. Mülakat bitip kanaldan ayrıldığında tekrar kapanacak ' +
    `(hiç katılmazsan <t:${unix(voice.until)}:R> kendiliğinden kapanır).`;
  const buttons = voice.waitingIn
    ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, voice.waitingIn))]
    : config.voiceChannels.map((c) =>
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(c.label).setURL(channelUrl(app.guildId, c.id)),
      );

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        voice.waitingIn
          ? `**<@${voice.staffId}> mülakat için seni şu an <#${voice.waitingIn}> kanalında bekliyor!**\n-# ${expiry}`
          : `**Mülakat için aşağıdaki ses kanallarından birine katılabilirsin.**\n-# ${expiry}`,
      ),
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
}

// Reddedilen başvurana giden sonuç DM'si (onaylanana oryantasyon sistemi kendi DM'ini gönderir)
function resultDm(app, guildName, reapplyAt) {
  const sections = [
    '### Başvurun Sonuçlandı\n' +
      '**Başvurun bu sefer olumlu sonuçlanmadı.**\n' +
      `-# #${pad(app.number)} numaralı başvurunu <@${app.reviewedBy}> değerlendirdi.` +
      (reapplyAt ? ` <t:${unix(reapplyAt)}:D> tarihinden sonra tekrar başvurabilirsin.` : ' İleride tekrar başvurabilirsin.'),
  ];
  if (app.note) sections.push(`**Sebep:**\n${quote(app.note)}`);

  return notice(sections, 'danger')
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${guildName} · <t:${unix(app.reviewedAt)}:F>`));
}

// "Görüşmeye Çağır" ile başvurana giden DM: yetkili bir ses kanalındaysa "seni X kanalında bekliyor",
// değilse "kanallardan birine geç" der. Ses kanalları açılamadıysa (voice yok) sadece görüşme çağrısı gider.
function meetingDm(app, guildName, voice) {
  const container = notice(
    '### Mülakata Davet Edildin\n' +
      `**<@${app.meetingBy}> başvurun hakkında seninle sesli bir görüşme yapmak istiyor.**\n` +
      `-# #${pad(app.number)} numaralı başvurun için mülakat aşamasına geçildi.`,
    'warning',
  );
  if (voice) voiceSection(container, app, voice);
  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# ${guildName} · <t:${unix(app.meetingAt)}:F>`));
}

// Başvuran bir görüşme kanalına girince başvuruyla ilgilenen yetkiliye giden DM (görüşme ya da oryantasyon için)
function applicantWaitingDm(app, guildName, channelId, orientation) {
  return notice(
    [
      '### Başvuran Seni Bekliyor\n' +
        `**<@${app.userId}> ${orientation ? 'oryantasyon' : 'görüşme'} için <#${channelId}> kanalına girdi.**\n` +
        `-# #${pad(app.number)} numaralı başvuru` +
        (orientation
          ? '. Kanala girdiğinde oryantasyon kendiliğinden başlayacak.'
          : ' için seni bekliyor, kanala geçip görüşmeye başlayabilirsin.'),
    ],
    'primary',
  )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, channelId)),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${guildName} · <t:${unix(Date.now())}:F>`));
}

// Kayıt kanalındaki görüşme mesajı: görüşme başlayınca gönderilir, bitince güncellenir
function meetingLog(app) {
  const m = app.meeting;
  const ended = Boolean(m.endedAt);
  const duration = ended ? Math.max(1, Math.round((m.endedAt - m.startedAt) / 60000)) : 0;
  return notice(
    ended
      ? `### Görüşme Tamamlandı · Başvuru #${pad(app.number)}\n` +
          `**<@${app.meetingBy}> ile <@${app.userId}> arasındaki görüşme bitti.**\n` +
          `-# <#${m.channelId}> kanalında <t:${unix(m.startedAt)}:t> - <t:${unix(m.endedAt)}:t> arası, ${duration} dakika sürdü.`
      : `### Görüşme Başladı · Başvuru #${pad(app.number)}\n` +
          `**<@${app.meetingBy}>, <@${app.userId}> ile <#${m.channelId}> kanalında görüşüyor.**\n` +
          `-# Başlangıç <t:${unix(m.startedAt)}:t> · Görüşme bitince bu mesaj güncellenir.`,
    ended ? 'success' : 'primary',
  );
}

module.exports = { IDS, STATUS, statusLabel, applicantWaitingDm, meetingLog, panel, applicationModal, applicationNotice, reviewModal, resultDm, meetingDm };
