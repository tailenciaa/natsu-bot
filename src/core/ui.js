// Tüm sistemlerin ortak kullandığı mesaj parçaları. Her sistemin kendi mesajları kendi klasöründeki ui.js'te.
// Tüm mesajlar Components V2 (container / text display / section / media gallery) ile kurulur, hiçbir yerde embed kullanılmaz.
// Düzen: önemli cümleler kalın, ek açıklamalar küçük yazı (-#), birbiriyle alakasız kısımların arasında çizgi.
const path = require('node:path');
const {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require('discord.js');
const config = require('./config');

const CV2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const EPHEMERAL_CV2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

// Panellerin varsayılan görseli
const DEFAULT_BANNER = path.join(__dirname, '..', '..', 'assets', 'banner.png');

const text = (content) => new TextDisplayBuilder().setContent(content);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const pad = (number) => String(number).padStart(4, '0');
const unix = (ms) => Math.floor(ms / 1000);
const quote = (value) =>
  value
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
const stars = (score) => `${'⭐'.repeat(score)} ${score}/5`;
const shorten = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
const messageUrl = (guildId, channelId, messageId) => `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;

// sections: tek metin ya da aralarına çizgi konacak birbirinden bağımsız metinler
function notice(sections, color) {
  const container = new ContainerBuilder();
  [].concat(sections).forEach((section, index) => {
    if (index > 0) container.addSeparatorComponents(divider());
    container.addTextDisplayComponents(text(section));
  });
  if (color) container.setAccentColor(config.colors[color]);
  return container;
}

// Kısa bildirimlerin ortak düzeni: kalın ana cümle, altında küçük açıklama
function alert(message, hint, color) {
  return notice(hint ? `**${message}**\n-# ${hint}` : `**${message}**`, color);
}

// Panel düzeni: başlık ve sağında buton, açıklama, görsel, altta uyarı yazısı
// image: tam bir http(s) URL'i ise doğrudan o kullanılır, değilse eklenmiş dosya adı (attachment://) sayılır
function panelMessage(texts, buttonId, image) {
  const container = new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(texts.title))
        .setButtonAccessory(new ButtonBuilder().setCustomId(buttonId).setLabel(texts.buttonLabel).setStyle(ButtonStyle.Primary)),
    )
    .addTextDisplayComponents(text(texts.description));

  if (image) {
    const url = /^https?:\/\//.test(image) ? image : `attachment://${image}`;
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url)));
  }

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(texts.footer));
}

// STANDART SAYFA DÜZENİ (duyurular, tablolar, bilgi panelleri): başlık, altında iki satıra yayılan gri açıklama,
// sonra çizgiyle ayrılmış bloklar. Mesajın genişliği en uzun satıra göre belirlendiği için "sub" bilerek uzun
// (en az ~140 karakter) yazılır; böylece bütün mesajlar aynı ve en geniş boyutta görünür, boşluk bırakmaya gerek kalmaz.
// Etiketler (<@&rol>) karakter sayısına dahil sayılmaz, uzunluğu sade metinle sağla.
// blocks: her biri ayrı bir metin bloğu (ör. "**Alt Başlık**\nsatırlar"), thumbnail: sağ üstteki küçük görsel (isteğe bağlı)
function page({ title, sub, thumbnail, blocks = [], accent }) {
  const header = text(`## ${title}\n-# ${sub}`);
  const container = new ContainerBuilder();
  if (accent) container.setAccentColor(accent);
  if (thumbnail) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(header).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)));
  } else {
    container.addTextDisplayComponents(header);
  }
  for (const block of blocks) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container;
}

module.exports = {
  CV2,
  EPHEMERAL,
  EPHEMERAL_CV2,
  DEFAULT_BANNER,
  colors: config.colors,
  text,
  divider,
  pad,
  unix,
  quote,
  stars,
  shorten,
  messageUrl,
  notice,
  alert,
  panelMessage,
  page,
};
