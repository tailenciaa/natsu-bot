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

const IDS = { select: 'logpanel', setup: 'logkur' }; // logpanel:sec, logkur:<eylem>

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

const button = (action, label, style, disabled = false) =>
  new ButtonBuilder().setCustomId(`${IDS.setup}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);

// /log kur menüsü: kanallar, panelin ve her kategorinin alt başlığının durumu ve işlem butonları
// rows: [{ category, thread }] (thread yoksa o kategori kurulu değil), panelUrl: gönderilmiş panel mesajının bağlantısı
function setupView({ mainId, panelId, rows, panelUrl, note }) {
  const ready = rows.filter((r) => r.thread).length;
  const complete = ready === rows.length && Boolean(panelUrl);

  const container = new ContainerBuilder()
    .setAccentColor(complete ? colors.success : colors.warning)
    .addTextDisplayComponents(
      text(
        `${panelTitle('Log Kurulumu')}\n` +
          `**${ready}/${rows.length} log alt başlığı kurulu${panelUrl ? '' : ', panel gönderilmemiş'}.**\n` +
          '-# Butonlarla eksikleri kurabilir, paneli yenileyebilir ya da hepsini sıfırlayabilirsin.',
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**Ana log kanalı:** <#${mainId}>\n` +
          `**Log paneli kanalı:** <#${panelId}>\n` +
          `**Panel:** ${panelUrl ? `✅ [mesaja git](${panelUrl})` : '❌ gönderilmemiş'}`,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(rows.map(({ category, thread }) => `${category.emoji} **${category.label}** · ${thread ? `✅ <#${thread.id}>` : '❌ kurulu değil'}`).join('\n')),
    );

  if (note) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(note));

  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button('setup', 'Eksikleri Kur', ButtonStyle.Primary, ready === rows.length),
        button('panel', panelUrl ? 'Paneli Yenile' : 'Paneli Gönder', ButtonStyle.Secondary),
        button('reset', 'Hepsini Sıfırla', ButtonStyle.Danger),
        button('refresh', 'Yenile', ButtonStyle.Secondary),
      ),
    );
}

// Sıfırlama onayı: alt başlıklar eski loglarıyla birlikte silineceği için sorulur
function resetConfirm() {
  return new ContainerBuilder()
    .setAccentColor(colors.danger)
    .addTextDisplayComponents(
      text(
        '**Tüm log alt başlıkları silinip yeniden açılsın mı?**\n' +
          '-# Alt başlıkların içindeki eski loglar da silinir, geri alınamaz.',
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button('resetyes', 'Evet, Sıfırla', ButtonStyle.Danger),
        button('refresh', 'Vazgeç', ButtonStyle.Secondary),
      ),
    );
}

module.exports = { IDS, entry, panel, jumpLink, setupView, resetConfirm };
