// Coin sistemi: üyeler sunucudaki etkinlikleriyle coin biriktirir ve profil kozmetiği alır. Günlük ödül tek
// komutla (/gunluk) toplanır; diğer kazançlar ilgili sistemler tarafından award() ile verilir (seviye atlama,
// haftalık derece, saygınlık verme). Gün sınırı İstanbul saatiyle gece yarısıdır.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { respond } = require('../../core/helpers');
const { levelFromXp } = require('../seviye/level');
const seviyeStore = require('../seviye/store');
const config = require('./config');
const store = require('./store');

const commands = [
  new SlashCommandBuilder()
    .setName('gunluk')
    .setDescription('Günlük coin ödülünü toplar ve giriş serisini sürdürür.')
    .setContexts(InteractionContextType.Guild),
];

// /gunluk: bugün henüz alınmadıysa ödül yazar, seri ve bakiye bildirilir
async function handleDaily(interaction) {
  const level = Math.max(levelFromXp(seviyeStore.xpOf('mesaj', interaction.user.id)), levelFromXp(seviyeStore.xpOf('ses', interaction.user.id)));
  const result = store.claim(interaction.user.id, level);

  if (!result.ok) {
    return respond(
      interaction,
      core.alert('Günlük ödülünü bugün zaten topladın.', `Sıradaki ödül <t:${core.unix(result.nextAt)}:R> içinde hazır oluyor.`),
    );
  }

  const { base } = config.daily;
  const number = (n) => Number(n).toLocaleString('tr-TR');
  return respond(
    interaction,
    core.alert(
      `${number(result.amount)} coin topladın.`,
      `**${result.streak}. gün** serin. Taban **${base}**, seri ve seviye bonusu **${result.bonus}**, bakiyen **${number(result.balance)}** coin.`,
      'success',
    ),
  );
}

module.exports = {
  name: 'coin',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { gunluk: 'Herkes' } },
  slash: { gunluk: handleDaily },
};
