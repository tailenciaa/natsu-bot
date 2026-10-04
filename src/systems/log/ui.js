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
const { botName, guildId } = require('../../core/config');
const { colors, text, divider, unix, page } = require('../../core/ui');
const categories = require('./categories');

const IDS = { select: 'logpanel', setup: 'logkur' }; // logpanel:sec, logkur:<eylem>

// Bir log girdisinin kutusu: başlık, uzun gri açıklama, çizgiyle ayrılmış kalın başlıklı bilgi bloğu (null/boş satırlar
// atlanır) ve en altta zaman damgası. Bütün log girdileri aynı genişlikte görünsün diye açıklama bilerek uzun tutulur.
const ENTRY_SUB =
  'Sunucuda gerçekleşen bu olay ilgili log kategorisine otomatik olarak kaydedildi; olayı kimin yaptığı, nerede gerçekleştiği ve ayrıntıları aşağıdaki bilgilerde yer alıyor.';

function entry(color, title, lines) {
  const body = [].concat(lines).filter((line) => line != null && line !== '').join('\n');
  return page({ title, sub: ENTRY_SUB, accent: colors[color] ?? colors.primary, blocks: [`**Olay Bilgileri**\n${body}`] })
    .addSeparatorComponents(divider())
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

  return page({
    title: `${botName} Log Paneli`,
    sub: 'Sunucudaki bütün olay kayıtlarına tek yerden ulaşabilirsin; aşağıdaki menüden bir kategori seçtiğinde o logun tutulduğu alt başlığa giden bir bağlantı gönderilir.',
    accent: colors.primary,
    blocks: [
      '**Nasıl Kullanılır?**\n' +
        '- Aradığın logu kanala girip aramak yerine aşağıdan seçebilirsin.\n' +
        '-# Bir kategori seçince o logun bulunduğu alt başlığa giden bir bağlantı gelir.',
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
}

// Panelden kategori seçilince gelen, alt başlığa giden bağlantı butonlu kısa cevap
function jumpLink(category, thread) {
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          text(
            `## ${category.emoji} ${category.label}\n` +
              '-# Seçtiğin log kategorisinin tutulduğu alt başlık hazır; yanındaki butona basarak doğrudan o alt başlığa gidebilir ve ilgili olay kayıtlarını orada inceleyebilirsin.',
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('Alt Başlığa Git')
            .setURL(`https://discord.com/channels/${guildId}/${thread.id}`),
        ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Kategori Açıklaması**\n-# ${category.description}`));
}

const button = (action, label, style, disabled = false) =>
  new ButtonBuilder().setCustomId(`${IDS.setup}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);

// /log kur menüsü: kanallar, panelin ve her kategorinin alt başlığının durumu ve işlem butonları
// rows: [{ category, thread }] (thread yoksa o kategori kurulu değil), panelUrl: gönderilmiş panel mesajının bağlantısı
function setupView({ mainId, panelId, rows, panelUrl, note }) {
  const ready = rows.filter((r) => r.thread).length;
  const complete = ready === rows.length && Boolean(panelUrl);

  const blocks = [
    `**Kurulum Durumu**\n**${ready}/${rows.length} log alt başlığı kurulu${panelUrl ? '' : ', panel gönderilmemiş'}.**`,
    '**Kanallar**\n' +
      `- **Ana log kanalı:** <#${mainId}>\n` +
      `- **Log paneli kanalı:** <#${panelId}>\n` +
      `- **Panel:** ${panelUrl ? `✅ [mesaja git](${panelUrl})` : '❌ gönderilmemiş'}`,
    `**Log Alt Başlıkları**\n${rows.map(({ category, thread }) => `- ${category.emoji} **${category.label}:** ${thread ? `✅ <#${thread.id}>` : '❌ kurulu değil'}`).join('\n')}`,
  ];
  if (note) blocks.push(`**Son İşlem**\n${note}`);

  return page({
    title: 'Log Kurulumu',
    sub: 'Log sisteminin kanallarını, panelini ve her kategorinin alt başlığını buradan görebilir; aşağıdaki butonlarla eksikleri kurabilir, paneli yenileyebilir ya da hepsini sıfırlayabilirsin.',
    accent: complete ? colors.success : colors.warning,
    blocks,
  })
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
  return page({
    title: 'Log Alt Başlıkları Sıfırlansın mı?',
    sub: 'Bu işlem bütün log alt başlıklarını silip yeniden açar; alt başlıkların içindeki eski loglar da silineceği için işlem geri alınamaz, devam etmeden önce iyice emin olmalısın.',
    accent: colors.danger,
    blocks: ['**Uyarı**\nTüm log alt başlıkları silinip yeniden açılsın mı?\n-# Alt başlıkların içindeki eski loglar da silinir, geri alınamaz.'],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button('resetyes', 'Evet, Sıfırla', ButtonStyle.Danger),
        button('refresh', 'Vazgeç', ButtonStyle.Secondary),
      ),
    );
}

module.exports = { IDS, entry, panel, jumpLink, setupView, resetConfirm };
