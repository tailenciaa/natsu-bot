// Evlilik mesajları: teklif kartı, kabul/ret/süre sonuç kartları, kişinin kendi hâl sayfası ve çiftler listesi.
// Görünürlük: teklif ve evlilik kartları komutla açılan ve iki kişiyi ilgilendiren KAYITLAR olduğu için kanalda
// kalıcı ve herkese açıktır — yüzük yakılıp evlilik ilan edilir, herkes görsün. Sonuçlar ayrı mesaj değildir:
// teklif kartı yerinde sonuç kartına döner, kanal dolmaz. Hatalarsa sadece basana görünür.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const core = require('../../core/ui');
const { coin, number } = require('../coin/ui');
const butikConfig = require('../butik/config');
const config = require('./config');

// evlilik:<adim> ve evlilik:<adim>:<veri>. Butik ve cüzdan kapıları coin/butik sisteminin sabit düğmeleri:
// aynı ID yeniden kullanılır ki üye parasını harcadığı raftan ayrılmasın.
const IDS = {
  prefix: 'evlilik',
  durum: 'evlilik:durum',
  list: 'evlilik:list',
  bonus: 'evlilik:bonus',
  bosan: 'evlilik:bosan',
  kabul: 'evlilik:kabul:', // + teklif numarası — yalnızca muhatap basabilir
  ret: 'evlilik:ret:', // + teklif numarası — yalnızca muhatap basabilir
  iptal: 'evlilik:iptal:', // + teklif numarası — yalnızca teklifi götüren basabilir
  cuzdan: 'coin-bakiye',
  butik: 'butik:magaza',
};

const mention = (userId) => `<@${userId}>`;

// Kartların ortak cümlesi: iki isim yan yana, fiil üçüncü tekil şahısta
const çift = (a, b) => `${mention(a)} ile ${mention(b)}`;

// Boşanma düğmesinin etiketi: bedel butonun üstünde yazılı ki üye tıklayınca sürprizle karşılaşmasın
const bosanEtiket = `Boşan · ${number(config.bosanma.price)}`;

// ── Teklif kartı ──────────────────────────────────────────────────────────────
function teklif({ oneren, hedef, no, sonAt }) {
  return core
    .page({
      title: config.basliklar.teklif,
      sub: `${çift(oneren.id, hedef.id)} evlenmek istiyor. Yüzük ${mention(oneren.id)} kişisinin cebinde duruyor; ` +
        `Karşılık bu kartın düğmelerinden verilir, yazıyla "tamam" demek işlemez.`,
      thumbnail: oneren.displayAvatarURL({ size: 256 }),
      blocks: [
        core.rows([
          ['Teklif Eden', mention(oneren.id)],
          ['Muhatap', mention(hedef.id)],
          ['Yüzük', core.chip(butikConfig.yuzuk.ad)],
          ['Yanıt Süresi', core.rel(sonAt)],
        ]),
        config.notlar.yuzuk,
      ],
      accent: core.colors.success,
    })
    .addSeparatorComponents(core.divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.kabul}${no}`).setLabel('Kabul Ediyorum').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${IDS.ret}${no}`).setLabel('Geri Çevir').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp()));
}

// ── Sonuç kartları ────────────────────────────────────────────────────────────
// Kabul: evlilik ilanı. Bakiye yazılmaz, yakılan yüzük ve verilen rol yazılır.
function evlilikKarti({ oneren, hedef, user, roleId, at = Date.now() }) {
  return core.receipt({
    title: config.basliklar.evlilik,
    sub: `${çift(oneren, hedef)} evlendi. Yüzük kabul anında yakıldı; ikili artık sunucuda çift olarak duruyor.`,
    user,
    accent: 'success',
    pairs: [
      ['Eş', mention(hedef)],
      ['Eş', mention(oneren)],
      ['Başlangıç', core.rel(at)],
      ['Yüzük', core.chip('yakıldı')],
      roleId ? ['Evli rolü', `<@&${roleId}>`] : false,
    ],
    note: config.notlar.evli,
    at,
  });
}

// Ret: kart yerinde bu karta döner, yüzük yakılmaz
function retKarti({ oneren, hedef, user, at = Date.now() }) {
  return core.receipt({
    title: config.basliklar.ret,
    sub: `${mention(hedef)} adlı üye, ${mention(oneren)} kişisinin teklifini geri çevirdi. Yüzük cebinde kaldı.`,
    user,
    accent: 'warning',
    pairs: [
      ['Teklif Eden', mention(oneren)],
      ['Muhatap', mention(hedef)],
      ['Yüzük', core.chip('yanmadı, elde')],
    ],
    note: config.notlar.ret,
    at,
  });
}

// Süre doldu: bekçi kartı yerinde kapatır
function sureKarti({ oneren, hedef, user, at = Date.now() }) {
  return core.receipt({
    title: config.basliklar.sure,
    sub: `${mention(oneren)} kişisinin ${mention(hedef)} için uzattığı teklife yanıt gelmedi.`,
    user,
    accent: 'warning',
    pairs: [
      ['Teklif Eden', mention(oneren)],
      ['Muhatap', mention(hedef)],
      ['Yüzük', core.chip('yanmadı, elde')],
    ],
    note: config.notlar.sure,
    at,
  });
}

// Kabul anında yüzük elde kalmamışsa kart bu karta döner: kayıt açılmaz, çift rolü verilmez
function gecersizKarti({ oneren, hedef, user, at = Date.now() }) {
  return core.receipt({
    title: config.basliklar.gecersiz,
    sub: `${çift(oneren, hedef)} için teklif kabul edildi ama yüzük bulunamadı; evlilik kaydedilmedi.`,
    user,
    accent: 'warning',
    pairs: [
      ['Teklif Eden', mention(oneren)],
      ['Muhatap', mention(hedef)],
      ['Sebep', core.chip('yüzük yok')],
    ],
    note: config.notlar.gecersiz,
    at,
  });
}

// Teklifinden vazgeçen tarafın kartı
function iptalKarti({ oneren, hedef, user, at = Date.now() }) {
  return core.receipt({
    title: config.basliklar.iptal,
    sub: `${mention(oneren)} adlı üye, ${mention(hedef)} kişisine uzattığı tekliften vazgeçti. Yüzük yanmadı.`,
    user,
    accent: 'warning',
    pairs: [
      ['Teklif Eden', mention(oneren)],
      ['Muhatap', mention(hedef)],
      ['Yüzük', core.chip('yanmadı, elde')],
    ],
    at,
  });
}

// Boşanma ilanı: bedel kasaya yazar, iki tarafın da rolü geri alınır
function bosanmaKarti({ a, b, user, bedel, at = Date.now() }) {
  return core.receipt({
    title: config.basliklar.bosanma,
    sub: `${çift(a, b)} yollarını ayırdı. Boşanma bedeli kasaya yazıldı.`,
    user,
    accent: 'warning',
    pairs: [
      ['Eski Eş', mention(b)],
      ['Eski Eş', mention(a)],
      ['Bedel', coin(bedel)],
      ['Yeni Teklif', core.rel(at + config.bosanma.bekleme)],
    ],
    note: config.notlar.bosanma,
    at,
  });
}

// Yıl dönümü ödülü kartı: iki tarafa birden yatan para tek kartta
function yilDonumuKarti({ a, b, odul, sayi, sonrakiAt, user, at = Date.now() }) {
  return core.receipt({
    title: 'Yıl Dönümü Kutlandı',
    sub: `${çift(a, b)} bir dönümü daha geride bıraktı; ödül ikisinin de cebine yattı.`,
    user,
    accent: 'success',
    pairs: [
      ['Eş', mention(b)],
      ['Eş', mention(a)],
      ['Kişi Başına', coin(odul)],
      ['Alınan Dönüm', core.chip(`${sayi}.`)],
      ['Sıradaki', core.rel(sonrakiAt)],
    ],
    at,
  });
}

// ── Kişinin kendi hâl sayfası ─────────────────────────────────────────────────
function evlilikBloku(state) {
  const { es, at, gun, bonus } = state.evlilik;
  const sonraki = bonus.hazir ? `${core.chip('hazır')}` : core.rel(bonus.sonrakiAt);
  return `### Evlisin\n${core.rows([
    ['Eşin', mention(es)],
    ['Başlangıç', core.rel(at)],
    ['Birlikte', `${number(gun)} gün`],
    ['Alınan Dönüm', bonus.sayi ? `${number(bonus.sayi)} kez` : 'henüz yok'],
    ['Sıradaki Ödül', sonraki],
  ])}`;
}

function bekleyenBloku(state) {
  const satirlar = [];
  if (state.giden) {
    satirlar.push(
      `**Uzattığın teklif:** ${mention(state.giden.hedef)} kişisine yüzük verdin, yanıt ${core.rel(state.giden.sonAt)} içinde belli olur.`,
    );
  }
  if (state.gelen) {
    satirlar.push(
      `**Sana uzanan teklif:** ${mention(state.gelen.oneren)} bekliyor; yanıt vermek için ${core.rel(state.gelen.sonAt)} içinde. Teklifin kartı kanalda duruyor.`,
    );
  }
  return satirlar.length ? `### Bekleyen Teklif\n${satirlar.join('\n')}` : null;
}

function sartBloku(state) {
  const yuzuk = state.yuzuk > 0 ? `Elinde ${core.chip(`${state.yuzuk} yüzük`)} var.` : `Yüzüğün yok; Butikte ${coin(butikConfig.yuzuk.price)} ve tek şart o.`;
  const seviye = state.seviye >= config.teklif.minSeviye
    ? `Seviyen ${core.chip(state.seviye)}, kapı açılmış.`
    : `Teklif için seviye ${core.chip(config.teklif.minSeviye)} gerekir, ölçülen seviyen ${core.chip(state.seviye)}.`;
  const durumlar = [
    ['Yüzük', yuzuk],
    ['Seviye', seviye],
    state.hapista ? ['Cezaevi', `Tahliyen ${core.rel(state.hapista)} içinde; içerideyken teklif götürülmez.`] : false,
    state.bosanmaBekleme > state.at ? ['Boşanma beklemesi', `Yeni teklif ${core.rel(state.bosanmaBekleme)} içinde.`] : false,
  ];
  return `### Teklif Şartları\n${core.rows(durumlar)}`;
}

function kurallarBloku(state) {
  const roller = config.roles.evli
    ? `5. Çiftin ikisine de **evli rolü** verilir; sunucudan düşüp dönersen bot rolü geri verir.`
    : '5. Evli rolü sunucuda hazır olmadığı için şu an verilmiyor; evlilik yine kaydediliyor.';
  return `### Nasıl İşler?
1. **${coin(butikConfig.yuzuk.price)}** karşılığında Butikten **yüzük** al: /bakiye > Butik.
2. **/evlilik teklif kullanici:@üye** yaz; teklif kartı kanala düşer, ${Math.round(config.teklif.pencere / 3600000)} saat yanıt beklenir.
3. Muhatap **Kabul Ediyorum** basarsa yüzüğün yakılır, ikiniz evli olarak kaydedilirsiniz. **Geri Çevir** ya da sessizlik yüzük kaybettirmez.
4. Evliliğin her ${config.yilDonumu.gun} gününde bir **yıl dönümü ödülü** iki tarafa birden yatar: sayfadaki düğmeye kim basarsa bassın, para ikisinin de cebine geçer.
${roller}
6. Yollar ayrılırsa **${bosanEtiket}** düğmesiyle boşanırsın; eşin de aynı süre boyunca yeni teklif götüremez.`;
}

function durumPaneli(state) {
  const container = core.page({
    title: config.basliklar.durum,
    sub: 'Evlilik yüzükle kurulur, kabul anında yüzük yakılır. Bu sayfa senin evlilik hâlini, bekleyen tekliflerini ' +
      've yıl dönümü ödülünü gösterir.',
    thumbnail: state.user.displayAvatarURL({ size: 256 }),
    blocks: [
      state.feedback ? `**${state.feedback}**` : null,
      state.evlilik ? evlilikBloku(state) : `### Bekârsın\n${core.chip('evli değilsin')}`,
      bekleyenBloku(state),
      state.evlilik ? null : sartBloku(state),
      kurallarBloku(state),
    ].filter(Boolean),
  });

  const butonlar = [];
  if (state.evlilik && state.evlilik.bonus.hazir) {
    butonlar.push(new ButtonBuilder().setCustomId(IDS.bonus).setLabel('Yıl Dönümü Ödülü').setStyle(ButtonStyle.Success));
  }
  if (state.evlilik) {
    butonlar.push(new ButtonBuilder().setCustomId(IDS.bosan).setLabel(bosanEtiket).setStyle(ButtonStyle.Danger));
  }
  if (state.giden) {
    butonlar.push(new ButtonBuilder().setCustomId(`${IDS.iptal}${state.giden.no}`).setLabel('Tekliften Vazgeç').setStyle(ButtonStyle.Secondary));
  }
  butonlar.push(
    new ButtonBuilder().setCustomId(IDS.butik).setLabel('Butik').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(IDS.list).setLabel('Çiftler Listesi').setStyle(ButtonStyle.Secondary),
  );

  container.addSeparatorComponents(core.divider()).addActionRowComponents(new ActionRowBuilder().addComponents(butonlar));
  return container.addSeparatorComponents(core.divider()).addTextDisplayComponents(core.text(core.stamp(state.at)));
}

// ── Çiftler listesi ───────────────────────────────────────────────────────────
function listePaneli(state) {
  const satirlar = state.ciftler.length
    ? state.ciftler
        .slice(0, config.listeGoster)
        .map((c) => `${çift(c.a, c.b)} — ${number(Math.max(0, Math.floor((state.at - c.at) / (24 * 60 * 60 * 1000))))} gün`)
        .join('\n')
    : '**Henüz evli çift yok.**';

  const container = core.page({
    title: config.basliklar.liste,
    sub: 'Sunucuda yüzükle bağlanan çiftler. İlk on sırada en yeni evlilikler duruyor.',
    blocks: [
      `### Çiftler\n${satirlar}`,
      state.ciftler.length > config.listeGoster
        ? `${number(state.ciftler.length)} çift var, listede ilk ${config.listeGoster} sırada.`
        : state.ciftler.length
          ? null
          : 'Teklifin yolu: Butikten yüzük al, sonra /evlilik teklif yaz.',
    ].filter(Boolean),
  });

  return container
    .addSeparatorComponents(core.divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.durum).setLabel('Kendi Hâlim').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(IDS.butik).setLabel('Butik').setStyle(ButtonStyle.Secondary),
      ),
    )
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp(state.at)));
}

module.exports = {
  IDS,
  bosanEtiket,
  mention,
  teklif,
  evlilikKarti,
  retKarti,
  sureKarti,
  gecersizKarti,
  iptalKarti,
  bosanmaKarti,
  yilDonumuKarti,
  durumPaneli,
  listePaneli,
};
