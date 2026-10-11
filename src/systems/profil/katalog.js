// Kozmetik kataloğu: mağazadaki dört rafın tek tanımı. Ürünlerin rafları (sahiplik alanı, kartta hangi alanla
// giyildiği, ücretsiz sayılan anahtar) ve ürün listeleri burada durur; mağaza sayfaları ve ödülle kozmetik
// veren diğer sistemler (görev kutusu, sezon) aynı katalogu okur. Böylece bir ürün bir yerde açılırken başka
// bir yerde "artık yok" olmaz.
const kapak = require('./kapak');
const kozmetik = require('./kozmetik');
const store = require('./store');
const { THEMES } = require('./themes');

// Mağazanın sekme adları
const SHOP_TABS = { cerceve: 'Çerçeveler', tema: 'Temalar', kapak: 'Arka Planlar', rozet: 'Rozetler' };

// Ürün türleri: sahiplik listesi (field), kartta hangi alanla giyildiği (wear), giyilmemişken kabul edilen
// varsayılanı (def) ve ücretsiz sayılan anahtar (free). `wear: null` olan türde giyme adımı yoktur: satın alınan
// sergi rozeti kartta kendiliğinden görünür. Ücretsiz temalar mağazada değil tema menüsünde durur.
const SHOP = {
  cerceve: {
    field: 'ownedFrames',
    wear: 'frame',
    def: 'yok',
    free: (key) => key === 'yok',
    items: () => kozmetik.FRAMES.map((f) => ({ key: f.key, name: f.label, note: f.note, price: f.price })),
  },
  tema: {
    field: 'ownedThemes',
    wear: 'theme',
    def: null,
    free: () => false,
    items: () =>
      Object.entries(THEMES)
        .filter(([, theme]) => theme.price > 0)
        .map(([key, theme]) => ({ key, name: theme.label, note: theme.description, price: theme.price })),
  },
  kapak: {
    field: 'ownedCovers',
    wear: 'cover',
    def: 'yok',
    free: (key) => key === 'yok',
    items: () => kapak.COVERS.map((c) => ({ key: c.key, name: c.label, note: c.note, price: c.price })),
  },
  rozet: {
    field: 'ownedBadges',
    wear: null,
    def: null,
    free: () => false,
    items: () => kozmetik.SHOP_BADGES.map((b) => ({ key: b.key, name: b.label, note: b.note, price: b.price })),
  },
};

const catalog = (tur) => (SHOP[tur]?.items() ?? []).map((item) => ({ ...item, tur }));

const ownsItem = (tur, custom, key) => {
  const shop = SHOP[tur];
  return Boolean(shop) && (shop.free(key) || (custom[shop.field] ?? []).includes(key));
};

const wornItem = (tur, custom, key) => {
  const shop = SHOP[tur];
  return Boolean(shop?.wear) && (custom[shop.wear] ?? shop.def) === key;
};

// Türün ödül olarak verilebilecek ürünleri: ücretli ve henüz sahip olunmayanlar. Ücretsiz seçenekler (çerçevesiz,
// temassız kapak) ödül sayılmaz; hepsi sahiplenmişse liste boş döner ve veren taraf başka ödüle geçer.
const adaylar = (tur, userId) => {
  const shop = SHOP[tur];
  if (!shop) return [];
  const owned = store.get(userId)[shop.field] ?? [];
  return catalog(tur).filter((item) => item.price > 0 && !owned.includes(item.key));
};

// Kozmetik hediye: parasız sahipliğe geçer ve giyilmesi gerekiyorsa giyilir. Satın almayla aynı kayıt düzeni
// kullanılır ki koleksiyon sayımı, mağaza satırı ve kart tek kaynaklı kalsın. Sipariş listesine yazılmaz:
// harcama olmayan bir şey "sipariş" görünce üyenin kendi defteri yanlış olur.
function hediye(userId, tur, key = null) {
  const havuz = key ? catalog(tur).filter((item) => item.key === key) : adaylar(tur, userId);
  const item = havuz[Math.floor(Math.random() * havuz.length)];
  const shop = SHOP[tur];
  if (!shop || !item || store.owns(userId, shop.field, item.key)) return null;
  store.addOwned(userId, shop.field, item.key);
  if (shop.wear) store.set(userId, { [shop.wear]: item.key });
  return { tur, ...item, giyildi: Boolean(shop.wear) };
}

module.exports = { SHOP_TABS, SHOP, catalog, ownsItem, wornItem, adaylar, hediye };
