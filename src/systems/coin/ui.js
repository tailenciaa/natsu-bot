// Coin mesajları: /gunluk ödül kartı, /bakiye ile açılan cüzdan ve mağazadan alınanların listelendiği sipariş sayfası.
// Cüzdandan mağaza aynı dokunuşla açılır (profil-ayar:magaza), siparişler ise cüzdanın yerini alır; böylece
// üye parasının nereye gittiğini ayrı bir mesaj aramadan görür.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { page, divider, chip, rows, rel, receipt, pageInfo, pagerRow } = require('../../core/ui');

const IDS = {
  shop: 'profil-ayar:magaza', // profil mağazası; aynı buton profil ayarlarında da duruyor
  orders: 'coin-siparis', // coin-siparis:<sayfa>
  wallet: 'coin-bakiye', // sipariş sayfasından cüzdana dönüş
};

// Bir sayfada bu kadar sipariş; başlık ve buton satırları bileşen sınırına yaklaştığı için liste uzun olamaz
const ORDER_PAGE_SIZE = 6;

// Satın alınan ürün hangi raftan geldiğiyle birlikte anılır; mağazadaki sekme adlarıyla aynı sözcükler kullanılır
const TUR_LABEL = { cerceve: 'Çerçeve', tema: 'Tema', kapak: 'Arka Plan', rozet: 'Rozet' };

const number = (value) => Number(value).toLocaleString('tr-TR');
const coin = (value) => chip(`${number(value)} coin`);

// Cüzdan kartı: bakiye, biriken, harcanan ve seri. Günlük ödülün ne zaman hazır olacağı da burada yazılır.
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
      readyAt > now ? `Günlük ödülün ${rel(readyAt)} içinde hazır olacak.` : 'Günlük ödülün hazır: `/gunluk` ile toplayabilirsin.',
    ],
  });
  return container.addSeparatorComponents(divider()).addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(IDS.shop).setLabel('Mağaza').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${IDS.orders}:0`).setLabel('Siparişlerim').setStyle(ButtonStyle.Secondary),
    ),
  );
}

// Sipariş satırı: ürün adı, hangi raftan geldiği, fiyatı ve ne zaman alındığı
const orderLine = (p) => {
  const tur = TUR_LABEL[p.tur];
  return `**${p.name}**${tur ? ` (${tur})` : ''} · ${coin(p.price)}\n${rel(p.at)} satın alındı`;
};

// Siparişler: satın alınan her ürün bir satırda. Ürünler kalıcı olduğu için beklemedeki sipariş yoktur;
// liste yalnızca geçmişi gösterir.
function orders({ user, items, page: current = 0 }) {
  const pageCount = Math.max(1, Math.ceil(items.length / ORDER_PAGE_SIZE));
  const pageNo = Math.min(Math.max(current, 0), pageCount - 1);
  const list = items.slice(pageNo * ORDER_PAGE_SIZE, pageNo * ORDER_PAGE_SIZE + ORDER_PAGE_SIZE);

  const container = page({
    title: 'Siparişlerim',
    sub: 'Mağazadan aldığın ürünler burada durur. Kozmetikler kalıcıdır: istediğin zaman kartında değiştirip tekrar giyebilirsin.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [
      items.length ? list.map(orderLine).join('\n\n') : '-# Henüz siparişin bulunmuyor.',
      items.length ? `-# ${pageInfo(pageNo, pageCount, items.length)}` : null,
    ],
  });

  const nav = (target) => `${IDS.orders}:${target}`;
  const buttons = items.length
    ? pagerRow({ prevId: nav(pageNo - 1), nextId: nav(pageNo + 1), page: pageNo, pageCount }).components
    : [];
  buttons.push(new ButtonBuilder().setCustomId(IDS.wallet).setLabel('Cüzdana Dön').setStyle(ButtonStyle.Secondary));
  return container.addSeparatorComponents(divider()).addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
}

module.exports = { IDS, ORDER_PAGE_SIZE, number, wallet, orders };
