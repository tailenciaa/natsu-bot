// Tüm sistemlerin ortak kullandığı mesaj parçaları. Her sistemin kendi mesajları kendi klasöründeki ui.js'te.
// Tüm mesajlar Components V2 (container / text display / section / media gallery) ile kurulur, hiçbir yerde embed kullanılmaz.
// Düzen: önemli cümleler kalın, ek açıklamalar küçük yazı (-#), birbiriyle alakasız kısımların arasında çizgi.
const path = require('node:path');
const {
  ActionRowBuilder,
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
const banner = require('./banner');

const CV2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const SILENT_CV2 = MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications;
const EPHEMERAL_CV2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

// Panellerin varsayılan görseli
const DEFAULT_BANNER = path.join(__dirname, '..', '..', 'assets', 'banner.png');

// Bir metin bloğu en fazla 4000 karakter olabilir; fazlası "…" ile kesilir (Discord geçersiz mesaj olarak reddetmesin)
const text = (content) => new TextDisplayBuilder().setContent(shorten(String(content), 4000));
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const pad = (number) => String(number).padStart(4, '0');
const unix = (ms) => Math.floor(ms / 1000);
const quote = (value) =>
  String(value)
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
const stars = (score) => `${'⭐'.repeat(score)} ${score}/5`;
function shorten(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
const messageUrl = (guildId, channelId, messageId) => `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;

// Etiket-değer satırları ve bloklar için küçük yardımcılar; boş (null/undefined/false/'') parçalar atlanır
const hasValue = (value) => value !== null && value !== undefined && value !== false && value !== '';
const fields = (rows) => rows.filter(hasValue).join('\n');
const field = (label, value) => `**${label}:** ${value}`;
// Küçük gri yazı: çok satırlı metinde her satır ayrı "-#" olur (Discord yalnızca satır başındaki "-#"yi küçültür)
const hint = (value) =>
  String(value)
    .split('\n')
    .map((line) => `-# ${line}`)
    .join('\n');
// Kalın başlık/ana cümle, altında düz satırlar, en altta küçük ipucu
const block = (title, body, note) => fields([`**${title}**`, body, hasValue(note) ? hint(note) : null]);
// Sayfa bilgisi tek satırda: "Sayfa 2 / 5 · 48 kayıt"
const pageInfo = (page, pageCount, total) => `Sayfa ${page + 1} / ${pageCount}${hasValue(total) ? ` · ${total.toLocaleString('tr-TR')} kayıt` : ''}`;
// "vaka" mesajlarının (talep, başvuru, ceza...) en altındaki tarih satırı
const stamp = (ms = Date.now(), style = 'F') => `-# <t:${unix(ms)}:${style}>`;

// sections: tek metin ya da aralarına çizgi konacak birbirinden bağımsız metinler
// color: 'success' | 'warning' | 'danger' (| 'primary') ya da doğrudan renk sayısı
function notice(sections, color) {
  const container = new ContainerBuilder();
  [].concat(sections)
    .filter(hasValue)
    .forEach((section, index) => {
      if (index > 0) container.addSeparatorComponents(divider());
      container.addTextDisplayComponents(text(section));
    });
  if (color) container.setAccentColor(typeof color === 'number' ? color : config.colors[color]);
  return container;
}

// Kısa bildirimlerin ortak düzeni: kalın ana cümle, altında küçük açıklama
function alert(message, note, color) {
  return notice(hasValue(note) ? `**${message}**\n${hint(note)}` : `**${message}**`, color);
}

// Afiş (media gallery). Discord CDN bağlantılarının süresi dolduğu için gönderirken yerel kopyaya çevrilir (core/banner.js)
const bannerGallery = (url) => new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url));

// STANDART PANEL: başlık ve açıklama solda, istenirse buton sağda (section aksesuarı), altında afiş ve küçük not.
// button: { id, label, style } ; image: afiş bağlantısı ya da dosya adı ; note: en alttaki küçük yazı (-# eklenir)
function panel({ title, sub, button, image, note, thumbnail }) {
  const header = text(`## ${title}${hasValue(sub) ? `\n-# ${sub}` : ''}`);
  const container = new ContainerBuilder();
  const section = new SectionBuilder().addTextDisplayComponents(header);
  if (button) {
    container.addSectionComponents(
      section.setButtonAccessory(new ButtonBuilder().setCustomId(button.id).setLabel(button.label).setStyle(button.style ?? ButtonStyle.Primary)),
    );
  } else if (thumbnail) {
    container.addSectionComponents(section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)));
  } else {
    container.addTextDisplayComponents(header);
  }
  if (image) container.addMediaGalleryComponents(bannerGallery(/^https?:\/\//.test(image) ? image : `attachment://${image}`));
  if (hasValue(note)) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(hint(note)));
  return container;
}

// Sayfa butonları: "«" ve "»" (emoji gibi görünen ok simgeleri yok); uçlarda pasif
function pagerRow({ prevId, nextId, page, pageCount }) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(prevId).setLabel('«').setStyle(ButtonStyle.Primary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(nextId).setLabel('»').setStyle(ButtonStyle.Primary).setDisabled(page >= pageCount - 1),
  );
}

// Sekme butonları: açık sekme yeşil (Success), diğerleri gri; tabs: { anahtar: 'Etiket' }, idOf(anahtar): customId
function tabRow(tabs, active, idOf) {
  return new ActionRowBuilder().addComponents(
    Object.entries(tabs).map(([key, label]) =>
      new ButtonBuilder().setCustomId(idOf(key)).setLabel(label).setStyle(key === active ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  );
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
  const header = text(`## ${title}${hasValue(sub) ? `\n-# ${sub}` : ''}`);
  const container = new ContainerBuilder();
  if (accent) container.setAccentColor(accent);
  if (thumbnail) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(header).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail)));
  } else {
    container.addTextDisplayComponents(header);
  }
  // Boş (null/undefined/false/'') bloklar atlanır, böylece koşullu bloklar için ayrıca kontrol yazmak gerekmez
  for (const content of blocks.filter(hasValue)) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(content));
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
// Discord CDN afiş bağlantılarının yerel kopyası (core/banner.js) varsa mesajın kendi ekine (attachment://) çevrilir
function localizeBanners(list) {
  for (const component of list ?? []) {
    const url = component?.media?.url ?? component?.accessory?.media?.url;
    const local = url ? banner.localUrl(url) : null;
    if (local) (component.media ?? component.accessory.media).url = local;
    localizeBanners(component?.items);
    localizeBanners(component?.components);
  }
}

const originalToJSON = ContainerBuilder.prototype.toJSON;
ContainerBuilder.prototype.toJSON = function toJSON(...args) {
  const json = originalToJSON.apply(this, args);
  if (Array.isArray(json.components)) {
    json.components = tidy(json.components);
    localizeBanners(json.components);
  }
  // Mavi (primary) "nötr bilgi" rengi gösterilmez: renk sadece durum bildirdiğinde (yeşil/sarı/kırmızı) kullanılır
  if (json.accent_color === config.colors.primary) delete json.accent_color;
  return json;
};

module.exports = {
  CV2,
  EPHEMERAL,
  EPHEMERAL_CV2,
  SILENT_CV2,
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
  hasValue,
  fields,
  field,
  hint,
  block,
  pageInfo,
  stamp,
  notice,
  alert,
  bannerGallery,
  panel,
  panelMessage,
  page,
  pagerRow,
  tabRow,
};
