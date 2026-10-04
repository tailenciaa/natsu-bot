// Partner sisteminin mesajları: talep kanalındaki oto partner teklifi, şartlar DM'i, yetkili kanalındaki karar
// kartı, paylaşım kanalındaki standart partner kartı, güvenilir partner listesi ve teklifte bulunma (yenileme) akışı.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { text, divider, colors, unix, quote, shorten, notice } = require('../../core/ui');
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
};

// @everyone / @here hiçbir zaman gerçek bir bildirim göndermesin diye metinden temizlenir (kanal izniyle birlikte
// çift güvence; bot zaten her mesajı mention'ları kapalı gönderir)
const sanitize = (value) => value.replace(/@everyone/gi, '@​everyone').replace(/@here/gi, '@​here');

// Standart başlık: büyük başlık ve iki satıra yayılan uzun gri açıklama (bütün mesajlar aynı genişlikte görünsün)
const head = (title, sub) => text(`## ${title}\n-# ${sub}`);

// Talep kanalında "partner" / "dm" geçen ya da rol etiketlenen mesaja yanıt olarak gider
function startPromptBase(button) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        'Partner Olmak mı İstiyorsun?',
        'Sunucunla bizimle karşılıklı partner olmak istiyorsan aşağıdaki butondan oto partner talebi oluşturabilir, yetkili onayından sonra metninin otomatik paylaşılmasını sağlayabilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '**Oto Partner Nasıl Çalışır?**\n' +
          '- Sunucu ID\'ni ve partner metnini gönderirsin.\n' +
          '- Yetkili onaylayınca metnin otomatik paylaşılır.\n' +
          '-# İstersen butona basmadan bir yetkilinin seninle ilgilenmesini de bekleyebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(button));
}

function startPrompt(authorId) {
  return startPromptBase(new ButtonBuilder().setCustomId(`${IDS.start}:${authorId}`).setLabel('Oto Partner Yap').setStyle(ButtonStyle.Success));
}

// Buton tıklandıktan sonra: buton devre dışı, loading state
function startPromptDisabled() {
  return startPromptBase(new ButtonBuilder().setCustomId('disabled').setLabel('Gönderiliyor...').setStyle(ButtonStyle.Secondary).setDisabled(true));
}

// Form gönderildikten sonra: success state
function startPromptSuccess() {
  return new ContainerBuilder()
    .setAccentColor(colors.success)
    .addTextDisplayComponents(
      head(
        'Partner Talebin Gönderildi',
        'Partner talebin yetkililere iletildi; devam edebilmek için sana gönderilen şartlar mesajını DM kutunda açıp şartları kabul etmen gerekiyor, DM\'lerin kapalıysa önce açmalısın.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('**Sıradaki Adım**\n- Şartlarını kabul etmek için DM\'ini kontrol et.'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('disabled').setLabel('Gönderildi').setStyle(ButtonStyle.Success).setDisabled(true),
      ),
    );
}

function requestModal() {
  return new ModalBuilder()
    .setCustomId(`${IDS.modal}:yeni`)
    .setTitle('Oto Partner')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Sunucu ID')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId(IDS.serverId).setStyle(TextInputStyle.Short).setPlaceholder('Sunucunun ID\'si').setMaxLength(32).setRequired(true),
        ),
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setDescription('Sunucunun reklam/partner metni, paylaşım kanalına bu haliyle gidecek.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.adText)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Sunucunuzu tanıtan metni buraya yaz...')
            .setMinLength(20)
            .setMaxLength(1500)
            .setRequired(true),
        ),
    );
}

function requestModalWithMessageId(messageId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.modal}:yeni:${messageId}`)
    .setTitle('Oto Partner')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Sunucu ID')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId(IDS.serverId).setStyle(TextInputStyle.Short).setPlaceholder('Sunucunun ID\'si').setMaxLength(32).setRequired(true),
        ),
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setDescription('Sunucunun reklam/partner metni, paylaşım kanalına bu haliyle gidecek.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.adText)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Sunucunuzu tanıtan metni buraya yaz...')
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
        'Partnerliğin düzenli ve karşılıklı olarak yürüyebilmesi için aşağıdaki şartların hepsini okuyup kabul etmen gerekiyor; kabul etmeden partner metnin paylaşılmayacak.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '**Şartlar**\n' +
          '1. Reklam metni Discord kurallarına aykırı içerik barındıramaz.\n' +
          '2. Sunucular karşılıklı olarak aynı gün içinde birbirini paylaşır.\n' +
          '3. Onaylanan reklam metni değiştirilemez, değişiklik için yeni talep açılması gerekir.\n' +
          '4. Kurallara uymayan partnerlikler yetkililerce tek taraflı sonlandırılabilir.\n' +
          '-# Devam edersen bu şartları kabul etmiş sayılırsın.',
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(acceptCustomId).setLabel('Şartları Kabul Ediyorum').setStyle(ButtonStyle.Success),
      ),
    );
}

// Yetkili kanalına giden onay/red kartı. decided: { sonuc, by } varsa butonlar yerine sonucu gösterir
function reviewCard(request, decided) {
  const container = new ContainerBuilder()
    .setAccentColor(decided ? (decided.sonuc === 'onayla' ? colors.success : colors.danger) : colors.warning)
    .addTextDisplayComponents(
      head(
        `Oto Partner Talebi #${request.number}`,
        decided
          ? 'Bu oto partner talebi bir yetkili tarafından değerlendirildi; talebin ayrıntıları ve verilen karar aşağıda kayıt olarak durmaya devam ediyor, işlem yapmana gerek yok.'
          : 'Bir üye oto partner talebi gönderdi; sunucu bilgilerini ve partner metnini inceleyip aşağıdaki butonlarla talebi onaylayabilir, reddedebilir ya da sunucuyu yasaklı listesine alabilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(`**Talep Bilgileri**\n- **Gönderen:** <@${request.requesterId}>\n- **Sunucu ID:** \`${request.serverId}\`${decided ? '' : `\n-# <@&${config.roles.staff}>, yeni bir partner talebi var.`}`),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Partner Metni**\n${quote(shorten(request.text, 1000))}`));

  if (decided) {
    return container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          '**Karar**\n' +
            (decided.sonuc === 'onayla'
              ? `✅ <@${decided.by}> onayladı, paylaşım kanalına gönderildi.`
              : `❌ <@${decided.by}> reddetti.`),
        ),
      );
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
// ayrı satırlarda
function postCard(request, trusted, banned) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        `Partner・\`${request.serverId ?? 'bilinmiyor'}\``,
        'Aşağıda partner olduğumuz sunucunun tanıtım metni yer alıyor; ilgini çekerse sunucuya katılabilirsin. Yetkililer bu karttaki butonlarla partneri güvenilir listeye alabilir veya yönetebilir.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Tanıtım Metni**\n${sanitize(request.text)}\n-# @everyone ve @here bu kanalda bildirim göndermez.`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Paylaşım**\n- **Paylaşan:** <@${request.requesterId}>\n- **Tarih:** <t:${unix(request.decidedAt ?? request.createdAt)}:f>`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.trustedAdd}:${request.id}`)
          .setLabel(trusted ? '✅ Güvenilir Listede' : 'Güvenilir Partnerler Listesine Al')
          .setStyle(trusted ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(Boolean(trusted) || Boolean(banned)),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.ban}:${request.id}`)
          .setLabel(banned ? '🚫 Yasaklandı' : 'Yasaklıya Al')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(Boolean(banned)),
        new ButtonBuilder().setCustomId(`${IDS.deletePost}:${request.id}`).setLabel('Partneri Sil').setStyle(ButtonStyle.Danger),
      ),
    );
}

const requesterResult = (sonuc, hint) =>
  new ContainerBuilder()
    .setAccentColor(sonuc === 'onayla' ? colors.success : colors.danger)
    .addTextDisplayComponents(
      head(
        sonuc === 'onayla' ? 'Partner Talebin Onaylandı' : 'Partner Talebin Reddedildi',
        sonuc === 'onayla'
          ? 'Gönderdiğin oto partner talebi yetkililer tarafından incelendi ve olumlu sonuçlandı; sunucunun tanıtım metni ilgili paylaşım kanalına gönderilerek partnerlik başlatıldı.'
          : 'Gönderdiğin oto partner talebi yetkililer tarafından incelendi ve olumsuz sonuçlandı; talebin paylaşım kanalına gönderilmedi, ayrıntılar için yetkililerle iletişime geçebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        sonuc === 'onayla'
          ? '**Sonuç**\n- ✅ Partner talebin onaylandı, metnin paylaşım kanalına gönderildi!'
          : `**Sonuç**\n- ❌ Partner talebin reddedildi.${hint ? `\n-# ${hint}` : ''}`,
      ),
    );

// /guvenilir-partnerler listesi
function trustedList(entries) {
  if (!entries.length) return notice('Henüz güvenilir listeye eklenmiş bir partner yok.', 'warning');

  const container = new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        'Güvenilir Partnerler',
        'Sürekli partner olduğumuz güvenilir sunucuların listesi; aşağıdaki menüden bir sunucu seçerek ekleme tarihini, partner yetkililerini, metnini ve yapabileceğin işlemleri görebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Liste Durumu**\n- **Toplam:** ${entries.length} sunucu\n-# Detay ve işlemler için aşağıdan bir partner seç.`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.trustedSelect}:0`)
          .setPlaceholder('Bir partner seç')
          .addOptions(
            entries
              .slice(0, 25)
              .map((e) =>
                new StringSelectMenuOptionBuilder()
                  .setValue(e.id)
                  .setLabel(e.serverId ? `Sunucu ${e.serverId}` : `Kayıt #${e.id.split('-').pop()}`)
                  .setDescription(shorten(e.content.replace(/\s+/g, ' '), 100)),
              ),
          ),
      ),
    );
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
        .setDescription('Bizim değil, karşı sunucununki. Birden fazlaysa virgül ya da yeni satırla ayır.')
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

// Bir güvenilir kaydın işlem butonları: Teklifte Bulun (eylem) ve yönetim butonları (Listeden Çıkar, Yetkili
// işlemleri) ayrı satırlarda. Teklifte Bulun sadece yetkili varsa anlamlı; Listeden Çıkar sadece partner lideri,
// diğerleri partner yetkilileri içindir (yetki kontrolü index.js'de yapılır)
function trustedActionRow(entry) {
  const hasContacts = Boolean(entry.contactIds?.length);
  const rows = [];

  if (hasContacts) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.trustedAction}:${entry.id}:teklif`).setLabel('Teklifte Bulun').setStyle(ButtonStyle.Primary),
      ),
    );
  }

  // Yönetim butonları: Listeden Çıkar, Yetkili Ekle/Güncelle
  const managementRow = new ActionRowBuilder();
  managementRow.addComponents(
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

// Güvenilir partnerler kanalındaki sürekli güncel panel: liste değiştikçe (ekleme/çıkarma) aynı mesaj düzenlenir.
// Discord mesaj başına en fazla 5 satır (action row) desteklediği için hızlı işlem butonları ilk 5 kayıtla sınırlı;
// fazlası için /guvenilir-partnerler komutundaki seçim menüsü kullanılır.
const QUICK_ACTION_LIMIT = 5;

function trustedListPanel(entries) {
  const container = new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        'Güvenilir Partnerler',
        'Bu kanalda sürekli partner olduğumuz sunucular ve o sunucuların partner yetkilileri listelenir; liste her ekleme veya çıkarmada bu mesaj düzenlenerek otomatik güncel tutulur.',
      ),
    );

  if (!entries.length) {
    return container.addSeparatorComponents(divider()).addTextDisplayComponents(text('**Liste Durumu**\n-# Henüz güvenilir listeye eklenmiş bir partner yok.'));
  }

  entries.forEach((entry, index) => {
    container.addSeparatorComponents(divider()).addTextDisplayComponents(
      text(
        `**Sunucu:** \`${entry.serverId ?? 'bilinmiyor'}\`\n` +
          `- **Partner Yetkilisi:** ${entry.contactIds?.length ? entry.contactIds.map((id) => `<@${id}>`).join(', ') : 'Bilinmiyor'}\n` +
          `- **Eklenme:** <t:${unix(entry.addedAt)}:D>\n` +
          `- **Ekleyen:** <@${entry.addedBy}>`,
      ),
    );

    if (index < QUICK_ACTION_LIMIT) container.addActionRowComponents(...trustedActionRow(entry));
  });

  if (entries.length > QUICK_ACTION_LIMIT) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(`-# İlk ${QUICK_ACTION_LIMIT} sunucu için hızlı işlem butonları gösterildi, diğerleri için /guvenilir-partnerler kullan.`),
      );
  }

  return container;
}

// Seçilen güvenilir partnerin detayı; sadece yetkiliye görünür
function trustedDetail(entry) {
  const container = new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        `Sunucu ${entry.serverId ?? 'bilinmiyor'}`,
        'Seçtiğin güvenilir partner sunucusunun kayıt bilgileri ve paylaşılan tanıtım metni aşağıda yer alıyor; yetkiliysen alttaki butonlarla bu kayıt üzerinde işlem yapabilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '**Kayıt Bilgileri**\n' +
          `- **Eklenme:** <t:${unix(entry.addedAt)}:F>\n` +
          `- **Ekleyen:** <@${entry.addedBy}>\n` +
          `- **İletişim:** ${entry.contactIds?.length ? entry.contactIds.map((id) => `<@${id}>`).join(', ') : 'Bilinmiyor'}`,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Partner Metni**\n${quote(shorten(entry.content, 1000))}`))
    .addSeparatorComponents(divider());

  return container.addActionRowComponents(...trustedActionRow(entry));
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

// Teklifte Bulun'a basınca: o an hangi yetkilinin bu yenilemeyle ilgileneceğini seçtiren menü (sadece basan kişiye görünür)
function staffSelect(trustedId, members, statusOf) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        'Yetkili Seç',
        'Teklifte bulunma sürecini yürütecek partner yetkilisini aşağıdaki menüden seçebilirsin; seçtiğin yetkiliye bir DM gider ve partner metnini inceleyip onaylaması ya da düzenlemesi istenir.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('**Yetkili Seçimi**\n- Bu teklifle hangi partner yetkilisi ilgilensin?'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.renewalAssign}:${trustedId}`)
          .setPlaceholder('Bir partner yetkilisi seç')
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

// Atanan yetkiliye giden, teklifi kabul edip etmeyeceğini soran ilk DM
function assignedOfferDm(entry, guildName) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        'Partner Yenileme Teklifi',
        'Bir sunucu seninle partner olmak ya da mevcut partnerliği yenilemek istiyor; teklifi kabul edersen partner metnini inceleyip onaylayabilir, düzenleyebilir veya iptal edebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '**Teklif Bilgileri**\n' +
          `- **Teklif eden sunucu:** **${guildName}**\n` +
          `- **Sizin sunucunuz:** \`${entry.serverId ?? 'bilinmiyor'}\`\n` +
          '-# Kabul edersen mevcut partner metnini inceleyip onaylayacak ya da düzenleyeceksin.',
      ),
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
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        `Sunucu \`${entry.serverId ?? 'bilinmiyor'}\``,
        'Teklifi kabul ettin; aşağıdaki partner metnini inceleyip olduğu gibi onaylayabilir, istersen metni düzenleyebilir ya da teklifi bir sebep belirterek iptal edebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Partner Metni**\n${quote(shorten(entry.content, 1000))}`))
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
  return new ModalBuilder()
    .setCustomId(`${IDS.renewalEditModal}:${entry.id}`)
    .setTitle('Partner Metnini Düzenle')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Partner Metni')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.renewalEditInput)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(shorten(entry.content, 1500))
            .setMinLength(20)
            .setMaxLength(1500)
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
        .setLabel('Sebep')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.renewalCancelInput)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('İptal sebebini yaz...')
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Teklif onaylandıktan sonra, karşı tarafın metni ve bizim sunucumuzu tanıtan metin karşı tarafa gider;
// her bölümün altında kendi paylaşılan mesajına giden buton
function ourTextDm(entry, partnerJumpUrl, ourJumpUrl) {
  const container = new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      head(
        'Partner Metinleri',
        'Teklif onaylandı; karşı sunucunun paylaşılan metni ile bizim sunucumuzu tanıtan metin aşağıda yer alıyor, ilgili butonlarla paylaşılan mesajlara doğrudan gidebilirsin.',
      ),
    );

  // Karşı tarafın metni (bizim gözüktüğümüz şekilde)
  if (entry?.serverId) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(`**Onların Sunucusu:** \`${entry.serverId}\`\n${quote(shorten(entry.content, 1000))}`));

    if (partnerJumpUrl) {
      container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setURL(partnerJumpUrl).setLabel('Onların Mesajı').setStyle(ButtonStyle.Link),
        ),
      );
    }
  }

  // Bizim metni
  container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Bizim Sunucumuz**\n${config.ourAdText}`));

  if (ourJumpUrl) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setURL(ourJumpUrl).setLabel('Bizim Mesajı').setStyle(ButtonStyle.Link),
      ),
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
        .setLabel('Yasaklama Sebebi')
        .setDescription('Bu sunucu neden yasaklanıyor?')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.banReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Yasaklama sebebini buraya yaz...')
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

module.exports = {
  IDS,
  sanitize,
  startPrompt,
  startPromptDisabled,
  startPromptSuccess,
  requestModal,
  requestModalWithMessageId,
  termsDm,
  reviewCard,
  postCard,
  requesterResult,
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
