// Elle yetki verme panelinin mesajları
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ThumbnailBuilder,
} = require('discord.js');
const { colors, text, divider, notice } = require('../../core/ui');
const config = require('./config');

const IDS = {
  level: 'yetki-seviye', // yetki-seviye:<kullanıcı>
  perms: 'yetki-perm', // yetki-perm:<kullanıcı>:<seviye>
  give: 'yetki-ver', // yetki-ver:<kullanıcı>:<seviye>:<yetkiler>
  cancel: 'yetki-iptal',
};

// state: { user, levelId, permIds, done, missingRoles }. Seçimler buton/menü ID'lerinde taşınır.
function staffPanel({ user, levelId, permIds, done, missingRoles }) {
  const { levels, perms } = config;
  const level = levels.find((l) => l.id === levelId);
  const permLabels = perms.filter((p) => permIds.includes(p.id)).map((p) => p.label);
  const header = done
    ? // Seviye ve yetkiler aşağıda ayrıca yazıyor
      '## Yetki Verildi\n' +
      `**<@${user.id}> artık ekipte.**\n` +
      (missingRoles ? '-# Bazı yetkilerin rolü henüz ayarlanmadığı için o roller verilmedi.' : '-# Seçilen yetkilerin rolleri verildi.')
    : '## Yetki Ver\n' +
      `**<@${user.id}> için yetki düzenliyorsun.**\n` +
      '-# Seviye seçtiğinde o seviyenin yetkileri otomatik işaretlenir, istersen ekleme ya da çıkarma yapabilirsin.';

  const container = new ContainerBuilder()
    .setAccentColor(done ? colors.success : colors.primary)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(header))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 256 }))),
    )
    .addSeparatorComponents(divider());

  if (!done) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.level}:${user.id}`)
          .setPlaceholder('Yetki seviyesini seç')
          .addOptions(
            levels.map((l) =>
              new StringSelectMenuOptionBuilder().setValue(l.id).setLabel(l.label).setDefault(l.id === levelId),
            ),
          ),
      ),
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.perms}:${user.id}:${levelId ?? '0'}`)
          .setPlaceholder(level ? 'Yetkileri düzenle' : 'Önce seviye seç')
          .setMinValues(0)
          .setMaxValues(perms.length)
          .setDisabled(!level)
          .addOptions(
            perms.map((p) =>
              new StringSelectMenuOptionBuilder().setValue(p.id).setLabel(p.label).setDefault(permIds.includes(p.id)),
            ),
          ),
      ),
    );
    container.addSeparatorComponents(divider());
  }

  container.addTextDisplayComponents(
    text(
      [
        `**Seviye:** ${level ? level.label : 'Seçilmedi'}`,
        `**Yetkiler:** ${permLabels.length ? permLabels.join(', ') : 'Yok'}`,
      ].join('\n'),
    ),
  );

  if (!done) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.give}:${user.id}:${levelId ?? '0'}:${permIds.join(',')}`)
          .setStyle(ButtonStyle.Success)
          .setLabel('Yetkiyi Ver')
          .setDisabled(!level),
        new ButtonBuilder().setCustomId(IDS.cancel).setStyle(ButtonStyle.Secondary).setLabel('İptal'),
      ),
    );
  }

  return container;
}

// Yetki verilen kişiye giden kısa tebrik DM'i
function grantDm(guildName) {
  return notice(
    '### Ekibe Hoş Geldin!\n' +
      `**${guildName} sunucusunda artık yetkili ekibinin bir parçasısın.**\n` +
      '-# Yeni görevinde başarılar dileriz!',
    'success',
  );
}

module.exports = { IDS, staffPanel, grantDm };
