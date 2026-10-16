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
  add: 'oda-uye-ekle', // oda-uye-ekle:0
  drop: 'oda-izni-kaldir', // oda-izni-kaldir:0
};

const isLocked = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has('Connect') ?? false;
const isHidden = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has('ViewChannel') ?? false;

// Üye seçim menüsü: Discord kendi arama kutusunu gösterir, oda üyelerinin listelenmesine ya da 25 sınırına gerek kalmaz
const userSelect = (customId, placeholder) => new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder);

// Oda kontrol paneli: oda sahibinin ses kanalının sohbetinde durur.
// state: { locked, hidden } verilirse kanalın önbelleğindeki izinler yerine bunlar gösterilir (izin değişikliği
// önbelleğe gecikmeli yansıdığı için işlemden hemen sonra yeni durum açıkça verilir).
// access: { invited, banned } odada ayrı izni olan üyelerin ID listeleridir; panelde üye menülerinin üstünde gösterilir.
function controlPanel(room, channel, state = {}, access = { invited: [], banned: [] }) {
  const locked = state.locked ?? isLocked(channel);
  const hidden = state.hidden ?? isHidden(channel);

  const container = page({
    title: 'Oda Kontrol Paneli',
    sub: 'Odanın kilidini, görünürlüğünü, kişi limitini ve ismini buradan yönetirsin. Odayı kilitlesen bile **eklediğin üyeler** girebilir; üyeleri çıkarır, yasaklar ya da sahipliği devredersin. Bu paneli sadece **oda sahibi** kullanabilir.',
    accent: locked ? colors.danger : colors.primary,
    blocks: [
      rows([
        ['Sahip', `<@${room.ownerId}>`],
        ['Kişi Limiti', chip(channel.userLimit ? `${channel.userLimit} kişi` : 'Sınırsız')],
        ['Durum', pills([['Kilit', locked ? 'Kilitli' : 'Açık'], ['Görünürlük', hidden ? 'Gizli' : 'Görünür']])],
      ]),
      accessBlock(access),
    ],
  });

  // Ayar düğmeleri üstte, üye menüleri altta. Kilit/gizlilik açılıp kapandıkça yer değiştirmesin diye hep sonda durur
  container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.limit).setLabel('Limiti Ayarla').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.rename).setLabel('İsmi Değiştir').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.lock).setLabel(locked ? 'Kilidi Aç' : 'Kilitle').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(IDS.hide).setLabel(hidden ? 'Göster' : 'Gizle').setStyle(hidden ? ButtonStyle.Success : ButtonStyle.Danger),
      ),
    );

  // Üye menüleri tek başlık altında yan yana durur: her menünün üstüne ayrı başlık koymak paneli bölüm bölüm
  // bölüyordu. Kimi istediği zaten menünün kendi satırında yazdığı için başlık yalnızca grubun adını taşır.
  // Panel 40 bileşen sınırında nefes alanı kalsın diye menüler ard arda dizilir (arasına çizgi girmez).
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('### Üye İşlemleri\nOdaya üye ekle, izni kaldır, odadan at, yasakla ya da sahipliği devret.'));
  for (const id of [IDS.add, IDS.drop, IDS.kick, IDS.ban, IDS.transfer])
    container.addActionRowComponents(new ActionRowBuilder().addComponents(userSelect(`${id}:0`, menuHint(id))));

  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(stamp(room.createdAt)));
}

// Menünün kimi istediği kendi satırında yazar: başlıklar tek gruba inince işlemi anlatan taraf bu metin oldu
const menuHint = (id) =>
  ({
    [IDS.add]: 'Odaya eklenecek üyeyi seç',
    [IDS.drop]: 'İzni kaldırılacak üyeyi seç',
    [IDS.kick]: 'Odadan atılacak üyeyi seç',
    [IDS.ban]: 'Odaya yasaklanacak üyeyi seç',
    [IDS.transfer]: 'Sahipliği devredilecek üyeyi seç',
  })[id];

// Odada ayrı izni olan üyeler: davetliler girer, yasaklılar giremez. Liste yoksa menünün ne işe yaradığı yazılır.
function accessBlock({ invited, banned }) {
  const line = (title, ids) => {
    const shown = ids.slice(0, 12).map((id) => `<@${id}>`).join(' ');
    return `**${title}:** ${ids.length > 12 ? `${shown} +${ids.length - 12} kişi daha` : shown}`;
  };
  const parts = [];
  if (invited.length) parts.push(line('Davetli', invited));
  if (banned.length) parts.push(line('Yasaklı', banned));
  return `### Odadaki İzinler\n${parts.length ? parts.join('\n') : 'Davet ettiğin ya da yasakladığın üye yok. Oda kilitliyken içeri girebilmesi için **Üye İşlemleri** menüsünden bir üye ekleyebilirsin.'}`;
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
      '### Oda Nasıl Açılır?',
      `1. <#${config.createChannelId}> kanalına gir; senin için **kendi ses kanalın** açılır.`,
      '2. Odanın adı görünen adından oluşur, istediğin zaman değiştirebilirsin.',
      '3. Ayarları odanın yazı sohbetindeki **kontrol panelinden** yaparsın.',
    ].join('\n'),
    [
      '### Oda Sahibi Neler Yapabilir?',
      '1. Odayı **kilitleyerek** yeni girişleri durdurur, **gizleyerek** kanal listesinden saklar.',
      '2. Odaya **üye ekler**: eklediği üyeler oda kilitliyken de girebilir; izni kaldırınca dışarıda kalır.',
      '3. Kişi limitini ve odanın adını değiştirir; odadakileri **atar**, **yasaklar** ya da sahipliği **devreder**.',
    ].join('\n'),
    [
      '### Bilmen Gerekenler',
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
