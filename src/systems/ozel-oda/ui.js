// Özel oda sisteminin mesajları: oda açılınca kendi ses kanalının metin sohbetine düşen kontrol paneli ve
// limit/isim değiştirme formları.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { text, divider, colors } = require('../../core/ui');

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

  return new ContainerBuilder()
    .setAccentColor(locked ? colors.danger : colors.primary)
    .addTextDisplayComponents(text(`### Oda Kontrol Paneli\n-# Sahip\n**<@${room.ownerId}>**`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**${locked ? 'Kilitli' : 'Açık'}** ・ ` +
          `**${hidden ? 'Gizli' : 'Görünür'}** ・ ` +
          `**Limit:** ${channel.userLimit || 'Sınırsız'}`,
      ),
    )
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

module.exports = { IDS, NONE, controlPanel, limitModal, renameModal };
