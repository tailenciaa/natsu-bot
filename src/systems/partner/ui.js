// Partner sisteminin mesajları: talep kanalındaki oto partner teklifi, şartlar DM'i, yetkili kanalındaki karar
// kartı, paylaşım kanalındaki standart partner kartı, güvenilir partner listesi ve partner yenileme akışı.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { text, divider, colors, unix, quote, shorten, alert, field, fields, rows, chip, pills, stamp, pageInfo, pagerRow, withActions } = require('../../core/ui');
const config = require('./config');

const IDS = {
  start: 'partner:baslat', // partner:baslat:<mesajı yazan kullanıcı>
  startBan: 'partner:baslat-yasakla', // partner:baslat-yasakla:<sunucu ID ya da davet-kod>
  startBanModal: 'partner:baslat-yasakla-form', // partner:baslat-yasakla-form:<sunucu ID ya da davet-kod>
  banReason: 'partner-yasaklama-sebebi',
  modal: 'partner:form',
  adText: 'partner-metin',
  contactId: 'partner-yetkili-id',
  termsAccept: 'partner-sartlar-kabul', // partner-sartlar-kabul:<talep>
  review: 'partner-karar', // partner-karar:<talep>:<onayla|reddet>
  preview: 'partner-onizle', // partner-onizle:<talep>
  trustedAdd: 'partner-guven-ekle', // partner-guven-ekle:<talep>
  ban: 'partner-yasakla', // partner-yasakla:<talep>
  unban: 'partner-yasak-kaldir', // partner-yasak-kaldir:<talep>
  trustedPage: 'partner-guven-sayfa', // partner-guven-sayfa:<sayfa>:<buton yeri>
  trustedPanelPage: 'partner-guven-panel-sayfa', // partner-guven-panel-sayfa:<sayfa>:<buton yeri>
  deletePost: 'partner-sil', // partner-sil:<talep>
  cancel: 'partner-iptal', // partner-iptal:<talep>
  trustedSelect: 'partner-guven-sec',
  trustedAction: 'partner-guven-y', // partner-guven-y:<kayıt>:<teklif|kaldir>
  contactAdd: 'partner-yetkili-ekle', // partner-yetkili-ekle:<kayıt>
  contactAddModal: 'partner-yetkili-ekle-form', // partner-yetkili-ekle-form:<kayıt>
  contactRemove: 'partner-yetkili-cikar', // partner-yetkili-cikar:<kayıt>
  // Partner yenileme akışı: teklif, güvenilir kaydın karşı sunucu yetkilisine gider; o kişi kendi
  // metnini onaylar (istersen günceller), gerekirse önce şartları kabul eder ve metin otomatik paylaşılır
  renewalAssign: 'partner-yenile-ata', // partner-yenile-ata:<kayıt>
  renewalAssignedAccept: 'partner-yenile-kabul', // partner-yenile-kabul:<kayıt>
  renewalApprove: 'partner-yenile-onayla', // partner-yenile-onayla:<kayıt>
  renewalEdit: 'partner-yenile-duzenle', // partner-yenile-duzenle:<kayıt>
  renewalEditModal: 'partner-yenile-duzenle-form', // partner-yenile-duzenle-form:<kayıt>
  renewalEditInput: 'partner-yenile-metin',
  renewalCancel: 'partner-yenile-iptal', // partner-yenile-iptal:<kayıt>
  renewalCancelModal: 'partner-yenile-iptal-form', // partner-yenile-iptal-form:<kayıt>
  renewalCancelInput: 'partner-yenile-sebep',
  renewalTermsAccept: 'partner-yenile-sartlar-kabul', // partner-yenile-sartlar-kabul:<kayıt>
  // Karşı sunucunun partner yetkililerine DM ile giden Partner Paneli: müsaitlik durumu ve kendi tarafından teklif
  panelStatus: 'partner-panel-durum', // partner-panel-durum:<kayıt>
  panelOffer: 'partner-panel-teklif', // partner-panel-teklif:<kayıt>
  panelOfferModal: 'partner-panel-teklif-form', // partner-panel-teklif-form:<kayıt>
};

// Partner yetkilisi "meşgul" derse yetkililerimiz bu süre boyunca teklif göndermez; süre dolunca otomatik müsait sayılır
const BUSY_DAYS = 7;
const isBusy = (entry) => entry.contactStatus === 'mesgul' && Date.now() - (entry.contactStatusAt ?? 0) < BUSY_DAYS * 24 * 60 * 60 * 1000;

// @everyone / @here hiçbir zaman gerçek bir bildirim göndermesin diye metinden temizlenir (kanal izniyle birlikte
// çift güvence; bot zaten her mesajı mention'ları kapalı gönderir)
const sanitize = (value) => String(value).replace(/@everyone/gi, '@​everyone').replace(/@here/gi, '@​here');

// Yetkili rolünü etiketleyen kartlarda (inceleme kartı) partner metnindeki rol/üye etiketleri de etkisizleştirilir,
// yoksa metindeki bir etiket kartı her gönderişte ayrıca bildirim yollardı
const inert = (value) => sanitize(value).replace(/<@([!&]?)(\d+)>/g, '<@​$1$2>');

// Partner metnindeki Discord davet bağlantısı: kartın "Sunucuya Katıl" düğmesi buradan üretilir. Yalnızca Discord'un
// kendi davet alanları alınır; üçüncü kişi kısaltma servisleri bağlantının nereye gittiği bilinmediği için düğmeye
// taşınmaz, ilanın metni içinde okunur kalır.
const INVITE_RE = /(?<host>discord\.gg|discord(?:app)?\.com\/invite)\/(?<code>[\w-]+)/i;
const inviteUrl = (value) => {
  const found = String(value ?? '').match(INVITE_RE);
  // Alan adı küçültülür (metinde büyük yazılmış olabilir), kod olduğu gibi kalır
  return found ? `https://${found.groups.host.toLowerCase()}/${found.groups.code}` : null;
};
// Kartta gösterilen davet: https:// başı düşürülür, üye gördüğü satırı kopyaladığında da aynı bağlantıya gider
const inviteLabel = (url) => url.slice('https://'.length);

// Standart başlık: büyük başlık ve iki satıra yayılan uzun normal yazılı açıklama (bütün mesajlar aynı genişlikte görünsün)
const head = (title, sub) => text(`## ${title}\n${sub}`);

// Kopyalanıp kendi sunucusunda paylaşılacak metinler kod bloğuna konur; bloğun içindeki üçlü tırnak
// sırasına küçük bir boşluk karakteri eklenir, yoksa bloğun tamamı bozulur
const copyBlock = (value) => '```\n' + String(value ?? '').replace(/```/g, '`\u200b``') + '\n```';

const serverLabel = (entry) => entry.serverId ?? 'bilinmiyor';
const serverTitle = (entry) => (entry.serverName ? shorten(inert(entry.serverName), 60) : `Sunucu ${serverLabel(entry)}`);
const contactsText = (entry) => (entry.contactIds?.length ? entry.contactIds.map((id) => `<@${id}>`).join(', ') : 'Bilinmiyor');

// Yasak/eşleşme anahtarı: davetten sunucu ID'si çözülemediyse davet kodu (davet-<kod>) yerine geçer
const inviteKey = (value) => {
  const code = inviteUrl(value)?.split('/').pop();
  return code ? `davet-${code}` : null;
};
const serverKey = (entry) => entry.serverId ?? inviteKey(entry.text ?? entry.content);
const serverKeyLabel = (key) => (key?.startsWith('davet-') ? `discord.gg/${key.slice('davet-'.length)}` : key ?? 'bilinmiyor');
// Talep kartlarındaki sunucu satırları: ad (davetten), ID (çözülebildiyse)
const serverRows = (request) => [
  ['Sunucu', request.serverName ? shorten(inert(request.serverName), 60) : 'Adı çözülemedi'],
  ['Sunucu ID', chip(request.serverId ?? 'davetten çözülemedi')],
];
// Yetkili olmayanların gördüğü sunucu satırı: ad çözüldüyse ad, yoksa davet kodu ya da ID.
// Ham sunucu ID'si sadece yetkili kartlarında (serverRows) gösterilir.
const serverLine = (record) => (record.serverName ? shorten(inert(record.serverName), 60) : chip(serverKeyLabel(serverKey(record))));

// Talep kanalında "partner" / "dm" geçen ya da rol etiketlenen mesaja yanıt olarak gider
function startPrompt(authorId) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Partner Olmak mı İstiyorsun?',
        'Sunucunla bizimle karşılıklı partner olmak istiyorsan **Oto Partner Yap** butonuyla oto partner talebi oluşturabilirsin. Yetkili onaylayınca metnin otomatik paylaşılır.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '### Oto Partner Nasıl Çalışır?\n' +
          "**Partner metnini** gönderirsin; sunucun metindeki davetten otomatik tanınır.\n" +
          'Yetkili onaylayınca metnin **otomatik paylaşılır**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('İstersen butona basmadan bir **yetkilinin seninle ilgilenmesini** de bekleyebilirsin.'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.start}:${authorId}`).setLabel('Oto Partner Yap').setStyle(ButtonStyle.Primary),
      ),
    );
}

// Form gönderildikten sonra talep mesajının aldığı hal; alreadyAccepted: şartlar daha önce kabul edilmişse DM yönlendirmesi yok
function startPromptSuccess(alreadyAccepted = false) {
  return new ContainerBuilder()
    .setAccentColor(colors.success)
    .addTextDisplayComponents(
      head(
        'Partner Talebin Gönderildi',
        alreadyAccepted
          ? 'Şartları daha önce kabul ettiğin için talebin doğrudan **yetkili incelemesine gönderildi**. Sonucu DM kutundan öğreneceksin.'
          : "Talebin kaydedildi. Yetkililere iletilebilmesi için **partner şartlarını kabul etmen gerekiyor**; şartlar DM kutuna gönderildi, DM'lerin kapalıysa önce açmalısın.",
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        alreadyAccepted
          ? '### Sıradaki Adım\nYetkililerin **kararını bekle**.'
          : '### Sıradaki Adım\nSana gelen DM\'deki **Şartları Kabul Et** butonuna bas.',
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('disabled').setLabel('Gönderildi').setStyle(ButtonStyle.Success).setDisabled(true),
      ),
    );
}

// Oto partner formu; messageId: form gönderilince güncellenecek talep mesajı
function requestModalWithMessageId(messageId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.modal}:yeni:${messageId}`)
    .setTitle('Oto Partner')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setDescription('Paylaşım kanalına bu haliyle gider; sunucun metindeki davet bağlantısından tanınır.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.adText)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Anime ve sohbet sunucumuza bekleriz! discord.gg/davet')
            .setMinLength(20)
            .setMaxLength(1500)
            .setRequired(true),
        ),
    );
}

// Şartları kabul ettiren genel DM: hem ilk oto partner talebinde (talep sahibine) hem partner yenileme akışında
// (karşı tarafa, daha önce hiç kabul etmediyse) kullanılır; acceptCustomId tıklanınca neyin olacağını belirler
function termsDm(acceptCustomId) {
  return new ContainerBuilder()
    .setAccentColor(colors.warning)
    .addTextDisplayComponents(
      head(
        'Partner Şartları',
        'Partnerliğin düzenli ve karşılıklı yürüyebilmesi için **şartları okuyup kabul etmen gerekiyor**. Kabul etmeden **partner metnin paylaşılmayacak**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '### Şartlar\n' +
          '1. Reklam metni **Discord kurallarına** aykırı içerik barındıramaz.\n' +
          '2. Sunucular karşılıklı olarak **aynı gün içinde** birbirini paylaşır.\n' +
          '3. Onaylanan reklam metni **değiştirilemez**; değişiklik için yeni talep açılması gerekir.\n' +
          '4. Kurallara uymayan partnerlikler yetkililerce **tek taraflı sonlandırılabilir**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('Devam edersen bu şartları **kabul etmiş sayılırsın**.'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(acceptCustomId).setLabel('Şartları Kabul Et').setStyle(ButtonStyle.Success),
      ),
    );
}

// Yetkili kanalına giden onay/red kartı. decided: { sonuc, by, banned } varsa butonlar yerine sonucu gösterir.
// Kartın içindeki metin davet önizlemesini göstermez; "Önizle" ilanı paylaşılacağı düz mesaj haliyle gizli gönderir
function reviewCard(request, decided) {
  const url = inviteUrl(request.text);
  const container = new ContainerBuilder()
    .setAccentColor(decided ? (decided.sonuc === 'onayla' ? colors.success : colors.danger) : colors.warning)
    .addTextDisplayComponents(
      head(
        `Oto Partner Talebi #${request.number}`,
        decided
          ? 'Bu talep **bir yetkili tarafından değerlendirildi**. Talebin ayrıntıları ve verilen karar kayıt olarak burada kalır, **başka bir işlem yapmana gerek yok**.'
          : 'Bir üye oto partner talebi gönderdi. **Önizle** ile ilanı paylaşılacağı haliyle görüp **Onayla** ya da **Reddet** ile karar verebilirsin; troll bir talepse **Yasaklıya Al**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Talep Bilgileri',
          rows([
            ['Gönderen', `<@${request.requesterId}>`],
            ...serverRows(request),
          ]),
          decided ? null : `<@&${config.roles.staff}>, **yeni bir partner talebi** var.`,
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`### Partner Metni\n${quote(shorten(inert(request.text), 1500))}`));

  const previewRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${IDS.preview}:${request.id}`).setLabel('Önizle').setStyle(ButtonStyle.Primary),
  );
  if (url) previewRow.addComponents(new ButtonBuilder().setURL(url).setLabel('Sunucuya Katıl').setStyle(ButtonStyle.Link));
  container.addActionRowComponents(previewRow);

  if (decided) {
    const verdict =
      decided.sonuc === 'onayla'
        ? `<@${decided.by}> talebi **onayladı**; metin paylaşım kanalına gönderildi.`
        : decided.banned
          ? `<@${decided.by}> talebi **reddetti** ve sunucuyu **yasaklı listesine** aldı.`
          : `<@${decided.by}> talebi **reddetti**.`;
    return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`### Karar\n${verdict}`));
  }

  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.review}:${request.id}:onayla`).setLabel('Onayla').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${IDS.review}:${request.id}:reddet`).setLabel('Reddet').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${IDS.startBan}:${serverKey(request)}`).setLabel('Yasaklıya Al').setStyle(ButtonStyle.Danger),
      ),
    );
}

// İlanın kendisi DÜZ mesaj olarak paylaşılır: Discord, davet bağlantısının ve eklerin önizlemesini yalnızca düz
// mesajda gösteriyor. Kartın içine girince bağlantı sıradan metne dönüp kayboluyordu, üye ilanı göremiyordu.
function postContent(request) {
  // Düz mesajın üst sınırı 2000 karakter; uzun ilan burada kırpılır, kayıttaki metin tam kalır
  return shorten(sanitize(request.text), 1990);
}

// Paylaşım kanalındaki ikinci mesaj: kaydın kısa özeti, partner sayıları ve yetkilinin işlemleri; ilanın kendisi
// ayrı düz mesajdadır. trusted: güvenilir listedeki kayıt (null: değil), banned: gönderen yasaklı mı,
// stats: store.partnerStats()
function postCard(request, trusted, banned, stats = {}) {
  const url = inviteUrl(request.text);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        // Başlık 28 karakteri geçmez; adı çözülemeyen (davetsiz/süresi dolmuş) kayıtta numara kalır
        request.serverName ? shorten(inert(request.serverName), 28) : `Partner Kaydı #${request.number}`,
        url
          ? 'Sunucunun ilanı bu kartla birlikte paylaşıldı; ilanı okuyup **Sunucuya Katıl** ile sunucuya girebilirsin.'
          : 'Sunucunun ilanı bu kartla birlikte paylaşıldı; sunucuya nasıl gireceğin **ilanın metninde** yazıyor.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        rows([
          ['Sunucu ID', chip(request.serverId ?? 'belirtilmedi')],
          ['Paylaşan', `<@${request.requesterId}> · <t:${unix(request.decidedAt ?? request.createdAt)}:R>`],
          ['Güvenilir Liste', chip(trusted ? 'Listede' : 'Listede değil')],
          [
            'Partner Sayısı',
            pills([
              ['Bugün', stats.gun?.onay ?? 0],
              ['Hafta', stats.hafta?.onay ?? 0],
              ['Ay', stats.ay?.onay ?? 0],
              ['Toplam', stats.toplam ?? 0],
            ]),
          ],
        ]),
      ),
    )
    .addSeparatorComponents(divider());

  // Üstte normal işlemler (güvenilir listeye alma ve davet bağlantısı), çizginin altında geri alınamayanlar
  // (iptal, yasaklama, silme). İptal ve yasak sadece lider, sil kaydı yapan ve lider içindir (yetki index.js'de denetlenir)
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`${IDS.trustedAdd}:${request.id}`)
      .setLabel(trusted ? 'Güvenilir Listede' : 'Güvenilir Listeye Al')
      .setStyle(trusted ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(Boolean(trusted) || Boolean(banned)),
  ];
  if (banned) buttons.push(new ButtonBuilder().setCustomId(`${IDS.unban}:${request.id}`).setLabel('Yasağı Kaldır').setStyle(ButtonStyle.Success));
  if (url) buttons.push(new ButtonBuilder().setURL(url).setLabel('Sunucuya Katıl').setStyle(ButtonStyle.Link));
  buttons.push(
    new ButtonBuilder().setCustomId(`${IDS.cancel}:${request.id}`).setLabel('Partneri İptal Et').setStyle(ButtonStyle.Danger),
    ...(banned ? [] : [new ButtonBuilder().setCustomId(`${IDS.ban}:${request.id}`).setLabel('Yasaklıya Al').setStyle(ButtonStyle.Danger)]),
    new ButtonBuilder().setCustomId(`${IDS.deletePost}:${request.id}`).setLabel('Partneri Sil').setStyle(ButtonStyle.Danger),
  );

  return withActions(container, buttons, { danger: true });
}

// Talep sahibinin onay/red sonucu DM'i. Onayda tek buton vardır: metninin paylaşıldığı ilana gider.
// sharedUrl paylaşım başarısızsa null gelir; o zaman buton gösterilmez, mesaj yine de bilgilendirir.
function requesterResult(sonuc, request, by, sharedUrl = null) {
  const container = new ContainerBuilder()
    .setAccentColor(sonuc === 'onayla' ? colors.success : colors.danger)
    .addTextDisplayComponents(
      head(
        sonuc === 'onayla' ? 'Partner Talebin Onaylandı' : 'Partner Talebin Reddedildi',
        sonuc === 'onayla'
          ? 'Oto partner talebin yetkililer tarafından incelendi ve **onaylandı**. Partner metnin paylaşım kanalımıza **paylaşıldı**, partnerlik başladı.\nMetninin paylaşıldığı mesaja bu karttaki butondan ulaşabilirsin; bizim sunucumuzu tanıtan metin ise bir sonraki mesajda kopyalaman için geliyor.'
          : 'Oto partner talebin yetkililer tarafından incelendi ve **reddedildi**. Talebin paylaşım kanalına gönderilmedi; ayrıntılar için yetkililerle iletişime geçebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Talep Bilgileri',
          rows([
            ['Talep', chip(`#${request.number}`)],
            ['Sunucu', serverLine(request)],
            ['Değerlendiren', `<@${by}>`],
          ]),
        ]),
      ),
    );

  if (sonuc === 'onayla' && sharedUrl) {
    container
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(sharedUrl).setLabel('Paylaşılan Mesaj').setStyle(ButtonStyle.Link)),
      );
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(stamp()));
}

// Bir yasaklama ya da teklif iptali gibi yetkili kanalına düşen kayıt (başlık, bilgi satırları ve sebep)
function noticeCard(title, sub, infoLines, reason) {
  const container = new ContainerBuilder().setAccentColor(colors.danger).addTextDisplayComponents(head(title, sub));
  if (infoLines.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(fields(infoLines)));
  if (reason) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`### Sebep\n${quote(reason)}`));
  return container;
}

// Yasaklı partnerler kanalına giden kayıt
const serverBannedLog = (key, reason, by) =>
  noticeCard(
    'Sunucu Yasaklandı',
    'Bu sunucu **partner sisteminden yasaklandı**. Yasak kaldırılana kadar bu sunucuyla **partner yapılamaz** ve gelen talepler otomatik engellenir.',
    ['### Yasak Bilgileri', rows([['Sunucu', chip(serverKeyLabel(key))], ['Yasaklayan', `<@${by}>`]])],
    reason,
  );

// Yasaklı sunucunun talep sahibine giden DM
const serverBannedDm = (reason) =>
  noticeCard(
    'Sunucun Yasaklı',
    'Sunucun partner sisteminden yasaklandığı için **talebin kabul edilmedi**. Yasak kaldırılana kadar bizimle partner olamazsın.',
    [],
    reason,
  );

// Partnerliği sona eren sunucunun kayıtlı yetkililerine giden DM. kind: 'iptal' (partnerlik biter) | 'yasak'
// (sunucu ya da yetkili partner sisteminden yasaklanır). removed: paylaşım kanalından silinen mesaj sayısı.
const partnerRevokedDm = (serverId, { kind, by, removed, reason = null }) =>
  noticeCard(
    kind === 'yasak' ? 'Sunucun Yasaklandı' : 'Partnerliğin İptal Edildi',
    kind === 'yasak'
      ? 'Sunucun partner sisteminden **yasaklandı**, paylaşım kanalındaki tüm ilanların kaldırıldı. Yasak kaldırılana kadar bizimle yeniden partner olamazsın.'
      : 'Partnerliğimiz **iptal edildi**, paylaşım kanalındaki tüm ilanların kaldırıldı ve sunucun güvenilir partner listesinden çıkarıldı. İsterseniz yeni bir taleple tekrar başvurabilirsiniz.',
    [
      '### İşlem Bilgileri',
      rows([
        ['Sunucu ID', chip(serverId ?? 'belirtilmedi')],
        ['İşlemi yapan', `<@${by}>`],
        ['Kaldırılan paylaşım', chip(`${removed} mesaj`)],
      ]),
    ],
    reason,
  );

// Karşı sunucunun yetkilisi teklifi reddedince inceleme kanalına düşen kayıt
const renewalCancelledLog = (entry, staffId, reason) =>
  noticeCard(
    'Teklif Reddedildi',
    'Partner yenileme teklifi **karşı sunucunun partner yetkilisi** tarafından reddedildi. Partner kaydı aynen duruyor, istenirse yeni bir teklif başlatılabilir.',
    ['### Teklif Bilgileri', rows([['Sunucu', serverTitle(entry)], ['Reddeden', `<@${staffId}>`]])],
    reason,
  );

// /guvenilir-partnerler listesi
const TRUSTED_PAGE_SIZE = 25; // seçim menüsü en fazla 25 seçenek alır

function trustedList(entries, page = 0) {
  if (!entries.length) return alert('Güvenilir listeye eklenmiş bir partner yok.');

  const pageCount = Math.ceil(entries.length / TRUSTED_PAGE_SIZE);
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const shown = entries.slice(current * TRUSTED_PAGE_SIZE, (current + 1) * TRUSTED_PAGE_SIZE);
  const nav = (target, slot) => `${IDS.trustedPage}:${target}:${slot}`;

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Güvenilir Partnerler',
        '**Sürekli partner olduğumuz güvenilir sunucuların listesi.** Menüden bir sunucu seçerek ekleme tarihini, partner yetkililerini, metnini, **davet bağlantısını** ve yapabileceğin işlemleri görebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(fields(['### Liste Durumu', field('Toplam', chip(`${entries.length} sunucu`)), `-# Sayfa ${current + 1} / ${pageCount}`])),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.trustedSelect}:0`)
          .setPlaceholder('Partner seç')
          .addOptions(
            shown
              .map((e) =>
                new StringSelectMenuOptionBuilder()
                  .setValue(e.id)
                  .setLabel(shorten(e.serverName ?? (e.serverId ? `Sunucu ${e.serverId}` : `Kayıt #${e.id.split('-').pop()}`), 100))
                  .setDescription(shorten(e.content.replace(/\s+/g, ' '), 100)),
              ),
          ),
      ),
    );
  // Sayfa butonları her zaman görünür; tek sayfada pasif kalır
  container.addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));
  return container;
}

// Güvenilir listeye alırken karşı sunucunun partner yetkilileri her zaman seçtirilir; menü yalnızca bizim
// sunucumuzdaki üyeleri listeler. defaultIds: oto talepte formu dolduran kişi hazır seçili gelir
function trustedAddModal(requestId, messageId, defaultIds = []) {
  const select = new UserSelectMenuBuilder().setCustomId(IDS.contactId).setMinValues(1).setMaxValues(10).setRequired(true);
  if (defaultIds.length) select.setDefaultUsers(defaultIds);
  return new ModalBuilder()
    .setCustomId(`${IDS.modal}:guven:${requestId}:${messageId}`)
    .setTitle('Güvenilir Listeye Al')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Karşı Sunucunun Partner Yetkilileri')
        .setDescription('Sunucumuzda olan ve o sunucunun partner işlerine bakan kişileri seç (en çok 10).')
        .setUserSelectMenuComponent(select),
    );
}

// Bir güvenilir kaydın işlem düğmeleri: üstte normal işlemler (Partner Yenile, yetkili düzenleme, davet bağlantısı),
// çizginin altında geri alınamayanlar (Yetkili Çıkar, Listeden Çıkar). Listeden Çıkar sadece partner lideri,
// diğerleri partner yetkilileri içindir (yetki kontrolü index.js'de yapılır)
function trustedActionButtons(entry, url = null) {
  const hasContacts = Boolean(entry.contactIds?.length);
  const buttons = [];
  if (hasContacts) {
    buttons.push(new ButtonBuilder().setCustomId(`${IDS.trustedAction}:${entry.id}:teklif`).setLabel('Partner Yenile').setStyle(ButtonStyle.Primary));
  }
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`${IDS.contactAdd}:${entry.id}`)
      .setLabel(hasContacts ? 'Yetkiliyi Güncelle' : 'Yetkili Ekle')
      .setStyle(ButtonStyle.Secondary),
  );
  if (url) buttons.push(new ButtonBuilder().setURL(url).setLabel('Sunucuya Katıl').setStyle(ButtonStyle.Link));
  if (hasContacts) {
    buttons.push(new ButtonBuilder().setCustomId(`${IDS.contactRemove}:${entry.id}`).setLabel('Yetkili Çıkar').setStyle(ButtonStyle.Danger));
  }
  buttons.push(new ButtonBuilder().setCustomId(`${IDS.trustedAction}:${entry.id}:kaldir`).setLabel('Listeden Çıkar').setStyle(ButtonStyle.Danger));
  return buttons;
}

// Panel mesajı en çok 10 bileşen taşıyabilir: her kayıt iki düğme satırı (normal işlemler + kırmızılar) tuttuğu
// için sayfada 2 kayıt durur
const PANEL_PAGE_SIZE = 2;

// cardName: çizim kartı ekteyse başlık/açıklama/sayfa bilgisi kartta olduğu için mesajda tekrar yazılmaz;
// kayıt satırlarının yerini kart alır, yetkili ve ekleyen etiketleri (görsele basılamadığı için) kısa metin olarak kalır
function trustedListPanel(entries, page = 0, cardName = null) {
  const container = new ContainerBuilder();
  if (cardName) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${cardName}`)),
    );
  } else {
    container.addTextDisplayComponents(
      head(
        'Güvenilir Partnerler',
        'Bu kanalda sürekli partner olduğumuz sunucular ve o sunucuların partner yetkilileri listelenir. Liste her ekleme ya da çıkarmada **bu mesaj düzenlenerek güncel tutulur**.',
      ),
    );
  }

  if (!entries.length) {
    // Boş durum kartın içinde yazıldığı için mesajda tekrarlanmaz
    if (cardName) return container;
    return container.addSeparatorComponents(divider()).addTextDisplayComponents(text('**Henüz güvenilir listeye eklenmiş bir partner yok.**'));
  }

  const pageCount = Math.ceil(entries.length / PANEL_PAGE_SIZE);
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const shown = entries.slice(current * PANEL_PAGE_SIZE, (current + 1) * PANEL_PAGE_SIZE);
  const nav = (target, slot) => `${IDS.trustedPanelPage}:${target}:${slot}`;

  for (const entry of shown) {
    // Her kayıt iki düğme satırı tuttuğu için sayfada 2 kayıt durur; mesaj 10 bileşeni aşamaz. Kart çizilemediğinde
    // çizgiler düşürülüp bilgiler tek sıkışık satıra iner (kartlı hali kuşaklar, bu yedek panel)
    if (cardName) container.addSeparatorComponents(divider());
    if (cardName) {
      container.addTextDisplayComponents(text(`**Partner Yetkilisi:** ${contactsText(entry)} · **Ekleyen:** <@${entry.addedBy}>`));
    } else {
      container.addTextDisplayComponents(
        text(
          `**${serverTitle(entry)}** · Yetkili: ${contactsText(entry)} · Ekleyen <@${entry.addedBy}> · <t:${unix(entry.addedAt)}:D>`,
        ),
      );
    }
    withActions(container, trustedActionButtons(entry), { danger: true });
  }

  // Sayfa bilgisi kartta gömülüyse metni yazılmaz. Sayfa butonları her zaman görünür; tek sayfada pasif kalır
  if (!cardName) container.addTextDisplayComponents(text(`-# ${pageInfo(current, pageCount, entries.length)}`));
  container.addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));

  return container;
}

// Seçilen güvenilir partnerin detayı; sadece yetkiliye görünür
function trustedDetail(entry) {
  const url = inviteUrl(entry.content);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        serverTitle(entry),
        'Seçtiğin güvenilir partner sunucusunun kayıt bilgileri ve paylaşılan tanıtım metni burada yer alıyor. Yetkiliysen butonlarla **bu kayıt üzerinde işlem yapabilirsin**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Kayıt Bilgileri',
          field('Eklenme', `<t:${unix(entry.addedAt)}:F>`),
          field('Ekleyen', `<@${entry.addedBy}>`),
          field('Partner Yetkilisi', contactsText(entry)),
          field('Partner Durumu', chip(isBusy(entry) ? 'Meşgul' : 'Müsait')),
          url ? field('Davet', chip(inviteLabel(url))) : null,
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`### Partner Metni\n${quote(shorten(sanitize(entry.content), 1500))}`));

  return withActions(container.addSeparatorComponents(divider()), trustedActionButtons(entry, url), { danger: true });
}

// Güvenilir kayda partner yetkilisi(leri) ekler ya da günceller; mevcut yetkililer menüde hazır seçili gelir
function contactModal(trustedId, currentIds) {
  const select = new UserSelectMenuBuilder().setCustomId(IDS.contactId).setMinValues(1).setMaxValues(10).setRequired(true);
  if (currentIds?.length) select.setDefaultUsers(currentIds.slice(0, 10));
  return new ModalBuilder()
    .setCustomId(`${IDS.contactAddModal}:${trustedId}`)
    .setTitle('Partner Yetkilisi')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Karşı Sunucunun Partner Yetkilileri')
        .setDescription('Sunucumuzda olan ve o sunucunun partner işlerine bakan kişileri seç (en çok 10).')
        .setUserSelectMenuComponent(select),
    );
}

// Partner Yenile'ye basınca: teklifin hangi **karşı sunucu yetkilisine** gideceğini seçtiren menü (sadece basana görünür)
function contactSelect(trustedId, members) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Teklifin Gideceği Yetkili',
        'Teklif, bu partner sunucusunun **kayıtlı partner yetkilisine** gider; kabul edince kendi metnini görüp onaylar. Kayıtta birden fazla yetkili varsa muhatabı seç.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Yetkili Seçimi',
          'Seçtiğin kişiye DM olarak teklif kartı açılır. Kayıtlı yetkilileri **Yetkiliyi Güncelle** ile değiştirebilirsin.',
          members.length > 25 ? 'Menüde **ilk 25 yetkili** listelenir.' : null,
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.renewalAssign}:${trustedId}`)
          .setPlaceholder('Partner yetkilisi seç')
          .addOptions(
            members
              .slice(0, 25)
              .map((m) =>
                new StringSelectMenuOptionBuilder()
                  .setValue(m.id)
                  .setLabel(m.displayName ?? m.user.username)
                  .setDescription('Karşı sunucunun partner yetkilisi'),
              ),
          ),
      ),
    );
}

// Karşı sunucunun partner yetkilisine giden, teklifi kabul edip etmeyeceğini soran ilk DM.
// startedBy: teklifi başlatan bizim yetkilimiz, ourServerName: metnin yayınlanacağı bizim sunucumuzun adı
function assignedOfferDm(entry, startedBy, ourServerName = null) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Partner Yenileme Teklifi',
        'Bir yetkilimiz, kayıtlı partner metnini **bizim sunucumuzda yeniden paylaşmak** için sana teklifte bulunuyor. Kabul edersen metnini görüp onaylayabilir, istersen güncelleyebilir ya da teklifi reddedebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Teklif Bilgileri',
          field('Teklif Eden Yetkili', startedBy ? `<@${startedBy}>` : 'Bilinmiyor'),
          field('Metnin Yayınlanacağı Sunucu', ourServerName ?? 'Sunucumuz'),
          field('Senin Sunucun', serverTitle(entry)),
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.renewalAssignedAccept}:${entry.id}`).setLabel('Kabul Ediyorum').setStyle(ButtonStyle.Success),
      ),
    );
}

// Karşı yetkili "Kabul Ediyorum" deyince aynı DM mesajı bu haline güncellenir. Kart karşı tarafın kendi
// sunucusundan değil **bizim taraftan** söz eder: metnin hangi sunucumuzda ve hangi yetkilimizin isteğiyle
// yayımlanacağı yazar; kendi metni ve daveti "onaylayacağı şey" olarak etiketlenir.
// Sunucusuna giden davet bağlantısı buton yapılmaz: adam zaten kendi sunucusundadır, buton anlamsız olurdu.
function renewalReviewDm(entry, { serverName = null, startedBy = null } = {}) {
  const url = inviteUrl(entry.content);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Partnerlik Yenileme Onayı',
        'Metnin, **onay verirsen** bizim paylaşım kanalımızda yeniden yayımlanacak. Olduğu gibi onaylayabilir, istersen güncelleyebilir ya da bir sebep belirterek reddedebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Paylaşım Bilgisi',
          field('Metnin Yayınlanacağı Sunucu', serverName ?? 'Sunucumuz'),
          field('Teklif Eden Yetkili', startedBy ? `<@${startedBy}>` : 'Bilinmiyor'),
          field('Senin Sunucun', serverTitle(entry)),
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`### Onaylayacağın Metin\n${quote(shorten(sanitize(entry.content), 1500))}`));

  if (url) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          fields([
            '### Metindeki Davet',
            field('Bağlantı', chip(inviteLabel(url))),
            'Onayladığında bu bağlantı bizim kanalımızda da görünür olur. Davetin adresi değiştiyse onaylamadan önce **Metni Güncelle** ile yenisini yapıştır.',
          ]),
        ),
      );
  }

  const buttons = [
    new ButtonBuilder().setCustomId(`${IDS.renewalApprove}:${entry.id}`).setLabel('Onayla').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${IDS.renewalEdit}:${entry.id}`).setLabel('Metni Güncelle').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${IDS.renewalCancel}:${entry.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger),
  ];
  return withActions(container.addSeparatorComponents(divider()), buttons, { danger: true });
}

function renewalEditModal(entry) {
  // Kayıtlı metin formun alt sınırından (20) kısaysa (ör. elle paylaşılan kısa metin) form hiç açılmazdı; alt sınır buna göre ayarlanır
  const current = shorten(entry.content, 2800);
  return new ModalBuilder()
    .setCustomId(`${IDS.renewalEditModal}:${entry.id}`)
    .setTitle('Partner Metnini Güncelle')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setDescription('Metinde sunucunun Discord davet bağlantısı bulunmalı.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.renewalEditInput)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(current)
            .setMinLength(Math.min(20, current.length))
            .setMaxLength(2800)
            .setRequired(true),
        ),
    );
}

function renewalCancelModal(trustedId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.renewalCancelModal}:${trustedId}`)
    .setTitle('Teklifi Reddet')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Neden reddediyorsun?')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.renewalCancelInput)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Sunucunun metni güncel değil.')
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Onaydan sonra karşı sunucunun partner yetkilisine giden ikinci mesaj: bizim sunucumuzu tanıtan metin.
// Metin kod bloğunda verilir ki olduğu gibi kopyalanıp karşı tarafın kendi sunucusunda paylaşılabilsin.
// sharedUrl biliniyorsa tek buton eklenir: karşı tarafın metninin paylaşıldığı mesaja gider.
function ourTextDm(entry, sharedUrl = null) {
  const kimlik = entry?.serverName ? `**${shorten(inert(entry.serverName), 60)}** sunucunun` : 'Sunucunun';
  const container = new ContainerBuilder().setAccentColor(colors.success).addTextDisplayComponents(
    head(
      'Bizim Partner Metnimiz',
      `${kimlik} partner metni paylaşım kanalımızda yayında. Bu mesajdaki metin bizim sunucumuzu tanıtan partner ilanımız; **kopyalayıp kendi sunucunun partner kanalında** paylaşabilirsin.`,
    ),
  );

  container.addSeparatorComponents(divider()).addTextDisplayComponents(
    text(`### Bizim Sunucumuz\n${copyBlock(config.ourAdText)}`),
  );

  if (sharedUrl) {
    container.addSeparatorComponents(divider()).addActionRowComponents(
      new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(sharedUrl).setLabel('Paylaşılan Mesaj').setStyle(ButtonStyle.Link)),
    );
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(stamp()));
}

function banServerModal(serverId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.startBanModal}:${serverId}`)
    .setTitle('Sunucuyu Yasakla')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Neden yasaklıyorsun?')
        .setDescription('Sebep yasaklı sunucuya bildirilir ve kayıtlara işlenir.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.banReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Troll talep, sunucu kurallarımıza aykırı.')
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Güvenilir listeye alınan partnerin yetkililerine DM'den giden panel; sadece o sunucunun yetkilileri kullanabilir
function partnerPanel(entry, guildName) {
  const busy = isBusy(entry);
  const option = (value, label, description) =>
    new StringSelectMenuOptionBuilder().setValue(value).setLabel(label).setDescription(description).setDefault(busy === (value === 'mesgul'));
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        `${guildName} Partner Paneli`,
        'Sunucun artık **güvenilir partnerlerimiz arasında**. Bu panelden müsaitlik durumunu belirleyebilir ve istediğin zaman bizimle yeni bir partnerlik teklifinde bulunabilirsin; panel sadece sunucunun partner yetkililerine özeldir.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '### Partner Bilgileri',
          field('Sunucu', serverTitle(entry)),
          field('Partnerlik', `<t:${unix(entry.addedAt)}:D>`),
          field('Durum', chip(busy ? 'Meşgul' : 'Müsait')),
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '### Neler Yapabilirsin?\n' +
          `**Meşgul** seçersen yetkililerimiz **${BUSY_DAYS} gün** boyunca sana teklif göndermez.\n` +
          'Yeni partner metnini **Teklif Gönder** butonuyla iletebilirsin; yetkilimiz onaylayınca **otomatik paylaşılır**.',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.panelStatus}:${entry.id}`)
          .setPlaceholder('Müsaitlik seç')
          .addOptions(
            option('aktif', 'Müsaitim', 'Yetkililer sana teklif gönderebilir'),
            option('mesgul', 'Meşgulüm', `${BUSY_DAYS} gün boyunca teklif gönderilmez`),
          ),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.panelOffer}:${entry.id}`).setLabel('Teklif Gönder').setStyle(ButtonStyle.Primary),
      ),
    );
}

// Partner Paneli'ndeki "Teklif Gönder" formu: sunucu ID kayıttan bilindiği için sadece metin istenir
function panelOfferModal(trustedId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.panelOfferModal}:${trustedId}`)
    .setTitle('Partnerlik Teklifi')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setDescription('Onaylanınca bu haliyle paylaşılır; metnindeki davet bağlantısı butona dönüşür.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.adText)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Anime ve sohbet sunucumuza bekleriz! discord.gg/davet')
            .setMinLength(20)
            .setMaxLength(1500)
            .setRequired(true),
        ),
    );
}

module.exports = {
  IDS,
  isBusy,
  inviteUrl,
  inviteKey,
  serverKey,
  serverKeyLabel,
  PANEL_PAGE_SIZE,
  partnerPanel,
  panelOfferModal,
  sanitize,
  startPrompt,
  startPromptSuccess,
  requestModalWithMessageId,
  termsDm,
  reviewCard,
  postContent,
  postCard,
  requesterResult,
  serverBannedLog,
  serverBannedDm,
  partnerRevokedDm,
  renewalCancelledLog,
  trustedAddModal,
  contactModal,
  trustedList,
  trustedListPanel,
  trustedDetail,
  contactSelect,
  assignedOfferDm,
  renewalReviewDm,
  renewalEditModal,
  renewalCancelModal,
  ourTextDm,
  banServerModal,
};
