// Başvuru sisteminin mesajları: panel, başvuru formu, başvurular kanalı mesajı ve başvurana giden DM'ler
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { colors, text, divider, pad, unix, quote, shorten, page, messageUrl, panel: standardPanel } = require('../../core/ui');
const orientationUi = require('../oryantasyon/ui');
const config = require('./config');

const IDS = {
  apply: 'basvuru:yap',
  applyModal: 'basvuru:form',
  applyQuestion: 'basvuru:soru', // sonuna soru ID'si eklenir
  review: 'basvuru-karar', // basvuru-karar:<başvuru>:<gorusme|devam|red> (eski mesajlarda onay da olabilir)
  reviewModal: 'basvuru-karar-form', // basvuru-karar-form:<başvuru>:red
  reviewNote: 'basvuru-karar-not',
  remind: 'basvuru-hatirlat', // basvuru-hatirlat:<başvuru>
};

const STATUS = { pending: 'İnceleniyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
// Boş satır yığınları tek satıra indirilir; mesajdaki toplam metin 4000 karakteri aşmasın diye cevaplar kırpılır
const answersText = (answers) =>
  shorten(answers.map(({ title, answer }) => `**${title}:**\n${quote(answer.replace(/\n{2,}/g, '\n'))}`).join('\n'), 2800);

// Standart sayfa düzeni: renk adı (primary, success...) ile page() kurar
const card = (title, sub, blocks, color, thumbnail) => page({ title, sub, blocks, accent: color ? colors[color] : undefined, thumbnail });
const withFooter = (container, footer) => container.addSeparatorComponents(divider()).addTextDisplayComponents(text(footer));

// Kalıcı başvuru paneli: başlık ve sağında buton, uzun gri açıklama, görsel, en altta uyarı notu
const panel = () =>
  standardPanel({
    title: config.panel.title,
    sub: 'Yetkili ekibine katılmak için **Başvur** butonuyla başvuru formunu doldur. Başvurun yetkililer tarafından dikkatle incelenir ve sonuç sana DM üzerinden iletilir.',
    button: { id: IDS.apply, label: config.panel.buttonLabel },
    image: config.banner,
    note: config.panel.footer,
  });

// "Başvur" butonuyla açılan form; sorular config.js'ten gelir
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
  if (o.status === 'choosing') {
    return [
      `**Durum: Oryantasyon kararı bekleniyor**
<@${o.staffId}> başvuruyu uygun buldu; oryantasyonu kendisinin mi vereceğine yoksa oryantasyon yetkililerine mi bırakacağına karar veriyor.`,
      colors.primary,
    ];
  }
  if (o.status === 'unassigned' && o.holdBy) {
    return [
      `**Durum: Oryantasyon beklemede**\n<@${o.holdBy}> oryantasyonu beklemeye aldı. **Oryantasyonu Üstlen** butonuna ilk basan yetkili kalınan adımdan devam eder.`,
      colors.warning,
    ];
  }
  if (o.status === 'unassigned') {
    return [
      `**Durum: Oryantasyon yetkilisi bekleniyor**
<@${app.reviewedBy}> başvuruyu onayladı ve oryantasyonu yetkililere bıraktı. **Oryantasyonu Üstlen** butonuna ilk basan yetkili oryantasyonu verir.`,
      colors.warning,
    ];
  }
  if (o.status === 'waiting') {
    return [
      `**Durum: Oryantasyon bekleniyor**\n<@${app.reviewedBy}> onayladı, oryantasyonu <@${o.staffId}> verecek. ` +
        'İkisi aynı görüşme kanalına girince **oryantasyon kendiliğinden başlar.**',
      colors.primary,
    ];
  }
  if (o.status === 'active') {
    const waiting = o.staffNeeded ? '\n**Yetkili ayrıldı,** oryantasyonu devralacak başka bir yetkili bekleniyor.' : '';
    return [
      `**Durum: Oryantasyonda**\n<@${o.staffId}> şu an <#${o.channelId}> kanalında oryantasyon veriyor.${waiting}`,
      o.staffNeeded ? colors.warning : colors.primary,
    ];
  }
  if (o.status === 'completed') {
    return [
      `**Durum: Ekibe katıldı**\n<@${o.staffId}> oryantasyonu tamamladı, **${o.levelLabel}** yetkisiyle ekibe başladı.\n` +
        `**${o.areaLabels.length > 1 ? 'Görev alanları' : 'Görev alanı'}:** ${o.areaLabels.join(', ')}`,
      colors.success,
    ];
  }
  const by = o.cancelledBy ? `<@${o.cancelledBy}> iptal etti.` : '**Otomatik olarak** iptal edildi.';
  const penalty = app.penaltyUntil
    ? `\n**Başvuru cezası:** başvuran <t:${unix(app.penaltyUntil)}:D> tarihine kadar yeniden başvuru yapamaz.`
    : '';
  return [`**Durum: Oryantasyon iptal edildi**\n${by}\n${quote(o.cancelReason)}${penalty}`, colors.danger];
}

// Sicil gibi yerlerde görünen kısa durum
function statusLabel(app) {
  if (app.status !== 'approved' || !app.orientation) return STATUS[app.status];
  return { choosing: 'Oryantasyonda', unassigned: 'Oryantasyon Bekliyor', waiting: 'Oryantasyonda', active: 'Oryantasyonda', completed: 'Ekibe Katıldı', cancelled: 'Oryantasyon İptal Edildi' }[
    app.orientation.status
  ];
}

// Başvurular kanalına giden mesaj: sağ üstte başvuranın fotoğrafı, inceleyen rol etiketlenir,
// karar verilene kadar Görüşmeye Çağır / Reddet butonları durur (başvuruyu onaylama kararı görüşme sırasında ses kanalının
// sohbetindeki panelden verilir). Onaylanınca oryantasyonun durumunu gösterir, oryantasyon sürerken aktarma ve iptal
// butonları, yetkililere bırakılınca üstlen butonu çıkar.
function applicationNotice(app, applicantUser) {
  const pending = app.status === 'pending';
  const orienting = ['choosing', 'unassigned', 'waiting', 'active'].includes(app.orientation?.status);

  let status;
  let color;
  if (app.status === 'approved' && app.orientation) {
    [status, color] = orientationStatus(app);
  } else if (app.status === 'approved') {
    const role = app.acceptRoleId
      ? app.roleGiven
        ? ` <@&${app.acceptRoleId}> rolü verildi.`
        : ' **Rol verilemedi,** elle verilmesi gerekiyor.'
      : '';
    status = `**Durum: Onaylandı**\n<@${app.reviewedBy}> onayladı.${role}`;
    color = colors.success;
  } else if (app.status === 'rejected') {
    status = `**Durum: Reddedildi**\n<@${app.reviewedBy}> başvuruyu reddetti.`;
    color = colors.danger;
  } else if (app.meetingBy) {
    const where = app.meetingChannelId ? `, <#${app.meetingChannelId}> kanalında bekliyor` : '';
    status =
      `**Durum: Görüşme bekleniyor**\n<@${app.meetingBy}> başvuranı görüşmeye çağırdı${where}.\n` +
      'Başvuruyla **o ilgileniyor,** kararı da o verecek.';
    color = colors.primary;
  } else if (app.onHold) {
    status = `**Durum: Görüşme beklemede**\n<@${app.onHold.by}> görüşmeyi ${app.onHold.auto ? 'kanaldan uzun süre ayrıldığı için otomatik olarak ' : ''}beklemeye aldı. **Görüşmeye Çağır** butonuna ilk basan yetkili başvuruyu üstlenir.`;
    color = colors.warning;
  } else {
    status = '**Durum: İnceleniyor**\nKarar verildiğinde sonuç başvurana **DM ile** iletilir.';
    color = colors.warning;
  }
  if (app.note) status += `\n${quote(app.note)}`;

  const previous = app.previous?.total
    ? `${app.previous.total} başvuru${app.previous.rejected ? ` - ${app.previous.rejected} reddedildi` : ''}`
    : 'Yok';

  const role = app.reviewerRoleId ? `<@&${app.reviewerRoleId}>, ` : '';
  const info = [
    // Başvuran başlıkta etiketli, burada sadece kullanıcı adı
    `**Kullanıcı Adı:** \`${app.username}\``,
    `**Hesap Oluşturma:** <t:${unix(app.accountCreatedAt)}:R>`,
    `**Sunucuya Katılma:** ${app.joinedAt ? `<t:${unix(app.joinedAt)}:R>` : 'Bilinmiyor'}`,
    `**Önceki Başvurular:** ${previous}`,
  ].join('\n');

  const container = card(
    pending ? `Yeni Başvuru #${pad(app.number)}` : `Başvuru #${pad(app.number)}`,
    pending
      ? 'Başvuranın bilgileri ve cevapları bu mesajda yer alıyor. Cevapları inceleyip başvuranı **Görüşmeye Çağır** ile sesli mülakata alabilir ya da **Reddet** ile başvuruyu sonuçlandırabilirsin; ilk çağıran yetkili başvuruyu üstlenir.'
      : 'Bu başvurunun bilgileri, cevapları ve güncel durumu burada listelenir. Başvuru sonuçlandıktan sonra da süreç boyunca bu mesaj güncellenir ve son durumu gösterir.',
    [
      `**Başvuran**\n${pending ? role : ''}<@${app.userId}> ekibe katılmak için başvurdu.\n${info}`,
      `**Cevaplar**\n${answersText(app.answers)}`,
      status,
    ],
    null,
    applicantUser?.displayAvatarURL({ size: 256 }),
  );
  container.setAccentColor(color);

  if (pending) {
    const reviewId = (action) => `${IDS.review}:${app.id}:${action}`;
    container.addSeparatorComponents(divider()).addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(reviewId('gorusme'))
          .setStyle(app.meetingBy ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setLabel(app.meetingBy ? 'Görüşmeye Çağrıldı' : 'Görüşmeye Çağır')
          .setDisabled(Boolean(app.meetingBy)),
        new ButtonBuilder().setCustomId(reviewId('red')).setStyle(ButtonStyle.Danger).setLabel('Reddet'),
      ),
    );
  }
  // Oryantasyon yönetimi (Aktar/İptal), başvuru kararından farklı bir iş yaptığı için çizgiyle ayrılır
  if (orienting) container.addSeparatorComponents(divider()).addActionRowComponents(orientationUi.noticeRow(app));

  return withFooter(container, `-# <t:${unix(app.createdAt)}:F>`);
}

// Reddet ile açılan form: sebep zorunlu ve başvurana DM ile iletilir
function reviewModal(app) {
  return new ModalBuilder()
    .setCustomId(`${IDS.reviewModal}:${app.id}:red`)
    .setTitle('Başvuruyu Reddet')
    .addTextDisplayComponents(
      text(`**#${pad(app.number)} numaralı başvuruyu reddediyorsun.**
Yazdığın sebep başvurana **DM ile** iletilecek.`),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Ret sebebi')
        .setDescription('Başvurana iletilir.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.reviewNote)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Aktiflik süren şu an için yeterli değil.')
            .setMinLength(5)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

const channelUrl = (guildId, channelId) => `https://discord.com/channels/${guildId}/${channelId}`;

// DM'lerdeki görüşme ses kanalı bölümü.
// voice: { staffId, waitingIn, until }: waitingIn yetkilinin şu an beklediği kanal (yoksa null), until erişimin kapanacağı zaman.
// Yetkili bir kanalda bekliyorsa o kanala, beklemiyorsa üç kanala da katılma butonu çıkar.
function voiceSection(container, app, voice) {
  const expiry =
    '**Görüşme kanalları senin için açıldı.** Mülakat bitip kanaldan ayrıldığında tekrar kapanır ' +
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
          ? `**Görüşme Kanalı**\n<@${voice.staffId}> mülakat için seni şu an <#${voice.waitingIn}> kanalında **bekliyor.**\n${expiry}`
          : `**Görüşme Kanalı**\nMülakat için butonlardaki **ses kanallarından birine** katılabilirsin.\n${expiry}`,
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
}

// Reddedilen başvurana giden sonuç DM'si (onaylanana oryantasyon sistemi kendi DM'ini gönderir)
function resultDm(app, guildName, reapplyAt) {
  const blocks = [
    `**Başvuru Sonucu**\nBaşvurun bu sefer **olumlu sonuçlanmadı.**\n` +
      `#${pad(app.number)} numaralı başvurunu <@${app.reviewedBy}> değerlendirdi.` +
      (reapplyAt ? ` **<t:${unix(reapplyAt)}:D>** tarihinden sonra tekrar başvurabilirsin.` : ' İleride tekrar başvurabilirsin.'),
  ];
  if (app.note) blocks.push(`**Sebep**\n${quote(app.note)}`);
  blocks.push(`-# ${guildName} - <t:${unix(app.reviewedAt)}:F>`);

  return card(
    'Başvurun Sonuçlandı',
    'Yetkili başvurun incelendi ve sonuçlandı. Kararı veren yetkili, varsa belirtilen sebep ve yeniden başvurabileceğin tarih bu mesajda yer alıyor; ilgin için teşekkür ederiz.',
    blocks,
    'danger',
  );
}

// "Görüşmeye Çağır" ile başvurana giden DM: yetkili bir ses kanalındaysa "seni X kanalında bekliyor",
// değilse "kanallardan birine geç" der. Ses kanalları açılamadıysa (voice yok) sadece görüşme daveti gider.
function meetingDm(app, guildName, voice) {
  const container = card(
    'Mülakata Davet Edildin',
    'Yetkili başvurun hakkında seninle sesli bir görüşme yapmak istiyor. Mülakat için hangi ses kanalına katılman gerektiği ve kanal erişiminin ne zaman kapanacağı bu mesajda yazıyor.',
    [`**Davet**\n<@${app.meetingBy}> başvurun hakkında seninle sesli bir görüşme yapmak istiyor.\n#${pad(app.number)} numaralı başvurun için mülakat aşamasına geçildi.`],
    'warning',
  );
  if (voice) voiceSection(container, app, voice);
  return withFooter(container, `-# ${guildName} - <t:${unix(app.meetingAt)}:F>`);
}

// Başvuran bir görüşme kanalına girince başvuruyla ilgilenen yetkiliye giden DM (görüşme ya da oryantasyon için)
function applicantWaitingDm(app, guildName, channelId, orientation, reminder) {
  return withFooter(
    card(
      reminder ? 'Başvuran Seni Hatırlatıyor' : 'Başvuran Seni Bekliyor',
      reminder
        ? 'Başvuran hâlâ kanalda bekliyor ve Hatırlat butonuyla sana haber verdi. **Kanala Katıl** butonuyla görüşmeyi ya da oryantasyonu hemen başlatabilirsin; başvuru ayrıntıları başvurular kanalında.'
        : 'Başvuran görüşme kanalına girdi ve seni bekliyor. **Kanala Katıl** butonuyla görüşmeyi ya da oryantasyonu hemen başlatabilirsin; başvuru ayrıntıları başvurular kanalında.',
      [
        `**Başvuran**\n<@${app.userId}> ${orientation ? 'oryantasyon' : 'görüşme'} için <#${channelId}> kanalında${reminder ? ' hâlâ' : ''} bekliyor.\n**Başvuru:** #${pad(app.number)}` +
          (orientation && !reminder ? '\nKanala girdiğinde oryantasyon kendiliğinden başlayacak.' : ''),
      ],
      'primary',
    )
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, channelId)),
        ),
      ),
    `-# ${guildName} - <t:${unix(Date.now())}:F>`,
  );
}

// Görüşme başlayınca (ikisi aynı görüşme kanalına girince) kanalın sohbetine atılan karar paneli: görüşmeye çağıran yetkili
// başvurunun devam edip etmeyeceğine buradan karar verir. state: open | rejected (Devam Et ile oryantasyon aşamasına geçilince
// panelin yerine oryantasyonu kimin vereceği sorusu gelir)
function decisionPanel(app, state = 'open') {
  if (state === 'rejected') {
    return card(
      'Başvuru Reddedildi',
      'Görüşmenin ardından başvuru reddedildi ve sebep başvurana DM ile iletildi. Görüşme kanalları başvurana kilitlenir; kayıt başvurular kanalında kalır.',
      [`**Başvuru #${pad(app.number)}**\n<@${app.reviewedBy}>, <@${app.userId}> kullanıcısının başvurusunu reddetti.`],
      'danger',
    );
  }
  if (state === 'hold') {
    return card(
      'Görüşme Beklemede',
      'Görüşmeyi yürüten yetkili işlemi beklemeye aldı. Başvurular kanalına bildirim gitti; başka bir yetkili başvuruyu üstlenince görüşme yeniden başlar, o zamana kadar kanalda beklemen yeterli.',
      [`**Başvuru #${pad(app.number)}**\n**<@${app.onHold?.by}> görüşmeyi beklemeye aldı.**\n<@${app.userId}> yeni yetkili çağrılana kadar bekliyor.`],
      'warning',
    );
  }
  const reviewId = (action) => `${IDS.review}:${app.id}:${action}`;
  const away = app.meeting?.staffAwaySince;
  const blocks = [
    `**Başvuru #${pad(app.number)}**\n<@${app.meetingBy}> ile <@${app.userId}> görüşüyor.\nKararı sadece **görüşmeye çağıran yetkili** (ya da yöneticiler) verebilir.`,
  ];
  if (away) {
    blocks.push(
      `**Yetkili ayrıldı.**\n<@${app.meetingBy}> kanaldan ayrıldı, <t:${unix(away + config.meetingStaffGraceMinutes * 60000)}:R> dönmezse görüşme beklemeye alınır ve başka bir yetkili çağrılır.`,
    );
  }
  return card(
    'Görüşme Kararı',
    'Görüşme bitince başvuranın uygun olup olmadığına karar ver: **Devam Et** ile başvuru oryantasyon aşamasına geçer, **İptal Et** ile başvuru reddedilir; bir sorun çıkarsa **Beklemeye Al** ile başka yetkiliye bırakabilirsin.',
    blocks,
    away ? 'warning' : 'primary',
  )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(reviewId('devam')).setStyle(ButtonStyle.Success).setLabel('Devam Et'),
        new ButtonBuilder().setCustomId(reviewId('bekle')).setStyle(ButtonStyle.Secondary).setLabel('Beklemeye Al'),
        new ButtonBuilder().setCustomId(reviewId('red')).setStyle(ButtonStyle.Danger).setLabel('İptal Et'),
      ),
    );
}

// Görüşme beklemeye alınınca (elle ya da yetkili kanaldan uzun süre ayrılınca) başvurular kanalına giden, inceleyen rolü
// etiketleyen bildirim: başvuru mesajındaki Görüşmeye Çağır butonuna ilk basan yetkili görüşmeyi sürdürür
function meetingHoldNotice(app) {
  const h = app.onHold;
  return card(
    'Görüşme Beklemede',
    'Başvuranın görüşmesi beklemeye alındı ve başvuru yeniden sahipsiz. Başvuru mesajındaki **Görüşmeye Çağır** butonuna ilk basan yetkili başvuruyu üstlenir ve görüşmeyi sürdürür.',
    [
      `**Başvuru #${pad(app.number)}**\n${app.reviewerRoleId ? `<@&${app.reviewerRoleId}>, ` : ''}<@${app.userId}> görüşme için bekliyor.\n**<@${h.by}> görüşmeyi ${h.auto ? 'kanaldan uzun süre ayrıldığı için otomatik olarak ' : ''}beklemeye aldı.**`,
    ],
    'warning',
  )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Başvuruya Git').setURL(messageUrl(app.guildId, app.channelId, app.messageId)),
      ),
    );
}

// Başvuran görüşme kanalına yetkiliden önce girince kanalın sohbetine giden bekleme mesajı.
// stage: meeting (görüşme) | orientation (oryantasyon yetkilisi belli) | unassigned (oryantasyonu üstlenen yok)
function waitingChat(app, stage, askStaffId, remindDisabled) {
  const staffId = stage === 'meeting' ? app.meetingBy : app.orientation?.staffId;
  const stageName = stage === 'meeting' ? 'Görüşme' : 'Oryantasyon';
  const info = [
    `**Başvuru:** #${pad(app.number)}`,
    `**Başvuran:** <@${app.userId}>`,
    `**Aşama:** ${stageName}`,
    `**Yetkili:** ${stage === 'unassigned' ? 'Henüz üstlenen yok' : `<@${staffId}>`}`,
  ].join('\n');
  const status = askStaffId
    ? `**<@${askStaffId}>, bekleyen bir oryantasyon işlemi var, ilgilenmek ister misin?**\nÜstlenmek için **Oryantasyonu Üstlen**, şimdilik geçmek için **Şimdi Değil** butonuna bas.`
    : stage === 'unassigned'
      ? '**Oryantasyonu üstlenecek yetkili bekleniyor.**\nBaşvurular kanalına bildirim gönderildi.'
      : '**Yetkilinin bağlanması bekleniyor.**\nYetkili kanala bağlanınca başlanacak, kanaldan ayrılmadan bekle.';
  const container = card(
    askStaffId ? 'Bekleyen Oryantasyon' : 'Yetkili Bekleniyor',
    askStaffId
      ? 'Oryantasyonu bekleyen başvuran kanalda ve henüz kimse üstlenmedi. **Oryantasyonu Üstlen** ile başvuranla ilgilenebilir, **Şimdi Değil** ile mesajı eski haline döndürebilirsin; mesaj kanalda kalır.'
      : 'Başvuran görüşme kanalına girdi ve yetkiliyi bekliyor. Yetkili kanala bağlandığında görüşme ya da oryantasyon başlar; o zamana kadar kanaldan ayrılmadan beklemen yeterli.',
    [info, status],
    'warning',
  );
  const row = new ActionRowBuilder();
  if (stage === 'unassigned') {
    row.addComponents(
      new ButtonBuilder().setCustomId(`${orientationUi.IDS.action}:${app.id}:ustlen`).setStyle(ButtonStyle.Success).setLabel('Oryantasyonu Üstlen'),
    );
    if (askStaffId) {
      row.addComponents(new ButtonBuilder().setCustomId(`${orientationUi.IDS.action}:${app.id}:gec`).setStyle(ButtonStyle.Secondary).setLabel('Şimdi Değil'));
    }
  }
  // Başvuran 5 dakikada bir yetkililere "bekliyorum" bildirimi gönderebilir
  row.addComponents(
    new ButtonBuilder().setCustomId(`${IDS.remind}:${app.id}`).setStyle(ButtonStyle.Secondary).setLabel('Hatırlat').setDisabled(Boolean(remindDisabled)),
  );
  return container.addSeparatorComponents(divider()).addActionRowComponents(row);
}

// Başvuran yetkiliden önce kanala girince başvurular kanalına (başvuru mesajına yanıt olarak) giden, başvuranın hangi aşamada beklediğini söyleyen kayıt.
// stage: meeting | orientation
function waitingLog(app, stage, channelId, reminder) {
  const staffId = stage === 'meeting' ? app.meetingBy : app.orientation.staffId;
  const stageName = stage === 'meeting' ? 'Görüşme' : 'Oryantasyon';
  return card(
    reminder ? 'Başvuran Hatırlatıyor' : 'Başvuran Bekliyor',
    reminder
      ? `Başvuran hâlâ kanalda bekliyor ve **Hatırlat** butonuyla sana haber verdi. **Kanala Katıl** butonuyla ${stage === 'meeting' ? 'görüşmeyi' : 'oryantasyonu'} hemen başlatabilirsin.`
      : `Başvuran ${stage === 'meeting' ? 'görüşme' : 'oryantasyon'} için görüşme kanalına girdi ve yetkiliyi bekliyor. **Kanala Katıl** butonuyla ${stage === 'meeting' ? 'görüşmeyi' : 'oryantasyonu'} hemen başlatabilirsin.`,
    [
      [
        `**Başvuru:** #${pad(app.number)}`,
        `**Başvuran:** <@${app.userId}>`,
        `**Aşama:** ${stageName}`,
        `**Yetkili:** <@${staffId}>`,
        `**Kanal:** <#${channelId}>`,
      ].join('\n'),
      reminder ? `**<@${staffId}>, başvuran hâlâ bekliyor.**` : `**<@${staffId}> yetkilisinin bağlanması bekleniyor.**`,
    ],
    'warning',
  )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, channelId)),
      ),
    );
}

// Görüşmeye çağıran yetkili başvurandan önce bir görüşme kanalına girince başvurana giden DM
function meetingStaffWaitingDm(app, guildName, channelId) {
  return withFooter(
    card(
      'Yetkilin Seni Bekliyor',
      'Görüşmeye çağıran yetkili görüşme kanalına girdi ve seni bekliyor. **Kanala Katıl** butonuyla hemen katılabilirsin; kanal senin için açık ve görüşme kanala girdiğinizde kendiliğinden başlar.',
      [`**Görüşme**
**<@${app.meetingBy}> mülakat için <#${channelId}> kanalına girdi, seni bekliyor.**
**Başvuru:** #${pad(app.number)}`],
      'primary',
    )
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(app.guildId, channelId)),
        ),
      ),
    `-# ${guildName} - <t:${unix(Date.now())}:F>`,
  );
}

// Kayıt kanalındaki görüşme mesajı: görüşme başlayınca gönderilir, bitince güncellenir
function meetingLog(app) {
  const m = app.meeting;
  const ended = Boolean(m.endedAt);
  const duration = ended ? Math.max(1, Math.round((m.endedAt - m.startedAt) / 60000)) : 0;
  return card(
    ended ? `Görüşme Tamamlandı - Başvuru #${pad(app.number)}` : `Görüşme Başladı - Başvuru #${pad(app.number)}`,
    'Başvuranla yapılan sesli görüşmenin kayıt kanalındaki özeti. Görüşme başlayınca gönderilir, bitince bu mesaj güncellenir ve görüşmenin süresi ile kanalı burada saklanır.',
    [
      ended
        ? `**Görüşme**\n<@${app.meetingBy}> ile <@${app.userId}> arasındaki görüşme bitti.\n` +
          `<#${m.channelId}> kanalında <t:${unix(m.startedAt)}:t> - <t:${unix(m.endedAt)}:t> arası, ${duration} dakika sürdü.`
        : `**Görüşme**\n<@${app.meetingBy}>, <@${app.userId}> ile <#${m.channelId}> kanalında görüşüyor.\n` +
          `Başlangıç <t:${unix(m.startedAt)}:t> - Görüşme bitince bu mesaj güncellenir.`,
    ],
    ended ? 'success' : 'primary',
  );
}

module.exports = { IDS, STATUS, statusLabel, meetingHoldNotice, applicantWaitingDm, meetingStaffWaitingDm, decisionPanel, waitingChat, waitingLog, meetingLog, panel, applicationModal, applicationNotice, reviewModal, resultDm, meetingDm };
