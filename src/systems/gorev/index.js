// Görevler: üyenin botla her gün temas hâlinde kalmasını sağlayan ilerleme katmanı. Tek panel (/gorev) beş sekme
// taşır: bugünün üç görevi, haftanın üç ağır görevi, Keşif Yolu (botun sistemlerini sırayla gezdiren on bir adım),
// Kutu (anahtar yakma) ve Sezon (aylık puan eşikleri). Katmanlar birbirine bağlıdır: görevden gelen anahtar kutuyu
// açar, kutudan çıkan kozmetik profil puanını büyütür, yolun son adımı profil puanını hedef gösterir.
// İlerleme hiçbir yerde ayrıca sayılmaz: mesaj ve ses sayıları sıralama kaydından, saygınlık saygi kaydından,
// günlük ödül ve siparişler coin defterinden, kozmetikler profil kaydından okunur (olcum.js). Yalnızca ödülün
// alındığı, anahtar sayacı, kutu istatistiği ve sezon puanı burada tutulur.
// Panel üyenin kendi ilerlemesini gösterdiği için gizlidir; kutu açılışı herkese açık duyurulur (satın alma gibi).
const { Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError, isMenuOwner, menuOwnerError } = require('../../core/helpers');
const coinStore = require('../coin/store');
const { TUR_LABEL } = require('../coin/ui');
const katalog = require('../profil/katalog');
const config = require('./config');
const olcum = require('./olcum');
const store = require('./store');
const ui = require('./ui');

const number = (n) => Number(n).toLocaleString('tr-TR');

const commands = [
  new SlashCommandBuilder()
    .setName('gorev')
    .setDescription('Günlük ve haftalık görevlerini, Keşif Yolunu, kutusunu ve sezon ödüllerini gösterir.')
    .setContexts(InteractionContextType.Guild),
];

// ── Ödemenin ödendiği yerler ──────────────────────────────────────────────────
// Ödülün dört hedefi var: coin cüzdanı, anahtar sayacı, sezon puanı ve kozmetik sahipliği. Kozmetik doğrudan
// mağazadaki sahipliğe geçer (aynı kayıt, aynı kart); sipariş defterine yazılmaz çünkü harcama değildir.
// Türün tüm kozmetikleri sahiplikteyse ödül coin'e döner ki üye boşuna anahtar yakmasın.
function ode(userId, odul, sezon, reason) {
  const kazanilan = [];
  if (odul.coin) {
    coinStore.add(userId, odul.coin, reason);
    kazanilan.push(`${number(odul.coin)} coin`);
  }
  if (odul.anahtar) {
    store.anahtarEkle(userId, odul.anahtar);
    kazanilan.push(`${odul.anahtar} anahtar`);
  }
  if (odul.puan) {
    store.puanEkle(userId, sezon, odul.puan);
    kazanilan.push(`${odul.puan} sezon puanı`);
  }
  if (odul.kozmetik) {
    const hediye = katalog.hediye(userId, odul.kozmetik);
    if (hediye) kazanilan.push(`${hediye.name} (${TUR_LABEL[hediye.tur]})`);
    else {
      coinStore.add(userId, config.KUTU.kozmetikYedek, `${reason}: kozmetik yedeği`);
      kazanilan.push(`${number(config.KUTU.kozmetikYedek)} coin`);
    }
  }
  return kazanilan;
}

// ── Panel durumu ──────────────────────────────────────────────────────────────
// Sayfa çizilirken ilerleme baştan ölçülür: eski bir mesajdan basılan düğme asla ödül üretemez.
function durum(interaction, tab) {
  const userId = interaction.user.id;
  const m = olcum.olcumler();
  // Yol sekmesi rozet sayısını, profil puanını ve ömür boyu ses süresini okur; bu üçü tek geçişte toplanır
  const ek = tab === 'yol' ? olcum.ekler(interaction.guild, interaction.member, userId, m) : null;
  const anahtar = store.anahtar(userId);
  return {
    tab,
    at: m.at,
    balance: coinStore.balance(userId),
    anahtar,
    gunluk: olcum.gunlukDurum(userId, m),
    demet: olcum.demetDurumu(userId, m),
    haftalik: olcum.haftalikDurum(userId, m),
    yol: tab === 'yol' ? olcum.yolDurumu(userId, m, ek) : [],
    kutu: { anahtar, ...store.kutuSayilari(userId), yeterli: anahtar >= config.KUTU.anahtar, yeterliUc: anahtar >= config.KUTU.anahtar * 3 },
    sezon: olcum.sezonDurumu(userId, m),
  };
}

const panelFor = (interaction, tab, feedback) => ui.panel({ ...durum(interaction, tab), feedback });

// Ödül alındığında panel yerinde yenilenir; ne kazanıldığı panelin üstünde kalın yazılır, ayrı mesaj atılmaz.
const guncelle = (interaction, tab, feedback) => interaction.update({ components: [panelFor(interaction, tab, feedback)], allowedMentions: { parse: [] } });

const özetle = (kazananlar) => `**Ödül eklendi: ${kazananlar.join(' · ')}.** Bakiyeni /bakiye ile görebilirsin.`;

// ── Görev ödülleri ────────────────────────────────────────────────────────────
// Üç akış da (günlük, haftalık, yol) aynı denetimi yapar: görev bu dönemin listesinde mi, hedef gerçekten dolu mu,
// ödül daha önce alınmadı mı. Soru birinde bile "hayır"sa hiçbir şey ödenmez ve neden hemen söylenir.
function alinabilirMi(satir, m, etiket) {
  if (!satir) return { ok: false, hata: `Bu ${etiket} şu an listede değil.`, ipucu: 'Paneli tazelemek için sekmenin düğmesine tekrar bas; görevler yenilendiğinde liste kendiliğinden değişir.' };
  if (satir.alindi) return { ok: false, hata: 'Bu görevin ödülünü zaten topladın.', ipucu: `${etiket} yenilenince aynı görev yeniden alınabilir olur.` };
  if (!satir.bitti) {
    return { ok: false, hata: 'Görev henüz bitmemiş.', ipucu: `Şu an ${ui.ilerleme(satir)} aşamadasın; hedefe ulaşınca düğme kendiliğinden açılır.` };
  }
  return { ok: true, satir };
}

async function gunlukAl(interaction, key) {
  const userId = interaction.user.id;
  const m = olcum.olcumler();
  const kontrol = alinabilirMi(olcum.gunlukDurum(userId, m).find((s) => s.gorev.key === key), m, 'günlük görev');
  if (!kontrol.ok) return replyError(interaction, kontrol.hata, kontrol.ipucu);

  store.gunlukAl(userId, key, m.gun);
  const kazanc = ode(userId, kontrol.satir.gorev.odul, config.sezonAnahtari(m.at), `görev: ${key}`);
  const kalan = olcum.demetDurumu(userId, m).satirlar.filter((s) => !s.alindi).length;
  return guncelle(
    interaction,
    'gunluk',
    `${özetle(kazanc)}${kalan ? ` Günün demeti için ${kalan} görevin ödülü daha var.` : ' Günün üç görevi de tamamlandı; demetini alabilirsin.'}`,
  );
}

async function haftalikAl(interaction, key) {
  const userId = interaction.user.id;
  const m = olcum.olcumler();
  const kontrol = alinabilirMi(olcum.haftalikDurum(userId, m).find((s) => s.gorev.key === key), m, 'haftalık görev');
  if (!kontrol.ok) return replyError(interaction, kontrol.hata, kontrol.ipucu);

  store.haftalikAl(userId, key, m.hafta);
  const kazanc = ode(userId, kontrol.satir.gorev.odul, config.sezonAnahtari(m.at), `haftalık görev: ${key}`);
  return guncelle(interaction, 'haftalik', `${özetle(kazanc)} Anahtarlar Kutu sekmesinde kutuya dönüşür.`);
}

// Günün demeti: üç günlük görevin ödülü de toplandığında üye kendisi açar; düğmenin etiketi ne eksik olduğunu yazar.
async function demetAl(interaction) {
  const userId = interaction.user.id;
  const m = olcum.olcumler();
  const demet = olcum.demetDurumu(userId, m);
  if (demet.alindi) return replyError(interaction, 'Günün demedini bugün zaten açtın.', 'Görevler gece yenilenince yeni demet de hazır olur.');
  if (!demet.alinabilir) return replyError(interaction, 'Demet için önce üç görevin ödülünü topla.', `Alınmayı bekleyen ${demet.kalan} görev var.`);

  store.demetVer(userId, m.gun);
  const kazanc = ode(userId, config.DEMET, config.sezonAnahtari(m.at), 'günün demeti');
  const seri = store.rec(userId).demetGunleri.length;
  return guncelle(interaction, 'gunluk', `**Günün demeti açıldı: ${kazanc.join(' · ')}.** Bugüne kadar ${seri} demet açtın; seri görevi bu sayıyı haftalık göreve çevirir.`);
}

// Keşif Yolu tek düğmeyle toplanır: birden fazla adım birden bitmiş olabilir (ör. yol yeni açıldı), üye tek tek
// taramak yerine hazır olanların hepsini alır.
async function yolTopla(interaction) {
  const userId = interaction.user.id;
  const m = olcum.olcumler();
  const ek = olcum.ekler(interaction.guild, interaction.member, userId, m);
  const hazir = olcum.yolDurumu(userId, m, ek).filter((s) => s.alinabilir);
  if (!hazir.length) return replyError(interaction, 'Toplanacak hazır adım yok.', 'Sıradaki adımı bitirdiğinde düğme kendiliğinden açılır; liste Keşif Yolu sekmesinde.');

  const sezon = config.sezonAnahtari(m.at);
  const kazanc = [];
  for (const satir of hazir) {
    store.yolAl(userId, satir.adim.key);
    kazanc.push(...ode(userId, satir.adim.odul, sezon, `yol: ${satir.adim.key}`));
  }
  const biten = olcum.yolDurumu(userId, m, ek).filter((s) => s.alindi).length;
  return guncelle(interaction, 'yol', `${özetle(kazanc)} Yolda ${biten} / ${config.YOL.length} adımı tamamladın.`);
}

// Sezon eşiği: puan ay boyunca birikir, her eşik ayda bir kez alınır.
async function sezonAl(interaction, index) {
  const userId = interaction.user.id;
  const m = olcum.olcumler();
  const sezon = config.sezonAnahtari(m.at);
  const kademe = olcum.sezonDurumu(userId, m).kademeler[Number(index)];
  if (!kademe) return replyError(interaction, 'Bu sezon eşiği bulunmuyor.', 'Sezon sekmesini yeniden açmayı dene.');
  if (kademe.alindi) return replyError(interaction, 'Bu eşiğin ödülünü bu ay zaten aldın.', 'Eşikler her ay başında yeniden açılır.');
  if (!kademe.alinabilir) return replyError(interaction, 'Sezon puanın bu eşik için yetmiyor.', `${kademe.ad} eşiği ${number(kademe.puan)} puan ister, sende ${number(kademe ? m : 0) ? number(olcum.sezonDurumu(userId, m).puan) : 0} var.`);

  store.sezonKademeAl(userId, sezon, kademe.index);
  const kazanc = ode(userId, kademe.odul, sezon, `sezon: ${kademe.ad}`);
  return guncelle(interaction, 'sezon', `**${kademe.ad} eşiği aşıldı: ${kazanc.join(' · ')}.**`);
}

// ── Kutu ──────────────────────────────────────────────────────────────────────
// Hazinenin ağırlıklı çekilişi. Garantili kutuda yalnızca kozmetik seçenekleri havuza girer; üye beş kutu
// kozmetiksiz geçiremez.
function hazinedan(userId) {
  const havuz = store.kozmetikGaranti(userId) ? config.KUTU.hazinede.filter((k) => k.tur === 'kozmetik') : config.KUTU.hazinede;
  let kalan = Math.random() * havuz.reduce((total, k) => total + k.agirlik, 0);
  for (const secenek of havuz) {
    kalan -= secenek.agirlik;
    if (kalan <= 0) return secenek;
  }
  return havuz[havuz.length - 1];
}

// Coin ödülleri 5'in katına yuvarlanır: sayılar kartta okunur dursun.
const yuvarla = (n) => Math.round(n / 5) * 5;

// Tek kutunun içeriği. Anahtarı yakan üstteki akıştır; burada yalnızca ödül düşer ve sayılar güncellenir.
function kutuAc(userId) {
  const secenek = hazinedan(userId);
  store.kutuKaydet(userId);

  if (secenek.tur === 'anahtar') {
    store.anahtarEkle(userId, secenek.adet);
    store.kutuGaranti(userId, false);
    return { tur: 'anahtar', miktar: secenek.adet };
  }

  if (secenek.tur === 'kozmetik') {
    const hediye = katalog.hediye(userId, secenek.secim);
    store.kutuGaranti(userId, Boolean(hediye));
    if (hediye) return { tur: hediye.tur, key: hediye.key, name: hediye.name };
    const miktar = yuvarla(config.KUTU.kozmetikYedek);
    coinStore.add(userId, miktar, 'kutu: kozmetik yedeği');
    return { tur: 'coin', miktar };
  }

  const [alt, ust] = secenek.aralik;
  const miktar = yuvarla(alt + Math.random() * (ust - alt));
  coinStore.add(userId, miktar, 'kutu');
  store.kutuGaranti(userId, false);
  return { tur: 'coin', miktar };
}

// Kutu açmak anahtar yakar ve sonucu kanala duyurulur: üye ne çıkardığını gösterir, gören kişi kutunun ne
// verdiğini öğrenir. Panel yerinde yenilenir, anahtar sayısı düşmüş hâliyle görünür.
async function kutu(interaction, adet) {
  const userId = interaction.user.id;
  const maliyet = config.KUTU.anahtar * adet;
  const anahtar = store.anahtar(userId);
  if (anahtar < maliyet) {
    return replyError(
      interaction,
      'Anahtarın bu kadar kutuya yetmiyor.',
      `${maliyet} anahtar gerekiyor, sende ${number(anahtar)} var. Anahtarlar haftalık görevlerden ve günün demetinden düşer.`,
    );
  }

  if (!store.anahtarHarca(userId, maliyet)) return replyError(interaction, 'Kutu açılamadı.', 'Birkaç saniye sonra tekrar dene.');
  const sonuclar = [];
  for (let i = 0; i < adet; i += 1) sonuclar.push(kutuAc(userId));

  await interaction.update({ components: [panelFor(interaction, 'kutu')], allowedMentions: { parse: [] } });
  return respond(
    interaction,
    ui.chest({ user: interaction.user, sonuclar, kalanAnahtar: store.anahtar(userId), balance: coinStore.balance(userId) }),
    { followUp: true, allowedMentions: { users: [interaction.user.id] } },
  );
}

// ── Etkileşim kapısı ──────────────────────────────────────────────────────────
// gorev: önekinin altındaki her düğme buradan geçer.
async function handle(interaction) {
  if (!interaction.guild) return replyError(interaction, 'Görevler sunucuda kullanılır.', 'Komutu bir sunucunun içinde tekrar dene.');
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);

  const [adim, ...kuyruk] = interaction.customId.slice(ui.IDS.prefix.length + 1).split(':');
  switch (adim) {
    case 'sekme': {
      const tab = kuyruk[0];
      if (!ui.TABLAR[tab]) return replyError(interaction, 'Bu sekme artık yok.', '/gorev ile paneli yeniden aç.');
      return interaction.update({ components: [panelFor(interaction, tab)], allowedMentions: { parse: [] } });
    }
    case 'al':
      return kuyruk[0] === 'h' ? haftalikAl(interaction, kuyruk[1]) : gunlukAl(interaction, kuyruk[1]);
    case 'demet':
      return demetAl(interaction);
    case 'yol-topla':
      return yolTopla(interaction);
    case 'kutu-ac':
      return kutu(interaction, kuyruk[0] === '3' ? 3 : 1);
    case 'sezon':
      return sezonAl(interaction, kuyruk[0]);
    default:
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/gorev ile paneli yeniden aç.');
  }
}

// Keşif Yolu'nun iki adımı (kartını aç, çekilişe katıl) hiçbir sistemde iz bırakmaz: bunlar tek yerde,
// etkileşim okunarak görülür. Gözlemci hiçbir cevaba karışmaz, bayrak zaten duruyorsa hiçbir şey yazmaz.
async function observe(interaction) {
  const adımAdi = interaction.isChatInputCommand?.()
    ? config.IZLENEN.komut[interaction.commandName]
    : interaction.isButton?.()
      ? config.IZLENEN.buton[interaction.customId]
      : null;
  if (!adımAdi || store.goruldu(interaction.user.id, adımAdi)) return;
  store.gorusuKaydet(interaction.user.id, adımAdi);
}

async function handleCommand(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL_CV2 });
  return respond(interaction, panelFor(interaction, 'gunluk'), { ephemeral: true });
}

module.exports = {
  name: 'gorev',
  commands,
  help: {
    category: ['hesap', 'Profil'],
    member: ['gorev'],
    access: { gorev: 'Herkes' },
  },
  slash: { gorev: handleCommand },
  prefixed: [[ui.IDS.prefix, handle]],
  events: { [Events.InteractionCreate]: observe },
};
