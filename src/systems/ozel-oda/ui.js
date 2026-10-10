// Özel oda sisteminin mesajları: oda açılınca kendi ses kanalının metin sohbetine düşen kontrol paneli,
// limit/isim değiştirme formları ve #özel-oda-rehberi bilgi paneli.
const {
  ActionRowBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} = require('discord.js');
const { divider, colors, page, text, rows, chip, pills, stamp } = require('../../core/ui');
const config = require('./config');

const IDS = {
  lock: 'oda-kilit',
  hide: 'oda-gizle',
  limit: 'oda-limit',
  limitModal: 'oda-limit-form',
  limitInput: 'oda-limit-sayi',
  rename: 'oda-isim',
  renameModal: 'oda-isim-form',
  renameInput: 'oda-isim-yeni',
  kick: 'oda-at', // oda-at:0 (menünün prefixli yönlendirilmesi için sabit ek)
  ban: 'oda-yasakla', // oda-yasakla:0
  transfer: 'oda-devret', // oda-devret:0
};

const isLocked = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has('Connect') ?? false;
const isHidden = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has('ViewChannel') ?? false;

// Üye seçim menüsü: Discord kendi arama kutusunu gösterir, oda üyelerinin listelenmesine ya da 25 sınırına gerek kalmaz
const userSelect = (customId, placeholder) => new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder);

// Odanın kendi ses kanalı sohbetine gönderilen, sadece oda sahibinin kullanabildiği kontrol paneli.
// state: { locked, hidden } verilirse kanalın önbelleğindeki izinler yerine bunlar gösterilir (izin değişikliği önbelleğe
// gecikmeli yansıdığı için işlemden hemen sonra yeni durum açıkça verilir)
function controlPanel(room, channel, state = {}) {
  const locked = state.locked ?? isLocked(channel);
  const hidden = state.hidden ?? isHidden(channel);

  return page({
    title: 'Oda Kontrol Paneli',
    sub: 'Odanın kilidini, görünürlüğünü, kişi limitini ve ismini bu panelden yönetebilir; odadaki üyeleri atabilir, yasaklayabilir ya da odanın sahipliğini başka birine devredebilirsin.',
    accent: locked ? colors.danger : colors.primary,
    blocks: [
      rows([
        ['Sahip', `<@${room.ownerId}>`],
        ['Kişi Limiti', chip(channel.userLimit ? `${channel.userLimit} kişi` : 'Sınırsız')],
        ['Durum', pills([['Kilit', locked ? 'Kilitli' : 'Açık'], ['Görünürlük', hidden ? 'Gizli' : 'Görünür']])],
      ]),
      'Bu paneli sadece **oda sahibi** kullanabilir.',
      stamp(room.createdAt),
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.lock).setLabel(locked ? 'Kilidi Aç' : 'Kilitle').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.hide).setLabel(hidden ? 'Göster' : 'Gizle').setStyle(hidden ? ButtonStyle.Success : ButtonStyle.Secondary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.limit).setLabel('Limiti Ayarla').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.rename).setLabel('İsmi Değiştir').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(userSelect(`${IDS.kick}:0`, 'Atılacak üyeyi seç')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(userSelect(`${IDS.ban}:0`, 'Yasaklanacak üyeyi seç')))
    .addActionRowComponents(new ActionRowBuilder().addComponents(userSelect(`${IDS.transfer}:0`, 'Yeni sahibi seç')));
}

function limitModal(current) {
  return new ModalBuilder()
    .setCustomId(IDS.limitModal)
    .setTitle('Kişi Limitini Ayarla')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kişi limiti')
        .setDescription('0 = sınırsız, en fazla 99 kişi.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.limitInput)
            .setStyle(TextInputStyle.Short)
            .setValue(String(current ?? 0))
            .setPlaceholder('Örn: 5')
            .setMaxLength(2)
            .setRequired(true),
        ),
    );
}

function renameModal(current) {
  const input = new TextInputBuilder().setCustomId(IDS.renameInput).setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true);
  if (current) input.setValue(current);
  return new ModalBuilder()
    .setCustomId(IDS.renameModal)
    .setTitle('Oda İsmini Değiştir')
    .addLabelComponents(new LabelBuilder().setLabel('Yeni isim').setTextInputComponent(input));
}

// Panelin görseli süreli bir Discord bağlantısı olabilir; gönderirken yerel kopyaya çevrilir (core/banner.js)
const GUIDE_BANNER =
  'https://cdn.discordapp.com/attachments/1538539811697332385/1555892852775718992/odabilgikazuki.jpg?backend=b2&ex=6ac37f23&is=6ac22da3&hm=da08b7431f50952593069496c3612a3eca3a95aeb8a126dcf0ffb67490fd403e&';
const GUIDE_TITLE = 'Özel Oda Rehberi';

// #özel-oda-rehberi kanalına giden bilgi paneli: odanın nasıl açıldığı ve kontrol panelinin ne yaptığı
function guidePanel() {
  const blocks = [
    [
      '**Oda nasıl açılır?**',
      `1. <#${config.createChannelId}> kanalına gir; senin için **kendi ses kanalın** açılır.`,
      '2. Odanın adı görünen adından oluşur, istediğin zaman değiştirebilirsin.',
      '3. Ayarları odanın yazı sohbetindeki **kontrol panelinden** yaparsın.',
    ].join('\n'),
    [
      '**Oda sahibi neler yapabilir?**',
      '1. Odayı **kilitleyerek** yeni girişleri durdurur, **gizleyerek** kanal listesinden saklar.',
      '2. Kişi limitini ve odanın adını değiştirir; kişi limiti **0** ise oda sınırsızdır.',
      '3. Odadaki üyeleri **atar**, tekrar girmesini **engeller** ya da sahipliği **devreder**.',
    ].join('\n'),
    [
      '**Bilmen gerekenler**',
      '1. Paneli sadece **oda sahibi** kullanabilir.',
      '2. İşlemler arasında kısa bir bekleme vardır.',
      '3. Odada kimse kalmayınca **oda silinir**.',
      `4. <#${config.createChannelId}> kanalına her girişinde yeni bir oda açılır.`,
    ].join('\n'),
  ];
  const container = page({
    title: GUIDE_TITLE,
    sub: 'Kendi özel sesli odanı nasıl açacağını, oda kontrol panelindeki seçeneklerin ne işe yaradığını ve odanın hangi durumlarda kapandığını bu kanalda adım adım öğrenebilirsin.',
  });
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(GUIDE_BANNER)));
  for (const block of blocks) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container;
}

module.exports = { IDS, GUIDE_TITLE, guidePanel, controlPanel, limitModal, renameModal };
