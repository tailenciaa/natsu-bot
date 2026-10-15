// Log sisteminin mesajları: tek tek log girdileri, grup sekmeli kategori paneli ve kurulum menüsü.
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
const { colors, text, divider, unix, page, tabRow, bannerGallery } = require('../../core/ui');
const categories = require('./categories');
const config = require('./config');
const { GROUPS, groupOf } = require('./groups');

const IDS = { select: 'logpanel', tab: 'logpanel:tab', setup: 'logkur', detail: 'logdetay' }; // logpanel:sec, logpanel:tab:<grup>, logkur:<eylem>

// Bir log girdisinin kutusu: başlık, uzun gri açıklama, çizgiyle ayrılmış kalın başlıklı bilgi bloğu (null/boş satırlar
// atlanır) ve en altta zaman damgası. Bütün log girdileri aynı genişlikte görünsün diye açıklama bilerek uzun tutulur.
const ENTRY_SUB =
  'Sunucuda gerçekleşen bu olay ilgili log kategorisine otomatik olarak kaydedildi; olayı kimin yaptığını, nerede gerçekleştiğini ve diğer ayrıntıları bu bilgilerde görebilirsin.';

// Bilgi satırları alt alta dizilir. Tek satırlar sıkışık kalsın; çok satırlı olanların (içerik, ekler gibi) önü ve
// sonu boş satırla ayrılsın ki bloklar birbirine karışıp iç içe görünmesin.
function stack(lines) {
  let body = '';
  let previousMulti = false;
  for (const line of lines) {
    const multi = line.includes('\n');
    if (body) body += multi || previousMulti ? '\n\n' : '\n';
    body += line;
    previousMulti = multi;
  }
  return body;
}

// details: butona basınca gösterilecek ek satırlar (mesaj ID'si, gönderilme zamanı vb.); verilmezse olay satırları gösterilir
function entry(color, title, lines, details) {
  const list = [].concat(lines).filter((line) => line != null && line !== '');
  const container = page({ title, sub: ENTRY_SUB, accent: colors[color] ?? colors.primary, blocks: [`### Olay Bilgileri\n${stack(list)}`] })
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

// "Detaylı Bilgi" butonuna basınca log alt başlığında açılan cevap: olayın tam zamanı, ilgili kişi/kanal ID'leri ve ek ayrıntılar
function detail(meta, categoryLabel) {
  const at = Math.floor(meta.at / 1000);
  const body = stack(meta.details.length ? meta.details : meta.lines);
  const users = [...new Set([...meta.lines.join('\n').matchAll(/<@!?(\d{15,})>/g)].map((m) => m[1]))];
  const channels = [...new Set([...meta.lines.join('\n').matchAll(/<#(\d{15,})>/g)].map((m) => m[1]))];
  const ids = [...users.map((id) => `**Kullanıcı ID:** \`${id}\``), ...channels.map((id) => `**Kanal ID:** \`${id}\``)];

  const blocks = [
    `**${meta.title}**\n**Kategori:** ${categoryLabel}\n**Tarih:** <t:${at}:D>\n**Saat:** <t:${at}:T> (<t:${at}:R>)`,
    `### Ayrıntılar\n${body}`.slice(0, 2800),
  ];
  if (ids.length) blocks.push(`### İlgili ID'ler\n${ids.slice(0, 8).join('\n')}`);

  return page({
    title: 'Log Detayı',
    sub: 'Seçtiğin log kaydının gerçekleştiği tarih ve saati, ilgili kişi ve kanalların ID bilgilerini ve olaya ait bütün ayrıntıları bu mesajda bulabilirsin.',
    blocks,
  });
}

// #log-paneli kanalına gönderilen panel: üstte log gruplarının sekmeleri, altta seçili grubun kategori menüsü.
// Sekmeye basınca panel kendi yerinde o grubun menüsüne döner; 15 kategori tek menüde birbirine karışmaz.
function panel(activeGroup = GROUPS[0].key) {
  const group = groupOf(activeGroup);
  const tabs = tabRow(Object.fromEntries(GROUPS.map((g) => [g.key, g.label])), group.key, (key) => `${IDS.tab}:${key}`);

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${IDS.select}:sec`)
    .setPlaceholder(`${group.label} kategorisi seç`)
    .addOptions(
      categories
        .filter((c) => c.group === group.key)
        .map((c) => new StringSelectMenuOptionBuilder().setLabel(c.label).setDescription(c.description).setValue(c.key)),
    );

  // Panel yalnızca bu mesaj için: başlık ve hemen altında açıklama, afiş, çizgi, sekmeler, çizgi, menü
  return page({
    title: `${botName} Log Paneli`,
    sub: 'Loglar **dört grubun** kendi kanalında, kategori kategori ayrılmış alt başlıklarda tutulur: önce bir **grup sekmesine**, sonra **kategori menüsünden** bir kategoriye bas; seçimin seni doğrudan o alt başlığa götürür.',
  })
    .addMediaGalleryComponents(bannerGallery(config.banner))
    .addSeparatorComponents(divider())
    .addActionRowComponents(tabs)
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(select));
}

// Panelden kategori seçilince gelen, alt başlığa giden bağlantı butonlu kısa cevap
function jumpLink(category, thread) {
  const group = groupOf(category.group);
  return new ContainerBuilder()
    .setAccentColor(colors.primary)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          text(
            `## ${category.label}\n` +
              'Seçtiğin log kategorisinin alt başlığı hazır; yanındaki butona basarak doğrudan o alt başlığa gidebilir ve ilgili olay kayıtlarını orada inceleyebilirsin.',
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
    .addTextDisplayComponents(text(`### Kategori Açıklaması\n${category.description}\n**Log grubu:** ${group.label} · ${group.description}`));
}

const button = (action, label, style, disabled = false) =>
  new ButtonBuilder().setCustomId(`${IDS.setup}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);

// /log menüsü: kanallar, panelin ve her kategorinin alt başlığının durumu grup grup gösterilir.
// groups: [{ group, channel, items: [{ category, thread }] }] (thread/channel yoksa kurulu değil),
// panelUrl: gönderilmiş panel mesajının bağlantısı, orphans: ana log kanalında kalan eski alt başlık sayısı
function setupView({ mainId, panelId, groups, panelUrl, note, orphans = 0 }) {
  const items = groups.flatMap((g) => g.items);
  const ready = items.filter((item) => item.thread).length;
  const fallback = groups.filter((g) => !g.channel || g.channel.id === mainId).length;
  const complete = ready === items.length && groups.every((g) => g.channel) && Boolean(panelUrl);

  const blocks = [
    `### Kurulum Durumu\n**${ready}/${items.length} log alt başlığı kurulu**${panelUrl ? '.' : ', panel gönderilmemiş.'}` +
      (fallback ? `\n**${fallback} grubun kanalı açılamadı**, logları ana log kanalına yazılıyor.` : ''),
    '### Kanallar\n' +
      `**Ana log kanalı:** <#${mainId}>\n` +
      `**Log paneli kanalı:** <#${panelId}>\n` +
      `**Panel:** ${panelUrl ? `[Mesaja git](${panelUrl})` : 'gönderilmemiş'}`,
    ...groups.map(
      ({ group, channel, items: list }) =>
        `### ${group.label} grubu\n` +
        `**Kanal:** ${channel ? `<#${channel.id}>` : 'açılamadı'}\n` +
        list.map(({ category, thread }) => `**${category.label}:** ${thread ? `<#${thread.id}>` : 'kurulu değil'}`).join('\n'),
    ),
  ];
  if (orphans) blocks.push(`### Eski Alt Başlıklar\nAna log kanalında eski düzeninden kalan **${orphans}** alt başlık var. Silinmedi, orada arşiv olarak duruyor.`);
  if (note) blocks.push(`### Son İşlem\n${note}`);

  return page({
    title: 'Log Kurulumu',
    sub: 'Log sisteminin kanal ve alt başlıklarını grup grup buradan görebilir; butonlarla eksikleri kurabilir, paneli yenileyebilir ya da hepsini sıfırlayabilirsin.',
    accent: complete ? colors.success : colors.warning,
    blocks,
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button('setup', 'Eksikleri Kur', ButtonStyle.Primary, ready === items.length),
        button('panel', panelUrl ? 'Paneli Yenile' : 'Paneli Gönder', ButtonStyle.Secondary),
        button('refresh', 'Yenile', ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(button('reset', 'Hepsini Sıfırla', ButtonStyle.Danger)));
}

// Sıfırlama onayı: alt başlıklar eski loglarıyla birlikte silineceği için sorulur
function resetConfirm() {
  return page({
    title: 'Loglar Sıfırlansın mı?',
    sub: 'Bu işlem bütün log alt başlıklarını silip yeniden açar; alt başlıkların içindeki eski loglar da silineceği için devam etmeden önce ne yapacağından emin olmalısın.',
    accent: colors.danger,
    blocks: [
      '### Uyarı\n**Tüm eski loglar kalıcı olarak silinir** ve bu işlem **geri alınamaz.**\n' +
        'Onaylıyorsan **Evet, Sıfırla** butonuna bas; vazgeçmek için **Vazgeç** butonuna bas.',
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        button('refresh', 'Vazgeç', ButtonStyle.Secondary),
        button('resetyes', 'Evet, Sıfırla', ButtonStyle.Danger),
      ),
    );
}

module.exports = { IDS, entry, detail, panel, jumpLink, setupView, resetConfirm };
