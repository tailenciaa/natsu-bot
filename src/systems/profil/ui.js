// Profil mesajı: kart görseli (card.js) ve sahibiyse kartın altında düzenleme kontrolleri (biyografi/unvan, renk,
// kapak görseli, tema, panel görünümü, sıfırlama) ile vitrin, rozet ve mağaza sayfaları. Kontroller aynı mesajı
// günceller; sahibi olmayanlar sadece görseli görür.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const core = require('../../core/ui');
const { coverOf } = require('./kapak');
const { THEMES } = require('./themes');

// Hepsi profil-ayar:<eylem> ile gelir; index.js'te tek önek altında karşılanır
const IDS = {
  prefix: 'profil-ayar',
  bio: 'profil-ayar:bio',
  color: 'profil-ayar:renk',
  banner: 'profil-ayar:kapak',
  reset: 'profil-ayar:sifirla',
  theme: 'profil-ayar:tema',
  vitrin: 'profil-ayar:vitrin',
  vitrinForm: 'profil-ayar:vitrin-form',
  vitrinLinks: 'profil-ayar:vitrin-baglanti',
  featured: 'profil-ayar:one-cikan',
  gorunum: 'profil-ayar:gorunum',
  gorunumBtn: 'profil-ayar:gorunum-btn:', // + azalt | artir | sifirla
  rozet: 'profil-ayar:rozetler',
  shop: 'profil-ayar:magaza',
  shopTab: 'profil-ayar:magaza:', // + cerceve | tema | kapak | rozet
  buy: 'profil-ayar:al:', // + tur:anahtar
  wear: 'profil-ayar:giy:', // + tur:anahtar
  kapakBtn: 'profil-ayar:kapak-btn:', // + buyut | kucult | sola | saga | yukari | asagi | sifirla | gorsel | kaldir
  bioForm: 'profil-ayar:bio-form',
  colorForm: 'profil-ayar:renk-form',
  bannerForm: 'profil-ayar:kapak-form',
};

const { text, divider, fields, stamp } = core;

// currentTheme: kayıtlı tema (yoksa ya da silinmişse menüde hiçbir seçenek seçili gelmez)
function profile(imageName, editable, currentTheme = null, description = 'Profil kartı') {
  const container = new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`).setDescription(description)),
  );
  if (!editable) return container;

  return container
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.bio).setLabel('Biyografi').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.vitrin).setLabel('Vitrin').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.rozet).setLabel('Rozetler').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.shop).setLabel('Mağaza').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.reset).setLabel('Sıfırla').setStyle(ButtonStyle.Danger),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.color).setLabel('Renk').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.gorunum).setLabel('Görünüm').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.banner).setLabel('Kapağı Düzenle').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(IDS.theme)
          .setPlaceholder('Tema seç')
          .addOptions(
            Object.entries(THEMES).map(([key, theme]) =>
              new StringSelectMenuOptionBuilder()
                .setValue(key)
                .setLabel(theme.label)
                .setDescription(theme.price ? `Mağazada ${theme.price.toLocaleString('tr-TR')} coin` : theme.description)
                .setDefault(THEMES[currentTheme] ? key === currentTheme : false),
            ),
          ),
      ),
    );
}

const input = (id, style, maxLength, value, placeholder) => {
  const field = new TextInputBuilder().setCustomId(id).setStyle(style).setMaxLength(maxLength).setRequired(false);
  if (value) field.setValue(value);
  if (placeholder) field.setPlaceholder(placeholder);
  return field;
};

const bioModal = (current) =>
  new ModalBuilder()
    .setCustomId(IDS.bioForm)
    .setTitle('Biyografi ve Unvanı Düzenle')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Biyografi')
        .setDescription('Kartında en fazla iki satır görünür.')
        .setTextInputComponent(input('bio', TextInputStyle.Paragraph, 160, current.bio, 'Örn: Anime izlemeyi ve gece sohbetlerini severim.')),
      new LabelBuilder()
        .setLabel('Unvan')
        .setDescription('Adının altında küçük bir etiket olarak görünür.')
        .setTextInputComponent(input('unvan', TextInputStyle.Short, 24, current.title, 'Örn: Anime Sever')),
    ]);

const colorModal = (current) =>
  new ModalBuilder()
    .setCustomId(IDS.colorForm)
    .setTitle('Profil Rengini Seç')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Vurgu rengi (hex kod)')
        .setDescription('Çubuklar, halka ve unvan bu renkte çizilir. Boşsa tema rengi kullanılır. Koyu renkler açılır.')
        .setTextInputComponent(
          input('renk', TextInputStyle.Short, 7, current.color === null || current.color === undefined ? null : `#${current.color.toString(16).padStart(6, '0')}`, 'Örn: #ff5599'),
        ),
    ]);

const bannerModal = (current) =>
  new ModalBuilder()
    .setCustomId(IDS.bannerForm)
    .setTitle('Kapak Görselini Değiştir')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Görsel bağlantısı')
        .setDescription('https ile başlayan bir görsel adresi gir. Boş bırakırsan seçtiğin arka plan efekti çizilir.')
        .setTextInputComponent(input('kapak', TextInputStyle.Short, 400, current.banner, 'Örn: https://i.imgur.com/ornek.png')),
    ]);

// Kapak düzenleyici: kartın üst alanı tek başına çizilir, görsel buradan büyütülüp dört yöne kaydırılır.
// Görsel yokken hareket düğmeleri görünür kalır ama pasiftir (önce görsel ya da arka plan gerekir).
function kapakPage(imageName, custom) {
  const zoom = Math.round((Number(custom.bannerZoom) || 1) * 100);
  const x = Math.round((Number(custom.bannerX) || 0) * 100);
  const y = Math.round((Number(custom.bannerY) || 0) * 100);
  const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
  const hasImage = Boolean(custom.banner);
  const btn = (neylem, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`${IDS.kapakBtn}${neylem}`).setLabel(label).setStyle(style).setDisabled(!hasImage);

  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        '## Kapağı Düzenle\nKartının üst alanındaki görseli büyütüp küçültebilir ve dört yönde kaydırabilirsin. Her dokunuşta kapak önizlemesi hemen çizilir; profil kartın da aynı anda yenilenir.',
      ),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`).setDescription('Kapak önizlemesi')),
    )
    .addTextDisplayComponents(
      text(
        fields([
          `**Yakınlaştırma:** %${zoom}`,
          `**Konum:** yatay ${signed(x)}, dikey ${signed(y)}`,
          `**Arka plan:** ${coverOf(custom.cover).label}`,
          hasImage
            ? 'Kaydırma yalnızca görselin taşan kısmı kadar yapılır; kenarlarda boşluk oluşmaz.'
            : 'Hareket düğmeleri bir görsel bağlantısı verdiğinde açılır; arka plan efektlerini mağazadan alabilirsin.',
        ]),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btn('buyut', 'Büyüt'), btn('kucult', 'Küçült'), btn('sola', 'Sola'), btn('saga', 'Sağa')),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btn('yukari', 'Yukarı'), btn('asagi', 'Aşağı'), btn('sifirla', 'Sıfırla', ButtonStyle.Danger)),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.kapakBtn}gorsel`).setLabel('Görsel Bağlantısı').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${IDS.shopTab}kapak`).setLabel('Arka Planlar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`${IDS.kapakBtn}kaldir`).setLabel('Görseli Kaldır').setStyle(ButtonStyle.Danger).setDisabled(!hasImage),
      ),
    );
}

// Görünüm sayfası: kartın tamamı çizilir, panel tarzı (düz ya da buzlu cam) ve saydamlık buradan ayarlanır.
// Saydamlık yalnızca cam temalarda işler; cam olmayan temada düğmeler görünür kalır ama pasiftir.
function gorunumPage(imageName, { themeLabel, glass, opacity }) {
  const btn = (neylem, label, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`${IDS.gorunumBtn}${neylem}`).setLabel(label).setStyle(style).setDisabled(!glass);

  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        '## Kart Görünümü\nKartındaki kutular temasına göre düz ya da buzlu cam panel olarak çizilir. Cam bir tema seçtiğinde saydamlığı artırıp azaltarak panellerin kapağın üzerinden ne kadar okunduğunu kendin ayarlayabilirsin.',
      ),
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`).setDescription('Profil kartı')),
    )
    .addTextDisplayComponents(
      text(
        fields([
          `**Tema:** ${themeLabel}`,
          `**Panel:** ${glass ? 'Buzlu cam' : 'Düz'}`,
          glass ? `**Saydamlık:** %${opacity}` : null,
          glass
            ? 'Saydamlık arttıkça kutular şeffaflaşır, kapağın rengi panellerin içinden daha çok görünür.'
            : 'Bu temada kutular düz çizildiği için saydamlık ayarı işlemez; buzlu cam paneller cam temalara özeldir.',
        ]),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(btn('azalt', 'Saydamlığı Azalt'), btn('artir', 'Saydamlığı Artır'), btn('sifirla', 'Sıfırla', ButtonStyle.Danger)),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.shopTab}tema`).setLabel('Temalar').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.banner).setLabel('Kapağı Düzenle').setStyle(ButtonStyle.Secondary),
      ),
    );
}

// Vitrin formu: kartta görünen zamir ve en fazla üç bağlantı
const vitrinModal = (current) =>
  new ModalBuilder()
    .setCustomId(IDS.vitrinLinks)
    .setTitle('Vitrin: Zamir ve Bağlantılar')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Zamir')
        .setDescription('Kullanıcı adının yanında küçük olarak görünür.')
        .setTextInputComponent(input('zamir', TextInputStyle.Short, 16, current.pronoun, 'Örn: o/o ya da onlar/onlar')),
      new LabelBuilder()
        .setLabel('Twitch')
        .setDescription('Yayın yapıyorsan kartına yazılır.')
        .setTextInputComponent(input('twitch', TextInputStyle.Short, 100, current.links?.twitch, 'Örn: https://twitch.tv/kullanici')),
      new LabelBuilder()
        .setLabel('YouTube')
        .setDescription('Kanal bağlantın.')
        .setTextInputComponent(input('youtube', TextInputStyle.Short, 100, current.links?.youtube, 'Örn: https://youtube.com/@kullanici')),
      new LabelBuilder()
        .setLabel('GitHub')
        .setDescription('Kod yazıyorsan profil bağlantın.')
        .setTextInputComponent(input('github', TextInputStyle.Short, 100, current.links?.github, 'Örn: https://github.com/kullanici')),
      new LabelBuilder()
        .setLabel('Kişisel site')
        .setDescription('Dördüncü bağlantı yer kalmayınca kartta gösterilmez.')
        .setTextInputComponent(input('site', TextInputStyle.Short, 100, current.links?.site, 'Örn: https://ornek.com')),
    ]);

// Rozet sayfası: kazanılanlar taşınan sırayla, kalanlar en yakın olana göre ilerleme çizgisiyle listelenir.
// Görev rozetleri ayrı bloktadır: tamamlanınca karttaki rozetin yanında config.js'te tanımlı rol de verilir.
function rozetPage(list, earnedCount) {
  const line = (b) => `**${b.label}** — ${b.goal > 1 ? `${b.value} / ${b.goal} · ` : ''}${b.note}`;
  const done = list.filter((b) => b.done);
  const rest = list.filter((b) => !b.done).sort((a, b) => b.value / b.goal - a.value / a.goal);
  const gorev = rest.filter((b) => b.gorev);
  const normal = rest.filter((b) => !b.gorev);
  return core.page({
    title: 'Rozetler',
    sub: 'Rozetler sunucudaki etkinliğinden türetilir; ayrı bir başvuru ya da istek gerekmez. Aşağıda kazandıkların ve kaldığı yerden ilerlemesi gösterilir.',
    blocks: [
      fields([
        `**${earnedCount} rozet kazanıldı**`,
        done.length ? done.map((b) => b.label).join(' · ') : 'Henüz rozetin yok; ilk hedefler mesaj ve ses seviyeleri.',
      ]),
      gorev.length
        ? fields(['**Görev rozetleri** · hedefe ulaşınca kartına rozetle birlikte sunucu rolü de verilir', gorev.map(line).join('\n')])
        : null,
      normal.length ? fields(['**Diğer rozetler**', normal.map(line).join('\n')]) : null,
    ],
  });
}

// Vitrin sayfası: kartta görünecek ek alanlar; bağlantılar formla, öne çıkan istatistik menüyle seçilir
function vitrinPage(current, featuredKey, featuredOptions, visitLine) {
  const links = current.links ?? {};
  return new ContainerBuilder()
    .addTextDisplayComponents(text('## Vitrin'))
    .addTextDisplayComponents(
      text('Kartında öne çıkarmak istediğin istatistiği seç, bağlantılarını ve zamirini düzenle. Seçtiklerin profil kartının alt şeridinde görünür.'),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        fields([
          `**Zamir:** ${current.pronoun ?? 'girilmedi'}`,
          `**Bağlantılar:** ${['twitch', 'youtube', 'github', 'site'].map((k) => links[k]).filter(Boolean).join(' · ') || 'yok'}`,
          `**Öne çıkan:** ${featuredOptions.find((o) => o.key === featuredKey)?.label ?? 'seçilmedi'}`,
          visitLine,
        ]),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(stamp()))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.vitrinLinks).setLabel('Zamir ve Bağlantılar').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(IDS.featured)
          .setPlaceholder('Öne çıkan istatistik')
          .addOptions(
            featuredOptions.map((o) =>
              new StringSelectMenuOptionBuilder().setValue(o.key).setLabel(o.label).setDescription(o.note).setDefault(o.key === featuredKey),
            ),
          ),
      ),
    );
}

// Mağaza: coin ile alınan kart çerçeveleri ve temalar. Her ürün kendi satırında, sağında al ya da giy düğmesi.
function shopPage(tab, tabs, balance, items) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(text('## Profil Mağazası'))
    .addTextDisplayComponents(
      text('Coinler günlük giriş, seviye atlama, haftalık derece ve saygınlık vermekten birikir. Alınan kozmetik kalıcıdır; istediğin zaman değiştirip tekrar giyebilirsin.'),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Bakiyen:** ${balance.toLocaleString('tr-TR')} coin`))
    .addActionRowComponents(core.tabRow(tabs, tab, (key) => `${IDS.shopTab}${key}`));

  for (const item of items) {
    const button = new ButtonBuilder().setStyle(item.wearStyle ?? ButtonStyle.Secondary);
    if (item.label) button.setLabel(item.label);
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(`**${item.name}**${item.note ? ` — ${item.note}` : ''}\n${item.state}`))
        .setButtonAccessory(button.setCustomId(item.id).setDisabled(Boolean(item.disabled))),
    );
  }
  return container;
}

module.exports = { IDS, profile, bioModal, colorModal, bannerModal, vitrinModal, kapakPage, rozetPage, vitrinPage, shopPage };
