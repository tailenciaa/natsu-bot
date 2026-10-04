// Takviye (boost) mesajları: DM, teşekkür kanalı bildirimi ve "Booster İşlemleri" paneli.
// Panelin butonları: emoji ekle, çıkartma ekle (dosya gerektirdiği için sadece komuta yönlendirir), isim değiştir,
// özel rol oluştur/düzenle. Hepsi takviye sürdüğü sürece geçerli; takviye bitince otomatik geri alınır.
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
const { colors, text, divider, notice, page } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');

const IDS = {
  emoji: 'boost:emoji',
  sticker: 'boost:sticker',
  nick: 'boost:nick',
  role: 'boost:rol',
  colorRole: 'boost-renk', // boost-renk:0
  emojiForm: 'boost-emoji-form',
  nickForm: 'boost-nick-form',
  roleForm: 'boost-rol-form',
  emojiField: 'emoji',
  nameField: 'isim',
  nickField: 'takma-ad',
  roleNameField: 'rol-isim',
  roleColorField: 'rol-renk',
  roleEmojiField: 'rol-emoji',
};

// Takviye edene giden DM: teşekkür + panelin ve çıkartma komutunun nasıl kullanılacağı
function thanksDm(guildName, panelChannelId, perks) {
  const panelLine = panelChannelId ? `<#${panelChannelId}> kanalındaki panelden` : 'Booster İşlemleri panelinden';
  return page({
    title: '💜 Takviyen İçin Teşekkürler!',
    sub: `${guildName} sunucusunu takviye ettiğin için çok teşekkür ederiz; takviyen sürdüğü sürece sana özel avantajlardan yararlanabilir, aşağıdaki bilgilerle bunları kullanabilirsin.`,
    accent: colors.success,
    blocks: [
      `**Panelden Yapabileceklerin**\nTakviyen sürdüğü sürece ${panelLine} kendi emojini ekleyebilir, adını değiştirebilir ve kendi renginde/emojinde bir rol oluşturabilirsin.`,
      `**Çıkartma ve Haklar**\n-# Çıkartma eklemek dosya yüklemesi gerektirdiği için \`/cikartma-ekle\` komutuyla yapılır.\n` +
        `-# Emoji ve çıkartma hakkın takviye başına ${perks.emoji} emoji, ${perks.sticker} çıkartma; isim ve rol takviyen bitince geri alınır.`,
    ],
  });
}

// Teşekkür kanalına düşen kısa bildirim: sağ üstte üyenin fotoğrafı
function channelThanks(user) {
  return page({
    title: '💜 Takviye Etti!',
    sub: 'Sunucumuzu takviye ederek bize destek olan üyelerimize buradan teşekkür ediyoruz; takviye edenler özel rol ve panel avantajlarından faydalanabilir ve topluluğumuzu büyütür.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    accent: 0xf47fff,
    blocks: [`**Takviye Eden**\n<@${user.id}> sunucuyu takviye etti, çok teşekkür ederiz!`],
  });
}

// Bot tarafından yapılan (panelden erişilebilen) avantajlar butonlarla eşleşir; geri kalanı booster rolünün
// Discord'daki kanal/sunucu izinlerinden gelir (bunları rolün izinlerinden sen ayarlarsın, bot karışmaz)
const PERKS = [
  'Çekiliş ve etkinliklerde **önceliklisin**.',
  '**Özel rolünle** diğer üyelerden üstte, ayrı bir grupta görünürsün.',
  '**Kendine özel bir rol** oluşturabilirsin (adını, rengini ve emojisini sen seçersin).',
  'Sunucuya **kendi emojini** ekleyebilirsin.',
  '**Takma adını** değiştirebilirsin.',
  'Sesli kanallarda **ses panelini (soundboard)** kullanabilirsin.',
  'Metin kanallarına **dosya ve bağlantı** gönderebilirsin.',
  '**Harici emoji ve çıkartma** kullanabilirsin (başka sunuculara ait olanlar dahil).',
];

// İşlem seçenekleri: butonlar sadece emojili (yazısız), hangi emojinin ne yaptığı "İşlem Seçenekleri" bloğunda yazar
const ACTIONS = [
  ['😀', 'Emoji Ekle', () => `Sunucuya kendi emojini ekle (**${config.perks.emoji} hak**).`, IDS.emoji, ButtonStyle.Success],
  ['🖼️', 'Çıkartma Ekle', () => `Sunucuya kendi çıkartmanı ekle (**${config.perks.sticker} hak**).`, IDS.sticker, ButtonStyle.Success],
  ['✏️', 'İsim Değiştir', () => 'Sunucudaki takma adını değiştir.', IDS.nick, ButtonStyle.Primary],
  ['🎨', 'Özel Rol', () => 'Kendi adında, renginde ve emojinde bir rol oluştur ya da düzenle.', IDS.role, ButtonStyle.Primary],
];

// Renk rolü tanımlanmadıysa menü yine görünür, tek seçenekle "yakında" der ve rol vermez (handleColorRole'da karşılanır)
const NO_COLOR_ROLE = 'yok';

// guild: sağ üstteki sunucu simgesi için
function panel(guild) {
  const container = page({
    title: `${botName} Booster İşlemleri`,
    sub: 'Bu panel sadece sunucuyu takviye eden (boost basan) üyeler içindir; isim ve rol ayrıcalıkları takviyen sürdüğü sürece geçerlidir, takviyen bitince otomatik geri alınır.',
    thumbnail: guild?.iconURL({ size: 256 }),
    accent: colors.primary,
    blocks: [`**Booster Olmanın Avantajları**\n${PERKS.map((p) => `- ${p}`).join('\n')}`],
  });

  if (config.banner) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  }

  const options = config.colorRoles.length
    ? config.colorRoles.map((c) => new StringSelectMenuOptionBuilder().setValue(c.roleId).setLabel(c.label))
    : [new StringSelectMenuOptionBuilder().setValue(NO_COLOR_ROLE).setLabel('Renk rolleri çok yakında')];

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(`**İşlem Seçenekleri**\n${ACTIONS.map(([emoji, title, describe]) => `${emoji} **${title}:** ${describe()}`).join('\n')}`),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        ACTIONS.map(([emoji, , , buttonId, style]) => new ButtonBuilder().setCustomId(buttonId).setEmoji(emoji).setStyle(style)),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`${IDS.colorRole}:0`).setPlaceholder('Almak istediğin renk rolünü seç').addOptions(options),
      ),
    );
}

// Butona basınca takviyeci değilse gösterilen mesaj
const notBoosterView = () => notice('❌ Bu işlem sadece sunucuyu takviye eden üyeler içindir.', 'danger');

// "Çıkartma Ekle": dosya yüklemesi modalla yapılamadığı için komuta yönlendirir
const stickerInfoView = () =>
  notice(
    '**Çıkartma eklemek dosya yüklemesi gerektiriyor, bu yüzden panelden değil komutla yapılır.**\n' +
      '-# `/cikartma-ekle` komutunu kullanabilirsin.',
    'primary',
  );

function emojiModal() {
  return new ModalBuilder()
    .setCustomId(IDS.emojiForm)
    .setTitle('Emoji Ekle')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Emoji')
        .setDescription("Emojinin kendisi, ID'si ya da bağlantısı")
        .setTextInputComponent(new TextInputBuilder().setCustomId(IDS.emojiField).setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true)),
      new LabelBuilder()
        .setLabel('İsim (isteğe bağlı)')
        .setTextInputComponent(new TextInputBuilder().setCustomId(IDS.nameField).setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(false)),
    ]);
}

function nickModal(current) {
  const input = new TextInputBuilder().setCustomId(IDS.nickField).setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true);
  if (current) input.setValue(current);
  return new ModalBuilder()
    .setCustomId(IDS.nickForm)
    .setTitle('İsim Değiştir')
    .addLabelComponents([new LabelBuilder().setLabel('Yeni İsim').setTextInputComponent(input)]);
}

function roleModal(existing) {
  const nameInput = new TextInputBuilder().setCustomId(IDS.roleNameField).setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true);
  const colorInput = new TextInputBuilder()
    .setCustomId(IDS.roleColorField)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Örn: #ff5599')
    .setMaxLength(7)
    .setRequired(true);
  const emojiInput = new TextInputBuilder().setCustomId(IDS.roleEmojiField).setStyle(TextInputStyle.Short).setMaxLength(8).setRequired(false);
  if (existing) {
    nameInput.setValue(existing.name);
    colorInput.setValue(`#${existing.color.toString(16).padStart(6, '0')}`);
    if (existing.unicodeEmoji) emojiInput.setValue(existing.unicodeEmoji);
  }
  return new ModalBuilder()
    .setCustomId(IDS.roleForm)
    .setTitle(existing ? 'Özel Rolünü Düzenle' : 'Özel Rol Oluştur')
    .addLabelComponents([
      new LabelBuilder().setLabel('Rol Adı').setTextInputComponent(nameInput),
      new LabelBuilder().setLabel('Rol Rengi (hex kod)').setTextInputComponent(colorInput),
      new LabelBuilder().setLabel('Rol Emojisi (isteğe bağlı, tek emoji)').setTextInputComponent(emojiInput),
    ]);
}

module.exports = {
  IDS,
  thanksDm,
  channelThanks,
  panel,
  NO_COLOR_ROLE,
  notBoosterView,
  stickerInfoView,
  emojiModal,
  nickModal,
  roleModal,
};
