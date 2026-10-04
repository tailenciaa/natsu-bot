// Elle yetki verme panelinin mesajları
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { colors, divider, page } = require('../../core/ui');
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
  const missingNote = missingRoles ? 'Bazı yetkilerin rolü henüz ayarlanmadığı için o roller verilmedi.' : 'Seçilen yetkilerin rolleri verildi.';
  const intro = done
    ? `**Yetki Durumu**\n<@${user.id}>\n-# ${missingNote}`
    : `**Düzenlenen Üye**\n<@${user.id}>`;
  const summary = [
    '**Seçimler**',
    `Seviye: ${level ? level.label : 'Seçilmedi'}`,
    `Yetkiler: ${permLabels.length ? permLabels.join(', ') : 'Yok'}`,
  ].join('\n');

  const container = page({
    title: done ? 'Yetki Verildi' : 'Yetki Ver',
    sub: done
      ? 'Seçtiğin seviye ve yetkiler üyeye başarıyla tanımlandı; verilen seviye ile yetkilerin özeti aşağıda yer alıyor, bu mesaj yetkilendirme işleminin kaydı olarak kanalda kalır.'
      : 'Seviye seçtiğinde o seviyenin yetkileri otomatik işaretlenir, istersen tek tek ekleme ya da çıkarma yapabilirsin, sonunda Yetkiyi Ver butonuyla seçimini onaylayabilirsin.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    accent: done ? colors.success : colors.primary,
    blocks: [intro, summary],
  });

  if (!done) {
    container.addSeparatorComponents(divider()).addActionRowComponents(
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
  return page({
    title: 'Ekibe Hoş Geldin!',
    sub: `${guildName} sunucusunda artık yetkili ekibinin bir parçasısın; sana tanımlanan yetkileri ve rolleri sunucuda görebilirsin, yeni görevinde başarılar dileriz.`,
    accent: colors.success,
  });
}

module.exports = { IDS, staffPanel, grantDm };
