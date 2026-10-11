// Oyun Salonu sayfası: /oyun ile açılır, üç sekme (Keşif, Rulet, Merdiven) tek mesajda gezilir. Sekme düğmesi
// mesajı yerinde yeniler; oyun sonuçları da aynı mesajın başlığının altında yazar, kanal dolmaz.
// Sayfa komutla açılan bir SAYFA olduğu için kanalda kalıcı ve herkese açıktır. Yalnızca büyük kazançlar ayrı ve
// herkesin gördüğü bir kart olarak duyurulur: üye kazandını göstersin, gören de salona girmek istesin.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const core = require('../../core/ui');
const { coin, number } = require('../coin/ui');
const config = require('./config');

const IDS = {
  prefix: 'oyun',
  sekme: 'oyun:sekme:', // + kesif | rulet | merdiven
  bahis: 'oyun:bahis:', // + coin tutarı
  kesif: 'oyun:kesif:', // + bölge anahtarı
  rulet: 'oyun:rulet:', // + kirmizi | siyah | yesil
  merdiven: 'oyun:merdiven:', // + bas | cik | cek
};

const TABLAR = { kesif: 'Keşif', rulet: 'Rulet', merdiven: 'Merdiven' };

const sekmeSatiri = (aktif) => core.tabRow(TABLAR, aktif, (key) => `${IDS.sekme}${key}`);

// Ganimetin okunur adı ve rengi: kartta da duyuruda da aynı sözcük ve ton geçer
const NITELIK = { siradan: 'Sıradan', degerli: 'Değerli', nadir: 'Nadir', efsanevi: 'Efsanevi' };
const NITELIK_ACCENT = { siradan: 'primary', degerli: 'success', nadir: 'warning', efsanevi: 'danger' };

// Bekleme süreleri dakika/saat olarak okunur
const sure = (ms) => {
  const total = Math.max(0, Math.floor((ms ?? 0) / 60000));
  const hours = Math.floor(total / 60);
  return hours ? `${hours} sa ${total % 60} dk` : `${total} dk`;
};

// Çarpanlar virgüllü ve gereksiz sıfırsız yazılır: 1,1x / 2,75x / 18x
const sayisal = (value) => String(Number(Number(value).toFixed(2))).replace('.', ',');

// ── Ortak parçalar ────────────────────────────────────────────────────────────
// Cüzdan şeridi: her sekmenin altında aynı satır durur; üye bahsinin ne olduğunu ve tavanını aramasın.
function cuzdan({ balance, bahis, kalanTavan }) {
  return `### Cüzdanın\n${core.pills([
    ['Bakiye', `${number(balance)} coin`],
    ['Seçili Bahis', `${number(bahis)} coin`],
    ['Oyuna Kalan', `${number(kalanTavan)} coin`],
  ])}`;
}

// Bahis satırı: beş düğme, seçili olan yeşil. Kumarhane sekmelerinin üstünde durur. Sekme adı customId'de
// taşınır ki bahis değişince üye hangi sayfada kaldığını kaybetmesin.
function bahisSatiri(aktif, tab) {
  return new ActionRowBuilder().addComponents(
    config.bets.map((value) =>
      new ButtonBuilder()
        .setCustomId(`${IDS.bahis}${tab}:${value}`)
        .setLabel(`${number(value)} coin`)
        .setStyle(value === aktif ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  );
}

// Kumarhane sicili: iki kumarhane sekmesi de aynı dört sayıyı aynı düzende gösterir
function sicil(kumar) {
  const net = `${kumar.net >= 0 ? 'kazanç' : 'kayıp'} ${number(Math.abs(kumar.net))} coin`;
  return `### Kumarhane Sicilin\n${core.rows([
    ['El', `${number(kumar.el)} el`],
    ['Net', net],
    ['En Büyük Çekim', coin(kumar.enBuyuk)],
    ['Bugün', `${kumar.gun} el`],
  ])}`;
}

// Panel iskeleti: başlık + açıklama, istenirse hemen altında geri bildirim, bloklar, düğme sıraları, cüzdan, sekmeler
function kabuk({ tab, title, sub, blocks = [], rows = [], feedback, balance, bahis, kalanTavan, at }) {
  const container = core.page({
    title,
    sub,
    blocks: feedback ? [feedback, ...blocks] : blocks,
    accent: feedback ? core.colors.success : undefined,
  });
  for (const row of rows) container.addActionRowComponents(row);
  container.addSeparatorComponents(core.divider()).addTextDisplayComponents(core.text(cuzdan({ balance, bahis, kalanTavan })));
  return (
    container
      .addActionRowComponents(sekmeSatiri(tab))
      .addSeparatorComponents(core.divider())
      .addTextDisplayComponents(core.text(core.stamp(at)))
  );
}

// ── Keşif ─────────────────────────────────────────────────────────────────────
// Bölge listesi: üye hangi bölgenin kendisine açık olduğunu ve orada kaç kez gezdiğini tek listede görür.
function bolgeSatirlari(seviye, sayim) {
  return config.kesif.bolgeler
    .map((b, index) => {
      const acik = seviye >= b.seviye;
      const def = sayim.bolgeler[b.key] ?? 0;
      const durum = acik ? (def ? `${number(def)} gezi` : 'henüz gezmedin') : `seviye ${b.seviye} ister`;
      return `${index + 1}. ${acik ? `**${b.ad}**` : b.ad} — ${durum}`;
    })
    .join('\n');
}

function kesifSekmesi(state) {
  const { seviye, kesif, kesifHazir: hazir } = state;

  const ritim = hazir.sebep === 'kota'
    ? `### Bugünün Gezisi\nBugünkü **${config.kesif.gunlukAdet}** gezinin hepsini yaptın. Gece sıfırlanır; o zamana kadar **Rulet** ve **Şans Merdiveni** açık.`
    : hazir.ok
      ? `### Bugünün Gezisi\nGezi hazır: bugün **${hazir.used} / ${config.kesif.gunlukAdet}** gezi kullandın, sıradaki gezi için beklemene gerek yok.`
      : `### Bugünün Gezisi\nSıradaki gezi ${core.rel(hazir.nextAt)} içinde hazır olur. Bugün **${hazir.used} / ${config.kesif.gunlukAdet}** gezi kullandın.`;

  const rows = new ActionRowBuilder().addComponents(
    config.kesif.bolgeler.map((b) => {
      const button = new ButtonBuilder().setCustomId(`${IDS.kesif}${b.key}`).setLabel(b.ad);
      if (seviye < b.seviye || !hazir.ok) return button.setStyle(ButtonStyle.Secondary).setDisabled(true);
      return button.setStyle(ButtonStyle.Primary);
    }),
  );

  return kabuk({
    ...state,
    tab: 'kesif',
    title: 'Keşif',
    sub: 'Seviyen yükseldikçe yeni bölgeler açılır. Gezi ücretsizdir, tek sınırı bekleme süresi ile günlük kotalır: ' +
      'bölgenin masasından coin, kutu anahtarı ya da doğrudan mağazandaki bir kozmetik çıkar. Ölçülen seviyen: ' +
      `**${seviye}** (mesaj ve ses seviyenden büyük olanı).`,
    blocks: [
      `### Bölgeler\n${bolgeSatirlari(seviye, kesif)}`,
      ritim,
      `### Bölge Masaları\n${config.kesif.bolgeler.map((b) => `**${b.ad}:** ${b.tarif}`).join('\n')}`,
    ],
    rows: [rows],
  });
}

// ── Rulet ─────────────────────────────────────────────────────────────────────
function ruletSekmesi(state) {
  const toplam = Object.values(config.rulet.cepler).reduce((a, b) => a + b, 0);
  const sans = (renk) => `${Math.round((config.rulet.cepler[renk] / toplam) * 100)}%`;

  const renkSatiri = new ActionRowBuilder().addComponents(
    Object.entries(config.rulet.renkler).map(([key, renk]) =>
      new ButtonBuilder()
        .setCustomId(`${IDS.rulet}${key}`)
        .setLabel(`${renk.ad} ${sayisal(renk.odul)}x`)
        .setStyle(key === 'yesil' ? ButtonStyle.Danger : ButtonStyle.Primary),
    ),
  );

  return kabuk({
    ...state,
    tab: 'rulet',
    title: 'Rulet',
    sub: 'Fiyonuk durduğunda rengi tutturursan bahsin katlanarak geri döner. On beş cepten yedisi kırmızı, yedisi ' +
      'siyah, biri yeşil; yeşil on dört kat öder ama ihtimali çok düşüktür. Bahis cüzdanından düşer, kazanç cüzdana yatar.',
    blocks: [
      `### Masanın Şansı\n${core.pills([
        ['Kırmızı', `${sans('kirmizi')} · ${sayisal(config.rulet.renkler.kirmizi.odul)}x`],
        ['Siyah', `${sans('siyah')} · ${sayisal(config.rulet.renkler.siyah.odul)}x`],
        ['Yeşil', `${sans('yesil')} · ${sayisal(config.rulet.renkler.yesil.odul)}x`],
      ])}`,
      sicil(state.kumar),
    ],
    rows: [bahisSatiri(state.bahis, 'rulet'), renkSatiri],
  });
}

// ── Şans Merdiveni ────────────────────────────────────────────────────────────
// Verilen basamağa kadar çıkan çarpanların toplamı
function merdivenPot(adimlar, adim) {
  return adimlar.slice(0, adim).reduce((carpan, a) => carpan * a.carpim, 1);
}

// Basamak tablosu: çıkılan satır kalın ve "buradasın" ile işaretli; üye hangi basamakta duracağını sayıya bakarak seçer
function basamakSatirlari(adim, bahis) {
  let carpim = 1;
  return config.merdiven.adimlar
    .map((basamak, index) => {
      carpim *= basamak.carpim;
      const pot = number(Math.round(bahis * carpim));
      const satir = `${index + 1}. ${sayisal(basamak.carpim)}x — ${Math.round(basamak.dusme * 100)}% düşme — pot ${pot} coin`;
      return index === adim - 1 ? `**${satir}  buradasın**` : satir;
    })
    .join('\n');
}

function merdivenSekmesi(state) {
  const { merdiven, bahis } = state;
  const adimlar = config.merdiven.adimlar;
  const son = adimlar.length - 1;

  const eylem = merdiven
    ? new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.merdiven}cik`).setLabel('Bir Basamak Çık').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`${IDS.merdiven}cek`).setLabel('Parayı Çek').setStyle(ButtonStyle.Success),
      )
    : new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${IDS.merdiven}bas`).setLabel('Tırman').setStyle(ButtonStyle.Success));

  const masada = merdiven
    ? `### Masada\nÇıkılan basamak: **${merdiven.adim} / ${adimlar.length}** · pot: ${coin(Math.round(merdivenPot(adimlar, merdiven.adim) * merdiven.bahis))}\n` +
      (merdiven.adim > son
        ? 'Son basamaktasın; buradan yukarı yok, çekmek zorundasın.'
        : `Sıradaki basamakta ${Math.round(adimlar[merdiven.adim].dusme * 100)}% ihtimalle düşersin; çıkarsan pot ${number(Math.round(merdiven.bahis * merdivenPot(adimlar, merdiven.adim + 1)))} coin olur.`)
    : `### Nasıl Oynanır?\nBahsini seçip tırmanmaya başla. Her basamakta çarpan büyür, düşme olasılığı da büyür. ` +
      `"Parayı Çek" dediğin an pot cüzdanına döner; düştüğün an bahis yanar. Sekizinci basamak ${sayisal(merdivenPot(adimlar, adimlar.length))}x verir ama oraya varan azdır.`;

  return kabuk({
    ...state,
    tab: 'merdiven',
    title: 'Şans Merdiveni',
    sub: 'Açgözlülüğün oyunu: potu çekene kadar sayılmaz. Düğmeye her basışta ya basamak atlayıp çarpanı büyütürsün ' +
      'ya da düşüp bahsi kaybedersin. Erken çeken kazanır, son basamağı isteyen düşer.',
    blocks: [masada, `### Basamaklar\n${basamakSatirlari(merdiven?.adim ?? 0, merdiven?.bahis ?? bahis)}`, sicil(state.kumar)],
    rows: merdiven ? [eylem] : [bahisSatiri(bahis), eylem],
  });
}

// ── Sekme dağıtımı ────────────────────────────────────────────────────────────
function panel(state) {
  if (state.tab === 'rulet') return ruletSekmesi(state);
  if (state.tab === 'merdiven') return merdivenSekmesi(state);
  return kesifSekmesi(state);
}

// ── Sonuç metinleri ───────────────────────────────────────────────────────────
// Ganimetin okunur cümlesi: sayfadaki geri bildirim satırı ile duyuru kartı aynı metni kullanır.
function ganimetSatiri(sonuc) {
  if (sonuc.tur === 'bos') return 'Bu gezide hiçbir şey bulamadın.';
  if (sonuc.tur === 'anahtar') return `${NITELIK[sonuc.nitelik]} ganimet: ${sonuc.adet} kutu anahtarı.`;
  if (sonuc.tur === 'kozmetik') return `${NITELIK[sonuc.nitelik]} ganimet: mağazandan **${sonuc.name}** ürünün sahipliğine geçti.`;
  const kesinti = sonuc.kesilen ? ` Günlük oyun tavanın dolduğu için ${number(sonuc.kesilen)} coin kesildi.` : '';
  return `${NITELIK[sonuc.nitelik]} ganimet: ${coin(sonuc.miktar)}${kesinti}`;
}

// Efsanevi ganimet ve büyük kumarhane kazançları kanalda anılır: üyenin kazancı görünür olsun ki salonun tadı
// sunucuya yayılsın. Küçük eller sayfada kalır, kanal dolmaz.
function bigWin({ user, title, sub, pairs, accent = 'success', at = Date.now() }) {
  return core.receipt({ title, sub, pairs, user, accent, at });
}

module.exports = { IDS, TABLAR, NITELIK, NITELIK_ACCENT, sure, sayisal, panel, ganimetSatiri, merdivenPot, basamakSatirlari, bigWin };
