// Oyun Salonu: /oyun ile açılan tek sayfa, üç sekme (Keşif, Rulet, Şans Merdiveni).
// Ekonomi düzeni: keşif ganimeti coin ÜRETİR ve coin/store.js'teki günlük tavana sayılır; kumarhane oyunları coin
// üretmez, üyenin kendi bakiyesini taşır (masanın payı %5-%7). Böylece salon hem vakit alan bir oyun alanıdır hem
// de enflasyonun dizginlendiği yer. Anahtar ve kozmetik ödülleri ilgili sistemlerin kendi kaydına geçer (görev
// anahtarı, profil mağazası sahipliği) — burada ikinci bir sahiplik listesi tutulmaz.
// Sonuçlar kural olarak sayfanın kendisinde yazılır (aynı mesaj yerinde yenilenir); yalnızca efsanevi ganimet ve
// config.duyuruEsik üstü kumarhane kazançları kanalda herkese açık kart olarak anılır.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError, isMenuOwner, menuOwnerError } = require('../../core/helpers');
const coinStore = require('../coin/store');
const gorevStore = require('../gorev/store');
const katalog = require('../profil/katalog');
const { levelFromXp } = require('../seviye/level');
const seviyeStore = require('../seviye/store');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const number = (n) => Number(n).toLocaleString('tr-TR');
// Sayılar kartta okunur dursun: kazançlar 5'in katına yuvarlanır (görev kutusuyla aynı teamül)
const yuvarla = (n) => Math.round(n / 5) * 5;

const commands = [
  new SlashCommandBuilder()
    .setName('oyun')
    .setDescription('Oyun Salonunu açar: keşif gezileri, rulet ve şans merdiveni.')
    .setContexts(InteractionContextType.Guild),
];

// Üyenin keşif kapısı: günlük ödülle aynı ölçüm (mesaj ve ses seviyesinin büyük olanı)
const seviyeOlcumu = (userId) =>
  Math.max(levelFromXp(seviyeStore.xpOf('mesaj', userId)), levelFromXp(seviyeStore.xpOf('ses', userId)));

// Sayfa çizilirken her şey baştan okunur: eski bir mesajdan basılan düğme asla ödül üretemez.
// durumOf dışa açılır ki önizleme (tools/preview) aynı okuma kapısından geçsin, senaryo için elle durum kurmasın.
function durumOf(userId, tab, feedback, at = Date.now()) {
  return {
    tab,
    at,
    feedback,
    seviye: seviyeOlcumu(userId),
    balance: coinStore.balance(userId),
    bahis: store.bahis(userId),
    kalanTavan: coinStore.winStatus(userId, at).kalan,
    kesif: store.kesifSayilari(userId),
    kesifHazir: store.kesifDurumu(userId, at),
    kumar: store.kumarSayilari(userId),
    merdiven: store.merdiven(userId, at),
  };
}

const durum = (interaction, tab, feedback) => durumOf(interaction.user.id, tab, feedback);

const panelFor = (interaction, tab, feedback) => ui.panel(durum(interaction, tab, feedback));

const guncelle = (interaction, tab, feedback) =>
  interaction.update({ components: [panelFor(interaction, tab, feedback)], allowedMentions: { parse: [] } });

// Büyük kazanç kanalda anılır; efsanevi ganimet ve eşik üstü kumarhane kazançları dışında mesaj atılmaz.
function duyur(interaction, card) {
  return respond(interaction, card, { followUp: true, allowedMentions: { users: [interaction.user.id] } });
}

// ── Keşif ─────────────────────────────────────────────────────────────────────
// Bölge masasından ağırlıklı tek sonuç çekilir.
function masaDon(bolge) {
  let kalan = Math.random() * bolge.masa.reduce((total, satir) => total + satir.agirlik, 0);
  for (const satir of bolge.masa) {
    kalan -= satir.agirlik;
    if (kalan <= 0) return satir;
  }
  return bolge.masa[bolge.masa.length - 1];
}

// Ganimet ilgili sisteme teslim edilir ve okunur sonuç döner. Coin tavana sayılır; tavan dolmuşsa kesinti
// kartta da yazar ki üye "neden daha az yattı" sorusunu sormasın.
function ganimetiTeslimEt(userId, satir) {
  if (satir.tur === 'anahtar') {
    gorevStore.anahtarEkle(userId, satir.adet);
    return { tur: 'anahtar', adet: satir.adet, nitelik: satir.nitelik };
  }

  if (satir.tur === 'kozmetik') {
    const hediye = katalog.hediye(userId, satir.secim);
    if (hediye) return { tur: 'kozmetik', name: hediye.name, nitelik: satir.nitelik };
    const kazanc = coinStore.addWin(userId, config.kesif.kozmetikYedek, 'keşif: kozmetik yedeği');
    return { tur: 'coin', miktar: kazanc.odenen, kesilen: kazanc.kesilen, nitelik: satir.nitelik };
  }

  const [alt, ust] = satir.aralik;
  const kazanc = coinStore.addWin(userId, yuvarla(alt + Math.random() * (ust - alt)), 'keşif');
  return { tur: 'coin', miktar: kazanc.odenen, kesilen: kazanc.kesilen, nitelik: satir.nitelik };
}

async function kesif(interaction, bolgeKey) {
  const userId = interaction.user.id;
  const bolge = config.kesif.bolgeler.find((b) => b.key === bolgeKey);
  if (!bolge) return replyError(interaction, 'Bu bölge artık salonda yok.', '/oyun ile sayfayı yeniden aç.');

  const hazir = store.kesifDurumu(userId);
  if (hazir.sebep === 'kota') return replyError(interaction, 'Bugünkü gezi kotasın doldu.', `Günde ${config.kesif.gunlukAdet} gezi yapabilirsin; gece sıfırlanır. Kumarhane açık.`);
  if (hazir.sebep === 'bekleme') return replyError(interaction, 'Bekleme süren dolmadı.', `Sıradaki gezi ${core.rel(hazir.nextAt)} içinde hazır olur.`);

  const seviye = seviyeOlcumu(userId);
  if (seviye < bolge.seviye) return replyError(interaction, 'Bu bölge senin seviyene açık değil.', `${bolge.ad} için seviye ${bolge.seviye} gerekir, senin ölçülen seviyen ${seviye}.`);

  const sonuc = ganimetiTeslimEt(userId, masaDon(bolge));
  store.kesifKaydet(userId, bolge.key);

  const satir = ui.ganimetSatiri(sonuc);
  await guncelle(interaction, 'kesif', `**${bolge.ad}:** ${satir}`);
  if (sonuc.nitelik === 'efsanevi') {
    return duyur(
      interaction,
      ui.bigWin({
        user: interaction.user,
        title: 'Efsanevi Ganimet',
        sub: `<@${userId}> ${bolge.ad} yolunda efsanevi ganimet buldu: ${satir.replace('Efsanevi ganimet: ', '')}`,
        pairs: [['Bölge', bolge.ad], ['Bugünkü Gezi', `${hazir.used + 1} / ${config.kesif.gunlukAdet}`]],
        accent: 'danger',
      }),
    );
  }
  return null;
}

// ── Rulet ─────────────────────────────────────────────────────────────────────
function cepRenk(cep) {
  if (cep < config.rulet.cepler.kirmizi) return 'kirmizi';
  if (cep < config.rulet.cepler.kirmizi + config.rulet.cepler.siyah) return 'siyah';
  return 'yesil';
}

async function rulet(interaction, renk) {
  const userId = interaction.user.id;
  const bahis = store.bahis(userId);
  if (!config.rulet.renkler[renk]) return replyError(interaction, 'Bu renk masada yok.', '/oyun ile sayfayı yeniden aç.');
  if (coinStore.balance(userId) < bahis) {
    return replyError(interaction, 'Bahsini karşılayacak coinin yok.', `Masaya ${number(bahis)} coin konuyor; cüzdanında ${number(coinStore.balance(userId))} coin var.`);
  }
  if (!coinStore.spend(userId, bahis)) return replyError(interaction, 'Bahis alınamadı.', 'Birkaç saniye sonra tekrar dene.');

  const cikan = cepRenk(Math.floor(Math.random() * Object.values(config.rulet.cepler).reduce((a, b) => a + b, 0)));
  const tuttu = cikan === renk;
  const odeme = tuttu ? bahis * config.rulet.renkler[renk].odul : 0;
  if (odeme) coinStore.add(userId, odeme, 'rulet');
  store.elKaydet(userId, { net: odeme - bahis, odul: odeme });

  const sonuc = `${config.rulet.renkler[cikan].ad} geldi.`;
  const satir = tuttu ? `${sonuc} ${config.rulet.renkler[renk].ad} tuttu: ${number(odeme)} coin geri döndü.` : `${sonuc} ${config.rulet.renkler[renk].ad} tutmadı: ${number(bahis)} coin masada kaldı.`;

  await guncelle(interaction, 'rulet', `**Rulet:** ${satir}`);
  if (odeme >= config.duyuruEsik) {
    return duyur(
      interaction,
      ui.bigWin({
        user: interaction.user,
        title: 'Kumarhanede Büyük El',
        sub: `<@${userId}> rulette ${config.rulet.renkler[renk].ad} oynadı, ${sonuc} ${number(odeme)} coin kazandı.`,
        pairs: [['Bahis', `${number(bahis)} coin`], ['Geri Dönen', number(odeme)], ['Cüzdan', `${number(coinStore.balance(userId))} coin`]],
      }),
    );
  }
  return null;
}

// ── Şans Merdiveni ────────────────────────────────────────────────────────────
const potHesapla = (merdiven) => Math.round(merdiven.bahis * ui.merdivenPot(config.merdiven.adimlar, merdiven.adim));

async function merdivenBaslat(interaction) {
  const userId = interaction.user.id;
  const bahis = store.bahis(userId);
  if (store.merdiven(userId)) return replyError(interaction, 'Masada zaten bir tırmanışın duruyor.', 'Önce "Parayı Çek" ya da "Bir Basamak Çık" ile sürdür.');
  if (coinStore.balance(userId) < bahis) {
    return replyError(interaction, 'Bahsini karşılayacak coinin yok.', `Masaya ${number(bahis)} coin konuyor; cüzdanında ${number(coinStore.balance(userId))} coin var.`);
  }
  if (!coinStore.spend(userId, bahis)) return replyError(interaction, 'Bahis alınamadı.', 'Birkaç saniye sonra tekrar dene.');

  store.merdivenBaslat(userId, bahis);
  const ilk = config.merdiven.adimlar[0];
  return guncelle(
    interaction,
    'merdiven',
    `**Tırmanış başladı:** ${number(bahis)} coin masada. İlk basamak ${Math.round(ilk.dusme * 100)}% riskle potu ${ui.sayisal(ilk.carpim)}x yapar.`,
  );
}

async function merdivenCik(interaction) {
  const userId = interaction.user.id;
  const aktif = store.merdiven(userId);
  if (!aktif) return replyError(interaction, 'Masada tırmanışın yok.', '"Tırman" düğmesiyle yeni bir el aç.');

  const adimlar = config.merdiven.adimlar;
  if (aktif.adim >= adimlar.length) return replyError(interaction, 'Son basamaktasın.', 'Buradan yukarı yok; "Parayı Çek" ile potu al.');

  const basamak = adimlar[aktif.adim];
  const dustu = Math.random() < basamak.dusme;
  if (dustu) {
    store.merdivenDusur(userId);
    store.elKaydet(userId, { net: -aktif.bahis, odul: 0 });
    return guncelle(interaction, 'merdiven', `**Düştün:** ${aktif.adim + 1}. basamakta tırmanış kırıldı, ${number(aktif.bahis)} coin yandı.`);
  }

  const guncel = store.merdivenYukselt(userId);
  const pot = potHesapla(guncel);
  const sonraki = adimlar[guncel.adim];
  const uyari = sonraki
    ? `Sıradaki basamak ${Math.round(sonraki.dusme * 100)}% risk taşır.`
    : 'Son basamaktasın; çekmek zorundasın.';
  return guncelle(interaction, 'merdiven', `**${guncel.adim}. basamaktasın:** pot ${number(pot)} coin. Çekersen cebine girer. ${uyari}`);
}

async function merdivenCek(interaction) {
  const userId = interaction.user.id;
  const aktif = store.merdiven(userId);
  if (!aktif) return replyError(interaction, 'Masada tırmanışın yok.', '"Tırman" düğmesiyle yeni bir el aç.');

  const pot = potHesapla(aktif);
  store.merdivenDusur(userId);
  coinStore.add(userId, pot, 'şans merdiveni');
  store.elKaydet(userId, { net: pot - aktif.bahis, odul: pot });

  await guncelle(interaction, 'merdiven', `**Çekildi:** ${aktif.adim} basamakta pot ${number(pot)} coin cüzdanına yattı.`);
  if (pot >= config.duyuruEsik) {
    return duyur(
      interaction,
      ui.bigWin({
        user: interaction.user,
        title: 'Şans Merdiveninden Çekildi',
        sub: `<@${userId}> ${aktif.adim}. basamakta indi ve ${number(pot)} coin aldı. Bahis ${number(aktif.bahis)} coin idi.`,
        pairs: [['Basamak', `${aktif.adim} / ${config.merdiven.adimlar.length}`], ['Kazanç', `${number(pot - aktif.bahis)} coin`], ['Cüzdan', `${number(coinStore.balance(userId))} coin`]],
      }),
    );
  }
  return null;
}

// ── Etkileşim kapısı ──────────────────────────────────────────────────────────
async function handle(interaction) {
  if (!interaction.guild) return replyError(interaction, 'Salon sunucuda çalışır.', 'Komutu bir sunucu içinde tekrar dene.');
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);

  const [adim, ...kuyruk] = interaction.customId.slice(ui.IDS.prefix.length + 1).split(':');
  switch (adim) {
    case 'sekme': {
      const tab = kuyruk[0];
      if (!ui.TABLAR[tab]) return replyError(interaction, 'Bu sekme artık yok.', '/oyun ile sayfayı yeniden aç.');
      return interaction.update({ components: [panelFor(interaction, tab)], allowedMentions: { parse: [] } });
    }
    case 'bahis': {
      const tab = kuyruk[0];
      if (!ui.TABLAR[tab]) return replyError(interaction, 'Bu sekme artık yok.', '/oyun ile sayfayı yeniden aç.');
      store.setBahis(interaction.user.id, Number(kuyruk[1]) || config.bets[0]);
      return interaction.update({ components: [panelFor(interaction, tab)], allowedMentions: { parse: [] } });
    }
    case 'kesif':
      return kesif(interaction, kuyruk[0]);
    case 'rulet':
      return rulet(interaction, kuyruk[0]);
    case 'merdiven': {
      if (kuyruk[0] === 'bas') return merdivenBaslat(interaction);
      if (kuyruk[0] === 'cik') return merdivenCik(interaction);
      if (kuyruk[0] === 'cek') return merdivenCek(interaction);
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/oyun ile sayfayı yeniden aç.');
    }
    default:
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/oyun ile sayfayı yeniden aç.');
  }
}

async function handleCommand(interaction) {
  await interaction.deferReply();
  return respond(interaction, panelFor(interaction, 'kesif'));
}

module.exports = {
  name: 'oyun',
  commands,
  help: {
    category: ['oyun', 'Oyun ve Şans'],
    member: ['oyun'],
    access: { oyun: 'Herkes' },
  },
  slash: { oyun: handleCommand },
  prefixed: [[ui.IDS.prefix, handle]],
  panelFor,
  durumOf,
};
