// Destek sisteminin mesajları: panel, talep alt başlığı, yetkili kanalı bildirimleri, loglar ve kapanış DM'i
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  FileBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { colors, text, divider, pad, unix, quote, messageUrl, notice, panelMessage } = require('../../core/ui');
const ratingUi = require('../degerlendirme/ui');
const config = require('./config');

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

// Kapanış mesajı ve logda aynı şekilde görünen kapatma sebebi bölümü
const reasonText = ({ label, note }) => `**Kapatma Sebebi:** ${label}${note ? `\n${quote(note)}` : ''}`;

function panel() {
  return panelMessage(config.panel, IDS.create, config.banner);
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
            .setPlaceholder('Örn: Sunucuya girerken bir hata alıyorum...')
            .setMinLength(5)
            .setMaxLength(1000)
            .setRequired(true),
        ),
    );
}

// Talep alt başlığında üyenin gördüğü mesaj.
// Yetkili rolü burada etiketlenmez: özel alt başlıkta etiketlenen herkes alt başlığa eklenir.
function ticketPanel(ticket) {
  const waiting = !ticket.claimedBy && !ticket.closedBy;

  let status;
  let color;
  // Kimin kapattığı ve sebebi ayrı "Talep Kapatıldı" mesajında, burada sadece kilit bilgisi
  if (ticket.closedBy) {
    status = '**Talep kilitlendi ve arşivlendi.**\n-# Artık bu kanala mesaj gönderilemez.';
    color = colors.danger;
  } else if (ticket.claimedBy) {
    status = `**<@${ticket.claimedBy}> talebinle ilgileniyor.**`;
    color = colors.success;
  } else {
    status =
      '**Bir yetkilinin talebini üstlenmesi bekleniyor...**\n' +
      (ticket.notified
        ? '-# Ekibe hatırlatma gönderildi, kısa süre içinde bir yetkili seninle ilgilenecek.'
        : '-# Uzun süre yanıt alamazsan **Hatırlat** butonuyla ekibe bir kez daha haber verebilirsin.');
    color = colors.warning;
  }

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      text(
        `## Destek Talebi #${pad(ticket.number)}\n` +
          `**Hoş geldin <@${ticket.ownerId}>, talebin ekibimize ulaştı.**\n` +
          '-# Beklerken sorununu ayrıntılı şekilde yazabilir, varsa ekran görüntüsü ekleyebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(status));

  if (!ticket.closedBy) {
    const row = new ActionRowBuilder();
    if (waiting) {
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

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# <t:${unix(ticket.createdAt)}:F>`));
}

// Talep üstlenilince alt başlığa giden mesaj: üyeyi etiketler, buradan yetkiliyi bir kez selamlayabilir.
// Kimin üstlendiği üstteki talep mesajında yazdığı için burada tekrar edilmez.
function claimedNotice(ticket) {
  return new ContainerBuilder()
    .setAccentColor(colors.success)
    .addTextDisplayComponents(text(`**<@${ticket.ownerId}>, yetkilin geldi!**\n-# Sorununu anlatmaya başlayabilirsin.`))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(IDS.greet)
          .setStyle(ButtonStyle.Primary)
          .setLabel(ticket.greeted ? 'Selam Verildi' : 'Selam Ver')
          .setDisabled(Boolean(ticket.greeted)),
      ),
    );
}

// Talep kapatılınca alt başlığa giden mesaj (kilit bilgisi üstteki talep mesajında olduğu için tekrar edilmez)
function ticketClosed(ticket) {
  return notice(
    [
      '### Talep Kapatıldı\n' +
        `**Bu talep <@${ticket.closedBy}> tarafından kapatıldı.**` +
        (logEnabled() ? '\n-# Konuşma kaydı ekibe iletildi.' : ''),
      reasonText(ticket.closeReason),
    ],
    'danger',
  );
}

// Talep kanalına giden "Yeni Destek Talebi" mesajı, butona ilk basan yetkili talebi üstlenir
// Beklerken başlık zaten "bekleyen talep var" dediği için ayrıca durum yazılmaz; üstlenilince ya da kapanınca
// başlık sadeleşir, durum satırı çıkar.
function claimRequest(ticket) {
  const waiting = !ticket.claimedBy && !ticket.closedBy;
  const header = waiting
    ? `### Yeni Destek Talebi #${pad(ticket.number)}\n` +
      `**<@&${ticket.staffRoleId}>, bekleyen yeni bir talep var.**\n` +
      '-# Talebi ilk üstlenen yetkili ilgilenir.'
    : `### Destek Talebi #${pad(ticket.number)}`;

  let status = null;
  let color = colors.primary;
  if (ticket.closedBy) {
    status = `<@${ticket.closedBy}> kapattı`;
    color = colors.danger;
  } else if (ticket.claimedBy) {
    status = `<@${ticket.claimedBy}> ilgileniyor`;
    color = colors.success;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${IDS.claim}:${ticket.threadId}`)
      .setStyle(ButtonStyle.Success)
      .setLabel(ticket.closedBy ? 'Kapatıldı' : ticket.claimedBy ? 'Üstlenildi' : 'Talebi Üstlen')
      .setDisabled(Boolean(ticket.claimedBy || ticket.closedBy)),
  );
  if (ticket.claimedBy || ticket.closedBy) {
    row.addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('Talebe Git')
        .setURL(`https://discord.com/channels/${ticket.guildId}/${ticket.threadId}`),
    );
  }

  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(text(header))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `**Talep Sahibi:** <@${ticket.ownerId}>`,
          `**Açılış:** <t:${unix(ticket.createdAt)}:R>`,
          status ? `**Durum:** ${status}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Konu:**\n${quote(ticket.reason)}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(row);
}

// Üye "Hatırlat"a basınca talep kanalına giden hatırlatma.
// Üstlenme mesajına yanıt olarak gider; talep bilgilerini tekrar etmez, "Talebe Git" o mesaja götürür.
function claimReminder(ticket) {
  return new ContainerBuilder()
    .setAccentColor(colors.warning)
    .addTextDisplayComponents(
      text(
        `### Hatırlatma · Talep #${pad(ticket.number)}\n` +
          `**<@&${ticket.staffRoleId}>, <@${ticket.ownerId}> hâlâ bir yetkili bekliyor!**\n` +
          '-# Butonla talebin üstlenme mesajına gidebilirsin.',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('Talebe Git')
          .setURL(messageUrl(ticket.guildId, ticket.claimChannelId, ticket.claimMessages.main)),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# <t:${unix(Date.now())}:F>`));
}

function ticketCreated(channel) {
  return new ContainerBuilder()
    .setAccentColor(colors.success)
    .addTextDisplayComponents(
      text(
        `**Talebin açıldı:** <#${channel.id}>\n` +
          '-# Ekibe haber verildi, bir yetkili talebini üstlendiğinde bildirim alacaksın.',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Talebe Git').setURL(channel.url),
      ),
    );
}

// "Talebi Kapat" ile açılan form: sebep seçilir, istenirse not yazılır. Formu göndermek onay yerine geçer.
function closeModal() {
  return new ModalBuilder()
    .setCustomId(IDS.closeModal)
    .setTitle('Talebi Kapat')
    .addTextDisplayComponents(
      text(`Talep kilitlenip arşivlenecek${logEnabled() ? ', konuşma kaydı ekibe iletilecek' : ''}.`),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Talep nasıl sonuçlandı?')
        .setDescription('Kapatma sebebini seç.')
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
        .setLabel('Not')
        .setDescription('İsteğe bağlı, kısa bir açıklama ekleyebilirsin.')
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
  return new ContainerBuilder()
    .setAccentColor(colors.success)
    .addTextDisplayComponents(text(`### Talep Açıldı #${pad(ticket.number)}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `**Talep:** <#${channel.id}>`,
          `**Açan:** <@${owner.id}> (\`${owner.username}\`)`,
          `**Tarih:** <t:${unix(ticket.createdAt)}:F>`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Konu:**\n${quote(ticket.reason)}`));
}

function closeLog(ticket, closedBy, fileName) {
  return new ContainerBuilder()
    .setAccentColor(colors.danger)
    .addTextDisplayComponents(text(`### Talep Kapatıldı #${pad(ticket.number)}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          `**Talep:** <#${ticket.threadId}>`,
          `**Talep Sahibi:** <@${ticket.ownerId}>`,
          `**Kapatan:** <@${closedBy.id}>`,
          `**Üstlenen:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Yok'}`,
          `**Açılış:** <t:${unix(ticket.createdAt)}:F>`,
          `**Kapanış:** <t:${unix(Date.now())}:F>`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Konu:**\n${quote(ticket.reason)}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(reasonText(ticket.closeReason)))
    .addSeparatorComponents(divider())
    .addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`));
}

// Talep sahibine giden kısa "talebin kapatıldı" DM'i.
// Değerlendirme sistemi bir değerlendirme oluşturduysa altına yetkiliyi puanlama bölümü eklenir.
function closeDm(ticketNumber, guildName, rating) {
  const container = notice(
    '### Talebin Kapatıldı\n' +
      `**${guildName}** sunucusundaki **#${pad(ticketNumber)}** numaralı talebin kapatıldı.\n` +
      '-# Başka bir konuda yardıma ihtiyacın olursa panelden yeni bir talep açabilirsin.',
    'danger',
  );
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
