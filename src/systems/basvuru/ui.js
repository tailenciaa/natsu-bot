// Başvuru sisteminin mesajları: panel, başvuru formu, başvurular kanalı mesajı ve başvurana giden DM'ler
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { colors, text, divider, pad, unix, quote, shorten, page, messageUrl, fields, field, pageInfo, pagerRow, panel: standardPanel } = require('../../core/ui');
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
  transfer: 'basvuru-devir', // basvuru-devir:<başvuru>:<iste|evet:<isteyen>|hayir:<isteyen>>
  statusDetail: 'basvuru-durum-detay', // basvuru-durum-detay:<başvuru id>
  statusPage: 'basvuru-durum-sayfa', // basvuru-durum-sayfa:<sayfa>:<buton yeri>
};

// Durum kartının başlığı, açıklaması ve sayfa boyutu; kartı çizen (card.js) ile metinli yedeği aynı bilgileri kullanır
const STATUS_TITLE = 'Bekleyen Başvurular';
const STATUS_SUB =
  'Yetkili alım sistemindeki tüm bekleyen başvurular ve anlık durumları burada listelenir; başvuru durumu her değiştiğinde bu mesaj otomatik olarak güncellenir.';
const STATUS_PAGE_SIZE = 6;

// Başvurunun durum panelindeki hali: karttaki kısa etiket (pill), metinli yedekteki uzun satır ve renk tonu
function statusState(app) {
  if (app.onHold) return { pill: 'Beklemede', line: `Görüşme beklemede — <@${app.onHold.by}>`, tone: 'wait', staffId: app.onHold.by };
  if (app.directConnect && app.meetingBy && app.meeting?.startedAt)
    return { pill: 'Bağlandı', line: `Bağlandı — <@${app.meetingBy}>`, tone: 'busy', staffId: app.meetingBy };
  if (app.directConnect && app.meetingBy) return { pill: 'Üstlenildi', line: `Üstlenildi — <@${app.meetingBy}>`, tone: 'busy', staffId: app.meetingBy };
  if (app.meetingBy) return { pill: 'Görüşmede', line: `Görüşmede — <@${app.meetingBy}>`, tone: 'busy', staffId: app.meetingBy };
  return { pill: 'İnceleniyor', line: 'İnceleniyor', tone: 'wait' };
}

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

// Başvurunun reddedilme / oryantasyonunun iptal edilme sebebi (yoksa null); sicil listesinde gösterilir
const cancelReasonOf = (app) => (app.status === 'rejected' ? app.note : app.orientation?.status === 'cancelled' ? app.orientation.cancelReason : null) ?? null;

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
    status = app.reviewedBy
      ? `**Durum: Reddedildi**\n<@${app.reviewedBy}> başvuruyu reddetti.`
      : '**Durum: Otomatik olarak reddedildi**\nGörüşme sırasında yaşanan bir sorun yüzünden başvuru kendiliğinden reddedildi.';
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
      (app.reviewedBy ? `#${pad(app.number)} numaralı başvurunu <@${app.reviewedBy}> değerlendirdi.` : `#${pad(app.number)} numaralı başvurun **otomatik olarak** reddedildi.`) +
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

const stageName = (stage) => (stage === 'meeting' ? 'Görüşme' : 'Oryantasyon');
const stageWord = (stage) => (stage === 'meeting' ? 'görüşmene' : 'oryantasyonuna');
const jump = (guildId, channelId) =>
  new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Kanala Katıl').setURL(channelUrl(guildId, channelId)));

// Başvuran bir görüşme kanalına girince başvuruyla ilgilenen yetkiliye giden DM (görüşme ya da oryantasyon için)
function applicantWaitingDm(app, guildName, channelId, orientation, reminder) {
  const stage = orientation ? 'oryantasyon' : 'görüşme';
  return withFooter(
    card(
      reminder ? 'Başvuran Hatırlatıyor' : 'Başvuran Seni Bekliyor',
      reminder
        ? `Başvuran hâlâ ${stage} için kanalda bekliyor ve **Hatırlat** butonuyla sana haber verdi. **Kanala Katıl** butonuyla hemen bağlanabilirsin.`
        : `Başvuran ${stage} için kanala girdi ve senin bağlanmanı bekliyor. **Kanala Katıl** butonuyla hemen bağlanabilirsin; ayrıntılar başvurular kanalında.`,
      [
        fields([field('Başvuru', `#${pad(app.number)}`), field('Başvuran', `<@${app.userId}>`), field('Aşama', orientation ? 'Oryantasyon' : 'Görüşme'), field('Kanal', `<#${channelId}>`)]),
        `**<@${app.userId}>, ${stage} için <#${channelId}> kanalında${reminder ? ' hâlâ' : ''} seni bekliyor.**`,
      ],
      'primary',
    )
      .addSeparatorComponents(divider())
      .addActionRowComponents(jump(app.guildId, channelId)),
    `-# ${guildName} - <t:${unix(Date.now())}:F>`,
  );
}

// Görüşme başlayınca (ikisi aynı görüşme kanalına girince) kanalın sohbetine atılan karar paneli: görüşmeye çağıran yetkili
// başvurunun devam edip etmeyeceğine buradan karar verir. state: open | rejected | hold (beklemeye alındı) | resumed (başka yetkili üstlendi)
function decisionPanel(app, state = 'open', remindDisabled) {
  const head = `**Başvuru #${pad(app.number)}**`;
  if (state === 'rejected') {
    const auto = !app.reviewedBy;
    return card(
      'Başvuru Reddedildi',
      auto
        ? 'Görüşme sırasında yaşanan bir sorun yüzünden başvuru otomatik olarak reddedildi ve sebep başvurana DM ile iletildi. Görüşme kanalları kilitlenir; kayıt başvurular kanalında ve sicilde kalır.'
        : 'Görüşmenin ardından başvuru reddedildi ve sebep başvurana DM ile iletildi. Görüşme kanalları başvurana kilitlenir; kayıt başvurular kanalında kalır.',
      [auto ? `${head}\n**<@${app.userId}> kullanıcısının başvurusu otomatik olarak reddedildi.**\n${quote(app.note)}` : `${head}\n<@${app.reviewedBy}>, <@${app.userId}> kullanıcısının başvurusunu reddetti.`],
      'danger',
    );
  }
  if (state === 'resumed') {
    return card(
      'Görüşme Üstlenildi',
      'Beklemedeki görüşmeyi bir yetkili üstlendi ve başvuranı yeniden görüşmeye çağırdı. Yetkili bu kanala bağlandığında görüşme başlar ve karar paneli yeniden gelir.',
      [`${head}\n**<@${app.meetingBy}> görüşmeyi üstlendi.**`],
      'success',
    );
  }
  if (state === 'hold') {
    const h = app.onHold;
    const protectedNow = h.until > Date.now();
    return card(
      'Görüşme Beklemede',
      'Görüşmeyi yürüten yetkili işlemi beklemeye aldı. Başvuran, bir yetkili görüşmeyi üstlenip kanala bağlanana kadar bekler; üstlenen yetkili başvuruyla ilgilenmek zorundadır.',
      [
        fields([field('Başvuru', `#${pad(app.number)}`), field('Başvuran', `<@${app.userId}>`), field('Beklemeye alan', `<@${h.by}>`), field('Durum', 'Yetkili bekleniyor')]),
        protectedNow
          ? `**<@${h.by}> <t:${unix(h.until)}:R> kadar işlemi geri alabilir.**\nBu süre dolunca başvurular kanalında yetkililere haber verilir ve herhangi bir yetkili üstlenebilir.`
          : '**Yetkili bekleniyor.**\nBaşvurular kanalında yetkililere haber verildi; bir yetkili üstlenince görüşme yeniden başlar.',
      ],
      'warning',
    )
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${IDS.remind}:${app.id}`).setStyle(ButtonStyle.Secondary).setLabel('Hatırlat').setDisabled(Boolean(remindDisabled)),
        ),
      );
  }
  const reviewId = (action) => `${IDS.review}:${app.id}:${action}`;
  const m = app.meeting;
  const blocks = [
    `${head}\n<@${app.meetingBy}> ile <@${app.userId}> görüşüyor.\nKararı sadece **görüşmeye çağıran yetkili** (ya da yöneticiler) verebilir.`,
  ];
  if (m?.staffAwaySince) {
    blocks.push(
      `**Yetkili kanaldan ayrıldı.**\n<@${app.meetingBy}> <t:${unix(m.staffAwaySince + config.meetingStaffGraceMinutes * 60000)}:R> kadar dönmezse görüşme beklemeye alınır ve **başka bir yetkiliye aktarılacaksınız.**`,
    );
  }
  if (m?.applicantAwaySince) {
    blocks.push(
      `**Başvuran kanaldan ayrıldı.**\n<@${app.userId}> (ayrılma ${m.applicantLeaves}/${config.meetingMaxApplicantLeaves}) <t:${unix(m.applicantAwaySince + config.meetingApplicantGraceMinutes * 60000)}:R> kadar dönmezse başvuru otomatik olarak reddedilir.`,
    );
  }
  return card(
    'Görüşme Kararı',
    'Görüşme bitince başvuranın uygun olup olmadığına karar ver: **Devam Et** ile başvuru oryantasyon aşamasına geçer, **İptal Et** ile başvuru reddedilir; bir sorun çıkarsa **Beklemeye Al** ile başka yetkiliye bırakabilirsin.',
    blocks,
    m?.staffAwaySince || m?.applicantAwaySince ? 'warning' : 'primary',
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

// Başvurular kanalına giden "görüşme beklemede" bildirimi.
// state: protected (beklemeye alan yetkinin geri alma süresi sürüyor, kimse etiketlenmez, başkaları devir isteyebilir) |
// open (süre doldu ya da yetkili ayrıldı: herkes üstlenebilir, inceleyen rol etiketlenir) | remind (başvuran hatırlattı) |
// taken (üstlenildi) | superseded (süre dolduğu için yeni bildirim gönderildi)
function meetingHoldNotice(app, state = 'open') {
  const h = app.onHold ?? {};
  const head = `**Başvuru #${pad(app.number)}**`;
  if (state === 'taken') {
    return card(
      'Görüşme Üstlenildi',
      'Beklemedeki görüşmeyi bir yetkili üstlendi ve başvuranı yeniden görüşmeye çağırdı; başka bir işlem gerekmiyor. Bu mesaj başvurular kanalında kayıt olarak kalır.',
      [`${head}\n**<@${app.meetingBy}> görüşmeyi üstlendi.**`],
      'success',
    );
  }
  if (state === 'superseded') {
    return card('Görüşme Beklemede', 'Geri alma süresi doldu; yetkililere haber vermek için yeni bir bildirim gönderildi. Bu mesaj kayıt olarak kalır.', [`${head}\n<@${h.by}> görüşmeyi beklemeye almıştı.`], 'warning');
  }
  const roles = app.reviewerRoleId ? `<@&${app.reviewerRoleId}>, ` : '';
  const info = fields([field('Başvuru', `#${pad(app.number)}`), field('Başvuran', `<@${app.userId}>`), field('Aşama', 'Görüşme'), field('Beklemeye alan', `<@${h.by}>`)]);
  const buttons = [new ButtonBuilder().setCustomId(`${IDS.review}:${app.id}:gorusme`).setStyle(ButtonStyle.Success).setLabel('Görüşmeye Çağır')];
  let sub;
  let status;
  if (state === 'protected') {
    sub = `**<@${h.by}>** görüşmeyi beklemeye aldı ve **<t:${unix(h.until)}:R>** kadar yalnızca o geri alabilir. Başka bir yetkili **Devralma İste** ile ondan devir isteyebilir; süre dolunca herkes üstlenebilir ve yetkililere haber verilir.`;
    status = `**<@${h.by}> görüşmeyi beklemeye aldı.**\n<@${app.userId}> yetkili bekliyor, bu süre içinde yetkililer etiketlenmez.`;
    buttons.push(new ButtonBuilder().setCustomId(`${IDS.transfer}:${app.id}:iste`).setStyle(ButtonStyle.Secondary).setLabel('Devralma İste'));
  } else if (state === 'remind') {
    sub = 'Görüşmesi beklemeye alınan başvuran hâlâ kanalda bekliyor ve **Hatırlat** butonuyla haber verdi. **Görüşmeye Çağır** butonuna ilk basan yetkili görüşmeyi sürdürür.';
    status = `${roles}**<@${app.userId}> hâlâ yetkili bekliyor.**`;
  } else {
    sub = 'Beklemedeki görüşmeyi **Görüşmeye Çağır** butonuna ilk basan yetkili sürdürür ve başvuranla ilgilenmek zorundadır.';
    status = `${roles}**<@${app.userId}> görüşme için yetkili bekliyor.**\n${h.auto ? `<@${h.by}> kanaldan uzun süre ayrıldığı için görüşme otomatik olarak beklemeye alındı.` : `<@${h.by}> görüşmeyi beklemeye almıştı, geri alma süresi doldu.`}`;
  }
  buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Başvuruya Git').setURL(messageUrl(app.guildId, app.channelId, app.messageId)));
  return card(state === 'remind' ? 'Başvuran Hatırlatıyor' : 'Görüşme Beklemede', sub, [info, status], 'warning')
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
}

// Devir isteği: beklemeye alan yetkiliye DM ile gider (butonlar onay/ret). state: pending | approved | rejected | stale
function transferRequestDm(app, requesterId, stage, state = 'pending') {
  const holderId = stage === 'meeting' ? app.onHold?.by : app.orientation?.holdBy;
  const until = stage === 'meeting' ? app.onHold?.until : app.orientation?.holdUntil;
  const what = stage === 'meeting' ? 'görüşmesini' : 'oryantasyonunu';
  const whatAcc = stage === 'meeting' ? 'görüşmeyi' : 'oryantasyonu';
  const head = `**Başvuru #${pad(app.number)} - ${stageName(stage)}**`;
  if (state !== 'pending') {
    const text_ = {
      approved: [`Devir Onaylandı`, `${head}\n**<@${requesterId}> ${whatAcc} devraldı.** Artık başvuruyla o ilgileniyor.`, 'success'],
      rejected: [`Devir Reddedildi`, `${head}\n**<@${requesterId}> kullanıcısının devir isteğini reddettin.** Geri alma süren devam ediyor.`, 'danger'],
      stale: [`İstek Geçersiz`, `${head}\nBu başvuru artık beklemede değil ya da süre doldu; bu istek için bir işlem gerekmiyor.`, 'warning'],
    }[state];
    return card(text_[0], 'Devir isteğinin sonucu bu mesajda görünür; bu mesaj kayıt olarak kalır.', [text_[1]], text_[2]);
  }
  return card(
    'Devir İsteği',
    `Beklemeye aldığın başvurunun ${what} başka bir yetkili devralmak istiyor. **Onayla** dersen işlem ona geçer, **Reddet** dersen geri alma süren devam eder.`,
    [
      fields([field('Başvuru', `#${pad(app.number)}`), field('Başvuran', `<@${app.userId}>`), field('Aşama', stageName(stage)), field('İsteyen', `<@${requesterId}>`)]),
      `**<@${requesterId}> bu işlemi devralmak istiyor.**\nCevap vermezsen <t:${unix(until)}:R> süre dolunca herhangi bir yetkili işlemi zaten üstlenebilir.`,
    ],
    'warning',
  )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.transfer}:${app.id}:evet:${requesterId}`).setStyle(ButtonStyle.Success).setLabel('Onayla'),
        new ButtonBuilder().setCustomId(`${IDS.transfer}:${app.id}:hayir:${requesterId}`).setStyle(ButtonStyle.Danger).setLabel('Reddet'),
      ),
    );
}

// Devir isteği sonuçlanınca isteyen yetkiliye giden DM. state: approved | rejected
function transferResultDm(app, holderId, stage, state) {
  const until = stage === 'meeting' ? app.onHold?.until : app.orientation?.holdUntil;
  return state === 'approved'
    ? card(
        'Devir Onaylandı',
        'İstediğin işlemi beklemeye alan yetkili sana devretti. Başvuranla artık sen ilgileniyorsun; ayrıntılar başvuran ve yetkili için ayrıca gönderildi.',
        [`**Başvuru #${pad(app.number)} - ${stageName(stage)}**\n**<@${holderId}> işlemi sana devretti.**`],
        'success',
      )
    : card(
        'Devir Reddedildi',
        'Beklemeye alan yetkili isteğini reddetti. Geri alma süresi dolunca herhangi bir yetkili işlemi üstlenebilir; o zamana kadar yalnızca o geri alabilir.',
        [`**Başvuru #${pad(app.number)} - ${stageName(stage)}**\n**<@${holderId}> devir isteğini reddetti.**\n${until > Date.now() ? `<t:${unix(until)}:R> sonra işlemi üstlenebilirsin.` : 'Süre doldu, işlemi doğrudan üstlenebilirsin.'}`],
        'danger',
      );
}

// Yetkili kanala bağlanınca kanalın sohbetindeki "Yetkili Bekleniyor" mesajının yerine geçer
function waitingResolved(app, stage) {
  const staffId = stage === 'meeting' ? app.meetingBy : app.orientation?.staffId;
  return card(
    'Yetkili Bağlandı',
    `Başvuranı bekleyen yetkili kanala bağlandı ve ${stage === 'meeting' ? 'görüşme' : 'oryantasyon'} başladı. Bu mesaj kanalın sohbetinde kayıt olarak kalır.`,
    [
      fields([field('Başvuru', `#${pad(app.number)}`), field('Başvuran', `<@${app.userId}>`), field('Aşama', stageName(stage)), field('Yetkili', `<@${staffId}>`)]),
      `**<@${app.userId}>, <@${staffId}> yetkilisi ${stageWord(stage)} bağlandı.**`,
    ],
    'success',
  );
}

// Başvuran görüşme kanalına yetkiliden önce girince kanalın sohbetine giden bekleme mesajı.
// stage: meeting (görüşme) | orientation (oryantasyon yetkilisi belli) | unassigned (oryantasyonu üstlenen yok)
function waitingChat(app, stage, askStaffId, remindDisabled) {
  const staffId = stage === 'meeting' ? app.meetingBy : app.orientation?.staffId;
  const what = stage === 'meeting' ? 'görüşme' : 'oryantasyon';
  const info = fields([
    field('Başvuru', `#${pad(app.number)}`),
    field('Başvuran', `<@${app.userId}>`),
    field('Aşama', stageName(stage)),
    field('Yetkili', stage === 'unassigned' ? 'Henüz üstlenen yok' : `<@${staffId}>`),
  ]);
  const status = askStaffId
    ? `**<@${askStaffId}>, <@${app.userId}> için bekleyen bir oryantasyon işlemi var, ilgilenmek ister misin?**\nÜstlenmek için **Oryantasyonu Üstlen**, şimdilik geçmek için **Şimdi Değil** butonuna bas.`
    : stage === 'unassigned'
      ? `**<@${app.userId}> oryantasyon için bir yetkilinin üstlenmesini bekliyor.**\nBaşvurular kanalında yetkililere haber verildi.`
      : `**<@${app.userId}> ${what} için <@${staffId}> yetkilisinin bağlanmasını bekliyor.**\nYetkili bağlandığında ${what} kendiliğinden başlar.`;
  const container = card(
    askStaffId ? 'Bekleyen Oryantasyon' : 'Yetkili Bekleniyor',
    askStaffId
      ? 'Oryantasyonu bekleyen başvuran kanalda ve henüz kimse üstlenmedi. **Oryantasyonu Üstlen** ile başvuranla ilgilenebilir, **Şimdi Değil** ile mesajı eski haline döndürebilirsin; mesaj kanalda kalır.'
      : `${stage === 'meeting' ? 'Görüşme' : 'Oryantasyon'} için kanalda bekliyorsun; yetkili bağlanınca başlanır. Uzun sürerse **Hatırlat** butonuyla yetkililere haber verebilirsin.`,
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
  const toWhat = stage === 'meeting' ? 'görüşmeye' : 'oryantasyona';
  return card(
    reminder ? 'Başvuran Hatırlatıyor' : 'Başvuran Bekliyor',
    reminder
      ? 'Başvuran hâlâ kanalda bekliyor ve **Hatırlat** butonuyla yetkiliye haber verdi. **Kanala Katıl** butonuyla hemen bağlanabilirsin.'
      : `Başvuran ${stage === 'meeting' ? 'görüşme' : 'oryantasyon'} için kanala girdi ve yetkiliyi bekliyor. **Kanala Katıl** butonuyla hemen bağlanabilirsin.`,
    [
      fields([
        field('Başvuru', `#${pad(app.number)}`),
        field('Başvuran', `<@${app.userId}>`),
        field('Aşama', stageName(stage)),
        field('Yetkili', `<@${staffId}>`),
        field('Kanal', `<#${channelId}>`),
      ]),
      `**<@${app.userId}>, <#${channelId}> kanalında <@${staffId}> yetkilisinin ${toWhat} bağlanmasını${reminder ? ' hâlâ' : ''} bekliyor.**`,
    ],
    'warning',
  )
    .addSeparatorComponents(divider())
    .addActionRowComponents(jump(app.guildId, channelId));
}

// Görüşmeye çağıran yetkili başvurandan önce bir görüşme kanalına girince başvurana giden DM
function meetingStaffWaitingDm(app, guildName, channelId) {
  return withFooter(
    card(
      'Yetkilin Seni Bekliyor',
      'Görüşmeye çağıran yetkili görüşme kanalına girdi ve seni bekliyor. **Kanala Katıl** butonuyla hemen bağlanabilirsin; kanal senin için açık ve görüşme ikiniz de kanaldayken kendiliğinden başlar.',
      [
        fields([field('Başvuru', `#${pad(app.number)}`), field('Aşama', 'Görüşme'), field('Yetkili', `<@${app.meetingBy}>`), field('Kanal', `<#${channelId}>`)]),
        `**<@${app.meetingBy}> yetkilisi görüşmen için <#${channelId}> kanalında seni bekliyor.**`,
      ],
      'primary',
    )
      .addSeparatorComponents(divider())
      .addActionRowComponents(jump(app.guildId, channelId)),
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

// Başvuranın "Bir yetkili bağlanıyor" DM'i: direkten bağlan (Bağlan butonu) akışında gönderilir
function connectingDm(app, guildName) {
  return page({
    title: `Başvuru #${pad(app.number)} — Birazdan Bağlanıyoruz`,
    sub: `${guildName} sunucusuna yaptığın yetkili başvurusuyla ilgili bir yetkili ses kanalına katılmak üzere; hazır ol ve kanalda kal.`,
    blocks: [`<@${app.userId}>, birazdan bir yetkili bulunduğun ses kanalına **bağlanacak.** Kanalda kal ve hazır ol.`],
  });
}

// Durum panelinin görünecek sayfası: kartı çizenle mesajı kuranın aynı dilimi kullanması için tek yerde
function statusPage(apps, page = 0) {
  const pageCount = Math.max(1, Math.ceil(apps.length / STATUS_PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  return { current, pageCount, shown: apps.slice(current * STATUS_PAGE_SIZE, (current + 1) * STATUS_PAGE_SIZE) };
}

// Durum kanalındaki canlı panel: bekleyen tüm başvuruları tek mesajda listeler; durum değiştikçe düzenlenir.
// cardName: çizim kartı ekteyse başlık/açıklama ve başvuru satırları kartta olduğu için mesajda tekrar yazılmaz;
// kartın altında menüden başvuru seçmeye ve sayfa gezmeye yarayan kontroller kalır
function statusPanel(apps, page = 0, cardName = null) {
  const now = Math.floor(Date.now() / 1000);
  const { current, pageCount, shown } = statusPage(apps, page);
  const nav = (target, slot) => `${IDS.statusPage}:${target}:${slot}`;

  const container = new ContainerBuilder();
  if (cardName) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${cardName}`)));
    container.addTextDisplayComponents(text(`-# Son güncelleme: <t:${now}:R>`));
  } else {
    container.addTextDisplayComponents(text(`## ${STATUS_TITLE}\n${STATUS_SUB}`));
    for (const app of shown) {
      container.addSeparatorComponents(divider()).addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text(`**#${pad(app.number)}** · <@${app.userId}> · ${statusState(app).line}`))
          .setButtonAccessory(new ButtonBuilder().setCustomId(`${IDS.statusDetail}:${app.id}`).setLabel('Detay').setStyle(ButtonStyle.Secondary)),
      );
    }
    if (!shown.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text('Şu an incelenmeyi bekleyen başvuru yok.'));
    container.addTextDisplayComponents(text(`-# ${pageInfo(current, pageCount, apps.length)}\n-# Son güncelleme: <t:${now}:R>`));
  }

  // Menü ve sayfa butonları her zaman görünür; tek sayfada butonlar pasif kalır
  if (shown.length) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.statusDetail}:menu`)
          .setPlaceholder('Ayrıntısını görmek istediğin başvuruyu seç')
          .addOptions(
            shown.map((app) =>
              new StringSelectMenuOptionBuilder()
                .setValue(app.id)
                .setLabel(`#${pad(app.number)}`)
                .setDescription(shorten(`${app.username} · ${statusState(app).line.replace(/<@\d+>/g, 'yetkili')}`, 100)),
            ),
          ),
      ),
    );
  }
  container.addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));
  return container;
}

module.exports = { IDS, STATUS, STATUS_TITLE, STATUS_SUB, STATUS_PAGE_SIZE, statusPage, statusState, statusLabel, cancelReasonOf, statusPanel, connectingDm, transferRequestDm, transferResultDm, meetingHoldNotice, waitingResolved, applicantWaitingDm, meetingStaffWaitingDm, decisionPanel, waitingChat, waitingLog, meetingLog, panel, applicationModal, applicationNotice, reviewModal, resultDm, meetingDm };
