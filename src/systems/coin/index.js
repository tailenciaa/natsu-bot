// Coin sistemi: üyeler sunucudaki etkinlikleriyle coin biriktirir ve profil kozmetiği alır. Günlük ödül tek
// komutla (/gunluk) toplanır; diğer kazançlar ilgili sistemler tarafından award() ile verilir (seviye atlama,
// haftalık derece, saygınlık verme). Gün sınırı İstanbul saatiyle gece yarısıdır.
// /bakiye cüzdanı açar: bakiye, seri, harcanan ve mağaza ile siparişlere giden butonlar tek kartta durur.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { respond, isMenuOwner, menuOwnerError } = require('../../core/helpers');
const { levelFromXp } = require('../seviye/level');
const seviyeStore = require('../seviye/store');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('gunluk')
    .setDescription('Günlük coin ödülünü toplar ve giriş serisini sürdürür.')
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('bakiye')
    .setDescription('Coin cüzdanını, giriş serisini ve mağazadan alınanları gösterir.')
    .setContexts(InteractionContextType.Guild),
];

// /gunluk: bugün henüz alınmadıysa ödül yazar, seri ve bakiye bildirilir
async function handleDaily(interaction) {
  const level = Math.max(levelFromXp(seviyeStore.xpOf('mesaj', interaction.user.id)), levelFromXp(seviyeStore.xpOf('ses', interaction.user.id)));
  const result = store.claim(interaction.user.id, level);

  if (!result.ok) {
    return respond(
      interaction,
      core.alert('Günlük ödülünü bugün zaten topladın.', `Sıradaki ödül ${core.rel(result.nextAt)} içinde hazır oluyor.`),
    );
  }

  const { base } = config.daily;
  const number = ui.number;
  return respond(
    interaction,
    core.alert(
      `${number(result.amount)} coin topladın.`,
      `**${result.streak}. gün** serin. Taban **${base}**, seri ve seviye bonusu **${result.bonus}**, bakiyen **${number(result.balance)}** coin.`,
      'success',
    ),
  );
}

// Cüzdan kartı: sayılar aynı mağaza bakiyesiyle tek kaynaktan (coin/store) gelir
const walletView = (interaction) =>
  ui.wallet({
    user: interaction.user,
    balance: store.balance(interaction.user.id),
    earned: store.earned(interaction.user.id),
    spent: store.spent(interaction.user.id),
    streak: store.streak(interaction.user.id),
    readyAt: store.dailyReadyAt(interaction.user.id),
  });

const ordersView = (interaction, page = 0) => ui.orders({ user: interaction.user, items: store.purchasesOf(interaction.user.id), page });

// /bakiye: cüzdan sadece kullanana görünür; butonlar ya yeni bir mesaj açar (mağaza) ya da kartın yerini alır
async function handleWallet(interaction) {
  return respond(interaction, walletView(interaction));
}

// coin-siparis:<sayfa>: siparişler ayrı mesaj olmaz, cüzdan kartının yerini alır
async function handleOrders(interaction) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  const [, page] = interaction.customId.split(':');
  return interaction.update({ components: [ordersView(interaction, Number(page) || 0)], allowedMentions: { parse: [] } });
}

// coin-bakiye: sipariş sayfasından cüzdana geri dön
async function handleBack(interaction) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  return interaction.update({ components: [walletView(interaction)], allowedMentions: { parse: [] } });
}

module.exports = {
  name: 'coin',
  commands,
  help: {
    category: ['hesap', 'Profil'],
    member: ['gunluk', 'bakiye'],
    access: { gunluk: 'Herkes', bakiye: 'Herkes' },
  },
  slash: { gunluk: handleDaily, bakiye: handleWallet },
  prefixed: [
    [ui.IDS.orders, handleOrders],
    [ui.IDS.wallet, handleBack],
  ],
};
