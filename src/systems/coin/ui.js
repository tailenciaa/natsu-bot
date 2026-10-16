// Coin mesajları: /gunluk ödül kartı, /bakiye ile açılan cüzdan ve mağazadan alınanların listelendiği sipariş sayfası.
// Cüzdan tek mesajda gezilir: "Mağaza" ve "Siparişlerim" cüzdan kartının yerini alır, oradaki geri düğmesi yeniden
// cüzdana döner; böylece üye parasının nereye gittiğini ayrı bir mesaj aramadan görür.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { page, divider, chip, pills, rel, receipt, pageInfo, pagerRow } = require('../../core/ui');

const IDS = {
  shop: 'profil-ayar:magaza:cerceve:cuzdan', // profil mağazası; sekme ve kaynak taşıdığı için cüzdan kartının yerini alır
  orders: 'coin-siparis', // coin-siparis:<sayfa>
  wallet: 'coin-bakiye', // mağaza ve sipariş sayfasından cüzdana dönüş
  quests: 'coin-gorev', // cüzdandan görev paneline geçiş: panel ayrı mesaj olur, kendi sekmeleriyle açılır
  arcade: 'coin-oyun', // cüzdandan Oyun Salonuna geçiş: sayfa ayrı mesaj olur, kendi sekmeleriyle açılır
  crime: 'coin-hirsizlik', // cüzdandan Arka Sokaklara geçiş: suç dünyası da ayrı mesaj olarak açılır
  banter: 'coin-sakalas', // cüzdandan Şakalaşma sayfasına geçiş: eğlence kartları da ayrı mesaj olarak açılır
  butik: 'butik:magaza', // butik rafı cüzdandan açılır ve kartın yerini alır; düğme butik sisteminin önekiyle gelir
};

// Bir sayfada bu kadar sipariş; başlık ve buton satırları bileşen sınırına yaklaştığı için liste uzun olamaz
const ORDER_PAGE_SIZE = 6;

// Satın alınan ürün hangi raftan geldiğiyle birlikte anılır; mağazadaki sekme adlarıyla aynı sözcükler kullanılır.
// Butik alımlarında ürün adı zaten ne olduğunu söylüyor (Ek Saygınlık Hakkı, Evlilik Yüzüğü), yalnızca renk
// satırda rafıyla anılır.
const TUR_LABEL = { cerceve: 'Çerçeve', tema: 'Tema', kapak: 'Arka Plan', rozet: 'Rozet', rol: 'Renkli Rol' };

const number = (value) => Number(value).toLocaleString('tr-TR');
const coin = (value) => chip(`${number(value)} coin`);

// /gunluk kartı: ödülen tutar, seri, bonusun kaynağı ve yeni bakiye ayrı satırlarda. Kazanç herkese açık
// duyurulur; üye kazandığını gösterir, okuyan da günlük girişini kaçırmak istemez.
function daily({ user, amount, streak, base, bonus, balance, nextAt }) {
  return receipt({
    title: 'Günlük Ödül Toplandı',
    sub: `<@${user.id}> **/gunluk** ile günlük ödülünü topladı. Art arda giriş serisi ve seviye bonusu kazanca eklendi; sıradaki ödül ${rel(nextAt)} içinde hazır olacak.`,
    user,
    pairs: [
      ['Kazanç', coin(amount)],
      ['Seri', chip(`${streak}. gün`)],
      ['Taban Ödül', coin(base)],
      ['Seri ve Seviye Bonusu', coin(bonus)],
      ['Yeni Bakiye', coin(balance)],
    ],
  });
}

// Cüzdan kartı: bakiye tek ve en önemli sayı olduğu için kendi satırında; kazanç, harcama ve seri yan yana
// kapsümlerde toplanır ki dört satırlık etiket-kutu yığını kartı boğmasın.
function wallet({ user, balance, earned, spent, streak, readyAt, now = Date.now() }) {
  const container = page({
    title: 'Coin Cüzdanım',
    sub: 'Coinler **günlük giriş**, seviye atlama, haftalık derece, saygınlık ve görevlerden birikir; keşif, eğlence, ' +
      'suç ve kumarhane de coin verir ama bunların **günlük tavanı** vardır. Harcama yerleri üçe ayrılır: ' +
      '**Mağaza** kartının çerçeve, tema, kapak ve rozetlerini; **Butik** evlilik yüzüğü ile ek ' +
      'saygınlık hakkını ve adını renklendiren rolü; **kumarhane** masaya koyduğun bahsi satar — kumarhanede ' +
      'masa uzun vadede daima kazanır.',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    blocks: [
      `### Cüzdan Bilgileri\n**Mevcut Bakiye:** ${coin(balance)}\n${pills([
        ['Kazanç', `${number(earned)} coin`],
        ['Harcanan', `${number(spent)} coin`],
        streak > 0 && ['Seri', `${streak} gün`],
      ])}`,
      readyAt > now ? `Günlük ödülün ${rel(readyAt)} içinde hazır olacak.` : 'Günlük ödülün hazır: `/gunluk` ile toplayabilirsin.',
      '### Parayı Değerlendir\nAltındaki ilk satır **kazanma** yollarını, ikinci satır **harcama ve geçmiş**ini açar: ' +
        'hepsi aynı cüzdanın kapıları, hiçbirinde ayrı komut yazman gerekmez.',
    ],
  });
  // İki satır: kazanma yolları üstte, harcama ve siparişler altta. Beş düğme sınırına takılmamak için bölündü.
  const kazan = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(IDS.quests).setLabel('Görevler').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(IDS.arcade).setLabel('Oyun Salonu').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(IDS.crime).setLabel('Arka Sokaklar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(IDS.banter).setLabel('Şakalaş').setStyle(ButtonStyle.Secondary),
  );
  const harca = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(IDS.shop).setLabel('Mağaza · Kart Süsü').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(IDS.butik).setLabel('Butik · Yüzük & Renk').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${IDS.orders}:0`).setLabel('Siparişlerim').setStyle(ButtonStyle.Secondary),
  );
  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(kazan)
    .addActionRowComponents(harca);
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

module.exports = { IDS, ORDER_PAGE_SIZE, TUR_LABEL, number, coin, daily, wallet, orders };
