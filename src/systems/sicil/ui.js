// Sicil mesajları. Sicil tek mesaj üzerinden gezilir:
//   Bölümler butonla seçilir (Genel, Destek Talepleri, Başvurular, Değerlendirmeler); her bölümde bir tablo ve tablodaki
//   kaydın detayını açan tek bir menü vardır. Detay, seçen kişiye ayrı ve sadece ona görünen mesaj olarak gelir; yetkisi
//   olana işlem butonları çıkar (ceza: süre ekle / kaldır / sil, değerlendirme: kaldır). Yeni ceza "Ceza Ver" ile verilir.
// Ayrıca işlem formları ve cezalı kişiye giden DM'ler.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder,
} = require('discord.js');
const { text, divider, unix, quote, shorten, page: pageBlocks, colors, pageInfo, pagerRow } = require('../../core/ui');
const { statusLabel: applicationStatus } = require('../basvuru/ui');
const { CATEGORIES, categoryOf, refText } = require('../degerlendirme/ui');
const config = require('./config');

const IDS = {
  navigate: 'sicil', // sicil:<kullanıcı>:<bölüm>:<sayfa>:<buton yeri> (bölüm, sayfa ve geri butonları)
  detail: 'sicil-detay', // sicil-detay:<kullanıcı>:<bölüm>:<sayfa> (kayıt detay menüsü)
  action: 'sicil-y', // sicil-y:<kullanıcı>:<işlem>:<kayıt>:<sayfa> (işlem butonları)
  form: 'sicil-f', // sicil-f:<kullanıcı>:<işlem>:<kayıt>:<sayfa> (işlem formları)
  duration: 'sicil-sure',
  reason: 'sicil-sebep',
};

const TABS = { genel: 'Genel', talepler: 'Destek Talepleri', basvurular: 'Başvurular', puan: 'Değerlendirmeler' };
// Bir sayfada en fazla bu kadar kayıt: Genel sekmesi yetkililerde 40 bileşen sınırına yaklaştığı için 6
const PAGE_SIZE = 6;

// Ceza türleri. timed: süre verilebilir; durationRequired: süre zorunlu
const TYPES = {
  uyari: { label: 'Uyarı', title: 'Uyarı Aldın', verb: 'uyarı aldın', description: 'Sicile uyarı kaydı ekler.' },
  mute: { label: 'Susturma', title: 'Susturuldun', verb: 'susturuldun', timed: true, durationRequired: true, description: 'Discord zaman aşımı uygular, en fazla 28 gün.' },
  jail: { label: 'Jail', title: "Jail'e Atıldın", verb: "jail'e atıldın", timed: true, description: 'Üyenin rollerini alıp jail rolü verir; süre bitince rolleri geri verir.' },
  ban: { label: 'Yasaklama', title: 'Sunucudan Yasaklandın', verb: 'yasaklandın', timed: true, description: 'Sunucudan yasaklar, süreliyse süre bitince kaldırır.' },
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function formatDuration(ms) {
  const parts = [
    [Math.floor(ms / DAY), 'gün'],
    [Math.floor((ms % DAY) / HOUR), 'saat'],
    [Math.round((ms % HOUR) / MINUTE), 'dakika'],
  ].filter(([amount]) => amount > 0);
  return parts.length ? parts.map(([amount, unit]) => `${amount} ${unit}`).join(' ') : '1 dakikadan az';
}

const lower = (value) => value.toLocaleLowerCase('tr-TR');
// Listelerde çok satırlı sebep/yorum tek satıra indirilip kısaltılır (detayda tam hali var)
const brief = (value, max = 80) => shorten(String(value ?? '').replace(/\s+/g, ' ').trim(), max);
const formatAverage = (list) =>
  (list.reduce((sum, r) => sum + r.score, 0) / list.length).toLocaleString('tr-TR', { maximumFractionDigits: 1 });

// Kategori bazında ortalamalar: "**Destek:** `4,8` (3) - **Görüşme:** `5` (1)"; değerlendirmesi olmayan kategori yazılmaz
function categoryAverages(ratings) {
  return Object.entries(CATEGORIES)
    .map(([key, category]) => [category, ratings.filter((r) => (r.category ?? 'destek') === key)])
    .filter(([, list]) => list.length)
    .map(([category, list]) => `**${category.short}:** \`${formatAverage(list)}\` (${list.length})`)
    .join(' - ');
}

// Liste satırlarındaki kısa durum: uyarılar süresiz olduğu için durum yazılmaz
const stateWord = (p) => (p.type === 'uyari' ? null : { active: 'Aktif', expired: 'Süresi doldu', lifted: 'Kaldırıldı' }[p.status] ?? null);

// Cezanın kısa durumu (uyarılar için yok)
function punishmentState(p) {
  if (p.type === 'uyari') return null;
  if (p.status === 'active') return p.expiresAt ? `**Aktif** - <t:${unix(p.expiresAt)}:R> bitiyor` : '**Aktif** - Süresiz';
  return p.status === 'expired' ? '**Süresi doldu**' : '**Kaldırıldı**';
}

const durationLabel = (p) => (p.type === 'uyari' ? null : p.duration ? formatDuration(p.duration) : 'Süresiz');

// Maddeler: "**Başlık:** değer (ek)", Discord'un madde işaretiyle
const code = (value) => `\`${value}\``;
const stat = (label, value, extra) => `**${label}:** ${value}${extra ? ` (${extra})` : ''}`;

// Tablolar: kod bloğunda sabit genişlikli sütunlar; uzun yazılar "…" ile kısaltılır, satır kaymaz.
// Sütun: [başlık, genişlik]; genişliği null olan sütun tek bir emoji taşır.
const TIME_ZONE = 'Europe/Istanbul';
const dateTime = (ms) =>
  new Date(ms).toLocaleString('tr-TR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateOnly = (ms) => new Date(ms).toLocaleDateString('tr-TR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });

const ticketResult = (t) => (t.closedAt ? (t.closeReason?.label ?? 'Kapatıldı') : 'Açık');

// Bölümlerdeki kayıtların listesi (kalın başlık + altında normal yazıyla özet satırı),
// detay menüsündeki seçenekleri ve boşken görünen yazı. Sebep ve yorumlar listede kısaltılır.
const LISTS = {
  genel: {
    title: 'Ceza Kayıtları',
    empty: '-# Ceza kaydı yok.',
    placeholder: 'Ceza seç',
    entry: (p) =>
      `**Ceza #${p.number} - ${TYPES[p.type].label}**\n${[stateWord(p) && `**${stateWord(p)}**`, dateTime(p.createdAt), brief(p.reason)].filter(Boolean).join(' - ')}`,
    option: (p) => ({
      id: p.id,
      label: `Ceza #${p.number}`,
      description: brief(`${TYPES[p.type].label} - ${[stateWord(p), p.reason].filter(Boolean).join(' - ')}`, 100),
    }),
  },
  talepler: {
    empty: '-# Destek talebi yok.',
    placeholder: 'Talep seç',
    entry: (t) => `**Talep #${t.number}**\n${dateOnly(t.createdAt)} - **${ticketResult(t)}** - ${brief(t.reason)}`,
    option: (t) => ({ id: t.threadId, label: `Talep #${t.number}`, description: brief(`${ticketResult(t)} - ${t.reason}`, 100) }),
  },
  basvurular: {
    empty: '-# Başvuru yok.',
    placeholder: 'Başvuru seç',
    entry: (a) => `**Başvuru #${a.number}**\n${dateOnly(a.createdAt)} - **${applicationStatus(a)}**`,
    option: (a) => ({ id: a.id, label: `Başvuru #${a.number}`, description: `${applicationStatus(a)} - ${dateOnly(a.createdAt)}` }),
  },
  puan: {
    empty: '-# Değerlendirme yok.',
    placeholder: 'Değerlendirme seç',
    entry: (r) => `**${r.score}/5 - ${categoryOf(r).short}**\n${dateOnly(r.ratedAt)}${r.comment ? ` - ${brief(r.comment)}` : ''}`,
    option: (r) => ({ id: r.id, label: `${r.score}/5 - ${categoryOf(r).short}`, description: brief(`${refText(r)}${r.comment ? ` - ${r.comment}` : ''}`, 100) }),
  },
};

// Başlık açık olan bölümü anlatır
const HEADINGS = {
  genel: 'sunucu üzerindeki geçmiş verilerine',
  talepler: 'açtığı destek taleplerine',
  basvurular: 'yaptığı yetkili başvurularına',
  puan: 'aldığı değerlendirmelere',
};

// hasItems: bölümde kayıt varsa listeden detay açılabileceği de söylenir
function header(user, tab, hasItems) {
  return new SectionBuilder()
    .addTextDisplayComponents(
      text(
        `## Kullanıcı Sicili\n<@${user.id}> kullanıcısının ${HEADINGS[tab]} buradan ulaşabilirsin. Bölümler arasında **butonlarla geçiş** yapabilirsin${hasItems ? '; listeden bir kaydın ayrıntılarını da açabilirsin' : '; bu bölümde henüz gösterilecek bir kayıt yok'}.`,
      ),
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 })));
}

// Başlık, varsa işlem sonucu ve ayırıcı; her görünüm bununla başlar
function frame(user, tab, banner, hasItems) {
  const container = new ContainerBuilder().addSectionComponents(header(user, tab, hasItems));
  if (banner) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(banner));
  return container.addSeparatorComponents(divider());
}

// Ana sayfadaki istatistik paneli: kısa özet. Aktif cezalar hemen alttaki tabloda göründüğü için ayrıca durum yazılmaz.
// Toplam İşlem Sayısı: kişinin yetkili olarak verdiği cezalar ve üstlendiği destek talepleri.
function statsPanel({ punishments, claimedCount, ratings, showRatings, givenCount }) {
  const points = punishments.reduce((sum, p) => sum + (config.penaltyPoints[p.type] ?? 0), 0);
  const tier = [...config.pointTiers].reverse().find((t) => points >= t.points);
  const lines = [
    stat('Toplam Ceza Puanı', code(points), tier ? tier.label : undefined),
    stat('Toplam İşlem Sayısı', code(givenCount + claimedCount)),
  ];
  if (showRatings) {
    lines.push(stat('Yetkili Puanı', code(ratings.length ? `${formatAverage(ratings)} / 5` : '-'), `Değerlendirme: ${code(ratings.length)}`));
  }
  return `**İstatistik Paneli**\n${lines.join('\n')}`;
}

// Bölüm butonları: açık olan bölüm yeşil (sıralama mesajındaki dönem butonları gibi)
function tabRow(user, tabs, current) {
  return new ActionRowBuilder().addComponents(
    tabs.map((key) =>
      new ButtonBuilder()
        .setCustomId(`${IDS.navigate}:${user.id}:${key}:0:tab`)
        .setLabel(TABS[key])
        .setStyle(key === current ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  );
}

// Herkese açık sicil. Düzen sıralama mesajıyla aynı: başlık, bölüm butonları, içerik, en altta toplam kayıt ve sayfalar.
// view: { user, tab, page, punishments, tickets, applications, ratings, claimedCount, givenCount, showRatings,
//         allowedTypes (verebileceği ceza türleri), canRemoveRatings, banner }
function sicil(view) {
  const { user, ratings } = view;
  const tabs = Object.keys(TABS).filter((key) => key !== 'puan' || view.showRatings);
  const tab = tabs.includes(view.tab) ? view.tab : 'genel';
  const list = LISTS[tab];
  const items = { genel: view.punishments, talepler: view.tickets, basvurular: view.applications, puan: ratings }[tab];

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(Math.max(view.page, 0), pageCount - 1);
  const start = page * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  const container = frame(user, tab, view.banner, items.length > 0).addActionRowComponents(tabRow(user, tabs, tab)).addSeparatorComponents(divider());
  if (tab === 'genel') container.addTextDisplayComponents(text(statsPanel(view))).addSeparatorComponents(divider());

  // Kategori dağılımı tek kategori varken ortalamanın aynısı olacağı için sadece birden fazla kategoride yazılır
  const multipleCategories = new Set(ratings.map((r) => r.category ?? 'destek')).size > 1;
  const intro =
    tab === 'puan' && ratings.length
      ? `**Değerlendirme Özeti**\n${stat('Ortalama Puan', code(`${formatAverage(ratings)} / 5`), `Değerlendirme: ${code(ratings.length)}`)}\n` +
        (multipleCategories ? categoryAverages(ratings) : '')
      : '';
  // Genel'de listenin başlığı var (istatistiklerden ayrılsın diye); diğer bölümlerde bölümün adı zaten üstteki başlıkta.
  // Yardım menüsündekiyle aynı düzen: her kayıt kendi metin bloğu, aralarında ince çizgi.
  if (tab === 'genel') container.addTextDisplayComponents(text(`**${list.title}**`)).addSeparatorComponents(divider());
  if (intro) container.addTextDisplayComponents(text(intro.trimEnd())).addSeparatorComponents(divider());
  if (!items.length) {
    container.addTextDisplayComponents(text(list.empty));
  } else {
    pageItems.forEach((item, index) => {
      if (index > 0) container.addSeparatorComponents(divider());
      container.addTextDisplayComponents(text(list.entry(item)));
    });
  }

  // Tablodaki kaydın detayı
  if (pageItems.length) {
    container.addSeparatorComponents(divider()).addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.detail}:${user.id}:${tab}:${page}`)
          .setPlaceholder(list.placeholder)
          .addOptions(
            pageItems.map((item) => {
              const o = list.option(item);
              const option = new StringSelectMenuOptionBuilder()
                .setValue(o.id)
                .setLabel(shorten(o.label, 100))
                .setDescription(shorten(o.description, 100));
              return o.emoji ? option.setEmoji(o.emoji) : option;
            }),
          ),
      ),
    );
  }

  // Toplam kayıt, sayfa ve sayfa butonları (kayıt yoksa gösterilmez)
  if (items.length) {
    const nav = (target, slot) => `${IDS.navigate}:${user.id}:${tab}:${target}:${slot}`;
    container
      .addSeparatorComponents(divider())
      .addTextDisplayComponents(text(pageInfo(page, pageCount, items.length)))
      .addActionRowComponents(pagerRow({ prevId: nav(page - 1, 'prev'), nextId: nav(page + 1, 'next'), page, pageCount }));
  }

  // Farklı iş yapan "Ceza Ver" çizgiyle ayrılır
  if (tab === 'genel' && view.allowedTypes.length) {
    container
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`${IDS.action}:${user.id}:ver:0:${page}`).setLabel('Ceza Ver').setStyle(ButtonStyle.Danger),
        ),
      );
  }
  return container;
}

// Detaylar menüyü seçen kişiye ayrı (sadece ona görünen) mesaj olarak gelir. Talep, başvuru ve değerlendirmelerde
// yeni bir mesaj tasarlanmaz, kaydın zaten başka kanalda duran mesajı gösterilir. İşlem butonlarının customId'sindeki
// messageId, işlemden sonra tablosu güncellenecek sicil mesajıdır.
const actionButton = (userId, action, id, messageId, label, style) =>
  new ButtonBuilder().setCustomId(`${IDS.action}:${userId}:${action}:${id}:${messageId}`).setLabel(label).setStyle(style);

// Başka bir sistemin mesajını detay olarak göstermek için salt okunur hale getirir: o mesajın kendi işlem butonları
// (talebi üstlen, onayla, itiraz et...) buradan basılırsa asıl mesaj yerine bu mesajı güncelleyeceği için çıkarılır,
// sadece bağlantı butonları kalır. actions: çizgiyle ayrılıp en alta eklenecek sicil işlem butonları.
function readOnly(container, actions = []) {
  const json = container.toJSON();
  const kept = json.components
    .map((c) =>
      c.type === ComponentType.ActionRow
        ? { ...c, components: c.components.filter((b) => b.type === ComponentType.Button && b.style === ButtonStyle.Link) }
        : c,
    )
    .filter((c) => c.type !== ComponentType.ActionRow || c.components.length);
  if (actions.length) {
    kept.push(divider().toJSON(), new ActionRowBuilder().addComponents(actions).toJSON());
  }
  // Çıkarılan butonlardan geriye kalan art arda ya da sondaki çizgiler temizlenir
  json.components = kept.filter(
    (c, i) => c.type !== ComponentType.Separator || (kept[i + 1] && kept[i + 1].type !== ComponentType.Separator),
  );
  return json;
}

// Ceza detayı (cezaların başka yerde mesajı yok); canEdit ise süre ekle / kaldır / sil butonları
function punishmentDetail(p, messageId, canEdit, banner) {
  const lines = [
    stat('Kullanıcı', `<@${p.userId}>`),
    punishmentState(p) && stat('Durum', punishmentState(p)),
    stat('Veren', `<@${p.by}> - <t:${unix(p.createdAt)}:F>`),
    p.type !== 'uyari' && stat('Süre', code(durationLabel(p))),
    p.status === 'active' && p.expiresAt && stat('Bitiş', `<t:${unix(p.expiresAt)}:F>`),
    p.extensions.length && stat('Uzatmalar', p.extensions.map((e) => `${code(`+${formatDuration(e.added)}`)} <@${e.by}>`).join(', ')),
    p.status === 'lifted' && stat('Kaldıran', `<@${p.liftedBy}> - <t:${unix(p.endedAt)}:F>`),
    p.status === 'expired' && stat('Sona Erdi', `<t:${unix(p.endedAt)}:F>`),
  ].filter(Boolean);

  const container = new ContainerBuilder();
  if (banner) container.addTextDisplayComponents(text(banner)).addSeparatorComponents(divider());
  container
    .addTextDisplayComponents(
      text(
        `## Ceza #${p.number} - ${TYPES[p.type].label}\nCezanın kim tarafından, ne zaman ve hangi sebeple verildiğini, süresini ve şu anki durumunu burada görebilirsin. Yetkin varsa **süre ekleyebilir**, **cezayı kaldırabilir** ya da **sicilden silebilirsin**.`,
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Ceza Bilgileri**\n${lines.join('\n')}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Sebep**\n${quote(p.reason)}`));
  if (p.liftReason) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`**Kaldırma Sebebi**\n${quote(p.liftReason)}`));

  const actions = [];
  if (canEdit && p.status === 'active' && p.expiresAt) actions.push(actionButton(p.userId, 'sure', p.id, messageId, 'Süre Ekle', ButtonStyle.Primary));
  if (canEdit && p.status === 'active' && p.type !== 'uyari') actions.push(actionButton(p.userId, 'kaldir', p.id, messageId, 'Cezayı Kaldır', ButtonStyle.Success));
  if (canEdit) actions.push(actionButton(p.userId, 'sil', p.id, messageId, 'Sicilden Sil', ButtonStyle.Danger));
  if (actions.length) container.addSeparatorComponents(divider()).addActionRowComponents(new ActionRowBuilder().addComponents(actions));
  return container;
}

// Değerlendirmeyi sicilden kaldırma butonu (değerlendirme detayının altına eklenir)
const ratingRemoveButton = (userId, rating, messageId) =>
  actionButton(userId, 'puansil', rating.id, messageId, 'Değerlendirmeyi Kaldır', ButtonStyle.Danger);

// "Ceza Ver" ile açılan, sadece yetkilinin gördüğü tür seçimi. messageId: güncellenecek sicil mesajı
function typePicker(user, messageId, allowedTypes) {
  return pageBlocks({
    title: 'Ceza Ver',
    sub: 'Vermek istediğin ceza türünü menüden seçersin. Sonraki adımda sebebi ve gerekiyorsa süreyi bir formda yazarsın; ceza kişinin siciline işlenir ve kişiye DM ile bildirilir.',
    blocks: [`**Ceza Verilecek Üye**\n<@${user.id}> için **ceza türünü** menüden seç.`],
  })
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.action}:${user.id}:tur:0:${messageId}`)
          .setPlaceholder('Ceza türü seç')
          .addOptions(
            allowedTypes.map((type) =>
              new StringSelectMenuOptionBuilder()
                .setValue(type)
                .setLabel(TYPES[type].label)
                .setDescription(type === 'jail' && !config.roles.jail ? 'Jail rolü ayarlanmamış.' : TYPES[type].description),
            ),
          ),
      ),
    );
}

const reasonInput = (placeholder) =>
  new LabelBuilder()
    .setLabel('Sebep')
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(IDS.reason)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(placeholder)
        .setMinLength(3)
        .setMaxLength(500)
        .setRequired(true),
    );

const durationInput = (label, description, required) =>
  new LabelBuilder()
    .setLabel(label)
    .setDescription(description)
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(IDS.duration)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Örn: 30dk, 2sa, 7g')
        .setMaxLength(30)
        .setRequired(required),
    );

// Ceza verme formu; messageId: işlem bitince güncellenecek sicil mesajı
function punishModal(user, type, messageId) {
  const t = TYPES[type];
  const modal = new ModalBuilder()
    .setCustomId(`${IDS.form}:${user.id}:ceza:${type}:${messageId}`)
    .setTitle(`${t.label} Ver`)
    .addTextDisplayComponents(text(`**${user.username}** kullanıcısına **${lower(t.label)}** cezası veriyorsun. Kişiye **DM** ile sebep ve süre bildirilir.`));
  if (t.timed) {
    modal.addLabelComponents(
      durationInput(
        'Süre',
        t.durationRequired ? 'dk: dakika, sa: saat, g: gün - en fazla 28 gün' : 'dk: dakika, sa: saat, g: gün - boş bırakırsan süresiz',
        Boolean(t.durationRequired),
      ),
    );
  }
  return modal.addLabelComponents(reasonInput('Örn: Sohbette küfür ve hakaret, daha önce uyarılmıştı.'));
}

// messageId: işlemden sonra tablosu güncellenecek sicil mesajı
const formId = (userId, action, id, messageId) => `${IDS.form}:${userId}:${action}:${id}:${messageId}`;

function extendModal(p, messageId) {
  return new ModalBuilder()
    .setCustomId(formId(p.userId, 'sure', p.id, messageId))
    .setTitle('Süre Ekle')
    .addTextDisplayComponents(
      text(`**Ceza #${p.number} - ${TYPES[p.type].label}** cezasına süre ekliyorsun.${p.expiresAt ? `\nŞu anki bitiş: **${dateTime(p.expiresAt)}**` : ''}`),
    )
    .addLabelComponents(durationInput('Eklenecek süre', 'dk: dakika, sa: saat, g: gün', true));
}

function liftModal(p, messageId) {
  return new ModalBuilder()
    .setCustomId(formId(p.userId, 'kaldir', p.id, messageId))
    .setTitle('Cezayı Kaldır')
    .addTextDisplayComponents(text(`**Ceza #${p.number} - ${TYPES[p.type].label}** cezası şimdi **kaldırılacak**, kayıt sicilde kalacak.`))
    .addLabelComponents(reasonInput('Örn: İtirazı haklı bulundu, erken kaldırıldı.'));
}

function deleteModal(p, messageId) {
  return new ModalBuilder()
    .setCustomId(formId(p.userId, 'sil', p.id, messageId))
    .setTitle('Sicilden Sil')
    .addTextDisplayComponents(
      text(
        `**Ceza #${p.number} - ${TYPES[p.type].label}** kaydı sicilden **tamamen silinecek**.` +
          (p.status === 'active' && p.type !== 'uyari' ? '\nCeza sürdüğü için önce **kaldırılacak**.' : ''),
      ),
    )
    .addLabelComponents(reasonInput('Örn: Yanlış kişiye verilmişti.'));
}

function ratingRemoveModal(userId, rating, messageId) {
  return new ModalBuilder()
    .setCustomId(formId(userId, 'puansil', rating.id, messageId))
    .setTitle('Değerlendirmeyi Kaldır')
    .addTextDisplayComponents(text(`**${rating.score}/5 - ${refText(rating)}** değerlendirmesi sicilden **kaldırılacak**.`))
    .addLabelComponents(reasonInput('Örn: Üye yanlış yetkiliyi puanlamış.'));
}

// Cezalı kişiye giden DM'ler
function punishDm(p, guildName) {
  const t = TYPES[p.type];
  const detail = p.expiresAt
    ? `**Süre:** ${formatDuration(p.duration)} - <t:${unix(p.expiresAt)}:R> sona erecek.`
    : p.type === 'uyari'
      ? 'Uyarılar **sicilinde tutulur**; tekrarlanması ceza almana neden olabilir.'
      : '**Süre:** Süresiz.';
  return pageBlocks({
    title: t.title,
    sub: 'Sunucudaki davranışların nedeniyle hakkında bir işlem uygulandı. Cezanın türü, süresi ve sebebi aşağıda; bir daha yaşanmaması için mesajı dikkatle oku.',
    accent: colors[p.type === 'uyari' ? 'warning' : 'danger'],
    blocks: [
      `**Ceza Bilgisi**\n**${guildName} sunucusunda ${t.verb}.**\n${detail}`,
      `**Sebep**\n${quote(p.reason)}`,
      `-# Ceza #${p.number} - <t:${unix(p.createdAt)}:F>`,
    ],
  });
}

function liftDm(p, guildName) {
  return pageBlocks({
    title: 'Cezan Sona Erdi',
    sub: 'Sunucudaki cezan sona erdi, artık kısıtlaman yok. Hangi cezanın neden bittiğini aşağıda görebilirsin; kurallara uymaya devam ettiğin sürece iyi eğlenceler.',
    accent: colors.success,
    blocks: [
      `**Ceza Bilgisi**\n**${guildName} sunucusundaki ${lower(TYPES[p.type].label)} cezan ${p.status === 'expired' ? 'süresi dolduğu için sona erdi' : 'kaldırıldı'}.**`,
      `-# Ceza #${p.number} - <t:${unix(Date.now())}:F>`,
    ],
  });
}

function extendDm(p, extra, guildName) {
  return pageBlocks({
    title: 'Cezanın Süresi Uzatıldı',
    sub: 'Sunucudaki aktif cezanın süresine ekleme yapıldı. Eklenen süreyi ve cezanın yeni bitiş zamanını aşağıda görebilirsin; kurallara dikkat etmeni bekleriz.',
    accent: colors.warning,
    blocks: [
      `**Ceza Bilgisi**\n**${guildName} sunucusundaki ${lower(TYPES[p.type].label)} cezana ${formatDuration(extra)} eklendi.**\n` +
        `**Yeni bitiş:** <t:${unix(p.expiresAt)}:F> (<t:${unix(p.expiresAt)}:R>)`,
      `-# Ceza #${p.number} - <t:${unix(Date.now())}:F>`,
    ],
  });
}

// Hızlı ceza komutlarının (/ban, /jail, /mute, /uyari...) herkese açık sonuç mesajları ve hata mesajı (Components V2)
const userLine = (p) => `**Kullanıcı:** <@${p.userId}>`;

function commandResult(p) {
  const t = TYPES[p.type];
  const duration = durationLabel(p);
  return pageBlocks({
    title: `${t.label} Uygulandı`,
    sub: 'Ceza uygulandı ve kullanıcının siciline işlendi. Kaydı /sicil komutuyla görebilir, ceza sürüyorsa numarasıyla /ceza-kaldir komutunu kullanarak kaldırabilirsin.',
    accent: colors[p.type === 'uyari' ? 'warning' : 'danger'],
    blocks: [
      [userLine(p), `**Yetkili:** <@${p.by}>`, `**Ceza:** ${t.label}`, duration ? `**Süre:** ${duration}` : null, p.expiresAt ? `**Bitiş:** <t:${unix(p.expiresAt)}:R>` : null]
        .filter(Boolean)
        .join('\n'),
      `**Sebep**\n${quote(p.reason)}`,
      `-# Ceza #${p.number} - <t:${unix(p.createdAt)}:F>`,
    ],
  });
}

function commandLift(p, byId, reason) {
  return pageBlocks({
    title: `${TYPES[p.type].label} Kaldırıldı`,
    sub: 'Kullanıcının aktif cezası yetkili tarafından kaldırıldı ve sicilinde sona ermiş olarak işlendi. Kaldıran yetkili ve kaldırma sebebi aşağıda.',
    accent: colors.success,
    blocks: [
      [userLine(p), `**Yetkili:** <@${byId}>`, `**Ceza:** ${TYPES[p.type].label} #${p.number}`].join('\n'),
      `**Sebep**\n${quote(reason)}`,
      `-# <t:${unix(Date.now())}:F>`,
    ],
  });
}

function commandDelete(p, byId, reason) {
  return pageBlocks({
    title: 'Ceza Kaydı Silindi',
    sub: 'Ceza kaydı sicilden tamamen silindi ve artık kullanıcının sicilinde görünmeyecek. Silinen kaydın bilgisi, silen yetkili ve sebep aşağıda.',
    blocks: [
      [userLine(p), `**Yetkili:** <@${byId}>`, `**Ceza:** ${TYPES[p.type].label} #${p.number}`].join('\n'),
      `**Sebep**\n${quote(reason)}`,
      `-# <t:${unix(Date.now())}:F>`,
    ],
  });
}

module.exports = {
  IDS,
  TYPES,
  formatDuration,
  sicil,
  readOnly,
  punishmentDetail,
  ratingRemoveButton,
  typePicker,
  punishModal,
  extendModal,
  liftModal,
  deleteModal,
  ratingRemoveModal,
  punishDm,
  liftDm,
  extendDm,
  commandResult,
  commandLift,
  commandDelete,
};
