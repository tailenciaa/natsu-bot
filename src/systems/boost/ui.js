// Takviye (boost) mesajları: DM, teşekkür kanalı bildirimi ve "Booster İşlemleri" paneli.
// Panelde takma ad ve özel rol işlemleri butonla yapılır; emoji ve çıkartma dosya/komut gerektirdiği için
// /emoji-ekle ve /cikartma-ekle ile eklenir. Takma ad ve özel rol takviye sürdüğü sürece geçerli; takviye bitince
// otomatik geri alınır.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { text, divider, alert, page, rows, chip, stamp } = require('../../core/ui');
const config = require('./config');

const IDS = {
  emoji: 'boost:emoji',
  sticker: 'boost:sticker',
  nick: 'boost:nick',
  role: 'boost:rol',
  colorRole: 'boost-renk', // boost-renk:0
  iconRole: 'boost-simge', // boost-simge:0
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

// Takviye edene giden DM: teşekkür + panelin ve emoji/çıkartma komutlarının nasıl kullanılacağı
function thanksDm(guildName, panelChannelId, perks) {
  const panelLine = panelChannelId ? `<#${panelChannelId}> kanalındaki panelden` : 'Booster İşlemleri panelinden';
  return page({
    title: 'Takviyen İçin Teşekkürler',
    sub: `${guildName} sunucusunu takviye ettiğin için **çok teşekkür ederiz**; takviyen sürdüğü sürece sana özel avantajlardan yararlanabilir ve bu mesajdaki bilgilerle hepsini kullanabilirsin.`,
    blocks: [
      `**Panelden yapabileceklerin**\n${panelLine} takma adını değiştirebilir ve kendi renginde, emojinde bir rol oluşturabilirsin.\nTakma ad ve rol takviyen bitince geri alınır.`,
      `**Emoji ve çıkartma**\nEmoji için \`/emoji-ekle\`, çıkartma için \`/cikartma-ekle\` komutunu kullanabilirsin.\nHakların: **${perks.emoji} emoji**, **${perks.sticker} çıkartma**.`,
    ],
  });
}

// Teşekkür kanalına düşen kısa bildirim: sağ üstte üyenin fotoğrafı
function channelThanks(user) {
  return page({
    title: 'Yeni Takviye',
    sub: 'Sunucumuzu takviye ederek bize destek olan üyelerimize buradan **teşekkür ediyoruz**; takviye edenler özel rol ve panel avantajlarından faydalanabilir ve topluluğumuzu büyütür.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [`**<@${user.id}> sunucuyu takviye etti, teşekkür ederiz.**`],
  });
}

// Panelden yapılan işlemler: ad, açıklama, butonun etiketi ve ID'si (açıklamalar "İşlem Seçenekleri" bloğunda, butonlar altındaki satırda)
const ACTIONS = [
  { title: 'İsim', note: 'Sunucudaki takma adını değiştirmeni sağlar.', label: 'İsim Değiştir', id: IDS.nick },
  { title: 'Emoji', note: 'Hakkın olan emojiyi sunucuya eklemeni ya da güncellemeni sağlar.', label: 'Emoji Ekle/Değiştir', id: IDS.emoji },
  { title: 'Özel Rol', note: 'Kendi adında, renginde ve emojinde bir rol oluşturmanı ya da düzenlemeni sağlar.', label: 'Özel Rol', id: IDS.role },
];

// Avantajlar: bot panelinden yapılanlar ve booster rolünün Discord'daki kanal/sunucu izinlerinden gelenler (anahtar sözcükler kalın)
function perkLines() {
  return [
    '- Sunucuda üstte görünen bir **özel rol** kazanırsın.',
    '- **Çekiliş ve etkinliklerde** önceliklisin.',
    '- Sohbete **dosya ve bağlantı** gönderebilirsin.',
    '- **Harici emoji ve çıkartma** kullanabilirsin.',
    '- **Takma adını** değiştirebilirsin.',
    '- **Ses panelini** (soundboard) kullanabilirsin.',
    `- \`/emoji-ekle\` ile **${config.perks.emoji} emoji**, \`/cikartma-ekle\` ile **${config.perks.sticker} çıkartma** ekleyebilirsin.`,
  ];
}

// İşlem Seçenekleri bloğu: her işlem kalın adıyla ve normal yazıyla açıklamasıyla
function optionLines() {
  const lines = ACTIONS.map((a) => `**${a.title}:** ${a.note}`);
  if (config.colorRoles.length) lines.push('**Renk Rolü:** Sana hazırladığımız renk rollerinden birini menüden seçebilirsin.');
  if (config.iconRoles.length) lines.push('**Simge Rolü:** Sana hazırladığımız simge rollerinden birini menüden seçebilirsin.');
  return lines;
}

// guild: sağ üstteki sunucu simgesi için
function panel(guild) {
  const container = page({
    title: 'Booster İşlemleri',
    sub: '**Bu panel sadece sunucuyu takviye eden üyeler içindir.** Takviye ederek takma adını değiştirebilir, sana özel rol oluşturabilir veya diğer booster ayrıcalıklarından yararlanabilirsin.',
    thumbnail: guild?.iconURL({ size: 256 }),
    blocks: [`**Booster Olmanın Avantajları**\n${perkLines().join('\n')}`],
  });

  if (config.banner) {
    container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**İşlem Seçenekleri**\n${optionLines().join('\n')}`))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(ACTIONS.map((a) => new ButtonBuilder().setCustomId(a.id).setLabel(a.label).setStyle(ButtonStyle.Primary))),
    );

  // Hazır renk/simge rolü tanımlı değilse ilgili menü hiç gösterilmez
  if (config.colorRoles.length) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.colorRole}:0`)
          .setPlaceholder('Renk rolü seç')
          .addOptions(config.colorRoles.map((c) => new StringSelectMenuOptionBuilder().setValue(c.roleId).setLabel(c.label))),
      ),
    );
  }
  if (config.iconRoles.length) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.iconRole}:0`)
          .setPlaceholder('Simge rolü seç')
          .addOptions(config.iconRoles.map((c) => new StringSelectMenuOptionBuilder().setValue(c.roleId).setLabel(c.label))),
      ),
    );
  }
  return container;
}

// Takviyeci olmayan biri butona/forma basınca gösterilen mesaj (hepsi aynı görünümü kullanır)
const notBoosterView = () => alert('Bu işlem sadece takviye eden üyeler içindir.', 'Sunucuyu takviye ettiğinde bu paneli kullanabilirsin.', 'danger');

// Eski panellerdeki "Çıkartma Ekle" butonu: dosya yüklemesi modalla yapılamadığı için komuta yönlendirir
const stickerInfoView = () => alert('Çıkartma panelden değil komutla eklenir.', 'Dosya yüklemek gerektiği için `/cikartma-ekle` komutunu kullanabilirsin.');

// Eski panellerdeki "Emoji Ekle" butonunun formu (emoji sistemindeki motoru çalıştırır)
function emojiModal() {
  return new ModalBuilder()
    .setCustomId(IDS.emojiForm)
    .setTitle('Emoji Ekle')
    .addLabelComponents([
      new LabelBuilder()
        .setLabel('Emoji')
        .setDescription('Emojinin kendisini, ID\'sini ya da bağlantısını yaz.')
        .setTextInputComponent(new TextInputBuilder().setCustomId(IDS.emojiField).setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true)),
      new LabelBuilder()
        .setLabel('İsim (isteğe bağlı)')
        .setTextInputComponent(new TextInputBuilder().setCustomId(IDS.nameField).setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(false)),
    ]);
}

function nickModal(current) {
  const input = new TextInputBuilder().setCustomId(IDS.nickField).setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(32).setPlaceholder('Örn: Kazuki').setRequired(true);
  if (current) input.setValue(current);
  return new ModalBuilder()
    .setCustomId(IDS.nickForm)
    .setTitle('Takma Adını Değiştir')
    .addLabelComponents([new LabelBuilder().setLabel('Yeni takma ad').setTextInputComponent(input)]);
}

// icons: sunucuda rol simgesi (ROLE_ICONS, takviye seviyesi 2) varsa emoji alanı da gösterilir
function roleModal(existing, { icons = true } = {}) {
  const nameInput = new TextInputBuilder().setCustomId(IDS.roleNameField).setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(32).setPlaceholder('Örn: Gece Kuşu').setRequired(true);
  const colorInput = new TextInputBuilder()
    .setCustomId(IDS.roleColorField)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Örn: #ff5599')
    .setMaxLength(7)
    .setRequired(true);
  const emojiInput = new TextInputBuilder().setCustomId(IDS.roleEmojiField).setStyle(TextInputStyle.Short).setMaxLength(16).setRequired(false);
  if (existing) {
    nameInput.setValue(existing.name);
    colorInput.setValue(`#${existing.color.toString(16).padStart(6, '0')}`);
    if (existing.unicodeEmoji) emojiInput.setValue(existing.unicodeEmoji);
  }
  const fields = [
    new LabelBuilder().setLabel('Rol adı').setTextInputComponent(nameInput),
    new LabelBuilder().setLabel('Rol rengi').setDescription('Altı haneli hex kod yaz.').setTextInputComponent(colorInput),
  ];
  if (icons) fields.push(new LabelBuilder().setLabel('Rol emojisi').setDescription('İsteğe bağlı, tek emoji.').setTextInputComponent(emojiInput));
  return new ModalBuilder().setCustomId(IDS.roleForm).setTitle(existing ? 'Özel Rolünü Düzenle' : 'Özel Rol Oluştur').addLabelComponents(fields);
}

module.exports = {
  IDS,
  thanksDm,
  channelThanks,
  panel,
  notBoosterView,
  stickerInfoView,
  emojiModal,
  nickModal,
  roleModal,
};
