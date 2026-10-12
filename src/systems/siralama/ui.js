// Sıralama mesajı: başlık (sunucu ikonuyla), dönem butonları, rol filtresi, sıralama türü, liste ve sayfalar.
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
const { divider, text, pageInfo, pagerRow, page: pageLayout } = require('../../core/ui');

const IDS = {
  navigate: 'siralama', // siralama:<tür>:<dönem>:<gün>:<rol>:<sayfa>:<buton yeri>
  role: 'siralama-rol', // siralama-rol:<tür>:<dönem>:<gün>
  type: 'siralama-tur', // siralama-tur:<dönem>:<gün>:<rol>
  custom: 'siralama-sure', // siralama-sure:<tür>:<rol> (Özel Süre butonu)
  customModal: 'siralama-sure-form', // siralama-sure-form:<tür>:<rol>
  days: 'siralama-gun',
};

const PAGE_SIZE = 15;
const TYPES = {
  mesaj: 'Mesaj Sıralaması',
  ses: 'Ses Sıralaması',
  yayin: 'Yayın Sıralaması',
  saygi: 'Saygınlık Sıralaması',
  coin: 'Coin Sıralaması',
  vip: 'VIP Sıralaması',
};
// Dönem yalnızca gün gün biriken türlerde anlamlıdır. Saygınlık bir daha düşmez, coin anlık cüzdandır, VIP bir
// tarih sırasıdır: bunlarda Genel/Haftalık/Özel Süre düğmeleri görünür kalır ama pasifleşir.
const DONEM = new Set(['mesaj', 'ses', 'yayin']);
const PERIODS = { genel: 'Genel', haftalik: 'Haftalık', ozel: 'Özel Süre' };
// Başlığın altındaki tek satır, o türün neyi saydığını ve dönemin neden seçilemediğini söyler
const ACIKLAMA = {
  mesaj: 'mesaj sayına göre sıralanır; Genel, Haftalık ya da son X gün seçilebilir.',
  ses: 'sesli kanallarda geçirdiğin süreye göre sıralanır; Genel, Haftalık ya da son X gün seçilebilir.',
  yayin: 'ekran paylaşımında geçirdiğin süreye göre sıralanır; Genel, Haftalık ya da son X gün seçilebilir.',
  saygi: 'toplam saygınlığına göre sıralanır; saygınlık hiç düşmediği için tek dönem vardır.',
  coin: 'şu anki cüzdanına göre sıralanır; harcayan geri düştüğü için tek dönem vardır.',
  vip: 'VIP rolünü alma sırasına göre listelenir; satırın sağındaki tarih VIP olunan gündür.',
};
const BOS = {
  mesaj: 'Bu dönemde sayılan bir mesaj yok.',
  ses: 'Bu dönemde sayılan bir ses süresi yok.',
  yayin: 'Bu dönemde sayılan bir yayın süresi yok.',
  saygi: 'Sunucuda henüz saygınlık kazanmış üye yok.',
  coin: 'Cüzdanında coin olan üye yok.',
  vip: 'VIP rolünü taşıyan üye yok.',
};
// Sayfa 1'deki ilk üç sıra büyük yazılır
const PODIUM = ['# ', '## ', '### '];

const number = (value) => value.toLocaleString('tr-TR');

function formatValue(type, value) {
  if (type === 'mesaj') return `${number(value)} mesaj`;
  if (type === 'saygi') return `${number(value)} saygınlık`;
  if (type === 'coin') return `${number(value)} coin`;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (!hours && !minutes) return 'Bir dakikadan az';
  return hours ? `${number(hours)} saat ${minutes} dk` : `${minutes} dk`;
}

// Satırın sağ hücresi: sayılar kod biçiminde yazılır; VIP'in değeri bir tarih olduğu için Discord damgası olur
// ve kodun içine girerse okunmaz (damga işlenmez).
const hucre = (type, value) => (type === 'vip' ? (value ? `<t:${Math.floor(value / 1000)}:D>` : 'kayıt öncesi') : `\`${formatValue(type, value)}\``);

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
    .setPlaceholder('Rol filtrele')
    .setMinValues(0)
    .setMaxValues(1);
  if (role) roleSelect.setDefaultRoles(role);

  // Liste
  const lines = pageItems.map(({ userId, value }, i) => {
    const rank = start + i + 1;
    const size = current === 0 && rank <= 3 ? PODIUM[rank - 1] : '';
    return `${size}${rank}. <@${userId}> » \`${formatValue(type, value)}\`${userId === viewerId ? ' **(Sen)**' : ''}`;
  });
  // Komutu kullanan bu sayfada yoksa sırası en altta gösterilir
  const viewerRank = ranking.findIndex((r) => r.userId === viewerId);
  if (viewerRank !== -1 && (viewerRank < start || viewerRank >= start + PAGE_SIZE)) {
    lines.push(`${viewerRank + 1}. <@${viewerId}> » \`${formatValue(type, ranking[viewerRank].value)}\` **(Sen)**`);
  }

  const listBlock = lines.length
    ? lines.join('\n')
    : `**Henüz kayıt yok.**\n${role ? 'Bu rolde bu dönemde sayılan üye yok.' : 'Bu dönemde sayılan bir mesaj, ses ya da yayın süresi yok.'}`;

  const container = pageLayout({
    title: 'Sıralama',
    sub:
      (role ? `<@&${role}> rolündeki üyeler listeleniyor; ` : 'Sunucudaki bütün üyeler listeleniyor; ') +
      'mesaj sayısı, ses ve yayın (ekran paylaşımı) süresine göre sıralanır.',
    thumbnail: guild.iconURL({ size: 256 }),
  });

  // Sıra: dönem butonları, rol ve tür menüleri, liste başlığı + liste (başlıktan ayrı bir metin: listedeki küçük satırlar
  // otomatik "not" sayılıp çizgiyle ayrılmasın), sayfa bilgisi ve en altta sayfa butonları (her zaman görünür, tek
  // sayfada pasif)
  container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
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
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`## ${TYPES[type]}`), text(listBlock));

  const nav = (target, slot) => `${IDS.navigate}:${state(type, period, days, roleId)}:${target}:${slot}`;
  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`-# ${pageInfo(current, pageCount, ranking.length)}`))
    .addActionRowComponents(pagerRow({ prevId: nav(current - 1, 'prev'), nextId: nav(current + 1, 'next'), page: current, pageCount }));
  return container;
}

// "Özel Süre": kaç günlük sıralama gösterileceği
function customModal(type, roleId) {
  return new ModalBuilder()
    .setCustomId(`${IDS.customModal}:${type}:${roleId}`)
    .setTitle('Özel Süre Seç')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Kaç günlük sıralama gösterilsin?')
        .setDescription('1 ile 365 arasında bir gün sayısı yaz; bugün de sayılır.')
        .setTextInputComponent(
          new TextInputBuilder().setCustomId(IDS.days).setStyle(TextInputStyle.Short).setPlaceholder('Örn: 30').setMaxLength(3).setRequired(true),
        ),
    );
}

module.exports = { IDS, TYPES, leaderboard, customModal };
