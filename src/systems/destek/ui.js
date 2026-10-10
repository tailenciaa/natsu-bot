// Destek sisteminin mesajları: panel, talep alt başlığı, yetkili kanalı bildirimleri, loglar ve kapanış DM'i
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
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const core = require('../../core/ui');
const ratingUi = require('../degerlendirme/ui');
const config = require('./config');

const { colors, text, divider, pad, messageUrl, unix, quote, page, alert, fields, rows, chip, stamp, pageInfo, pagerRow } = core;

const IDS = {
  create: 'destek:olustur',
  modal: 'destek:modal',
  reason: 'destek:konu',
  claim: 'destek:ustlen', // yetkili kanalında, sonuna talebin ID'si eklenir
  notify: 'destek:haber-ver',
  greet: 'destek:selamla',
  close: 'destek:kapat',
  closeModal: 'destek:kapat-form',
  closeReason: 'destek:kapat-sebep',
  closeNote: 'destek:kapat-not',
  statusDetail: 'destek-durum-detay', // destek-durum-detay:<alt başlık id>
  statusPage: 'destek-durum-sayfa', // destek-durum-sayfa:<sayfa>:<buton yeri>
};

// Durum kartının başlığı ve açıklaması; kartı çizen (card.js) ve metinli yedeği kuran aynı metinleri kullanır
const STATUS_TITLE = 'Açık Destek Talepleri';
const STATUS_SUB = 'Açık destek talepleri ve anlık durumları burada listelenir.';
// Bir sayfadaki talep sayısı: kartın altındaki detay butonları bir satıra en fazla 5 sığabildiği için 5
const STATUS_PAGE_SIZE = 5;

// Talebin durum panelindeki hali: karttaki kısa etiket (pill), metinli yedekteki uzun satır ve renk tonu
function ticketState(ticket) {
  return ticket.claimedBy
    ? { pill: 'Üstlenildi', line: `<@${ticket.claimedBy}> üstlendi`, tone: 'claim' }
    : { pill: 'Bekliyor', line: 'Üstlenilmedi', tone: 'wait' };
}

// Log kanalı kapalıysa konuşma kaydı kimseye gitmez, mesajlarda bahsedilmez
const logEnabled = () => Boolean(config.channels.log);

// Kapatma sebebi bölümü: kapanış mesajında, logda ve DM'de aynı görünür
const reasonText = (closeReason) =>
  closeReason ? fields(['**Kapatma Sebebi**', closeReason.label, closeReason.note ? quote(closeReason.note) : null]) : null;

// Log satırlarındaki kişi: etiket ve (biliniyorsa) kullanıcı adı
const personText = (id, user) => `<@${id}>${user ? ` (\`${user.username}\`)` : ''}`;

function panel() {
  return core.panel({
    title: config.panel.title,
    sub: '**Talep Oluştur** butonuyla destek talebi açabilirsin. Bir sorunla karşılaştığında ya da yardıma ihtiyaç duyduğunda talebini yaz; destek ekibimiz inceleyip en kısa sürede seninle ilgilenir.',
    button: { id: IDS.create, label: config.panel.buttonLabel },
    image: config.banner,
    note: config.panel.footer,
  });
}

function ticketModal() {
  return new ModalBuilder()
    .setCustomId(IDS.modal)
    .setTitle('Destek Talebi Oluştur')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Nasıl yardımcı olabiliriz?')
        .setDescription('Sorununu ne kadar net anlatırsan o kadar hızlı çözüme ulaşırız.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.reason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Sunucuya girerken bir hata alıyorum.')
            .setMinLength(5)
            .setMaxLength(1000)
            .setRequired(true),
        ),
    );
}

// Talep alt başlığında üyenin gördüğü mesaj; talep ilerledikçe güncellenir.
// Yetkili rolü burada etiketlenmez: özel alt başlıkta etiketlenen herkes alt başlığa eklenir.
function ticketPanel(ticket) {
  let sub;
  let status;
  let color;
  if (ticket.closedBy) {
    sub = 'Bu talep sona erdi. Kimin kapattığı ve kapatma sebebi ayrı bir mesajda yer alır; konuşma bu noktadan sonra yalnızca okunabilir.';
    status = '**Talep kapatıldı.**\nAlt başlık kilitlendi ve arşivlendi.';
    color = colors.danger;
  } else if (ticket.claimedBy) {
    sub = 'Talebini üstlenen yetkili bu kanalda seninle ilgilenir. Sorununu buradan yazmaya devam edebilir, ekran görüntüsü ekleyebilirsin; işin bittiğinde **Talebi Kapat** butonuyla talebi kapatabilirsin.';
    status = `**<@${ticket.claimedBy}> talebinle ilgileniyor.**`;
    color = colors.success;
  } else {
    sub = ticket.notified
      ? 'Bir yetkili talebini üstlenene kadar sorununu ayrıntılı yazabilir, varsa ekran görüntüsü ekleyebilirsin. Yetkili gelince bu kanalda seninle ilgilenir; vazgeçersen **Talebi Kapat** butonuyla talebi kapatabilirsin.'
      : 'Bir yetkili talebini üstlenene kadar sorununu ayrıntılı yazabilir, varsa ekran görüntüsü ekleyebilirsin. Uzun süre yanıt alamazsan **Hatırlat** butonuyla ekibe haber verebilirsin.';
    status = `**Bir yetkili bekleniyor.**${ticket.notified ? '\nEkibe hatırlatma gönderildi.' : ''}`;
    color = colors.warning;
  }

  const container = page({ title: `Destek Talebi #${pad(ticket.number)}`, sub, accent: color, blocks: [status] });

  if (!ticket.closedBy) {
    const row = new ActionRowBuilder();
    if (!ticket.claimedBy) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(IDS.notify)
          .setStyle(ButtonStyle.Primary)
          .setLabel(ticket.notified ? 'Hatırlatıldı' : 'Hatırlat')
          .setDisabled(Boolean(ticket.notified)),
      );
    }
    row.addComponents(new ButtonBuilder().setCustomId(IDS.close).setStyle(ButtonStyle.Danger).setLabel('Talebi Kapat'));
    container.addActionRowComponents(row);
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(stamp(ticket.createdAt)));
}

// Talep üstlenilince alt başlığa giden mesaj: üyeyi etiketler, üye buradan yetkiliyi bir kez selamlayabilir.
// Kimin üstlendiği talep mesajında yazdığı için burada tekrar edilmez.
function claimedNotice(ticket) {
  return alert(
    `<@${ticket.ownerId}>, talebin üstlenildi.`,
    ticket.greeted
      ? 'Sorununu bu kanala yazabilirsin.'
      : 'Sorununu bu kanala yazabilirsin; yetkiliye **Selam Ver** butonuyla selam gönderebilirsin.',
    'success',
  ).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(IDS.greet)
        .setStyle(ButtonStyle.Primary)
        .setLabel(ticket.greeted ? 'Selam Verildi' : 'Selam Ver')
        .setDisabled(Boolean(ticket.greeted)),
    ),
  );
}

// Talep kapatılınca alt başlığa giden mesaj (kilit bilgisi talep mesajında olduğu için tekrar edilmez)
function ticketClosed(ticket) {
  return page({
    title: 'Talep Kapatıldı',
    sub: 'Talebin kapanış bilgisi burada yer alır: kimin kapattığı ve seçilen sebep. Başka bir konuda yardıma ihtiyacın olursa destek panelinden istediğin zaman yeni bir talep açabilirsin.',
    accent: colors.danger,
    blocks: [
      rows([
        ['Kapatan', `<@${ticket.closedBy}>`],
        logEnabled() && ['Konuşma Kaydı', chip('ekibe iletildi')],
      ]),
      reasonText(ticket.closeReason),
    ],
  });
}

// Yetkili talep kanalındaki "Yeni Destek Talebi" mesajı, butona ilk basan yetkili talebi üstlenir.
// Sicil bu mesajı butonsuz (sadece bağlantı butonlarıyla) gösterdiği için metinler butona atıf yapmaz.
function claimRequest(ticket) {
  const waiting = !ticket.claimedBy && !ticket.closedBy;

  let sub;
  let color;
  if (ticket.closedBy) {
    sub = 'Talep kapatıldı ve alt başlık kilitlendi. Kimin kapattığı ve kapanış sebebi bu mesajda güncellenir; **Talebe Git** butonuyla alt başlığa ulaşabilirsin.';
    color = colors.danger;
  } else if (ticket.claimedBy) {
    sub = 'Talep üstlenildi ve yetkili üyeyle ilgileniyor. Talebin son durumu bu mesajda güncellenir; konuşmanın tamamına **Talebe Git** butonuyla ulaşabilirsin.';
    color = colors.success;
  } else {
    sub = 'Bir üye destek talebi oluşturdu ve bir yetkili bekliyor. Talebi ilk üstlenen yetkili üyeyle ilgilenir; üyenin yazdığı konu ve talep bilgileri bu mesajda yer alır.';
    color = colors.warning;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.claim}:${ticket.threadId}`)
      .setStyle(ticket.closedBy ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setLabel(ticket.closedBy ? 'Kapatıldı' : ticket.claimedBy ? 'Üstlenildi' : 'Talebi Üstlen')
      .setDisabled(!waiting),
  );
  if (!waiting) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Talebe Git')
        .setURL(`https://discord.com/channels/${ticket.guildId}/${ticket.threadId}`),
    );
  }

  return page({
    title: `${waiting ? 'Yeni ' : ''}Destek Talebi #${pad(ticket.number)}`,
    sub,
    accent: color,
    blocks: [
      rows([
        ['Talep Sahibi', `<@${ticket.ownerId}>`],
        ['Açılış', `<t:${unix(ticket.createdAt)}:R>`],
        ticket.claimedBy && ['Üstlenen', `<@${ticket.claimedBy}>`],
        ticket.closedBy && ['Kapatan', `<@${ticket.closedBy}>`],
        ticket.closedBy && ticket.closeReason && ['Kapatma Sebebi', ticket.closeReason.label],
      ]),
      waiting ? `<@&${ticket.staffRoleId}>, bekleyen yeni bir talep var.` : null,
      `**Konu**\n${quote(ticket.reason)}`,
    ],
  }).addActionRowComponents(row);
}

// Üye "Hatırlat"a basınca yetkili kanalına giden hatırlatma: üstlenme mesajına yanıt olarak gider,
// talebin bilgileri orada olduğu için sadece yeni olanı söyler.
function claimReminder(ticket) {
  return alert(`<@&${ticket.staffRoleId}>, <@${ticket.ownerId}> hâlâ bir yetkili bekliyor.`, null, 'warning').addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Talebe Git')
        .setURL(messageUrl(ticket.guildId, ticket.claimChannelId, ticket.claimMessages.main)),
    ),
  );
}

function ticketCreated(channel) {
  return alert('Talebin açıldı.', 'Bir yetkili üstlendiğinde sana bildirim gelecek.', 'success').addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Talebe Git').setURL(channel.url)),
  );
}

// "Talebi Kapat" ile açılan form: sebep seçilir, istenirse not yazılır. Formu göndermek onay yerine geçer.
function closeModal() {
  return new ModalBuilder()
    .setCustomId(IDS.closeModal)
    .setTitle('Talebi Kapat')
    .addTextDisplayComponents(text(`Talep kilitlenip arşivlenecek${logEnabled() ? '; konuşma kaydı ekibe iletilecek' : ''}.`))
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Talep nasıl sonuçlandı?')
        .setDescription('Seçtiğin sebep kapanış mesajında görünür.')
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(IDS.closeReason)
            .setPlaceholder('Sebep seç')
            .setRequired(true)
            .addOptions(
              config.closeReasons.map((reason) =>
                new StringSelectMenuOptionBuilder().setValue(reason.value).setLabel(reason.label),
              ),
            ),
        ),
      new LabelBuilder()
        .setLabel('Eklemek istediğin bir not var mı?')
        .setDescription('İsteğe bağlı, kısa bir açıklama yazabilirsin.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.closeNote)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Rol verildi, sorun giderildi.')
            .setMaxLength(500)
            .setRequired(false),
        ),
    );
}

function openLog(ticket, channel, owner) {
  return page({
    title: `Talep Açıldı #${pad(ticket.number)}`,
    sub: 'Bir üye yeni bir destek talebi açtı. Talebi açan üye, alt başlık ve üyenin yazdığı konu bu kayıtta yer alır; talep kapanınca ayrı bir kapanış kaydı eklenir.',
    accent: colors.success,
    blocks: [
      rows([
        ['Talep', `<#${channel.id}>`],
        ['Talep Sahibi', personText(owner.id, owner)],
        ['Açılış', `<t:${unix(ticket.createdAt)}:F>`],
      ]),
      `**Konu**\n${quote(ticket.reason)}`,
    ],
  });
}

// owner: talep sahibinin kullanıcı nesnesi (alınamadıysa null, o zaman sadece etiket gösterilir)
function closeLog(ticket, closedBy, fileName, owner) {
  return page({
    title: `Talep Kapatıldı #${pad(ticket.number)}`,
    sub: 'Bir destek talebi kapatıldı. İlgili kişiler, zamanlar, konu ve kapatma sebebi bu kayıtta yer alır; konuşmanın tamamı ekteki dosyadadır.',
    accent: colors.danger,
    blocks: [
      rows([
        ['Talep', `<#${ticket.threadId}>`],
        ['Talep Sahibi', personText(ticket.ownerId, owner)],
        ['Üstlenen', ticket.claimedBy ? `<@${ticket.claimedBy}>` : chip('yok')],
        ['Kapatan', personText(closedBy.id, closedBy)],
        ['Açılış', `<t:${unix(ticket.createdAt)}:F>`],
        ['Kapanış', `<t:${unix(Date.now())}:F>`],
      ]),
      `**Konu**\n${quote(ticket.reason)}`,
      reasonText(ticket.closeReason),
    ],
  })
    .addSeparatorComponents(divider())
    .addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
}

// Talep sahibine giden kısa "talebin kapatıldı" DM'i.
// Değerlendirme sistemi bir değerlendirme oluşturduysa altına yetkiliyi puanlama bölümü eklenir; puan verilince
// değerlendirme sistemi bu DM'i aynı imzayla yeniden çizer.
function closeDm(ticketNumber, guildName, rating) {
  const container = page({
    title: 'Talebin Kapatıldı',
    sub: 'Destek ekibimizle yaptığın görüşme sona erdi. Aynı konuda ya da başka bir konuda yardıma ihtiyacın olursa destek panelinden istediğin zaman yeni bir talep açabilirsin.',
    accent: colors.danger,
    blocks: [rows([['Sunucu', guildName], ['Talep', chip(`#${pad(ticketNumber)}`)]])],
  });
  if (rating) ratingUi.ratingSection(container, rating);
  return container;
}

// Durum panelinin görünecek sayfası: kartı çizenle mesajı kuranın aynı dilimi kullanması için tek yerde
function statusPage(tickets, page = 0) {
  const pageCount = Math.max(1, Math.ceil(tickets.length / STATUS_PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  return { current, pageCount, shown: tickets.slice(current * STATUS_PAGE_SIZE, (current + 1) * STATUS_PAGE_SIZE) };
}

// Durum kanalındaki canlı panel: açık tüm talepleri tek mesajda listeler; durum değiştikçe düzenlenir.
// cardName: çizim kartı ekteyse başlık/açıklama ve talep satırları kartta olduğu için mesajda tekrar yazılmaz;
// kartın altında talep numarası butonları ve sayfa gezme kontrolleri kalır
function statusPanel(tickets, page = 0, cardName = null) {
  const now = Math.floor(Date.now() / 1000);
  const { current, pageCount, shown } = statusPage(tickets, page);
  const nav = (target, slot) => `${IDS.statusPage}:${target}:${slot}`;

  const container = new ContainerBuilder();
  if (cardName) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${cardName}`)));
    container.addTextDisplayComponents(
      text(`-# Son güncelleme: <t:${now}:R>${shown.length ? ' · Ayrıntı için talep numarası butonuna bas' : ''}`),
    );
  } else {
    container.addTextDisplayComponents(text(`## ${STATUS_TITLE}\n${STATUS_SUB}`));
    for (const t of shown) {
      container.addSeparatorComponents(divider()).addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(text(`**#${pad(t.number)}** · <@${t.ownerId}> · ${ticketState(t).line}`))
          .setButtonAccessory(new ButtonBuilder().setCustomId(`${IDS.statusDetail}:${t.threadId}`).setLabel('Detay').setStyle(ButtonStyle.Secondary)),
      );
    }
    if (!shown.length) container.addSeparatorComponents(divider()).addTextDisplayComponents(text('Şu an açık destek talebi yok.'));
    container.addTextDisplayComponents(text(`-# ${pageInfo(current, pageCount, tickets.length)}\n-# Son güncelleme: <t:${now}:R>`));
  }

  // Kart satırlarında buton taşınamadığı için detay butonları kartın altına ayrı satıra konur. Aynı kaydı tekrar
  // seçince hiçbir etkileşim gitmediği için menü değil buton kullanılır; sayfa butonları her zaman görünür
  if (cardName && shown.length) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        shown.map((t) =>
          new ButtonBuilder().setCustomId(`${IDS.statusDetail}:${t.threadId}`).setLabel(`#${pad(t.number)}`).setStyle(ButtonStyle.Secondary),
        ),
      ),
    );
  }
  container.addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));
  return container;
}

module.exports = {
  IDS,
  STATUS_TITLE,
  STATUS_SUB,
  STATUS_PAGE_SIZE,
  statusPage,
  ticketState,
  panel,
  statusPanel,
  ticketModal,
  ticketPanel,
  claimedNotice,
  ticketClosed,
  claimRequest,
  claimReminder,
  ticketCreated,
  closeModal,
  openLog,
  closeLog,
  closeDm,
};
