// Log sisteminin mesajları: tek tek log girdileri ve kategori seçim paneli.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { botName, guildId, panelTitle } = require('../../core/config');
const { colors, text, divider, unix } = require('../../core/ui');
const categories = require('./categories');

const IDS = { select: 'logpanel' }; // logpanel:sec

// Bir log girdisinin kutusu: kalın başlık, altında bilgi satırları (null/boş olanlar atlanır), en altta zaman damgası.
function entry(color, title, lines) {
  const body = [].concat(lines).filter((line) => line != null && line !== '').join('\n');
  return new ContainerBuilder()
    .setAccentColor(colors[color] ?? colors.primary)
    .addTextDisplayComponents(text(`**${title}**\n${body}`))
    .addTextDisplayComponents(text(`-# <t:${unix(Date.now())}:f>`));
}

// #log-paneli kanalına gönderilen, kategori seçim menülü panel
function panel() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${IDS.select}:sec`)
    .setPlaceholder('Bir log kategorisi seç...')
    .addOptions(
      categories.map((c) =>
        new StringSelectMenuOptionBuilder().setLabel(c.label).setDescription(c.description).setEmoji(c.emoji).setValue(c.key),
      ),
    );

  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addTextDisplayComponents(
      text(
        `${panelTitle(`${botName} Log Paneli`)}\n` +
          '**Aradığın logu kanala girip aramak yerine aşağıdan seçebilirsin.**\n' +
          '-# Bir kategori seçince o logun bulunduğu alt başlığa giden bir bağlantı gelir.',
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
}

// Panelden kategori seçilince gelen, alt başlığa giden bağlantı butonlu kısa cevap
function jumpLink(category, thread) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(`**${category.emoji} ${category.label}**\n-# ${category.description}`))
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Alt Başlığa Git')
            .setURL(`https://discord.com/channels/${guildId}/${thread.id}`),
        ),
    );
}

module.exports = { IDS, entry, panel, jumpLink };
