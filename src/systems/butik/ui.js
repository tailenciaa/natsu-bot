// Butik mesajları: cüzdan kartının yerini alan raf sayfası ve alım bittikten sonra kanala düşen işlem kartı.
// Sayfa cüzdandan açıldığı için kalıcı ve herkese açıktır; alım kartı da öyledir — üye parasının neye gittiğini
// göstersin ki harcama da görünürlük kazanıp diğerlerine örnek olsun.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder } = require('discord.js');
const core = require('../../core/ui');
const { coin, number } = require('../coin/ui');
const config = require('./config');

// butik:<adim> şeklinde gelir; index.js tek önek altında karşılar. Cüzdana dönüş ve sipariş defteri coin
// sisteminin sabit düğmeleridir, aynı ID yeniden kullanılır ki iki raf arasında gezinme tek yol olsun.
const IDS = {
  prefix: 'butik',
  magaza: 'butik:magaza', // cüzdan kartını yerinde butiğe çevirir
  al: 'butik:al:', // + tükenen ürün anahtarı (ek-hak | yuzuk)
  rol: 'butik:rol:', // + renk anahtarı
  cuzdan: 'coin-bakiye',
  siparis: 'coin-siparis:0',
};

// Raf satırının durum yazısı: tükenen üründe elde kalan adet, kalıcı üründe sahiplik
const elde = (n, ad) => (n > 0 ? `Elinde ${core.chip(`${n} ${ad}`)} var.` : 'Henüz almadın.');

const fiyat = (price) => core.chip(`${number(price)} coin`);

// Ürün satırı: adı ve gerekçesi solda, al düğmesi sağda. Düğme etiketi kısa kalsın diye fiyat tek sayı olarak yazılır.
function urunSatiri({ ad, note, durum, id, etiket, sahipEtiketi = null, disabled = false }) {
  const button = new ButtonBuilder().setCustomId(id).setDisabled(disabled);
  if (sahipEtiketi) button.setLabel(sahipEtiketi).setStyle(ButtonStyle.Secondary);
  else button.setLabel(etiket).setStyle(ButtonStyle.Success);
  return new SectionBuilder()
    .addTextDisplayComponents(core.text(`**${ad}** — ${note}\n${durum}`))
    .setButtonAccessory(button);
}

// Rafın açıklaması: üye hangi ürünün ne işe yaradığını satıra bakmadan önce buradan anlasın
function hakRaf(state) {
  return [
    urunSatiri({
      ...config.hak,
      durum: `${elde(state.hak, config.hak.adetAdi)} Birimi ${fiyat(config.hak.price)}.`,
      id: `${IDS.al}${config.hak.key}`,
      etiket: `Al · ${number(config.hak.price)}`,
    }),
    urunSatiri({
      ...config.yuzuk,
      durum: `${elde(state.yuzuk, config.yuzuk.adetAdi)} Birimi ${fiyat(config.yuzuk.price)}.`,
      id: `${IDS.al}${config.yuzuk.key}`,
      etiket: `Al · ${number(config.yuzuk.price)}`,
    }),
  ];
}

function rolRaf(state) {
  return state.renkler.map((reng) => {
    const owned = state.roller.includes(reng.key);
    return urunSatiri({
      ...reng,
      durum: owned ? 'Bu renk zaten sende, adın onunla yazılıyor.' : `Fiyatı ${fiyat(reng.price)}. Bir kez alınır, kalıcıdır.`,
      id: `${IDS.rol}${reng.key}`,
      etiket: `Al · ${number(reng.price)}`,
      sahipEtiketi: owned ? 'Sahipsin' : null,
      disabled: owned,
    });
  });
}

function kurallar(state) {
  const roller = state.renkler.length
    ? '4. **Renkli roller** kalıcıdır: bir kez alırsın, adın sunucuda o renkte yazılır. Sunucudan düşüp dönersen bot rolü geri verir.'
    : '4. **Renkli rol** rafı şu an kapalı: roller sunucuda hazırlanınca kendini gösterecek.';
  return `### Nasıl İşler?
1. Her alım **coin** ile ödenir; bakiyen kartın başında yazıyor.
2. **Ek saygınlık hakkı** kendi kendine yanar: /saygi-ver bekleme sürene takıldığında elindeki bir hak harcanır ve o gün bir kez daha vermen açılır.
3. **Evlilik yüzüğü** /evlilik ile bir üyeye teklif götürürken yakılır; evliliğin tek şartı bu yüzüktür.
${roller}
5. Ne aldığın **/bakiye > Siparişlerim** defterinde durur. Kartının çerçeve, tema ve rozetleri ise profil mağazasında satılır.`;
}

// Butik sayfası: üç raf tek mesajda. Cüzdanın yerini alır, alttaki düğme cüzdana döndürür.
function panel(state) {
  const container = new ContainerBuilder().addTextDisplayComponents(
    core.text(
      '## Butik\nCoinlerin kozmetik dışındaki son durağı: saygınlık vermede kullanılan ek hak, evlilikte yakılan yüzük ' +
        've sunucuda adını renklendiren özel rol. Aldığın hak kendiliğinden kullanılır, para iade edilmez.',
    ),
  );

  container.addSeparatorComponents(core.divider()).addTextDisplayComponents(
    core.text(`**Bakiyen:** ${coin(state.balance)}${state.hak + state.yuzuk > 0 ? ` · **Elinde:** ${number(state.hak)} hak, ${number(state.yuzuk)} yüzük` : ''}`),
  );

  container.addSeparatorComponents(core.divider());
  container.addTextDisplayComponents(core.text(`### ${config.hakRafBasligi}`));
  for (const satir of hakRaf(state)) container.addSectionComponents(satir);

  if (state.renkler.length) {
    container.addSeparatorComponents(core.divider());
    container.addTextDisplayComponents(core.text(`### ${config.rolRafBasligi}`));
    for (const satir of rolRaf(state)) container.addSectionComponents(satir);
  }

  container.addSeparatorComponents(core.divider()).addTextDisplayComponents(core.text(kurallar(state)));

  const nav = [IDS.cuzdan, IDS.siparis].map((id) =>
    new ButtonBuilder().setCustomId(id).setLabel(id === IDS.cuzdan ? 'Cüzdana Dön' : 'Siparişlerim').setStyle(ButtonStyle.Secondary),
  );
  return container
    .addSeparatorComponents(core.divider())
    .addActionRowComponents(new ActionRowBuilder().addComponents(nav))
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp(state.at)));
}

// ── Alım kartları ─────────────────────────────────────────────────────────────
// Tükenen ürün alımı: elde kaç adet biriktiği yazılır, bakiye açıklanmaz
function tukenenAlindi({ user, ad, adetAdi, kullanim, price, total }) {
  return core.receipt({
    title: 'Butik Alımı Tamamlandı',
    sub: `<@${user.id}> Butik'ten **${ad}** aldı. Aldığı ${adetAdi} ${kullanim} kendiliğinden kullanılacak.`,
    user,
    pairs: [
      ['Ürün', core.chip(ad)],
      ['Fiyat', coin(price)],
      ['Elinde', core.chip(`${total} ${adetAdi}`)],
    ],
  });
}

// Renk alımı: rol mention'u display için yazılır, bildirim yetkisi olmadığı için role ping gitmez
function rolAlindi({ user, ad, price, roleId }) {
  return core.receipt({
    title: 'Butik Alımı Tamamlandı',
    sub: `<@${user.id}> Butik'ten **${ad}** rengini aldı; sunucuda adı artık o rolün rengiyle yazılıyor.`,
    user,
    pairs: [
      ['Ürün', core.chip(ad)],
      ['Fiyat', coin(price)],
      ['Rol', `<@&${roleId}>`],
      ['Kalıcılık', core.chip('hep sende')],
    ],
  });
}

module.exports = { IDS, elde, fiyat, panel, tukenenAlindi, rolAlindi };
