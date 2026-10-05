// Emoji ekleme mesajları: sağ tık ile açılan seçim paneli ve eklemenin sonucu
const {
  ActionRowBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { colors, divider, page } = require('../../core/ui');

const IDS = { pick: 'emoji-sec' }; // emoji-sec:0, seçenek değeri: <hareketli 1/0>:<isim>:<id>

const MAX_PICK = 25;
const PREVIEW = 10; // önizleme galerisinde gösterilen en fazla emoji
const MAX_FAILED_SHOWN = 15; // sonuç mesajında gösterilen en fazla eklenemeyen emoji
const cdnUrl = (emoji) => `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=128`;
const shorten = (value, max) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

// Sağ tık > "Emojileri Sunucuya Ekle": mesajdaki emojilerin önizlemesi ve eklenecekleri seçme menüsü
function pickPanel(emojis) {
  const shown = emojis.slice(0, MAX_PICK);
  const notes = [];
  if (shown.length > PREVIEW) notes.push(`İlk ${PREVIEW} emojinin önizlemesi gösteriliyor.`);
  if (emojis.length > MAX_PICK) notes.push(`Bir seferde en fazla ${MAX_PICK} emoji eklenebilir.`);
  const container = page({
    title: 'Emojileri Sunucuya Ekle',
    sub: 'Seçtiğin mesajdaki özel emojileri sunucuna ekleyebilirsin; eklemek istediklerini menüden seç, seçtiğin anda emojiler sunucuya eklenir ve hemen kullanılabilir.',
    blocks: [`**Mesajda ${emojis.length} emoji bulundu.**${notes.length ? `\n${notes.map((n) => `-# ${n}`).join('\n')}` : ''}`],
  });
  return container
    .addSeparatorComponents(divider())
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        shown.slice(0, PREVIEW).map((e) => new MediaGalleryItemBuilder().setURL(cdnUrl(e)).setDescription(`:${e.name}:`)),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.pick}:0`)
          .setPlaceholder('Eklenecek emojileri seç')
          .setMinValues(1)
          .setMaxValues(shown.length)
          .addOptions(
            shown.map((e) =>
              new StringSelectMenuOptionBuilder()
                .setValue(`${e.animated ? 1 : 0}:${e.name}:${e.id}`)
                .setLabel(`:${e.name}:`)
                .setDescription(e.animated ? 'Hareketli emoji' : 'Sabit emoji'),
            ),
          ),
      ),
    );
}

// Eklemenin sonucu. added: eklenen GuildEmoji'ler, failed: [{ name, reason }]
// Renk durumu söyler: hepsi eklendiyse yeşil, kısmi eklendiyse sarı, hiçbiri eklenmediyse kırmızı
function result(added, failed) {
  const summary = [added.length ? `${added.length} emoji eklendi` : null, failed.length ? `${failed.length} emoji eklenemedi` : null].filter(Boolean).join(', ');
  const blocks = [`**${summary}.**`];
  if (added.length) blocks.push(`**Eklenen Emojiler**\n${added.map((e) => `${e} \`:${e.name}:\``).join('\n')}`);
  if (failed.length) {
    const lines = failed.slice(0, MAX_FAILED_SHOWN).map((f) => `\`${shorten(f.name, 40)}\`: ${f.reason}`);
    if (failed.length > MAX_FAILED_SHOWN) lines.push(`-# Ve ${failed.length - MAX_FAILED_SHOWN} tane daha.`);
    blocks.push(`**Eklenemeyenler**\n${lines.join('\n')}`);
  }
  return page({
    title: added.length ? 'Emoji Eklendi' : 'Emoji Eklenemedi',
    sub: added.length
      ? 'Başarıyla eklenen emojiler sunucuda hemen kullanıma hazır; eklenemeyenler varsa nedenleri ayrıca belirtildi, düzeltip tekrar deneyebilirsin.'
      : 'Hiçbir emoji sunucuya eklenemedi; nedenleri ayrıca belirtildi, sorunu düzeltip komutu ya da seçimi tekrar deneyebilirsin.',
    accent: !failed.length ? colors.success : added.length ? colors.warning : colors.danger,
    blocks,
  });
}

module.exports = { IDS, pickPanel, result };
