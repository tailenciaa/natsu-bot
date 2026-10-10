// Coin mesajları: /bakiye ile açılan cüzdan kartı ve mağazadan alınanların listelendiği sipariş sayfası.
// Cüzdandan mağaza aynı dokunuşla açılır (profil-ayar:magaza), siparişler ise cüzdanın yerini alır; böylece
// üye parasının nereye gittiğini ayrı bir mesaj aramadan görür.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { page, text, divider, chip, rows, rel, stamp, pageInfo, pagerRow } = require('../../core/ui');

const IDS = {
  shop: 'profil-ayar:magaza', // profil mağazası; aynı buton profil ayarlarında da duruyor
  orders: 'coin-siparis', // coin-siparis:<sayfa>
  wallet: 'coin-bakiye', // sipariş sayfasından cüzdana dönüş
};

// Bir sayfada bu kadar sipariş; başlık ve buton satırları bileşen sınırına yaklaştığı için liste uzun olamaz
const ORDER_PAGE_SIZE = 6;

const number = (value) => Number(value).toLocaleString('tr-TR');
const coin = (value) => chip(`${number(value)} coin`);

// Cüzdan kartı: bakiye, biriken, harcanan ve seri. Günlük ödülün ne zaman hazır olacağı da burada yazılır.
function wallet({ user, balance, earned, spent, streak, readyAt, now = Date.now() }) {
  const container = page({
    title: 'Coin Cüzdanım',
    sub: 'Coinler **günlük giriş**, **seviye atlama**, **haftalık derece** ve **saygınlık vermekten** birikir; harcadığın yer profil mağazasıdır.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [
      `**Cüzdan Bilgileri**\n${rows([
        ['Mevcut Bakiye', coin(balance)],
        ['Toplam Kazanç', coin(earned)],
        ['Harcanan', coin(spent)],
        streak > 0 && ['Günlük Seri', chip(`${streak} gün`)],
      ])}`,
      readyAt > now
        ? `Günlük ödülün ${rel(readyAt)} içinde hazır olacak. Hazır olduğunda \`/gunluk\` ile toplayabilirsin.`
        : 'Günlük ödülün hazır: `/gunluk` ile toplayabilirsin.',
    ],
  });
  return container.addSeparatorComponents(divider()).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(IDS.shop).setLabel('Mağaza').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${IDS.orders}:0`).setLabel('Siparişlerim').setStyle(ButtonStyle.Secondary),
    ),
  );
}

// Siparişler: satın alınan her ürün bir satırda, fiyatı ve alındığı tarihle. Ürünler kalıcı olduğu için
// beklemedeki sipariş yoktur; liste yalnızca geçmişi gösterir.
function orders({ user, items, page: current = 0 }) {
  const pageCount = Math.max(1, Math.ceil(items.length / ORDER_PAGE_SIZE));
  const pageNo = Math.min(Math.max(current, 0), pageCount - 1);
  const list = items.slice(pageNo * ORDER_PAGE_SIZE, pageNo * ORDER_PAGE_SIZE + ORDER_PAGE_SIZE);

  const container = page({
    title: 'Siparişlerim',
    sub: 'Mağazadan aldığın ürünler burada durur. Kozmetikler kalıcıdır: istediğin zaman kartında değiştirip tekrar giyebilirsin.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [
      items.length
        ? list.map((p) => `**${p.name}** · ${coin(p.price)}\n${stamp(p.at, 'R')}`).join('\n\n')
        : '-# Henüz siparişin bulunmuyor.',
      items.length ? `-# ${pageInfo(pageNo, pageCount, items.length)}` : null,
    ],
  });

  container.addSeparatorComponents(divider()).addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(IDS.wallet).setLabel('Cüzdana Dön').setStyle(ButtonStyle.Secondary)),
  );
  if (!items.length) return container;

  const nav = (target) => `${IDS.orders}:${target}`;
  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(pagerRow({ prevId: nav(pageNo - 1), nextId: nav(pageNo + 1), page: pageNo, pageCount }));
}

module.exports = { IDS, ORDER_PAGE_SIZE, number, wallet, orders };
