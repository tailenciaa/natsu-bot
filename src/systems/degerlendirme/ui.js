// Değerlendirme sisteminin mesajları: DM'deki puanlama bölümü, değerlendirme ve şikayet kanalı mesajları, DM bildirimleri
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
const { colors, text, divider, pad, unix, quote, stars, messageUrl, notice } = require('../../core/ui');
const config = require('./config');

// Hepsinin sonuna veri eklenir (değerlendirme ID'si, puan, karar)
const IDS = {
  rate: 'puan', // puan:<id>:<puan>
  rateModal: 'puan-form', // puan-form:<id>:<puan>
  rateComment: 'puan-yorum',
  report: 'puan-bildir', // puan-bildir:<id>
  reportModal: 'puan-bildir-form', // puan-bildir-form:<id>
  reportReason: 'puan-bildir-sebep',
  review: 'puan-karar', // puan-karar:<id>:<onay|red|gorusme>
  reply: 'puan-yanit', // puan-yanit:<id>
  replyModal: 'puan-yanit-form', // puan-yanit-form:<id>
  replyText: 'puan-yanit-metin',
};

const SCORE_LABELS = { 1: 'Çok Kötü', 2: 'Kötü', 3: 'Orta', 4: 'İyi', 5: 'Mükemmel' };
const REPORT_LABELS = { pending: 'İtiraz Edildi', rejected: 'İtiraz Reddedildi' };

// Değerlendirme kategorileri: neyin değerlendirildiği ve mesajlarda nasıl anlatıldığı.
// Kategorisi olmayan eski kayıtlar destek sayılır.
const CATEGORIES = {
  destek: {
    short: 'Destek',
    ref: (r) => `Destek Talebi #${pad(r.ticketNumber)}`,
    handled: (name) => `Talebinle ${name} ilgilendi.`,
    question: 'Aldığın destekten ne kadar memnun kaldın?',
    modalTitle: 'Destek Deneyimini Puanla',
    placeholder: 'Örn: Çok hızlı ve ilgili davrandı, teşekkürler.',
  },
  gorusme: {
    short: 'Görüşme',
    ref: (r) => `Başvuru #${pad(r.applicationNumber)} görüşmesi`,
    handled: (name) => `Görüşmeni ${name} yaptı.`,
    question: 'Görüşme nasıl geçti, yetkiliden ne kadar memnun kaldın?',
    modalTitle: 'Görüşmeyi Puanla',
    placeholder: 'Örn: Çok rahat bir görüşmeydi, sorularımı sabırla cevapladı.',
  },
  oryantasyon: {
    short: 'Oryantasyon',
    ref: (r) => `Başvuru #${pad(r.applicationNumber)} oryantasyonu`,
    handled: (name) => `Oryantasyonunu ${name} verdi.`,
    question: 'Oryantasyon ne kadar açıklayıcı ve faydalıydı?',
    modalTitle: 'Oryantasyonu Puanla',
    placeholder: 'Örn: Her şeyi adım adım anlattı, kafamda soru işareti kalmadı.',
  },
};
const categoryOf = (rating) => CATEGORIES[rating.category] ?? CATEGORIES.destek;
const refText = (rating) => categoryOf(rating).ref(rating);

// DM'deki puanlama bölümü (destek talebinin kapanış DM'inin ya da görüşme / oryantasyon sonrası DM'in altına eklenir),
// puan verilince teşekkür haline gelir
function ratingSection(container, rating) {
  container.addSeparatorComponents(divider());
  if (rating.score) {
    // Puan verilince DM yeşile döner
    return container.setAccentColor(colors.success).addTextDisplayComponents(
      text(`**Geri bildirimin için teşekkürler!**\n-# **${rating.staffName}** yetkilisine ${stars(rating.score)} verdin.`),
    );
  }
  const category = categoryOf(rating);
  return container
    .addTextDisplayComponents(
      text(`**${category.handled(rating.staffName)}**\n-# ${category.question} Yıldızlardan birini seçerek puan verebilirsin.`),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map((score) =>
          new ButtonBuilder()
            .setCustomId(`${IDS.rate}:${rating.id}:${score}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('⭐'.repeat(score)),
        ),
      ),
    );
}

// Üye DM'de puana basınca açılan yorum formu
function ratingModal(rating, score) {
  return new ModalBuilder()
    .setCustomId(`${IDS.rateModal}:${rating.id}:${score}`)
    .setTitle(categoryOf(rating).modalTitle)
    .addTextDisplayComponents(text(`**${rating.staffName}** yetkilisine verdiğin puan: **${stars(score)}**`))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Yorumun')
        .setDescription('İsteğe bağlı, deneyimini birkaç cümleyle paylaşabilirsin.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.rateComment)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(categoryOf(rating).placeholder)
            .setMaxLength(500)
            .setRequired(false),
        ),
    );
}

// Değerlendirme kanalına giden mesaj: sağ üstte yetkilinin fotoğrafı, yetkili etiketlenir ve buradan itiraz edebilir.
// Normalde sarı durur. İtiraz edilince kırmızı olur ve başlık değişir; itiraz reddedilirse mesaj ilk haline döner,
// sadece buton "İtiraz Reddedildi" olur (kanalı görenler normal bir değerlendirme gibi görür).
// İtirazı onaylanırsa "Değerlendirme Kaldırıldı" haline gelir, puanın üstü çizilir ve buton kalkar.
function ratingNotice(rating, staffUser) {
  const removed = rating.reportStatus === 'approved' || Boolean(rating.removedAt);
  const disputed = !removed && Boolean(rating.reportedAt) && (rating.reportStatus ?? 'pending') === 'pending';
  const score = `${stars(rating.score)} · ${SCORE_LABELS[rating.score]}`;

  let header;
  if (removed) {
    header =
      '### Değerlendirme Kaldırıldı\n' +
      `**<@${rating.staffId}> yetkilisinin aldığı değerlendirme geçersiz sayıldı.**\n` +
      (rating.removedAt
        ? `-# <@${rating.removedBy}> değerlendirmeyi sicilden kaldırdı.`
        : `-# <@${rating.reviewedBy}> itirazı onayladı, değerlendirme sicilden çıkarıldı.`);
  } else if (disputed) {
    header =
      '### İtiraz Edilen Değerlendirme\n' +
      `**<@${rating.staffId}> bu değerlendirmeye itiraz etti.**\n` +
      '-# İtiraz liderler tarafından inceleniyor.';
  } else {
    // Değerlendirmenin nereden geldiği aşağıdaki "Kaynak" satırında
    header = '### Yeni Değerlendirme\n' + `**<@${rating.staffId}> yeni bir değerlendirme aldı.**`;
  }
  header = text(header);

  const container = new ContainerBuilder().setAccentColor(removed || disputed ? colors.danger : colors.warning);
  if (staffUser) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(header)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(staffUser.displayAvatarURL({ size: 256 }))),
    );
  } else {
    container.addTextDisplayComponents(header);
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `**Puan:** ${removed ? `~~${score}~~` : score}`,
          `**Değerlendiren:** <@${rating.userId}>`,
          `**Kaynak:** ${refText(rating)}`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(rating.comment ? `**Yorum:**\n${quote(rating.comment)}` : '**Yorum:** Yorum bırakılmadı'));

  if (rating.staffReply) {
    container.addTextDisplayComponents(text(`**Yetkili Yorumu:**\n${quote(rating.staffReply)}`));
  }

  if (!removed) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.reply}:${rating.id}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(rating.repliedAt ? 'Yorum Eklendi' : 'Yorum Ekle')
          .setDisabled(Boolean(rating.repliedAt)),
        new ButtonBuilder()
          .setCustomId(`${IDS.report}:${rating.id}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel(rating.reportedAt ? REPORT_LABELS[rating.reportStatus ?? 'pending'] : 'İtiraz Et')
          .setDisabled(Boolean(rating.reportedAt)),
      ),
    );
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# <t:${unix(rating.ratedAt)}:F>`));
}

// Yetkilinin değerlendirmeye itiraz ederken sebep yazdığı form
function reportModal(rating) {
  return new ModalBuilder()
    .setCustomId(`${IDS.reportModal}:${rating.id}`)
    .setTitle('Değerlendirmeye İtiraz Et')
    .addTextDisplayComponents(
      text(
        `**${refText(rating)} için aldığın ${stars(rating.score)} değerlendirmeye itiraz ediyorsun.**\n` +
          'İtirazın liderlere iletilecek.',
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('İtiraz sebebin')
        .setDescription('Bu değerlendirmenin neden haksız olduğunu açıkla.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.reportReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Sorunu çözdüm ama üye kasıtlı olarak düşük puan verdi.')
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true),
        ),
    );
}

// Değerlendirilen yetkilinin değerlendirmeye yorum yazdığı form
function replyModal(rating) {
  return new ModalBuilder()
    .setCustomId(`${IDS.replyModal}:${rating.id}`)
    .setTitle('Değerlendirmeye Yorum Ekle')
    .addTextDisplayComponents(
      text(
        `**${refText(rating)} için aldığın ${stars(rating.score)} değerlendirmeye yorum ekliyorsun.**\n` +
          'Yorumun değerlendirme mesajında görünecek ve üyeye DM ile iletilecek.',
      ),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Yorumun')
        .setDescription('Bir kez eklenebilir, sonradan değiştirilemez.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.replyText)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Güzel geri bildirimin için teşekkürler, her zaman yardımcı olmaya hazırız.')
            .setMinLength(2)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Yetkili yorum ekleyince değerlendirmeyi yapan üyeye giden DM
function replyDm(rating, guildName) {
  return notice(
    [
      '### Değerlendirmene Yorum Geldi\n' +
        `**<@${rating.staffId}> verdiğin değerlendirmeye yorum ekledi.**\n` +
        `-# ${refText(rating)} için verdiğin puan: ${stars(rating.score)}`,
      `**Yetkilinin Yorumu:**\n${quote(rating.staffReply)}`,
      `-# ${guildName} · <t:${unix(rating.repliedAt)}:F>`,
    ],
    'success',
  );
}

// Şikayet kanalına giden itiraz: lider rolü etiketlenir, karar butonları sonuçlanana kadar durur
function ratingComplaint(rating) {
  const decided = rating.reportStatus === 'approved' || rating.reportStatus === 'rejected';

  let status;
  let color;
  if (rating.reportStatus === 'approved') {
    status = `**Durum: Onaylandı**\n-# <@${rating.reviewedBy}> itirazı haklı buldu, değerlendirme sicilden kaldırıldı.`;
    color = colors.success;
  } else if (rating.reportStatus === 'rejected') {
    status = `**Durum: Reddedildi**\n-# <@${rating.reviewedBy}> itirazı reddetti, değerlendirme sicilde kalıyor.`;
    color = colors.danger;
  } else if (rating.meetingBy) {
    const where = rating.meetingChannelId ? `, <#${rating.meetingChannelId}> kanalında bekliyor` : '';
    status = `**Durum: Görüşme bekleniyor**\n-# <@${rating.meetingBy}> yetkiliyi görüşmeye çağırdı${where}.`;
    color = colors.primary;
  } else {
    status = '**Durum: İnceleniyor**\n-# Onaylanırsa değerlendirme yetkilinin sicilinden kaldırılır.';
    color = colors.warning;
  }

  // Karar butonları (işlem) ile "Değerlendirmeye Git" (gezinme) farklı işler yaptığı için ayrı satırlarda durur
  const decisionRow = new ActionRowBuilder();
  if (!decided) {
    const reviewId = (action) => `${IDS.review}:${rating.id}:${action}`;
    decisionRow.addComponents(
      new ButtonBuilder().setCustomId(reviewId('onay')).setStyle(ButtonStyle.Success).setLabel('Onayla'),
      new ButtonBuilder().setCustomId(reviewId('red')).setStyle(ButtonStyle.Danger).setLabel('Reddet'),
      new ButtonBuilder()
        .setCustomId(reviewId('gorusme'))
        .setStyle(ButtonStyle.Primary)
        .setLabel(rating.meetingBy ? 'Görüşmeye Çağrıldı' : 'Görüşmeye Çağır')
        .setDisabled(Boolean(rating.meetingBy)),
    );
  }
  const linkRow = new ActionRowBuilder();
  if (rating.messageId) {
    linkRow.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Değerlendirmeye Git')
        .setURL(messageUrl(rating.guildId, rating.channelId, rating.messageId)),
    );
  }

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      text(
        '### Değerlendirme İtirazı\n' +
          `**${rating.leaderRoleId ? `<@&${rating.leaderRoleId}>, ` : ''}<@${rating.staffId}> aldığı bir değerlendirmeye itiraz etti.**\n` +
          `-# <@${rating.userId}> tarafından verilen puanın haksız olduğunu düşünüyor.`,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**Kaynak:** ${refText(rating)}\n` +
          `**Değerlendirme:** ${stars(rating.score)}\n${rating.comment ? quote(rating.comment) : '-# Yorum bırakılmadı.'}`,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**İtiraz Sebebi:**\n${quote(rating.reportReason)}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(status));

  if (decisionRow.components.length) container.addActionRowComponents(decisionRow);
  if (linkRow.components.length) {
    if (decisionRow.components.length) container.addSeparatorComponents(divider());
    container.addActionRowComponents(linkRow);
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# <t:${unix(rating.reportedAt)}:F>`));
}

// "Görüşmeye Çağır" ile itiraz eden yetkiliye giden DM: lider bir görüşme kanalındaysa "seni X kanalında bekliyor",
// değilse "kanallardan birine geç" der ve kanallara katılma butonları ekler
function meetingDm(rating, guildName) {
  const channelUrl = (channelId) => `https://discord.com/channels/${rating.guildId}/${channelId}`;
  const waitingIn = rating.meetingChannelId;
  const buttons = waitingIn
    ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(waitingIn))]
    : config.voiceChannels.map((c) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(c.label).setURL(channelUrl(c.id)));

  return notice(
    '### Görüşmeye Çağrıldın\n' +
      `**<@${rating.meetingBy}> itirazın hakkında seninle sesli bir görüşme yapmak istiyor.**\n` +
      `-# ${refText(rating)} için aldığın değerlendirmeye yaptığın itiraz için görüşme yapılacak.`,
    'primary',
  )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        waitingIn
          ? `**<@${rating.meetingBy}> görüşme için seni şu an <#${waitingIn}> kanalında bekliyor!**`
          : '**Görüşme için aşağıdaki ses kanallarından birine geç.**',
      ),
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(buttons))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${guildName} · <t:${unix(rating.meetingAt)}:F>`));
}

// Görüşme ya da oryantasyon bitince başvurana giden puanlama DM'i (destek talepleri kapanış DM'inin altında puanlanır)
function ratingRequestDm(rating) {
  // Soru alttaki puanlama bölümünde sorulur; oryantasyonun tebriği ayrı DM'de olduğu için burada tekrar edilmez
  const header =
    rating.category === 'oryantasyon'
      ? '### Oryantasyonunu Değerlendir\n' +
        `-# Başvuru #${pad(rating.applicationNumber)} · Geri bildirimin yeni yetkililerin oryantasyonunu geliştirmemize yardımcı olur.`
      : '### Görüşmeni Değerlendir\n' +
        `**${rating.guildName} sunucusundaki yetkili alım görüşmen tamamlandı.**\n` +
        `-# Başvuru #${pad(rating.applicationNumber)} · Başvurunun sonucundan bağımsız olarak puanlayabilirsin.`;
  return ratingSection(notice(header, 'primary'), rating);
}

// İtiraz sonuçlanınca itiraz eden yetkiliye giden DM
function reviewDm(rating, guildName) {
  const approved = rating.reportStatus === 'approved';
  return notice(
    [
      approved
        ? '### İtirazın Kabul Edildi\n' +
          '**Değerlendirme sicilinden kaldırıldı.**\n' +
          `-# ${refText(rating)} için yaptığın itirazı <@${rating.reviewedBy}> onayladı.`
        : '### İtirazın Reddedildi\n' +
          '**Değerlendirme sicilinde kalmaya devam ediyor.**\n' +
          `-# ${refText(rating)} için yaptığın itirazı <@${rating.reviewedBy}> reddetti.`,
      `-# ${guildName} · <t:${unix(rating.reviewedAt)}:F>`,
    ],
    approved ? 'success' : 'danger',
  );
}

module.exports = {
  IDS,
  CATEGORIES,
  categoryOf,
  refText,
  ratingRequestDm,
  ratingSection,
  ratingModal,
  ratingNotice,
  replyModal,
  replyDm,
  reportModal,
  ratingComplaint,
  meetingDm,
  reviewDm,
};
