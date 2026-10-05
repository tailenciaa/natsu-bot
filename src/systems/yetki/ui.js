// Elle yetki verme panelinin mesajları
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { colors, divider, page, field, fields, stamp } = require('../../core/ui');
const { staffCommandChannel } = require('../../core/config');
const config = require('./config');

const IDS = {
  level: 'yetki-seviye', // yetki-seviye:<kullanıcı>
  perms: 'yetki-perm', // yetki-perm:<kullanıcı>:<seviye>:<görev maskesi>
  duties: 'yetki-gorev', // yetki-gorev:<kullanıcı>:<seviye>:<yetki maskesi>
  give: 'yetki-ver', // yetki-ver:<kullanıcı>:<seviye>:<yetki maskesi>:<görev maskesi>
  cancel: 'yetki-iptal',
};

// Seçimler buton/menü ID'lerinde (en fazla 100 karakter) taşınır: listedeki sıraya göre bit maskesi, 36'lık tabanda
const mask = (ids, list) => list.reduce((n, item, i) => (ids.includes(item.id) ? n | (1 << i) : n), 0).toString(36);
const unmask = (value, list) => {
  const n = parseInt(value || '0', 36) || 0;
  return list.filter((_, i) => n & (1 << i)).map((item) => item.id);
};

// Seçili öğelerin adları; hiçbiri seçili değilse "Yok"
const labelsOf = (list, ids) => list.filter((item) => ids.includes(item.id)).map((item) => item.label).join(', ') || 'Yok';

// state: { user, levelId, permIds, done, missingRoles }. Seçimler buton/menü ID'lerinde taşınır.
function staffPanel({ user, levelId, permIds, dutyIds = [], done, missingRoles, by, roleIds = [] }) {
  const { levels, perms, duties } = config;
  const level = levels.find((l) => l.id === levelId);
  const summary = fields([
    field('Rütbe', level ? level.label : 'Seçilmedi'),
    field('Yetkiler', labelsOf(perms, permIds)),
    field('Görev Rolleri', labelsOf(duties, dutyIds)),
  ]);

  const blocks = done
    ? [
        fields(['**Yeni Yetkili**', `<@${user.id}> artık yetkili ekibinde.`, field('Yetkiyi Veren', `<@${by}>`)]),
        `**Verilen Yetkiler**\n${summary}`,
        `**Verilen Roller**\n${roleIds.map((id) => `<@&${id}>`).join(' ')}${missingRoles ? '\n-# Bazı yetkilerin rolü henüz ayarlanmadığı için o roller verilmedi.' : ''}`,
        stamp(),
      ]
    : [`**Düzenlenen Üye**\n<@${user.id}> için yetki düzenliyorsun.`, `**Seçimler**\n${summary}`];

  const container = page({
    title: done ? 'Yetki Verildi' : 'Yetki Ver',
    sub: done
      ? 'Rütbe, yetkiler ve görev rolleri üyeye tanımlandı; verilen rollerin özeti aşağıda. Bu mesaj, yetkilendirme işleminin kaydı olarak kanalda kalır.'
      : 'Rütbe seçince o rütbenin yetkileri ve görev rolleri otomatik işaretlenir; istersen tek tek ekleyip çıkarabilir, sonunda **Yetkiyi Ver** butonuyla seçimini onaylayabilirsin.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    accent: done ? colors.success : colors.primary,
    blocks,
  });

  if (!done) {
    container.addSeparatorComponents(divider()).addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.level}:${user.id}`)
          .setPlaceholder('Rütbeyi seç')
          .addOptions(
            levels.map((l) =>
              new StringSelectMenuOptionBuilder().setValue(l.id).setLabel(l.label).setDescription(l.description).setDefault(l.id === levelId),
            ),
          ),
      ),
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.perms}:${user.id}:${levelId ?? '0'}:${mask(dutyIds, duties)}`)
          .setPlaceholder(level ? 'Yetkileri düzenle' : 'Önce rütbe seç')
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
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.duties}:${user.id}:${levelId ?? '0'}:${mask(permIds, perms)}`)
          .setPlaceholder(level ? 'Görev rollerini düzenle' : 'Önce rütbe seç')
          .setMinValues(0)
          .setMaxValues(duties.length)
          .setDisabled(!level)
          .addOptions(
            duties.map((d) =>
              new StringSelectMenuOptionBuilder().setValue(d.id).setLabel(d.label).setDefault(dutyIds.includes(d.id)),
            ),
          ),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${IDS.give}:${user.id}:${levelId ?? '0'}:${mask(permIds, perms)}:${mask(dutyIds, duties)}`)
          .setStyle(ButtonStyle.Success)
          .setLabel('Yetkiyi Ver')
          .setDisabled(!level),
        new ButtonBuilder().setCustomId(IDS.cancel).setStyle(ButtonStyle.Secondary).setLabel('İptal'),
      ),
    );
  }

  return container;
}

// Yeni yetkiliye giden DM'lerin "Başlarken" bölümü: nerede ne yapacağı
const guideText = () =>
  '**Başlarken**\n' +
  `Yetkili komutlarını <#${staffCommandChannel}> kanalında kullanabilirsin. Kuralları <#${config.guide.rules}>, işleyişi <#${config.guide.info}> kanalından okuyabilir, ekiple <#${config.guide.chat}> kanalında konuşabilirsin.`;

// Yetki verilen kişiye giden DM: ne verildiği ve nereden başlayacağı
function grantDm(guildName, { level, permIds, dutyIds, by }) {
  return page({
    title: 'Ekibe Hoş Geldin',
    sub: `${guildName} sunucusunda artık yetkili ekibinin bir parçasısın. Sana tanımlanan rütbe, yetkiler ve görev rolleri ile nereden başlayacağın aşağıda; yeni görevinde başarılar.`,
    accent: colors.success,
    blocks: [
      fields([
        '**Yetki Bilgilerin**',
        field('Rütbe', level.label),
        field('Yetkiler', labelsOf(config.perms, permIds)),
        field('Görev Rolleri', labelsOf(config.duties, dutyIds)),
        field('Yetkiyi Veren', `<@${by}>`),
      ]),
      guideText(),
      stamp(),
    ],
  });
}

module.exports = { IDS, unmask, guideText, staffPanel, grantDm };
