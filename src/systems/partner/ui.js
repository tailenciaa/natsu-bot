// Partner sisteminin mesajları: talep kanalındaki oto partner teklifi, şartlar DM'i, yetkili kanalındaki karar
// kartı, paylaşım kanalındaki standart partner kartı, güvenilir partner listesi ve teklifte bulunma (yenileme) akışı.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { text, divider, colors, unix, quote, shorten, alert, field, fields, stamp, pageInfo, pagerRow } = require('../../core/ui');
const config = require('./config');

const IDS = {
  start: 'partner:baslat', // partner:baslat:<mesajı yazan kullanıcı>
  startBan: 'partner:baslat-yasakla', // partner:baslat-yasakla:<sunucu ID>
  startBanModal: 'partner:baslat-yasakla-form', // partner:baslat-yasakla-form:<sunucu ID>
  banReason: 'partner-yasaklama-sebebi',
  modal: 'partner:form',
  serverId: 'partner-sunucu-id',
  adText: 'partner-metin',
  contactId: 'partner-yetkili-id',
  termsAccept: 'partner-sartlar-kabul', // partner-sartlar-kabul:<talep>
  review: 'partner-karar', // partner-karar:<talep>:<onayla|reddet>
  trustedAdd: 'partner-guven-ekle', // partner-guven-ekle:<talep>
  ban: 'partner-yasakla', // partner-yasakla:<talep>
  unban: 'partner-yasak-kaldir', // partner-yasak-kaldir:<talep>
  trustedPage: 'partner-guven-sayfa', // partner-guven-sayfa:<sayfa>:<buton yeri>
  trustedPanelPage: 'partner-guven-panel-sayfa', // partner-guven-panel-sayfa:<sayfa>:<buton yeri>
  deletePost: 'partner-sil', // partner-sil:<talep>
  trustedSelect: 'partner-guven-sec',
  trustedAction: 'partner-guven-y', // partner-guven-y:<kayıt>:<teklif|kaldir>
  contactAdd: 'partner-yetkili-ekle', // partner-yetkili-ekle:<kayıt>
  contactAddModal: 'partner-yetkili-ekle-form', // partner-yetkili-ekle-form:<kayıt>
  contactRemove: 'partner-yetkili-cikar', // partner-yetkili-cikar:<kayıt>
  // Teklifte bulunma (yenileme) akışı: kayıt sahibine özel bir yetkili atanır, o yetkili metni inceler,
  // onaylarsa karşı tarafın gerekirse şartları kabul etmesinin ardından otomatik paylaşılır
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

// Standart başlık: büyük başlık ve iki satıra yayılan uzun normal yazılı açıklama (bütün mesajlar aynı genişlikte görünsün)
const head = (title, sub) => text(`## ${title}\n${sub}`);

const serverLabel = (entry) => entry.serverId ?? 'bilinmiyor';
const contactsText = (entry) => (entry.contactIds?.length ? entry.contactIds.map((id) => `<@${id}>`).join(', ') : 'Bilinmiyor');

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
        '**Oto Partner Nasıl Çalışır?**\n' +
          "**Sunucu ID'ni** ve **partner metnini** gönderirsin.\n" +
          'Yetkili onaylayınca metnin **otomatik paylaşılır**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('İstersen butona basmadan bir **yetkilinin seninle ilgilenmesini** de bekleyebilirsin.'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.start}:${authorId}`).setLabel('Oto Partner Yap').setStyle(ButtonStyle.Success),
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
          ? '**Sıradaki Adım**\nYetkililerin **kararını bekle**.'
          : '**Sıradaki Adım**\nDM kutundaki mesajda **Şartları Kabul Ediyorum** butonuna bas.',
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
        .setLabel('Sunucu ID')
        .setDescription('Sunucunun sayısal kimliği; sunucu ayarlarından ya da geliştirici modundan kopyalanır.')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId(IDS.serverId).setStyle(TextInputStyle.Short).setPlaceholder('Örn: 123456789012345678').setMaxLength(32).setRequired(true),
        ),
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setDescription('Sunucunun partner metni, paylaşım kanalına bu haliyle gider.')
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

// Şartları kabul ettiren genel DM: hem ilk oto partner talebinde (talep sahibine) hem teklifte bulunma akışında
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
        '**Şartlar**\n' +
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
        new ButtonBuilder().setCustomId(acceptCustomId).setLabel('Şartları Kabul Ediyorum').setStyle(ButtonStyle.Success),
      ),
    );
}

// Yetkili kanalına giden onay/red kartı. decided: { sonuc, by, banned } varsa butonlar yerine sonucu gösterir
function reviewCard(request, decided) {
  const container = new ContainerBuilder()
    .setAccentColor(decided ? (decided.sonuc === 'onayla' ? colors.success : colors.danger) : colors.warning)
    .addTextDisplayComponents(
      head(
        `Oto Partner Talebi #${request.number}`,
        decided
          ? 'Bu talep **bir yetkili tarafından değerlendirildi**. Talebin ayrıntıları ve verilen karar kayıt olarak burada kalır, **başka bir işlem yapmana gerek yok**.'
          : 'Bir üye oto partner talebi gönderdi. Sunucu bilgilerini ve partner metnini inceleyip **Onayla** ya da **Reddet** butonuyla karar verebilirsin; troll bir talepse **Yasaklıya Al** ile sunucuyu yasaklayabilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '**Talep Bilgileri**',
          field('Gönderen', `<@${request.requesterId}>`),
          field('Sunucu ID', `\`${request.serverId}\``),
          decided ? null : `<@&${config.roles.staff}>, **yeni bir partner talebi** var.`,
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Partner Metni**\n${quote(shorten(inert(request.text), 1500))}`));

  if (decided) {
    const verdict =
      decided.sonuc === 'onayla'
        ? `<@${decided.by}> talebi **onayladı**; metin paylaşım kanalına gönderildi.`
        : decided.banned
          ? `<@${decided.by}> talebi **reddetti** ve sunucuyu **yasaklı listesine** aldı.`
          : `<@${decided.by}> talebi **reddetti**.`;
    return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Karar**\n${verdict}`));
  }

  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.review}:${request.id}:onayla`).setLabel('Onayla').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${IDS.review}:${request.id}:reddet`).setLabel('Reddet').setStyle(ButtonStyle.Danger),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.startBan}:${request.serverId}`).setLabel('Yasaklıya Al').setStyle(ButtonStyle.Danger),
      ),
    );
}

// Paylaşım kanalındaki standart partner kartı. trusted: zaten güvenilir listede mi, banned: gönderen yasaklı mı
// (ikisi de buton etiketi/durumu için) — Güvenilir Listeye Al (ekleme) ve Yasaklıya Al/Partneri Sil (yönetim)
// ayrı satırlarda. request.files: elle atılan mesajın ekleri ({ name, image }), kartla birlikte gösterilir
function postCard(request, trusted, banned) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        `Partner \`${serverLabel(request)}\``,
        'Partner olduğumuz sunucunun tanıtım metni bu kartta yer alıyor; ilgini çekerse sunucuya katılabilirsin. Yetkililer karttaki butonlarla partneri **güvenilir listeye alabilir** ya da yönetebilir.',
      ),
    )
    .addSeparatorComponents(divider())
    // Bir mesajdaki toplam metin 4000 karakteri geçemez; kayıtlı metin tam kalır, kartta çok uzunsa kırpılır
    .addTextDisplayComponents(text(`**Tanıtım Metni**\n${shorten(sanitize(request.text), 2800)}`));

  const files = request.files ?? [];
  const images = files.filter((f) => f.image);
  if (images.length) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(images.slice(0, 10).map((f) => new MediaGalleryItemBuilder().setURL(`attachment://${f.name}`))),
    );
  }
  for (const f of files.filter((file) => !file.image).slice(0, 5)) {
    container.addFileComponents(new FileBuilder().setURL(`attachment://${f.name}`));
  }

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(fields(['**Paylaşım**', field('Paylaşan', `<@${request.requesterId}>`), field('Tarih', `<t:${unix(request.decidedAt ?? request.createdAt)}:f>`)])),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.trustedAdd}:${request.id}`)
          .setLabel(trusted ? 'Güvenilir Listede' : 'Güvenilir Listeye Al')
          .setStyle(trusted ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(Boolean(trusted) || Boolean(banned)),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        // Yasaklıysa aynı yerdeki buton yasağı kaldırır (sadece lider kullanabilir)
        new ButtonBuilder()
          .setCustomId(banned ? `${IDS.unban}:${request.id}` : `${IDS.ban}:${request.id}`)
          .setLabel(banned ? 'Yasağı Kaldır' : 'Yasaklıya Al')
          .setStyle(banned ? ButtonStyle.Secondary : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${IDS.deletePost}:${request.id}`).setLabel('Partneri Sil').setStyle(ButtonStyle.Danger),
      ),
    );
}

const requesterResult = (sonuc, request, by) =>
  new ContainerBuilder()
    .setAccentColor(sonuc === 'onayla' ? colors.success : colors.danger)
    .addTextDisplayComponents(
      head(
        sonuc === 'onayla' ? 'Partner Talebin Onaylandı' : 'Partner Talebin Reddedildi',
        sonuc === 'onayla'
          ? 'Oto partner talebin yetkililer tarafından incelendi ve **onaylandı**. Sunucunun tanıtım metni paylaşım kanalına gönderildi, **partnerlik başladı**.'
          : 'Oto partner talebin yetkililer tarafından incelendi ve **reddedildi**. Talebin paylaşım kanalına gönderilmedi; ayrıntılar için yetkililerle iletişime geçebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(fields(['**Talep Bilgileri**', field('Talep', `#${request.number}`), field('Sunucu ID', `\`${request.serverId}\``), field('Değerlendiren', `<@${by}>`)])),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(stamp()));

// Bir yasaklama ya da teklif iptali gibi yetkili kanalına düşen kayıt (başlık, bilgi satırları ve sebep)
function noticeCard(title, sub, infoLines, reason) {
  const container = new ContainerBuilder().setAccentColor(colors.danger).addTextDisplayComponents(head(title, sub));
  if (infoLines.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(fields(infoLines)));
  if (reason) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Sebep**\n${quote(reason)}`));
  return container;
}

// Yasaklı partnerler kanalına giden kayıt
const serverBannedLog = (serverId, reason, by) =>
  noticeCard(
    'Sunucu Yasaklandı',
    'Bu sunucu **partner sisteminden yasaklandı**. Yasak kaldırılana kadar bu sunucuyla **partner yapılamaz** ve gelen talepler otomatik engellenir.',
    ['**Yasak Bilgileri**', field('Sunucu ID', `\`${serverId}\``), field('Yasaklayan', `<@${by}>`)],
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

// Teklifte bulunma iptal edilince inceleme kanalına düşen kayıt
const renewalCancelledLog = (entry, staffId, reason) =>
  noticeCard(
    'Teklif İptal Edildi',
    'Teklifte bulunma süreci atanan yetkili tarafından **iptal edildi**. Partner kaydı aynen duruyor, istenirse yeni bir teklif başlatılabilir.',
    ['**Teklif Bilgileri**', field('Sunucu ID', `\`${serverLabel(entry)}\``), field('Yetkili', `<@${staffId}>`)],
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
        '**Sürekli partner olduğumuz güvenilir sunucuların listesi.** Menüden bir sunucu seçerek ekleme tarihini, partner yetkililerini, metnini ve yapabileceğin işlemleri görebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(fields(['**Liste Durumu**', field('Toplam', `**${entries.length}** sunucu`), `-# Sayfa ${current + 1} / ${pageCount}`])),
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
                  .setLabel(e.serverId ? `Sunucu ${e.serverId}` : `Kayıt #${e.id.split('-').pop()}`)
                  .setDescription(shorten(e.content.replace(/\s+/g, ' '), 100)),
              ),
          ),
      ),
    );
  // Sayfa butonları her zaman görünür; tek sayfada pasif kalır
  container.addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));
  return container;
}

// Elle paylaşılan bir metni güvenilir listeye alırken karşı sunucunun partner yetkilisinin ID'si bilinmez,
// oto partner akışının aksine bu formla sorulur
function trustedAddModal(requestId, messageId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.modal}:guven:${requestId}:${messageId}`)
    .setTitle('Güvenilir Listeye Al')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Karşı Sunucunun Partner Yetkilisi')
        .setDescription('Karşı sunucunun yetkilisinin kullanıcı ID\'si; birden fazlaysa virgül ya da yeni satırla ayır.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.contactId)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('123456789012345678, 234567890123456789')
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Bir güvenilir kaydın işlem butonları: Teklifte Bul (eylem) ve yönetim butonları (Listeden Çıkar, Yetkili
// işlemleri) ayrı satırlarda. Teklifte Bul sadece yetkili varsa anlamlı; Listeden Çıkar sadece partner lideri,
// diğerleri partner yetkilileri içindir (yetki kontrolü index.js'de yapılır)
function trustedActionRow(entry) {
  const hasContacts = Boolean(entry.contactIds?.length);
  const rows = [];

  if (hasContacts) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.trustedAction}:${entry.id}:teklif`).setLabel('Teklifte Bul').setStyle(ButtonStyle.Primary),
      ),
    );
  }

  // Yönetim butonları: Listeden Çıkar, Yetkili Ekle/Güncelle/Çıkar
  const managementRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${IDS.trustedAction}:${entry.id}:kaldir`).setLabel('Listeden Çıkar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${IDS.contactAdd}:${entry.id}`)
      .setLabel(hasContacts ? 'Yetkiliyi Güncelle' : 'Yetkili Ekle')
      .setStyle(ButtonStyle.Secondary),
  );
  if (hasContacts) {
    managementRow.addComponents(new ButtonBuilder().setCustomId(`${IDS.contactRemove}:${entry.id}`).setLabel('Yetkili Çıkar').setStyle(ButtonStyle.Secondary));
  }
  rows.push(managementRow);

  return rows;
}

const PANEL_PAGE_SIZE = 3;

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
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        cardName
          ? text(`**Partner Yetkilisi:** ${contactsText(entry)} · **Ekleyen:** <@${entry.addedBy}>`)
          : text(
              fields([
                field('Sunucu', `\`${serverLabel(entry)}\``),
                field('Partner Yetkilisi', contactsText(entry)),
                field('Eklenme', `<t:${unix(entry.addedAt)}:D>`),
                field('Ekleyen', `<@${entry.addedBy}>`),
              ]),
            ),
      )
      .addActionRowComponents(...trustedActionRow(entry));
  }

  // Sayfa bilgisi kartta gömülüyse metni yazılmaz. Sayfa butonları her zaman görünür; tek sayfada pasif kalır
  container.addSeparatorComponents(divider());
  if (!cardName) container.addTextDisplayComponents(text(`-# ${pageInfo(current, pageCount, entries.length)}`));
  container.addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));

  return container;
}

// Seçilen güvenilir partnerin detayı; sadece yetkiliye görünür
function trustedDetail(entry) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        `Sunucu ${serverLabel(entry)}`,
        'Seçtiğin güvenilir partner sunucusunun kayıt bilgileri ve paylaşılan tanıtım metni burada yer alıyor. Yetkiliysen butonlarla **bu kayıt üzerinde işlem yapabilirsin**.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '**Kayıt Bilgileri**',
          field('Eklenme', `<t:${unix(entry.addedAt)}:F>`),
          field('Ekleyen', `<@${entry.addedBy}>`),
          field('Partner Yetkilisi', contactsText(entry)),
          field('Partner Durumu', isBusy(entry) ? 'Meşgul' : 'Müsait'),
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Partner Metni**\n${quote(shorten(sanitize(entry.content), 1500))}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(...trustedActionRow(entry));
}

// Güvenilir kayda partner yetkilisi(leri) ekler ya da günceller; current (varsa) tüm liste düzenlenmek üzere hazır gelir
function contactModal(trustedId, currentIds) {
  return new ModalBuilder()
    .setCustomId(`${IDS.contactAddModal}:${trustedId}`)
    .setTitle('Partner Yetkilisi')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Partner Yetkilisi')
        .setDescription('Birden fazlaysa virgül ya da yeni satırla ayır.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.contactId)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(currentIds?.join(', ') ?? '')
            .setPlaceholder('123456789012345678, 234567890123456789')
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Teklifte Bul'a basınca: o an hangi yetkilinin bu yenilemeyle ilgileneceğini seçtiren menü (sadece basan kişiye görünür)
function staffSelect(trustedId, members, statusOf) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Yetkili Seç',
        'Teklifte bulunma sürecini yürütecek **partner yetkilisini seçmelisin**. Seçilen yetkiliye DM gider; partner metnini inceleyip onaylaması ya da düzenlemesi istenir.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          '**Yetkili Seçimi**',
          'Bu teklifle **hangi partner yetkilisinin** ilgileneceğini menüden seç.',
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
                  .setDescription(statusOf(m.id) === 'mesgul' ? 'Meşgul' : 'Aktif'),
              ),
          ),
      ),
    );
}

// Atanan yetkiliye giden, teklifi kabul edip etmeyeceğini soran ilk DM. startedBy: teklifi başlatan yetkili
function assignedOfferDm(entry, startedBy) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        'Partner Yenileme Teklifi',
        'Bir yetkili, güvenilir partner kaydındaki metnin yenilenmesi için **seni atadı**. Kabul edersen metni inceleyip onaylayabilir, düzenleyebilir ya da teklifi iptal edebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(fields(['**Teklif Bilgileri**', field('Partner Sunucu', `\`${serverLabel(entry)}\``), startedBy ? field('Atayan', `<@${startedBy}>`) : null])),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.renewalAssignedAccept}:${entry.id}`).setLabel('Kabul Ediyorum').setStyle(ButtonStyle.Success),
      ),
    );
}

// Atanan yetkili kabul edince aynı DM mesajı bu haline güncellenir: metni görüp onaylar, düzenler ya da iptal eder
// Onay/Düzenleme ve İptal ayrı işlemler olduğu için farklı satırlarda
function renewalReviewDm(entry) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      head(
        `Sunucu ${serverLabel(entry)}`,
        '**Teklifi kabul ettin.** Partner metnini inceleyip olduğu gibi onaylayabilir, istersen düzenleyebilir ya da bir sebep belirterek teklifi iptal edebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Partner Metni**\n${quote(shorten(sanitize(entry.content), 1500))}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.renewalApprove}:${entry.id}`).setLabel('Onayla').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${IDS.renewalEdit}:${entry.id}`).setLabel('Metni Düzenle').setStyle(ButtonStyle.Primary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.renewalCancel}:${entry.id}`).setLabel('İptal Et').setStyle(ButtonStyle.Danger),
      ),
    );
}

function renewalEditModal(entry) {
  // Kayıtlı metin formun alt sınırından (20) kısaysa (ör. elle paylaşılan kısa metin) form hiç açılmazdı; alt sınır buna göre ayarlanır
  const current = shorten(entry.content, 2800);
  return new ModalBuilder()
    .setCustomId(`${IDS.renewalEditModal}:${entry.id}`)
    .setTitle('Partner Metnini Düzenle')
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
    .setTitle('Teklifi İptal Et')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Neden iptal ediyorsun?')
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

// Teklif onaylandıktan sonra, karşı tarafın metni ve bizim sunucumuzu tanıtan metin karşı tarafa gider.
// partnerJumpUrl: karşı tarafın metninin paylaşıldığı mesaj, ourJumpUrl: bizim bağlantımız (paylaşım kanalı ya da
// mesaj). Aynı yere gidiyorlarsa tek buton gösterilir.
function ourTextDm(entry, partnerJumpUrl, ourJumpUrl) {
  const container = new ContainerBuilder().setAccentColor(colors.success).addTextDisplayComponents(
    head(
      'Partner Metinleri',
      '**Teklif onaylandı.** Karşı sunucunun paylaşılan metni ile bizim sunucumuzu tanıtan metin bu mesajda yer alıyor; butonlarla paylaşılan mesaja doğrudan gidebilirsin.',
    ),
  );

  // Karşı tarafın metni (bizim gözüktüğümüz şekilde)
  if (entry?.serverId) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(`${field('Onların Sunucusu', `\`${entry.serverId}\``)}\n${quote(shorten(sanitize(entry.content), 1500))}`));

    if (partnerJumpUrl) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(partnerJumpUrl).setLabel('Mesaja Git').setStyle(ButtonStyle.Link)),
      );
    }
  }

  // Bizim metni
  container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Bizim Sunucumuz**\n${config.ourAdText}`));


  if (ourJumpUrl && ourJumpUrl !== partnerJumpUrl) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(ourJumpUrl).setLabel('Partner Kanalına Git').setStyle(ButtonStyle.Link)),
    );
  }

  return container;
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
          '**Partner Bilgileri**',
          field('Sunucu', `\`${serverLabel(entry)}\``),
          field('Partnerlik', `<t:${unix(entry.addedAt)}:D>`),
          field('Durum', busy ? 'Meşgul' : 'Müsait'),
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '**Neler Yapabilirsin?**\n' +
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
        .setDescription('Sunucunun partner metni, onaylanınca paylaşım kanalına bu haliyle gider.')
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
  PANEL_PAGE_SIZE,
  partnerPanel,
  panelOfferModal,
  sanitize,
  startPrompt,
  startPromptSuccess,
  requestModalWithMessageId,
  termsDm,
  reviewCard,
  postCard,
  requesterResult,
  serverBannedLog,
  serverBannedDm,
  renewalCancelledLog,
  trustedAddModal,
  contactModal,
  trustedList,
  trustedListPanel,
  trustedDetail,
  staffSelect,
  assignedOfferDm,
  renewalReviewDm,
  renewalEditModal,
  renewalCancelModal,
  ourTextDm,
  banServerModal,
};
