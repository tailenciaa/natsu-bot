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

// STANDART SAYFA DÜZENİ (duyurular, tablolar, bilgi panelleri): sade başlık, altında çizgiyle ayrılmış bloklar.
// Dolgu amaçlı uzun gri açıklama gösterilmez; çağıran yerlerdeki "sub" parametresi eski kullanımlar için kabul edilir ama yok sayılır.
// blocks: her biri ayrı bir metin bloğu (ör. "**Alt Başlık**\nsatırlar"), thumbnail: sağ üstteki küçük görsel (isteğe bağlı)
function page({ title, sub, thumbnail, blocks = [], accent }) {
  const header = text(`## ${title}`);
  const container = new ContainerBuilder();
  if (accent) container.setAccentColor(accent);
  let rest = blocks;
  if (thumbnail) {
    // Görselin yanındaki alan boş kalmasın diye ilk blok başlıkla birlikte görselin yanına konur
    const section = new SectionBuilder().addTextDisplayComponents(header).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
    if (blocks.length) {
      section.addTextDisplayComponents(text(blocks[0]));
      rest = blocks.slice(1);
    }
    container.addSectionComponents(section);
  } else {
    container.addTextDisplayComponents(header);
  }
  for (const block of rest) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container;
}

// OTOMATİK DÜZENLEME: bütün container'lar gönderilirken (toJSON) tek yerden düzeltilir, böylece her mesaj aynı düzende olur:
//  1) görsel/banner (media gallery) üstünde ve altında çizgi, 2) butonların/menülerin üstünde çizgi,
//  3) bir bloğun sonundaki küçük açıklama (-#) kalın/normal satırlardan çizgiyle ayrılır (başlık satırı "#" ile başlayanlara dokunulmaz).
const SEP = { type: 14, divider: true, spacing: 1 };
const isSep = (c) => c?.type === 14;
function splitNote(component) {
  const content = component?.type === 10 ? component.content : null;
  if (!content || content.startsWith('#') || content.startsWith('-#')) return [component];
  const lines = content.split('\n');
  let cut = lines.length;
  while (cut > 0 && lines[cut - 1].startsWith('-# ')) cut--;
  if (cut === lines.length || cut < 2) return [component];
  return [{ ...component, content: lines.slice(0, cut).join('\n') }, SEP, { ...component, content: lines.slice(cut).join('\n') }];
}
const countAll = (list) => list.reduce((n, c) => n + 1 + countAll(c.components ?? []) + (c.accessory ? 1 : 0), 0);
function tidy(components) {
  const out = [];
  const push = (c) => out.push(c);
  const sepBefore = () => {
    if (out.length && !isSep(out[out.length - 1])) push(SEP);
  };
  let prev = null;
  for (const raw of components) {
    for (const c of splitNote(raw)) {
      if (c.type === 12) sepBefore();
      else if (c.type === 1 && prev?.type !== 1) sepBefore();
      else if (prev?.type === 12 && !isSep(c)) push(SEP);
      push(c);
      prev = c;
    }
  }
  // Menü/butonların hemen üstündeki tek başına küçük not (-#), düzen için en alta, butonların altına taşınır
  const isNote = (c) => c?.type === 10 && c.content.startsWith('-# ') && c.content.split('\n').every((l) => l.startsWith('-#'));
  for (let i = 1; i < out.length - 2; i++) {
    if (!isNote(out[i]) || !isSep(out[i + 1]) || out[i + 2].type !== 1) continue;
    const note = out[i];
    let k = i + 2;
    while (out[k + 1]?.type === 1) k++;
    out.splice(i, 2); // not ve ardındaki çizgi çıkar
    k -= 2;
    if (!isSep(out[i - 1])) {
      out.splice(i, 0, SEP);
      k++;
    }
    out.splice(k + 1, 0, SEP, note);
  }
  // Discord bir mesajda iç içe en fazla 40 bileşene izin verir; düzenleme bunu aşıyorsa mesaj olduğu gibi bırakılır
  return countAll(out) + 1 <= 40 ? out : components;
}
const originalToJSON = ContainerBuilder.prototype.toJSON;
ContainerBuilder.prototype.toJSON = function toJSON(...args) {
  const json = originalToJSON.apply(this, args);
  if (Array.isArray(json.components)) json.components = tidy(json.components);
  // Mavi (primary) "nötr bilgi" rengi gösterilmez: renk sadece durum bildirdiğinde (yeşil/sarı/kırmızı) kullanılır
  if (json.accent_color === config.colors.primary) delete json.accent_color;
  return json;
};

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
