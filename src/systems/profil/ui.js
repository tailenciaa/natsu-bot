// Profil mesajı: kart görseli (card.js) ve sahibiyse kartın altında düzenleme kontrolleri (biyografi/unvan, renk,
// kapak görseli, tema, sıfırlama) ile vitrin, rozet ve mağaza sayfaları. Kontroller aynı mesajı günceller; sahibi
// olmayanlar sadece görseli görür.
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
  rozet: 'profil-ayar:rozetler',
  shop: 'profil-ayar:magaza',
  shopTab: 'profil-ayar:magaza:', // + cerceve | tema
  buy: 'profil-ayar:al:', // + tur:anahtar
  wear: 'profil-ayar:giy:', // + tur:anahtar
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
        new ButtonBuilder().setCustomId(IDS.banner).setLabel('Kapak').setStyle(ButtonStyle.Secondary),
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
        .setDescription('https ile başlayan bir görsel bağlantısı gir; boş bırakırsan tema gradyanı kullanılır.')
        .setTextInputComponent(input('kapak', TextInputStyle.Short, 400, current.banner, 'Örn: https://i.imgur.com/ornek.png')),
    ]);

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

// Rozet sayfası: kazanılanlar taşınan sırayla, kalanları ilerleme çizgisiyle listelenir
function rozetPage(list, earnedCount) {
  const done = list.filter((b) => b.done);
  const todo = list.filter((b) => !b.done);
  return core.page({
    title: 'Rozetler',
    sub: 'Rozetler sunucudaki etkinliğinden türetilir; ayrı bir başvuru ya da istek gerekmez. Aşağıda kazandıkların ve kaldığı yerden ilerlemesi gösterilir.',
    blocks: [
      fields([
        `**Kazanılan ${earnedCount} rozet**`,
        done.length ? done.map((b) => b.label).join(' · ') : 'Henüz rozetin yok; ilk hedefler mesaj ve ses seviyeleri.',
      ]),
      fields([
        '**Yoldaki rozetler**',
        todo
          .slice(0, 10)
          .map((b) => `**${b.label}** — ${b.goal > 1 ? `${b.value} / ${b.goal} · ` : ''}${b.note}`)
          .join('\n'),
      ]),
    ],
  });
}

// Vitrin sayfası: kartta görünecek ek alanlar; bağlantılar formla, öne çıkan istatistik menüyle seçilir
function vitrinPage(current, featuredKey, featuredOptions, visitLine) {
  const links = current.links ?? {};
  return new ContainerBuilder()
    .addTextDisplayComponents(text('## Vitrin'))
    .addTextDisplayComponents(
      text('Kartında öne çıkarmak istediğin istatistiği seç, bağlantılarını ve zamarini düzenle. Seçtiklerin profil kartının alt şeridinde görünür.'),
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

module.exports = { IDS, profile, bioModal, colorModal, bannerModal, vitrinModal, rozetPage, vitrinPage, shopPage };
