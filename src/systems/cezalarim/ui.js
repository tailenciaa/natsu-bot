// Cezalarım paneli: #cezalarım kanalındaki sabit panel ve üç butonun (Süre, Sebep, İtiraz) sonuçları.
// İtiraz: aktif cezalardan biri seçilir, sebep formu doldurulur, destek sistemi üzerinden o cezaya özel talep açılır.
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
const { text, divider, colors, unix, quote, shorten, pad, notice, page: pageBlocks } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const { TYPES, formatDuration } = require('../sicil/ui');
const config = require('./config');

const IDS = {
  sure: 'cezalarim:sure',
  sebep: 'cezalarim:sebep',
  itiraz: 'cezalarim:itiraz',
  itirazPick: 'cezalarim-itiraz-sec', // cezalarim-itiraz-sec:0
  itirazForm: 'cezalarim-itiraz-form', // cezalarim-itiraz-form:<ceza kaydı ID'si>
  itirazReason: 'itiraz-sebep',
  itirazKarar: 'cezalarim-itiraz-karar', // cezalarim-itiraz-karar:<ceza kaydı ID'si>:<onayla|reddet>
};

// Her satır kendi açıklamasıyla birlikte, tam yanında o satırın butonuyla durur
const row = (title, description, buttonId, buttonLabel, style) =>
  new SectionBuilder()
    .addTextDisplayComponents(text(`**${title}**\n-# ${description}`))
    .setButtonAccessory(new ButtonBuilder().setCustomId(buttonId).setLabel(buttonLabel).setStyle(style));

function panel() {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `${panelTitle(`${botName} Ceza Bilgilendirme Paneli`)}\n` +
          '-# Aşağıdaki butonları kullanarak sunucu üzerindeki aktif cezaların hakkında detaylı bilgi alabilir, cezanın ne zaman biteceğini ve sebebini öğrenebilir, haksız bulursan itiraz edebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      row('Cezam Ne Zaman Bitecek?', 'Süreli cezalarının ne zaman sona ereceğini öğren.', IDS.sure, 'Süreyi Öğren', ButtonStyle.Success),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      row('Ceza Sebebim Ne?', 'Hangi sebeple cezalandırıldığını görüntüle.', IDS.sebep, 'Sebebi Öğren', ButtonStyle.Success),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      row('Cezaya İtiraz Et', 'Cezanın haksız olduğunu düşünüyorsan itiraz için destek talebi aç.', IDS.itiraz, 'İtiraz Et', ButtonStyle.Danger),
    );

  if (config.banner) {
    container
      .addSeparatorComponents(divider())
      .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  }
  return container;
}

// Jail kanalına giden bilgilendirme paneli: jail'deki üye diğer kanalları göremediği için #cezalarım paneline
// ulaşamaz, bu yüzden "ne zaman bitecek" bilgisi burada aynı buton (IDS.sure) ile tekrar sunulur.
function jailPanel() {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `${panelTitle(`${botName} Jail Bilgilendirme`)}\n` +
          "-# Jail'deyken bu kanal dışında sunucudaki hiçbir kanalı göremezsin; süresi dolunca jail kendiliğinden kalkar ve tekrar tüm kanallara erişebilirsin, kalan süreni aşağıdan öğrenebilirsin.",
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text("**Jail Durumun**\nJail'desin, bu kanal dışında sunucudaki hiçbir kanalı göremezsin.\n-# Kurallara uygun davrandığını gösterirsen süresi dolunca jail kendiliğinden kalkar, tekrar tüm kanallara erişebilirsin."))
    .addSeparatorComponents(divider())
    .addSectionComponents(
      row("Ne Zaman Çıkacağım?", "Jail'inin ve varsa diğer aktif cezalarının ne zaman sona ereceğini öğren.", IDS.sure, 'Süreyi Öğren', ButtonStyle.Success),
    );
}

const NO_ACTIVE = '✅ Şu an sunucuda aktif bir cezan bulunmuyor.';

// "Cezam Ne Zaman Bitecek?": aktif cezaların kalan süresi
function sureView(active) {
  if (!active.length) return notice(NO_ACTIVE, 'success');
  return pageBlocks({
    title: 'Ceza Sürelerin',
    sub: 'Sunucuda şu an aktif olan cezalarının ne zaman sona ereceğini aşağıda görebilirsin; süresiz olarak verilen cezalar yetkililer tarafından kaldırılana kadar devam eder.',
    accent: colors.warning,
    blocks: active.map((p) => `**${TYPES[p.type].label} #${p.number}**\n-# ${p.expiresAt ? `<t:${unix(p.expiresAt)}:R> sona erecek` : 'Süresiz'}`),
  });
}

// "Ceza Sebebim Ne?": aktif cezaların sebebi
function sebepView(active) {
  if (!active.length) return notice(NO_ACTIVE, 'success');
  return pageBlocks({
    title: 'Ceza Sebeplerin',
    sub: 'Sunucuda şu an aktif olan cezalarının hangi sebeple verildiğini aşağıda görebilirsin; cezayı haksız buluyorsan #cezalarım panelindeki itiraz butonunu kullanabilirsin.',
    accent: colors.warning,
    blocks: active.map((p) => `**${TYPES[p.type].label} #${p.number}**\n${quote(p.reason)}`),
  });
}

const itirazNoneView = () => notice('✅ İtiraz edebileceğin aktif bir cezan yok.', 'success');

// "Cezaya İtiraz Et": aktif cezalardan birini seçme menüsü
function itirazPicker(active) {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        '## Cezaya İtiraz Et\n-# Aşağıdaki menüden itiraz etmek istediğin aktif cezayı seç; ardından açılan formda itiraz sebebini yazdığında yetkililer için özel bir destek talebi oluşturulur.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('**İtiraz etmek istediğin cezayı seç.**'))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.itirazPick}:0`)
          .setPlaceholder('İtiraz edeceğin cezayı seç')
          .addOptions(
            active.map((p) =>
              new StringSelectMenuOptionBuilder()
                .setValue(p.id)
                .setLabel(`${TYPES[p.type].label} #${pad(p.number)}`)
                .setDescription(shorten(p.reason, 100)),
            ),
          ),
      ),
    );
}

// Seçilen cezanın itiraz sebebini soran form
function itirazModal(p) {
  return new ModalBuilder()
    .setCustomId(`${IDS.itirazForm}:${p.id}`)
    .setTitle(`İtiraz・${TYPES[p.type].label} #${pad(p.number)}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('İtiraz Sebebin')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.itirazReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Bu cezayı neden haksız buluyorsun?')
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Form gönderilince destek talebinin konusu olacak metin
const itirazTicketReason = (p, sebep) => `Ceza İtirazı・${TYPES[p.type].label} #${pad(p.number)}: ${sebep}`;

// İtiraz talebi açılınca alt başlığa giden, cezanın bilgisini gösteren ve yetkiliye onay/red butonu sunan kart.
// Karar verilmişse butonlar yerine sonucu gösterir.
function itirazCard(p, sebep, karar) {
  const durum = p.type === 'uyari' ? null : p.expiresAt ? `<t:${unix(p.expiresAt)}:R> sona erecek` : 'Süresiz';

  const container = new ContainerBuilder()
    .setAccentColor(karar ? (karar.sonuc === 'onayla' ? colors.success : colors.danger) : colors.warning)
    .addTextDisplayComponents(
      text(
        '## İtiraz Edilen Ceza\n-# Üye aşağıdaki cezaya itiraz etti; cezanın bilgilerini, ceza sebebini ve üyenin itiraz sebebini inceleyip alttaki butonlarla itirazı onaylayabilir ya da reddedebilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        '**Ceza Bilgileri**\n' +
          [
            `- **Tür:** ${TYPES[p.type].label}`,
            `- **Numara:** #${pad(p.number)}`,
            `- **Veren:** <@${p.by}>`,
            `- **Verilme:** <t:${unix(p.createdAt)}:F>`,
            p.duration ? `- **Süre:** ${formatDuration(p.duration)}` : null,
            durum ? `- **Durum:** ${durum}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Ceza Sebebi**\n${quote(p.reason)}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**İtiraz Sebebi**\n${quote(sebep)}`));

  if (karar) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(
        text(
          karar.sonuc === 'onayla'
            ? `✅ **İtiraz <@${karar.by}> tarafından onaylandı, ceza kaldırıldı.**`
            : `❌ **İtiraz <@${karar.by}> tarafından reddedildi, ceza sürüyor.**`,
        ),
      );
    return container;
  }

  return container.addSeparatorComponents(divider()).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${IDS.itirazKarar}:${p.id}:onayla`).setLabel('Onayla, Cezayı Kaldır').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${IDS.itirazKarar}:${p.id}:reddet`).setLabel('Reddet').setStyle(ButtonStyle.Danger),
    ),
  );
}

module.exports = {
  IDS,
  panel,
  jailPanel,
  sureView,
  sebepView,
  itirazNoneView,
  itirazPicker,
  itirazModal,
  itirazTicketReason,
  itirazCard,
};
