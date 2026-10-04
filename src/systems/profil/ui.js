// Profil mesajı: kart görseli (card.js) ve sahibiyse kartın altında düzenleme kontrolleri (biyografi/unvan, renk, kapak
// görseli, tema, sıfırlama). Kontroller aynı mesajı günceller; sahibi olmayanlar sadece görseli görür.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { THEMES, DEFAULT_THEME } = require('./themes');

// Hepsi profil-ayar:<eylem>; index.js'te tek ön ek altında karşılanır
const IDS = {
  prefix: 'profil-ayar',
  bio: 'profil-ayar:bio',
  color: 'profil-ayar:renk',
  banner: 'profil-ayar:kapak',
  reset: 'profil-ayar:sifirla',
  theme: 'profil-ayar:tema',
  bioForm: 'profil-ayar:bio-form',
  colorForm: 'profil-ayar:renk-form',
  bannerForm: 'profil-ayar:kapak-form',
};

function profile(imageName, editable, currentTheme = DEFAULT_THEME) {
  const container = new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`)),
  );
  if (!editable) return container;

  return container
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.bio).setLabel('Biyografi ve Unvan').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.color).setLabel('Renk').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.banner).setLabel('Kapak Görseli').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.reset).setLabel('Sıfırla').setStyle(ButtonStyle.Danger),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(IDS.theme)
          .setPlaceholder('Profil temasını seç')
          .addOptions(
            Object.entries(THEMES).map(([key, theme]) =>
              new StringSelectMenuOptionBuilder().setValue(key).setLabel(theme.label).setDescription(theme.description).setDefault(key === currentTheme),
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
    .setTitle('Biyografi ve Unvan')
    .addLabelComponents([
      new LabelBuilder().setLabel('Biyografi').setTextInputComponent(input('bio', TextInputStyle.Paragraph, 160, current.bio)),
      new LabelBuilder()
        .setLabel('Unvan')
        .setDescription('İsminin altında küçük bir etiket olarak görünür')
        .setTextInputComponent(input('unvan', TextInputStyle.Short, 24, current.title, 'Örn: Anime Sever')),
    ]);

const colorModal = (current) =>
  new ModalBuilder()
    .setCustomId(IDS.colorForm)
    .setTitle('Profil Rengi')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Vurgu rengi (hex kod)')
        .setDescription('Çubuklar, halka ve unvan bu renkte çizilir; boş bırakırsan temanın rengi kullanılır')
        .setTextInputComponent(input('renk', TextInputStyle.Short, 7, current.color ? `#${current.color.toString(16).padStart(6, '0')}` : null, 'Örn: #ff5599')),
    ]);

const bannerModal = (current) =>
  new ModalBuilder()
    .setCustomId(IDS.bannerForm)
    .setTitle('Kapak Görseli')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Görsel bağlantısı')
        .setDescription('https ile başlayan bir görsel linki; boş bırakırsan tema gradyanı kullanılır')
        .setTextInputComponent(input('kapak', TextInputStyle.Short, 400, current.banner, 'https://...')),
    ]);

module.exports = { IDS, profile, bioModal, colorModal, bannerModal };
