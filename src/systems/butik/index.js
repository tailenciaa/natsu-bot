// Butik: cüzdan kartının yerini alan coin harcama rafı — ek saygınlık hakkı, evlilik yüzüğü ve özel renkli rol.
// Kendi komutu yoktur: /bakiye cüzdanındaki Butik düğmesiyle açılır, alımlar düğmeyle yapılır. Böylece üyenin
// Parasının iki kapısı (kazanmak ve harcamak) aynı kartta toplanır.
// Ödeme düzeni: coin harcamaktır, kazanç değildir — burada para basılmaz, yalnızca el değiştirir. Bu yüzden
// alımlar coinStore.spend ile düşülür ve coinStore.recordPurchase ile üyenin sipariş defterine yazılır.
// Renk düzeni: bot rol yaratmaz, config.js'te ID'si yazılı hazır rolü verir. Rol verilemezse para alınmaz.
const { Events } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isMenuOwner, menuOwnerError } = require('../../core/helpers');
const coinStore = require('../coin/store');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const price = (n) => core.chip(`${n.toLocaleString('tr-TR')} coin`);

// Sayfanın okuduğu bütün durum: bakiye, elde duran tükenenler ve satıştaki renkler. Dışa açılır ki önizleme ile
// cüzdan düğmesi aynı kapıdan geçsin.
function sayfaDurumu(userId, user, at = Date.now()) {
  return {
    user,
    at,
    balance: coinStore.balance(userId),
    hak: store.hakSay(userId),
    yuzuk: store.yuzukSay(userId),
    roller: store.rolleri(userId),
    renkler: store.satisdakiRenkler(),
  };
}

const panelFor = (interaction) => ui.panel(sayfaDurumu(interaction.user.id, interaction.user));

// Butik cüzdan kartının yerini alır, ayrı mesaj atmaz: üye parasının olduğu karttan ayrılmamış olur
function sayfayiGoster(interaction) {
  return interaction.update({ components: [panelFor(interaction)], allowedMentions: { parse: [] } });
}

// Yetersiz bakiye cevabı: fiyat ve bakiye yan yana yazılır ki üye ne kadar daha kazanması gerektiğini bilsin
const bakiyeYetmez = (interaction, item) =>
  replyError(
    interaction,
    'Bakiyen bu ürün için yetmiyor.',
    `Fiyatı ${price(item.price)}, senin bakiyen ${price(coinStore.balance(interaction.user.id))}. Günlük ödüller, görevler ve oyunlarla tamamlayabilirsin.`,
  );

// Tükenen ürün alımı: para ancak ürün elde birikiyorsa düşer
async function alTukenen(interaction, item) {
  const userId = interaction.user.id;
  if (coinStore.balance(userId) < item.price) return yoksaCevap(interaction, item);
  if (!coinStore.spend(userId, item.price)) return replyError(interaction, 'Satın alma tamamlanamadı.', 'Birkaç saniye sonra tekrar dene.');

  const total = store.ekle(item.key, userId);
  coinStore.recordPurchase(userId, { tur: item.tur, key: item.key, name: item.ad, price: item.price });

  await sayfayiGoster(interaction);
  return respond(interaction, ui.tukenenAlindi({ user: interaction.user, ...item, total }), {
    followUp: true,
    allowedMentions: { users: [userId] },
  });
}

// Renk alımı: önce rol verilir, sonra para düşer. Rol verilemediği durumda para istenmez ki üye boşuna ödemesin.
async function alRol(interaction, item) {
  const userId = interaction.user.id;
  if (!item || !item.roleId) return replyError(interaction, 'Bu renk şu anda satışta değil.', 'Rol sunucuda hazırlanınca raf kendini gösterir.');
  if (store.rolSahibi(userId, item.key)) return replyError(interaction, 'Bu renk zaten sende.', 'Sunucuda adın o rolün rengiyle yazılıyor.');
  if (!interaction.guild) return replyError(interaction, 'Renkler sunucuda kullanılır.', 'Düğmeyi bir sunucu içinde tekrar dene.');
  if (coinStore.balance(userId) < item.price) return yoksaCevap(interaction, item);

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) return replyError(interaction, 'Sunucu kaydın bulunamadı.', 'Bir yetkiliye haber ver.');

  try {
    await member.roles.add(item.roleId, 'Butik rengi');
  } catch (err) {
    console.error('[butik] Renk rolü verilemedi:', err.message);
    return replyError(interaction, 'Rol verilemedi, para alınmadı.', 'Botun rolleri yönetme yetkisi yoksa bir yetkiliye haber ver.');
  }

  if (!coinStore.spend(userId, item.price)) {
    await member.roles.remove(item.roleId, 'Butik ödemesi tamamlanmadı').catch(() => {});
    return replyError(interaction, 'Satın alma tamamlanamadı.', 'Bakiyen bu üründen az; önce coin topla.');
  }

  store.rolEkle(userId, item.key);
  coinStore.recordPurchase(userId, { tur: item.tur, key: item.key, name: item.ad, price: item.price });

  await sayfayiGoster(interaction);
  return respond(interaction, ui.rolAlindi({ user: interaction.user, ad: item.ad, price: item.price, roleId: item.roleId }), {
    followUp: true,
    allowedMentions: { users: [userId] },
  });
}

// Üye sunucudan düşüp döndüğünde satın aldığı renkler kaybolur: dönüşte bot geri verir
async function renkleriGeriVer(member) {
  if (member.user.bot) return;
  for (const key of store.rolleri(member.id)) {
    const item = store.renk(key);
    if (!item?.roleId || member.roles.cache.has(item.roleId)) continue;
    await member.roles.add(item.roleId, 'Butik rengi geri verildi').catch((err) => console.error('[butik] Renk rolü geri verilemedi:', err.message));
  }
}

// butik:<adim>:<veri> — sayfa açılışı ve iki alım düğmesi tek önekten geçer
async function handle(interaction) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  const [adim, ...kuyruk] = interaction.customId.slice(ui.IDS.prefix.length + 1).split(':');

  switch (adim) {
    case 'magaza':
      return sayfayiGoster(interaction);
    case 'al': {
      const item = [config.hak, config.yuzuk].find((t) => t.key === kuyruk[0]);
      if (!item) return replyError(interaction, 'Bu ürün artık butikte satılmıyor.', 'Cüzdanından butiği yeniden açabilirsin.');
      return alTukenen(interaction, item);
    }
    case 'rol':
      return alRol(interaction, store.renk(kuyruk[0]));
    default:
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/bakiye ile cüzdanını yeniden açabilirsin.');
  }
}

module.exports = {
  name: 'butik',
  prefixed: [[ui.IDS.prefix, handle]],
  events: {
    [Events.GuildMemberAdd]: (member) => (member.guild.id === guildId ? renkleriGeriVer(member) : null),
  },
  panelFor,
  sayfaDurumu,
};
