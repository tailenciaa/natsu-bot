// Cezalarım paneli: #cezalarım kanalındaki sabit panel ve üç butonun (Süre, Sebep, İtiraz) sonuçları.
// İtiraz: aktif cezalardan biri seçilir, sebep formu doldurulur, destek sistemi üzerinden o cezaya özel talep açılır.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { text, divider, hint, colors, unix, quote, shorten, alert, bannerGallery, block, field, fields, page } = require('../../core/ui');
const { botName } = require('../../core/config');
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

// Mesaj sınırları: bir listede en fazla bu kadar ceza gösterilir (40 bileşen / 4000 karakter sınırı), menüde en fazla 25 seçenek olur
const MAX_LIST = 10;
const MAX_REASON = 250;

const label = (p) => `${TYPES[p.type].label} #${p.number}`;

// Her satır kendi açıklamasıyla birlikte, tam yanında o satırın butonuyla durur
const row = (title, description, buttonId, buttonLabel, style) =>
  new SectionBuilder()
    .addTextDisplayComponents(text(block(title, null, description)))
    .setButtonAccessory(new ButtonBuilder().setCustomId(buttonId).setLabel(buttonLabel).setStyle(style));

function panel() {
  const container = new ContainerBuilder().addTextDisplayComponents(
    text(
      `## ${botName} Ceza Bilgilendirme\n` +
        '-# **Süreyi Öğren**, **Sebebi Öğren** ve **İtiraz Et** butonlarıyla aktif cezalarının süresini ve sebebini öğrenebilir, haksız bulduğun bir cezaya itiraz edebilirsin.',
    ),
  );
  if (config.banner) container.addMediaGalleryComponents(bannerGallery(config.banner));

  return container
    .addSeparatorComponents(divider())
    .addSectionComponents(row('Ceza Süresi', 'Süreli cezalarının ne zaman sona ereceğini öğren.', IDS.sure, 'Süreyi Öğren', ButtonStyle.Success))
    .addSeparatorComponents(divider())
    .addSectionComponents(row('Ceza Sebebi', 'Hangi sebeple cezalandırıldığını görüntüle.', IDS.sebep, 'Sebebi Öğren', ButtonStyle.Success))
    .addSeparatorComponents(divider())
    .addSectionComponents(
      row('Cezaya İtiraz', 'Cezanın haksız olduğunu düşünüyorsan itiraz için destek talebi aç.', IDS.itiraz, 'İtiraz Et', ButtonStyle.Danger),
    );
}

// Jail kanalına giden bilgilendirme paneli: jail'deki üye diğer kanalları göremediği için #cezalarım paneline
// ulaşamaz, bu yüzden "ne zaman bitecek" bilgisi burada aynı buton (IDS.sure) ile tekrar sunulur.
function jailPanel() {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `## ${botName} Jail Bilgilendirme\n` +
          "-# Jail'deyken bu kanal dışında sunucudaki hiçbir kanalı göremezsin. Süren dolunca jail kendiliğinden kalkar; kalan süreni **Süreyi Öğren** butonuyla öğrenebilirsin.",
      ),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      row('Jail Süresi', "Jail'inin ve varsa diğer aktif cezalarının ne zaman sona ereceğini öğren.", IDS.sure, 'Süreyi Öğren', ButtonStyle.Success),
    );
}

// Liste uzunsa ilk MAX_LIST kayıt gösterilir, kalanı tek satırda belirtilir
const overflowNote = (total) => (total > MAX_LIST ? `+${total - MAX_LIST} ceza daha var; hepsini /sicil komutuyla görebilirsin.` : null);

// Bitiş bilgisi: süresi dolmuş ama kaldırma taraması henüz çalışmamış ceza "sona erecek" demez
function endText(p) {
  if (!p.expiresAt) return 'Süresiz, bir yetkili kaldırana kadar sürer.';
  if (p.expiresAt <= Date.now()) return 'Süresi doldu, birazdan kaldırılacak.';
  return `Bitiş: <t:${unix(p.expiresAt)}:F> (<t:${unix(p.expiresAt)}:R>)`;
}

const NO_ACTIVE = () => alert('Şu an aktif bir cezan yok.', null, 'success');

// "Ceza Süresi": aktif cezaların bitiş zamanı. Uyarıların süresi olmadığı için burada listelenmez.
function sureView(active) {
  const timed = active.filter((p) => p.type !== 'uyari');
  if (!timed.length) {
    return active.length ? alert('Süreli bir cezan yok.', 'Uyarıların süresi olmaz, sicilinde kayıtlı kalır.', 'success') : NO_ACTIVE();
  }
  return page({
    title: 'Ceza Sürelerin',
    sub: 'Sunucuda aktif olan cezalarının ne zaman sona ereceğini burada görebilirsin. Süresiz verilen cezalar bir yetkili kaldırana kadar sürer.',
    accent: colors.warning,
    blocks: [...timed.slice(0, MAX_LIST).map((p) => `**${label(p)}**\n${endText(p)}`), overflowNote(timed.length)],
  });
}

// "Ceza Sebebi": aktif cezaların sebebi
function sebepView(active) {
  if (!active.length) return NO_ACTIVE();
  return page({
    title: 'Ceza Sebeplerin',
    sub: 'Sunucuda aktif olan cezalarının hangi sebeple verildiğini burada görebilirsin. Cezayı haksız buluyorsan #cezalarım panelindeki **İtiraz Et** butonunu kullanabilirsin.',
    accent: colors.warning,
    blocks: [...active.slice(0, MAX_LIST).map((p) => `**${label(p)}**\n${quote(shorten(p.reason, MAX_REASON))}`), overflowNote(active.length)],
  });
}

const itirazNoneView = () => alert('İtiraz edebileceğin aktif bir cezan yok.');

// "Cezaya İtiraz": aktif cezalardan birini seçme menüsü (en fazla 25 ceza listelenir)
function itirazPicker(active) {
  return page({
    title: 'Cezaya İtiraz Et',
    sub: 'İtiraz etmek istediğin cezayı menüden seç. Ardından açılan formda sebebini yaz; yetkililer için sana özel bir destek talebi oluşturulur ve itirazın orada incelenir.',
  }).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`${IDS.itirazPick}:0`)
        .setPlaceholder('İtiraz edeceğin cezayı seç')
        .addOptions(
          active.slice(0, 25).map((p) =>
            new StringSelectMenuOptionBuilder().setValue(p.id).setLabel(label(p)).setDescription(shorten(p.reason, 100)),
          ),
        ),
    ),
  );
}

// Seçilen cezanın itiraz sebebini soran form
function itirazModal(p) {
  return new ModalBuilder()
    .setCustomId(`${IDS.itirazForm}:${p.id}`)
    .setTitle(`Cezaya İtiraz - ${label(p)}`)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Neden itiraz ediyorsun?')
        .setDescription('İtirazın yetkililer tarafından incelenir.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.itirazReason)
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Örn: Bu mesajı ben yazmadım, bir yanlış anlaşılma oldu.')
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true),
        ),
    );
}

// Form gönderilince destek talebinin konusu olacak kısa metin; itiraz sebebinin kendisi itirazCard'da yer alır
const itirazTicketReason = (p) => `Ceza İtirazı: ${label(p)}`;

// Cezanın kısa durumu (uyarılarda yok)
function durumText(p) {
  if (p.type === 'uyari') return null;
  if (p.status === 'lifted') return 'Kaldırıldı';
  if (p.status === 'expired') return 'Süresi doldu';
  if (!p.expiresAt) return 'Aktif, süresiz';
  return p.expiresAt <= Date.now() ? 'Süresi doldu' : `Aktif, <t:${unix(p.expiresAt)}:R> bitiyor`;
}

// İtiraz talebi açılınca alt başlığa giden, cezanın bilgisini gösteren ve yetkiliye onay/red butonu sunan kart.
// Karar verilmişse butonlar yerine sonucu gösterir.
function itirazCard(p, sebep, karar) {
  const approved = karar?.sonuc === 'onayla';
  const container = page({
    title: 'İtiraz Edilen Ceza',
    sub: karar
      ? 'Bu itiraz bir yetkili tarafından incelendi ve karara bağlandı. Cezanın bilgileri, ceza sebebi ve üyenin itiraz sebebi aşağıda kayıtlı kalır.'
      : 'Üye bir cezaya itiraz etti. Ceza bilgilerini ve iki sebebi inceleyip **İtirazı Onayla** ya da **İtirazı Reddet** butonuyla karar verebilirsin; onaylarsan ceza kaldırılır.',
    accent: karar ? (approved ? colors.success : colors.danger) : colors.warning,
    blocks: [
      fields([
        '**Ceza Bilgileri**',
        field('Ceza', label(p)),
        field('Yetkili', `<@${p.by}>`),
        field('Tarih', `<t:${unix(p.createdAt)}:F>`),
        p.duration ? field('Süre', formatDuration(p.duration)) : null,
        durumText(p) ? field('Durum', durumText(p)) : null,
      ]),
      `**Ceza Sebebi**\n${quote(p.reason)}`,
      `**İtiraz Sebebi**\n${quote(sebep)}`,
      karar
        ? fields([
            `**İtiraz <@${karar.by}> tarafından ${approved ? 'onaylandı' : 'reddedildi'}.**`,
            approved ? hint('Ceza kaldırıldı.') : p.status === 'active' ? hint('Ceza sürüyor.') : null,
          ])
        : null,
    ],
  });
  if (karar) return container;

  return container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${IDS.itirazKarar}:${p.id}:onayla`).setLabel('İtirazı Onayla').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`${IDS.itirazKarar}:${p.id}:reddet`).setLabel('İtirazı Reddet').setStyle(ButtonStyle.Danger),
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
