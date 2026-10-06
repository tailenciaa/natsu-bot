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

const IDS = { select: 'logpanel', setup: 'logkur', detail: 'logdetay' }; // logpanel:sec, logkur:<eylem>

// Bir log girdisinin kutusu: başlık, uzun gri açıklama, çizgiyle ayrılmış kalın başlıklı bilgi bloğu (null/boş satırlar
// atlanır) ve en altta zaman damgası. Bütün log girdileri aynı genişlikte görünsün diye açıklama bilerek uzun tutulur.
const ENTRY_SUB =
  'Sunucuda gerçekleşen bu olay ilgili log kategorisine otomatik olarak kaydedildi; olayı kimin yaptığını, nerede gerçekleştiğini ve diğer ayrıntıları bu bilgilerde görebilirsin.';

// details: butona basınca gösterilecek ek satırlar (mesaj ID'si, gönderilme zamanı vb.); verilmezse olay satırları gösterilir
function entry(color, title, lines, details) {
  const list = [].concat(lines).filter((line) => line != null && line !== '');
  const container = page({ title, sub: ENTRY_SUB, accent: colors[color] ?? colors.primary, blocks: [`**Olay Bilgileri**\n${list.join('\n')}`] })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# <t:${unix(Date.now())}:f>`))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.detail}:goster`).setLabel('Detaylı Bilgi').setStyle(ButtonStyle.Secondary),
      ),
    );
  container.logMeta = { title, lines: list, details: [].concat(details ?? []).filter((line) => line != null && line !== ''), at: Date.now() };
  return container;
}

// "Detaylı Bilgi" butonuna basınca sadece basana görünen cevap: olayın tam zamanı, ilgili kişi/kanal ID'leri ve ek ayrıntılar

function detail(meta, categoryLabel) {
  const at = Math.floor(meta.at / 1000);
  const body = (meta.details.length ? meta.details : meta.lines).join('\n');
  const users = [...new Set([...meta.lines.join('\n').matchAll(/<@!?(\d{15,})>/g)].map((m) => m[1]))];
  const channels = [...new Set([...meta.lines.join('\n').matchAll(/<#(\d{15,})>/g)].map((m) => m[1]))];
  const ids = [...users.map((id) => `**Kullanıcı ID:** \`${id}\``), ...channels.map((id) => `**Kanal ID:** \`${id}\``)];

  const blocks = [
    `**${meta.title}**\n**Kategori:** ${categoryLabel}\n**Tarih:** <t:${at}:D>\n**Saat:** <t:${at}:T> (<t:${at}:R>)`,
    `**Ayrıntılar**\n${body}`.slice(0, 2800),
  ];
  if (ids.length) blocks.push(`**İlgili ID'ler**\n${ids.slice(0, 8).join('\n')}`);

  return page({
    title: 'Log Detayı',
    sub: 'Seçtiğin log kaydının gerçekleştiği tarih ve saati, ilgili kişi ve kanalların ID bilgilerini ve olaya ait bütün ayrıntıları bu mesajda bulabilirsin.',
    blocks,
  });
}

// #log-paneli kanalına gönderilen, kategori seçim menülü panel
function panel() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`${IDS.select}:sec`)
    .setPlaceholder('Bir log kategorisi seç...')
    .addOptions(
      categories.map((c) =>
        new StringSelectMenuOptionBuilder().setLabel(c.label).setDescription(c.description).setValue(c.key),
      ),
    );

  return page({
    title: `${botName} Log Paneli`,
    sub: 'Sunucudaki bütün olay kayıtlarına tek yerden ulaşabilirsin; kayıtlar mesaj, ses, üye, moderasyon, sunucu ve takviye gibi kategorilere ayrılmış olarak ayrı alt başlıklarda tutulur.',
    accent: colors.primary,
    blocks: [
      '**Nasıl Kullanılır?**\n' +
        'Aşağıdaki menüden **bir log kategorisi seç**.\n' +
        'Sana o logun bulunduğu **alt başlığa giden bağlantı** gelir; kanalda aramana gerek kalmaz.',
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
            `## ${category.label}\n` +
              '-# Seçtiğin log kategorisinin alt başlığı hazır; yanındaki butona basarak doğrudan o alt başlığa gidebilir ve ilgili olay kayıtlarını orada inceleyebilirsin.',
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
    .addTextDisplayComponents(text(`**Kategori Açıklaması**\n${category.description}`));
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
      `**Ana log kanalı:** <#${mainId}>\n` +
      `**Log paneli kanalı:** <#${panelId}>\n` +
      `**Panel:** ${panelUrl ? `[Mesaja git](${panelUrl})` : 'gönderilmemiş'}`,
    `**Log Alt Başlıkları**\n${rows.map(({ category, thread }) => `**${category.label}:** ${thread ? `<#${thread.id}>` : 'kurulu değil'}`).join('\n')}`,
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
    title: 'Loglar Sıfırlansın mı?',
    sub: 'Bu işlem bütün log alt başlıklarını silip yeniden açar; alt başlıkların içindeki eski loglar da silineceği için devam etmeden önce ne yapacağından emin olmalısın.',
    accent: colors.danger,
    blocks: [
      '**Uyarı**\n**Tüm eski loglar kalıcı olarak silinir** ve bu işlem **geri alınamaz.**\n' +
        'Onaylıyorsan **Evet, Sıfırla** butonuna bas; vazgeçmek için **Vazgeç** butonuna bas.',
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button('resetyes', 'Evet, Sıfırla', ButtonStyle.Danger),
        button('refresh', 'Vazgeç', ButtonStyle.Secondary),
      ),
    );
}

module.exports = { IDS, entry, detail, panel, jumpLink, setupView, resetConfirm };
