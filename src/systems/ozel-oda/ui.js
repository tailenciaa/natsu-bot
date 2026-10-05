// Özel oda sisteminin mesajları: oda açılınca kendi ses kanalının metin sohbetine düşen kontrol paneli ve
// limit/isim değiştirme formları.
const {
  ActionRowBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { divider, colors, page, text } = require('../../core/ui');

const IDS = {
  lock: 'oda-kilit',
  hide: 'oda-gizle',
  limit: 'oda-limit',
  limitModal: 'oda-limit-form',
  limitInput: 'oda-limit-sayi',
  rename: 'oda-isim',
  renameModal: 'oda-isim-form',
  renameInput: 'oda-isim-yeni',
  kick: 'oda-at', // oda-at:0 (StringSelectMenu'nün prefixli yönlendirilmesi için sabit ek)
  ban: 'oda-yasakla', // oda-yasakla:0
  transfer: 'oda-devret', // oda-devret:0
};

const NONE = 'yok';

const isLocked = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has('Connect') ?? false;
const isHidden = (channel) => channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id)?.deny.has('ViewChannel') ?? false;

// Oda sahibi hariç, o an kanalda bulunan üyelerden seçim menüsü kurar; kimse yoksa devre dışı bir menü döner
function memberSelect(customId, placeholder, channel, ownerId) {
  const others = [...channel.members.values()].filter((m) => m.id !== ownerId);
  const menu = new StringSelectMenuBuilder().setCustomId(customId);

  if (!others.length) {
    return menu
      .setPlaceholder('Odada başka kimse yok')
      .setDisabled(true)
      .addOptions(new StringSelectMenuOptionBuilder().setValue(NONE).setLabel('Odada başka kimse yok'));
  }

  return menu.setPlaceholder(placeholder).addOptions(
    others.slice(0, 25).map((m) => new StringSelectMenuOptionBuilder().setValue(m.id).setLabel(m.displayName ?? m.user.username)),
  );
}

// Odanın kendi ses kanalı sohbetine gönderilen, sadece oda sahibinin kullanabildiği kontrol paneli
function controlPanel(room, channel) {
  const locked = isLocked(channel);
  const hidden = isHidden(channel);

  return page({
    title: 'Oda Kontrol Paneli',
    sub: 'Odanın kilidini, görünürlüğünü, kişi limitini ve ismini bu panelden yönetebilir; odadaki üyeleri atabilir, yasaklayabilir ya da odanın sahipliğini başka birine devredebilirsin.',
    accent: locked ? colors.danger : colors.primary,
    blocks: [
      `**Oda Bilgisi**\n**Sahip:** <@${room.ownerId}>\n**Durum:** ${locked ? 'Kilitli' : 'Açık'}\n**Görünürlük:** ${hidden ? 'Gizli' : 'Görünür'}\n**Kişi Limiti:** ${channel.userLimit || 'Sınırsız'}\n-# Paneli sadece oda sahibi kullanabilir.`,
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.lock).setLabel(locked ? 'Kilidi Aç' : 'Kilitle').setStyle(locked ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(IDS.hide).setLabel(hidden ? 'Göster' : 'Gizle').setStyle(hidden ? ButtonStyle.Success : ButtonStyle.Secondary),
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.limit).setLabel('Kişi Limiti').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(IDS.rename).setLabel('İsim Değiştir').setStyle(ButtonStyle.Primary),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(memberSelect(`${IDS.kick}:0`, 'Odadan atmak için kullanıcı seç', channel, room.ownerId)),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(memberSelect(`${IDS.ban}:0`, 'Odadan yasaklamak için kullanıcı seç', channel, room.ownerId)),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(memberSelect(`${IDS.transfer}:0`, 'Sahipliği devretmek için kullanıcı seç', channel, room.ownerId)),
    );
}

function limitModal(current) {
  return new ModalBuilder()
    .setCustomId(IDS.limitModal)
    .setTitle('Kişi Limiti')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kişi Limiti')
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
  return new ModalBuilder()
    .setCustomId(IDS.renameModal)
    .setTitle('Oda İsmi')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Yeni İsim')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(IDS.renameInput)
            .setStyle(TextInputStyle.Short)
            .setValue(current ?? '')
            .setMaxLength(100)
            .setRequired(true),
        ),
    );
}


const GUIDE_BANNER =
  'https://cdn.discordapp.com/attachments/1538539811697332385/1555892852775718992/odabilgikazuki.jpg?backend=b2&ex=6ac37f23&is=6ac22da3&hm=da08b7431f50952593069496c3612a3eca3a95aeb8a126dcf0ffb67490fd403e&';
const GUIDE_TITLE = 'Özel Oda Rehberi';

// #özel-oda-rehberi kanalına giden bilgi paneli: odanın nasıl açıldığı ve kontrol panelinin ne yaptığı
function guidePanel() {
  const { createChannelId } = require('./config');
  const blocks = [
    `**Oda nasıl açılır?**\n<#${createChannelId}> kanalına girdiğinde senin için kendi ses kanalın açılır ve içine alınırsın. Odanın adı görünen adından oluşur, istediğin zaman değiştirebilirsin. Odanın yazı sohbetinde oda ayarlarını yönettiğin panel durur.`,
    '**Oda sahibi neler yapabilir?**\nOdayı kilitleyerek yeni girişleri durdurabilir, gizleyerek kanal listesinde sadece içindekilere görünür yapabilirsin. Kişi limitini ve odanın adını da değiştirebilirsin, limit 0 ise sınırsızdır.',
    '**Kullanıcı yönetimi**\nSeçtiğin kişiyi odadan atabilir ya da oda silinene kadar tekrar girmesini engelleyebilirsin. Odanın sahipliğini odadaki başka bir üyeye devredebilirsin, menüler sadece o an odada olanları listeler.',
    '**Bilmen gerekenler**\nPaneli sadece oda sahibi kullanabilir, spam olmasın diye işlemler arasında kısa bir bekleme vardır. Odada kimse kalmayınca oda silinir ve oluştur kanalına her girişinde yeni bir oda açılır.',
  ];
  const container = page({
    title: GUIDE_TITLE,
    sub: 'Kendi özel sesli odanı nasıl açacağını, oda kontrol panelindeki seçeneklerin ne işe yaradığını ve odanın hangi durumlarda kapandığını bu kanalda adım adım öğrenebilirsin.',
  });
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(GUIDE_BANNER)));
  for (const block of blocks) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container;
}

module.exports = { IDS, NONE, GUIDE_TITLE, guidePanel, controlPanel, limitModal, renameModal };
