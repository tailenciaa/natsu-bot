// Emoji ekleme mesajları: sağ tık ile açılan seçim paneli ve eklemenin sonucu
const {
  ActionRowBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { text, divider } = require('../../core/ui');

const IDS = { pick: 'emoji-sec' }; // emoji-sec:0, seçenek değeri: <hareketli 1/0>:<isim>:<id>

const MAX_PICK = 25;
const cdnUrl = (emoji) => `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=128`;

// Sağ tık > "Emojileri Sunucuya Ekle": mesajdaki emojilerin önizlemesi ve eklenecekleri seçme menüsü
function pickPanel(emojis) {
  const shown = emojis.slice(0, MAX_PICK);
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `### Emojileri Sunucuya Ekle\n**Mesajda ${emojis.length} emoji bulundu.**\n` +
          '-# Eklemek istediklerini aşağıdaki menüden seç, seçtiğin anda sunucuya eklenir.' +
          (emojis.length > MAX_PICK ? `\n-# Bir seferde en fazla ${MAX_PICK} emoji gösterilebilir.` : ''),
      ),
    )
    .addSeparatorComponents(divider())
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        shown.slice(0, 10).map((e) => new MediaGalleryItemBuilder().setURL(cdnUrl(e)).setDescription(`:${e.name}:`)),
      ),
    )
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

  const container = new ContainerBuilder().addTextDisplayComponents(
    text(`### ${title}${added.length ? `\n${added.map((e) => `${e} \`:${e.name}:\``).join('\n')}` : ''}`),
  );
  if (failed.length) {
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(failed.map((f) => `-# \`${f.name}\`: ${f.reason}`).join('\n')));
  }
  return container;
}

module.exports = { IDS, pickPanel, result };
