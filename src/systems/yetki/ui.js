// Elle yetki verme panelinin mesajları
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { colors, divider, page, field, fields, rows, chip, stamp } = require('../../core/ui');
const { staffCommandChannel } = require('../../core/config');
const config = require('./config');

const IDS = {
  level: 'yetki-seviye', // yetki-seviye:<kullanıcı>
  perms: 'yetki-perm', // yetki-perm:<kullanıcı>:<seviye>:<görev maskesi>
  duties: 'yetki-gorev', // yetki-gorev:<kullanıcı>:<seviye>:<yetki maskesi>
  give: 'yetki-ver', // yetki-ver:<kullanıcı>:<seviye>:<yetki maskesi>:<görev maskesi>
  cancel: 'yetki-iptal',
  // Yetki alma: menüler ve "Seçilenleri Al" aynı biçimi taşır: yetki-al-...:<kullanıcı>:<rütbe maskesi>:<yetki maskesi>:<görev maskesi>
  takeLevel: 'yetki-al-seviye',
  takePerms: 'yetki-al-perm',
  takeDuties: 'yetki-al-gorev',
  takeSelected: 'yetki-al-secili',
  takeAll: 'yetki-al-hepsi', // yetki-al-hepsi:<kullanıcı>
  takeCancel: 'yetki-al-iptal',
};

// Seçimler buton/menü ID'lerinde (en fazla 100 karakter) taşınır: listedeki sıraya göre bit maskesi, 36'lık tabanda
const mask = (ids, list) => list.reduce((n, item, i) => (ids.includes(item.id) ? n | (1 << i) : n), 0).toString(36);
const unmask = (value, list) => {
  const n = parseInt(value || '0', 36) || 0;
  return list.filter((_, i) => n & (1 << i)).map((item) => item.id);
};

// Seçili öğelerin adları; hiçbiri seçili değilse "Yok"
const labelsOf = (list, ids) => list.filter((item) => ids.includes(item.id)).map((item) => item.label).join(', ') || 'Yok';
// Seçim değerleri kartta kod rozetinde durur; seçim yapılmadıysa boşluk hali rozetsiz, düz yazıyla kalır
const choice = (value) => (value === 'Yok' ? value : chip(value));

// state: { user, levelId, permIds, done, missingRoles }. Seçimler buton/menü ID'lerinde taşınır.
function staffPanel({ user, levelId, permIds, dutyIds = [], done, missingRoles, by, roleIds = [] }) {
  const { levels, perms, duties } = config;
  const level = levels.find((l) => l.id === levelId);
  const summary = rows([
    ['Rütbe', level ? chip(level.label) : 'Seçilmedi'],
    ['Yetkiler', labelsOf(perms, permIds)],
    ['Görev Rolleri', labelsOf(duties, dutyIds)],
  ]);

  const blocks = done
    ? [
        fields(['**Yeni Yetkili**', `<@${user.id}> artık **yetkili ekibinde.**`, field('Yetkiyi Veren', `<@${by}>`)]),
        `**Verilen Yetkiler**\n${summary}`,
        `**Verilen Roller**\n${roleIds.map((id) => `<@&${id}>`).join(' ')}${missingRoles ? '\nBazı yetkilerin **rolü henüz ayarlanmadığı** için o roller verilmedi.' : ''}`,
        stamp(),
      ]
    : [`**Düzenlenen Üye**\n<@${user.id}> için **yetki düzenliyorsun.**`, `**Seçimler**\n${summary}`];

  const container = page({
    title: done ? 'Yetki Verildi' : 'Yetki Ver',
    sub: done
      ? 'Rütbe, yetkiler ve görev rolleri üyeye tanımlandı. Bu mesaj, yetkilendirme işleminin kaydı olarak kanalda kalır.'
      : 'Rütbe seçince o rütbenin yetkileri ve görev rolleri otomatik işaretlenir; istersen bunları tek tek düzenleyebilir, sonunda **Yetkiyi Ver** butonuyla seçimini onaylayabilirsin.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    accent: done ? colors.success : colors.primary,
    blocks,
  });

  if (!done) {
    container.addSeparatorComponents(divider()).addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.level}:${user.id}`)
          .setPlaceholder('Rütbe seç')
          .addOptions(
            levels.map((l) =>
              new StringSelectMenuOptionBuilder().setValue(l.id).setLabel(l.label).setDescription(l.description).setDefault(l.id === levelId),
            ),
          ),
      ),
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.perms}:${user.id}:${levelId ?? '0'}:${mask(dutyIds, duties)}`)
          .setPlaceholder(level ? 'Yetki seç' : 'Önce rütbe seç')
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
          .setPlaceholder(level ? 'Görev rolü seç' : 'Önce rütbe seç')
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
  fields([
    '**Başlarken**',
    field('Komutlar', `Yetkili komutlarını <#${staffCommandChannel}> kanalında kullanabilirsin.`),
    field('Kurallar', `Yetkili kurallarını <#${config.guide.rules}> kanalından okuyabilirsin.`),
    field('İşleyiş', `Yetkili işleyişini <#${config.guide.info}> kanalından öğrenebilirsin.`),
    field('Sohbet', `Ekiple <#${config.guide.chat}> kanalında konuşabilirsin.`),
  ]);

// Yetki verilen kişiye giden DM: ne verildiği ve nereden başlayacağı
function grantDm(guildName, { level, permIds, dutyIds, by }) {
  return page({
    title: 'Ekibe Hoş Geldin',
    sub: `${guildName} sunucusunda artık yetkili ekibinin bir parçasısın. Sana tanımlanan rütbe, yetkiler ve görev rolleri ile nereden başlayacağın bu mesajda; yeni görevinde başarılar.`,
    accent: colors.success,
    blocks: [
      `**Yetki Bilgilerin**\n${rows([
        ['Rütbe', chip(level.label)],
        ['Yetkiler', labelsOf(config.perms, permIds)],
        ['Görev Rolleri', labelsOf(config.duties, dutyIds)],
        ['Yetkiyi Veren', `<@${by}>`],
      ])}`,
      guideText(),
      stamp(),
    ],
  });
}

// Yetki alma paneli. held: üyenin şu an sahip olduğu { levelIds, permIds, dutyIds }; picked: alınmak üzere seçilenler.
// Menüde sadece üyenin sahip olduğu rütbe/yetki/görev çıkar; hiçbiri yoksa o menü hiç gösterilmez.
function takePanel({ user, held, picked, done, by, roleIds = [], all = false }) {
  const { levels, perms, duties } = config;
  const summary = (src) =>
    rows([
      ['Rütbe', choice(labelsOf(levels, src.levelIds))],
      ['Yetkiler', labelsOf(perms, src.permIds)],
      ['Görev Rolleri', labelsOf(duties, src.dutyIds)],
    ]);

  const blocks = done
    ? [
        fields([
          '**Yetkisi Kaldırılan**',
          `<@${user.id}> artık ${all ? '**yetkili ekibinde değil.**' : '**seçilen yetkilere sahip değil.**'}`,
          field('Yetkiyi Kaldıran', `<@${by}>`),
        ]),
        `**Kaldırılan Yetkiler**\n${summary(all ? held : picked)}`,
        `**Kaldırılan Roller**\n${roleIds.map((id) => `<@&${id}>`).join(' ') || 'Kaldırılacak rol kalmamıştı.'}`,
        stamp(),
      ]
    : [`**Düzenlenen Üye**\n<@${user.id}>'ın **yetkilerini kaldırıyorsun.**`, `**Şu Anki Yetkileri**\n${summary(held)}`, `**Kaldırılacaklar**\n${summary(picked)}`];

  const container = page({
    title: done ? 'Yetki Kaldırıldı' : 'Yetki Kaldır',
    sub: done
      ? 'Seçilen rütbe, yetki ve görev rolleri üyeden kaldırıldı. Bu mesaj, işlemin kaydı olarak kanalda kalır.'
      : 'Menülerden **üyeden kaldırılacak** rütbe, yetki ve görev rollerini seç, ardından **Seçilenleri Kaldır** butonuyla onayla; üyenin bütün yetkilerini birden kaldırmak için **Hepsini Kaldır** butonunu kullan.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    accent: done ? colors.danger : colors.primary,
    blocks,
  });
  if (done) return container;

  const stateId = (kind) =>
    `${kind}:${user.id}:${mask(picked.levelIds, levels)}:${mask(picked.permIds, perms)}:${mask(picked.dutyIds, duties)}`;
  const menu = (kind, placeholder, list, heldIds, pickedIds) =>
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(stateId(kind))
        .setPlaceholder(placeholder)
        .setMinValues(0)
        .setMaxValues(heldIds.length)
        .addOptions(
          list
            .filter((item) => heldIds.includes(item.id))
            .map((item) => new StringSelectMenuOptionBuilder().setValue(item.id).setLabel(item.label).setDefault(pickedIds.includes(item.id))),
        ),
    );

  const rows = [];
  if (held.levelIds.length) rows.push(menu(IDS.takeLevel, 'Kaldırılacak rütbe', levels, held.levelIds, picked.levelIds));
  if (held.permIds.length) rows.push(menu(IDS.takePerms, 'Kaldırılacak yetkiler', perms, held.permIds, picked.permIds));
  if (held.dutyIds.length) rows.push(menu(IDS.takeDuties, 'Kaldırılacak görev rolleri', duties, held.dutyIds, picked.dutyIds));
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(stateId(IDS.takeSelected))
        .setStyle(ButtonStyle.Danger)
        .setLabel('Seçilenleri Kaldır')
        .setDisabled(![picked.levelIds, picked.permIds, picked.dutyIds].some((list) => list.length)),
      new ButtonBuilder().setCustomId(`${IDS.takeAll}:${user.id}`).setStyle(ButtonStyle.Danger).setLabel('Hepsini Kaldır'),
      new ButtonBuilder().setCustomId(IDS.takeCancel).setStyle(ButtonStyle.Secondary).setLabel('İptal'),
    ),
  );
  return container.addSeparatorComponents(divider()).addActionRowComponents(...rows);
}

// Yetkisi kaldırılan kişiye giden DM
function revokeDm(guildName, { taken, by, all }) {
  return page({
    title: all ? 'Yetkili Ekibinden Çıkarıldın' : 'Bazı Yetkilerin Kaldırıldı',
    sub: all
      ? `${guildName} sunucusundaki yetkili ekibi üyeliğin sona erdi ve bütün yetkilerin kaldırıldı; bugüne kadarki emeğin için teşekkür ederiz.`
      : `${guildName} sunucusunda bazı yetkilerin kaldırıldı; kaldırılan yetkileri ve işlemi yapan yetkiliyi bu mesajda görebilirsin.`,
    accent: colors.danger,
    blocks: [
      `**Kaldırılan Yetkiler**\n${rows([
        ['Rütbe', choice(labelsOf(config.levels, taken.levelIds))],
        ['Yetkiler', labelsOf(config.perms, taken.permIds)],
        ['Görev Rolleri', labelsOf(config.duties, taken.dutyIds)],
        ['Yetkiyi Kaldıran', `<@${by}>`],
      ])}`,
      stamp(),
    ],
  });
}

module.exports = { IDS, unmask, guideText, staffPanel, grantDm, takePanel, revokeDm };
