// Sıralama mesajı: başlık (sunucu adı ve ikonu), rol filtresi, sıralama türü, dönem butonları, liste ve sayfalar.
// Tüm durum (tür, dönem, gün sayısı, rol, sayfa) buton ve menü ID'lerinde taşınır.
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { divider, page: pageLayout } = require('../../core/ui');

const IDS = {
  navigate: 'siralama', // siralama:<tür>:<dönem>:<gün>:<rol>:<sayfa>:<buton yeri>
  role: 'siralama-rol', // siralama-rol:<tür>:<dönem>:<gün>
  type: 'siralama-tur', // siralama-tur:<dönem>:<gün>:<rol>
  custom: 'siralama-sure', // siralama-sure:<tür>:<rol> (Özel Süre butonu)
  customModal: 'siralama-sure-form', // siralama-sure-form:<tür>:<rol>
  days: 'siralama-gun',
};

const PAGE_SIZE = 15;
const TYPES = { mesaj: 'Mesaj Sıralaması', ses: 'Ses Sıralaması' };
const PERIODS = { genel: 'Genel', haftalik: 'Haftalık', ozel: 'Özel Süre' };
// Sayfa 1'deki ilk üç sıra büyük yazılır
const PODIUM = ['# ', '## ', '### '];

const number = (value) => value.toLocaleString('tr-TR');

function formatValue(type, value) {
  if (type === 'mesaj') return `${number(value)} mesaj`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours ? `${number(hours)} saat ${minutes} dk` : `${minutes} dk`;
}

const periodLabel = (period, days) => (period === 'ozel' ? `Son ${days} Gün` : PERIODS[period]);

// view: { guild, viewerId, type, period, days, roleId, page, ranking: [{ userId, value }] }
function leaderboard({ guild, viewerId, type, period, days, roleId, page, ranking }) {
  const role = roleId !== '0' ? roleId : null;
  const pageCount = Math.max(1, Math.ceil(ranking.length / PAGE_SIZE));
  const current = Math.min(Math.max(page, 0), pageCount - 1);
  const start = current * PAGE_SIZE;
  const pageItems = ranking.slice(start, start + PAGE_SIZE);
  const state = (t, p, d, r) => `${t}:${p}:${d}:${r}`;

  // Filtreler: rol, sıralama türü ve dönem
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`${IDS.role}:${type}:${period}:${days}`)
    .setPlaceholder('Sıralamayı Rol İle Filtrele')
    .setMinValues(0)
    .setMaxValues(1);
  if (role) roleSelect.setDefaultRoles(role);

  // Liste
  const lines = pageItems.map(({ userId, value }, i) => {
    const rank = start + i + 1;
    const size = current === 0 && rank <= 3 ? PODIUM[rank - 1] : '-# ';
    return `${size}${rank}. <@${userId}> » \`${formatValue(type, value)}\`${userId === viewerId ? ' **(Sen)**' : ''}`;
  });
  // Komutu kullanan bu sayfada yoksa sırası en altta gösterilir
  const viewerRank = ranking.findIndex((r) => r.userId === viewerId);
  if (viewerRank !== -1 && (viewerRank < start || viewerRank >= start + PAGE_SIZE)) {
    lines.push(`-# ${viewerRank + 1}. <@${viewerId}> » \`${formatValue(type, ranking[viewerRank].value)}\` **(Sen)**`);
  }

  const blocks = [
    `**${TYPES[type]} (${periodLabel(period, days)})**\n${lines.length ? lines.join('\n') : '-# Bu dönem için henüz veri yok.'}`,
  ];
  if (ranking.length) {
    blocks.push(
      `**Sayfa Bilgisi**\n` +
        `-# Toplam **${number(ranking.length)}** kayıt arasından **${start + 1}-${start + pageItems.length}** arası gösteriliyor.\n` +
        `-# Sayfa: \`${current + 1} / ${pageCount}\``,
    );
  }

  const container = pageLayout({
    title: `${guild.name} Sıralamaları`,
    sub:
      (role ? `<@&${role}> rolündeki üyelerin verileri listeleniyor; ` : 'Sunucu genelindeki tüm veriler listeleniyor; ') +
      'aşağıdaki menülerden rol, sıralama türü ve dönem seçerek listeyi istediğin gibi filtreleyebilir, butonlarla sayfalar arasında gezebilirsin.',
    thumbnail: guild.iconURL({ size: 256 }),
    blocks,
  });

  container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(roleSelect),
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${IDS.type}:${period}:${days}:${roleId}`)
          .addOptions(
            Object.entries(TYPES).map(([key, label]) =>
              new StringSelectMenuOptionBuilder().setValue(key).setLabel(label).setDefault(key === type),
            ),
          ),
      ),
      new ActionRowBuilder().addComponents(
        ...['genel', 'haftalik'].map((key) =>
          new ButtonBuilder()
            .setCustomId(`${IDS.navigate}:${state(type, key, 0, roleId)}:0:${key}`)
            .setLabel(PERIODS[key])
            .setStyle(key === period ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
        new ButtonBuilder()
          .setCustomId(`${IDS.custom}:${type}:${roleId}`)
          .setLabel(period === 'ozel' ? periodLabel(period, days) : PERIODS.ozel)
          .setStyle(period === 'ozel' ? ButtonStyle.Success : ButtonStyle.Secondary),
      ),
    );

  // Sayfalar
  if (ranking.length) {
    const nav = (target, slot) => `${IDS.navigate}:${state(type, period, days, roleId)}:${target}:${slot}`;
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(nav(current - 1, 'prev')).setLabel('«').setStyle(ButtonStyle.Primary).setDisabled(current === 0),
        new ButtonBuilder().setCustomId(nav(current + 1, 'next')).setLabel('»').setStyle(ButtonStyle.Primary).setDisabled(current >= pageCount - 1),
      ),
    );
  }
  return container;
}

// "Özel Süre": kaç günlük sıralama gösterileceği
function customModal(type, roleId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.customModal}:${type}:${roleId}`)
    .setTitle('Özel Süre')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kaç günlük sıralama gösterilsin?')
        .setDescription('1 ile 365 arasında bir sayı yaz. Bugün dahil son o kadar gün sayılır.')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId(IDS.days).setStyle(TextInputStyle.Short).setPlaceholder('Örn: 30').setMaxLength(3).setRequired(true),
        ),
    );
}

module.exports = { IDS, TYPES, leaderboard, customModal };
