// Profil mesajı: kart görseli (card.js) ve sahibiyse "Profili Düzenle" butonu
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { divider } = require('../../core/ui');

const IDS = { edit: 'profil:duzenle', form: 'profil-form' };

function profile(imageName, isSelf) {
  const container = new ContainerBuilder().addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`)),
  );
  if (isSelf) {
    container
      .addSeparatorComponents(divider())
      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(IDS.edit).setLabel('Profili Düzenle').setStyle(ButtonStyle.Secondary),
        ),
      );
  }
  return container;
}

function editModal(current) {
  const bioInput = new TextInputBuilder().setCustomId('bio').setStyle(TextInputStyle.Paragraph).setMaxLength(200).setRequired(false);
  if (current.bio) bioInput.setValue(current.bio);
  const colorInput = new TextInputBuilder()
    .setCustomId('renk')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Örn: #ff5599')
    .setMaxLength(7)
    .setRequired(false);
  if (current.color) colorInput.setValue(`#${current.color.toString(16).padStart(6, '0')}`);

  return new ModalBuilder()
    .setCustomId(IDS.form)
    .setTitle('Profili Düzenle')
    .addLabelComponents([
      new LabelBuilder().setLabel('Biyografi (isteğe bağlı)').setTextInputComponent(bioInput),
      new LabelBuilder().setLabel('Profil Rengi (isteğe bağlı, hex kod)').setTextInputComponent(colorInput),
    ]);
}

module.exports = { IDS, profile, editModal };
