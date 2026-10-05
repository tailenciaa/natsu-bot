// Destek sisteminin mesajları: panel, talep alt başlığı, yetkili kanalı bildirimleri, loglar ve kapanış DM'i
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  FileBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const core = require('../../core/ui');
const ratingUi = require('../degerlendirme/ui');
const config = require('./config');

const { colors, text, divider, pad, messageUrl, unix, quote, page, alert, field, fields, stamp } = core;

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
};

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
    sub = 'Bu talep sona erdi. Kimin kapattığı ve kapatma sebebi talebin kapatıldığı ayrı mesajda yer alır; konuşma bu noktadan sonra yalnızca okunabilir.';
    status = '**Talep kapatıldı.**\n-# Alt başlık kilitlendi ve arşivlendi.';
    color = colors.danger;
  } else if (ticket.claimedBy) {
    sub = 'Talebini üstlenen yetkili bu kanalda seninle ilgilenir. Sorununu buradan yazmaya devam edebilir, ekran görüntüsü ekleyebilirsin; işin bittiğinde **Talebi Kapat** butonuyla talebi kapatabilirsin.';
    status = `**<@${ticket.claimedBy}> talebinle ilgileniyor.**`;
    color = colors.success;
  } else {
    sub = ticket.notified
      ? 'Bir yetkili talebini üstlenene kadar sorununu ayrıntılı yazabilir, varsa ekran görüntüsü ekleyebilirsin. Yetkili gelince bu kanalda seninle ilgilenir; vazgeçersen **Talebi Kapat** butonuyla talebi kapatabilirsin.'
      : 'Bir yetkili talebini üstlenene kadar sorununu ayrıntılı yazabilir, varsa ekran görüntüsü ekleyebilirsin. Uzun süre yanıt alamazsan **Hatırlat** butonuyla ekibe haber verebilirsin.';
    status = `**Bir yetkili bekleniyor.**${ticket.notified ? '\n-# Ekibe hatırlatma gönderildi.' : ''}`;
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
      fields([`**Talebi <@${ticket.closedBy}> kapattı.**`, logEnabled() ? '-# Konuşma kaydı ekibe iletildi.' : null]),
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
      fields([
        '**Talep Bilgileri**',
        field('Talep Sahibi', `<@${ticket.ownerId}>`),
        field('Açılış', `<t:${unix(ticket.createdAt)}:R>`),
        ticket.claimedBy ? field('Üstlenen', `<@${ticket.claimedBy}>`) : null,
        ticket.closedBy ? field('Kapatan', `<@${ticket.closedBy}>`) : null,
        ticket.closedBy && ticket.closeReason ? field('Kapatma Sebebi', ticket.closeReason.label) : null,
        waiting ? `-# <@&${ticket.staffRoleId}>, bekleyen yeni bir talep var.` : null,
      ]),
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
            .setPlaceholder('Bir sebep seç')
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
      fields([
        '**Talep Bilgileri**',
        field('Talep', `<#${channel.id}>`),
        field('Talep Sahibi', personText(owner.id, owner)),
        field('Açılış', `<t:${unix(ticket.createdAt)}:F>`),
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
      fields([
        '**Talep Bilgileri**',
        field('Talep', `<#${ticket.threadId}>`),
        field('Talep Sahibi', personText(ticket.ownerId, owner)),
        field('Üstlenen', ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Yok'),
        field('Kapatan', personText(closedBy.id, closedBy)),
        field('Açılış', `<t:${unix(ticket.createdAt)}:F>`),
        field('Kapanış', `<t:${unix(Date.now())}:F>`),
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
    blocks: [`**${guildName}** sunucusundaki **#${pad(ticketNumber)}** numaralı destek talebin kapatıldı.`],
  });
  if (rating) ratingUi.ratingSection(container, rating);
  return container;
}

module.exports = {
  IDS,
  panel,
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
