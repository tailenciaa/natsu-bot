// Emoji ekleme mesajları: sağ tık ile açılan seçim paneli ve eklemenin sonucu
const {
  ActionRowBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { divider, page } = require('../../core/ui');

const IDS = { pick: 'emoji-sec' }; // emoji-sec:0, seçenek değeri: <hareketli 1/0>:<isim>:<id>

const MAX_PICK = 25;
const cdnUrl = (emoji) => `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=128`;

// Sağ tık > "Emojileri Sunucuya Ekle": mesajdaki emojilerin önizlemesi ve eklenecekleri seçme menüsü
function pickPanel(emojis) {
  const shown = emojis.slice(0, MAX_PICK);
  const container = page({
    title: 'Emojileri Sunucuya Ekle',
    sub: 'Seçtiğin mesajdaki özel emojileri sunucuna ekleyebilirsin; eklemek istediklerini aşağıdaki menüden seç, seçtiğin anda emojiler sunucuya eklenir ve hemen kullanılabilir.',
    blocks: [
      `**Bulunan Emojiler**\n${emojis.length} emoji` +
        (emojis.length > MAX_PICK ? `\n-# Bir seferde en fazla ${MAX_PICK} emoji gösterilebilir.` : ''),
    ],
  });
  return container
    .addSeparatorComponents(divider())
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        shown.slice(0, 10).map((e) => new MediaGalleryItemBuilder().setURL(cdnUrl(e)).setDescription(`:${e.name}:`)),
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
function result(added, failed) {
  const total = added.length + failed.length;
  const title = !failed.length
    ? added.length > 1
      ? `${added.length} Emoji Eklendi`
      : 'Emoji Eklendi'
    : added.length
      ? `Emojiler Eklendi (${added.length}/${total})`
      : 'Emoji Eklenemedi';

  const blocks = [];
  if (added.length) blocks.push(`**Eklenen Emojiler**\n${added.map((e) => `${e} \`:${e.name}:\``).join('\n')}`);
  if (failed.length) blocks.push(`**Eklenemeyenler**\n${failed.map((f) => `-# \`${f.name}\`: ${f.reason}`).join('\n')}`);
  return page({
    title,
    sub: 'Seçtiğin emojilerin sunucuya eklenme sonucunu aşağıda görebilirsin; başarıyla eklenenler hemen kullanıma hazırdır, eklenemeyenlerin nedeni ise altlarında ayrıca belirtilir.',
    blocks,
  });
}

module.exports = { IDS, pickPanel, result };
