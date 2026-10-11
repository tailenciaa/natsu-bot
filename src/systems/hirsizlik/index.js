// Suç Dünyası: /sokak ile açılan Arka Sokaklar sayfası, /çal ile atılan pusular, Devletin Kasası ve cezaevi.
// Ekonomi düzeni: bu sistem coin ÜRETMEZ. Üye soymak parayı kurbanın cebinden soyguncunun cebine taşır
// (coin/store.js transfer), kasa soygunu ise cezalarla birikmiş kasadan dağıtır. Kasa yalnızca üye cebinden
// çıkan parayla (ceza, kefalet) büyür; kuruluş tutarı tek seferlik. Kasa ödülü ve yakalatma ikramiyesi günlük
// oyun kazancı tavanına sayılır, böylece arka kapıdan tavan delinmez.
// Zamanlama kuralı: pusu kartı açılır, kurban (ya da kasada herkes) config'in verdiği pencerede düğmeye basmazsa
// girişim bekçi tarafından sonuçlandırılır. Bekçi bot açılırken bir kez, sonra sabit aralıkla çalışır; süre geçmiş
// kayıt okumada kendini boş gösterdiği için tek bir tarama bile yeter.
const { ChannelType, Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError, isMenuOwner, menuOwnerError } = require('../../core/helpers');
const { coin } = require('../coin/ui');
const coinStore = require('../coin/store');
const { levelFromXp } = require('../seviye/level');
const seviyeStore = require('../seviye/store');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('sokak')
    .setDescription('Arka Sokakları açar: suç sicilin, cezaevin ve Devletin Kasası.')
    .setContexts(InteractionContextType.Guild),
  new SlashCommandBuilder()
    .setName('çal')
    .setDescription('Suç işler: bir üyeyi soymaya kalkış ya da Devletin Kasasını zorla.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName('uye')
        .setDescription('Bir üyeyi soymaya kalkışırsın; kurbanın direnme süresi doğar.')
        .addUserOption((o) => o.setName('kullanici').setDescription('Hedef üye').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('kasa').setDescription('Devletin Kasasını soymaya kalkışırsın; herkes müdahale edebilir.')),
];

// Kazanç 5'in katına yuvarlanır: kartta okunur dursun (keşif ve görevle aynı teamül)
const yuvarla = (n) => Math.round(n / 5) * 5;

// Girişim numarası kısa tutulur: custom_id içinde taşınır ve kart çözüldüğünde kayıttan kalkar
const girisimNo = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;

// Üyenin suç ölçümü: seviye hem kepenk hem kelepçe (mesaj ve ses seviyesinin büyük olanı)
const seviyeOlcumu = (userId) =>
  Math.max(levelFromXp(seviyeStore.xpOf('mesaj', userId)), levelFromXp(seviyeStore.xpOf('ses', userId)));

// Yakalanma olasılığı: direnenin ya da müdahale edenin seviyesi saldırganı geçiyorsa şans büyür
function yakalanmaSansi(mudahiSeviye, saldirganSeviye) {
  const { taban, seviyeFarki, min, max } = config.yakalanma;
  return Math.min(max, Math.max(min, taban + (mudahiSeviye - saldirganSeviye) * seviyeFarki));
}

// Üyeden kasaya para yatırılır (ceza ve kefalet): bakiye yetmiyorsa olduğunca alınır, üye borçlu bırakılmaz
function kasayaYatir(userId, tutar) {
  const odenen = Math.min(coinStore.balance(userId), Math.max(0, Math.floor(tutar)));
  if (odenen > 0) {
    coinStore.spend(userId, odenen);
    store.kasaEkle(odenen);
  }
  return odenen;
}

// Sayfanın okuduğu bütün durum: store ölçümü + cüzdan. Dışa açılır ki önizleme aynı kapıdan geçsin.
function durumOf(userId, feedback, at = Date.now()) {
  return { ...store.durumOf(userId, at), balance: coinStore.balance(userId), feedback, seviye: seviyeOlcumu(userId) };
}

const panelFor = (interaction, feedback) => ui.panel(durumOf(interaction.user.id, feedback));

// ── Kapılar ───────────────────────────────────────────────────────────────────
// Sıra önemli: önce cezaevi (üye içerideyse hiçbir şey yapamaz), sonra seviye, kota, bekleme ve elindeki açık pusu.
function kapilar(userId, at = Date.now()) {
  const durum = store.durumOf(userId, at);
  const seviye = seviyeOlcumu(userId);
  if (durum.hapis) {
    return { ok: false, mesaj: 'İçeridesin, yeni suç işleyemezsin.', ipucu: `Tahliyen ${core.rel(durum.hapis)} içinde. Erken çıkmak için /sokak sayfasından kefalet ödeyebilirsin.` };
  }
  if (seviye < config.minSeviye) {
    return { ok: false, mesaj: 'Suç dünyası senin seviyene kapalı.', ipucu: `Girişim için seviye ${config.minSeviye} gerekir, ölçülen seviyen ${seviye}.` };
  }
  if (durum.kalan <= 0) {
    return { ok: false, mesaj: 'Bugünkü suç kotan doldu.', ipucu: `Günde ${config.gunlukAdet} girişim yapabilirsin; gece sıfırlanır. Kumarhane açık.` };
  }
  if (durum.bekleme > at) {
    return { ok: false, mesaj: 'Sıradaki girişimin için bekliyorsun.', ipucu: `${core.rel(durum.bekleme)} içinde yeniden suç işleyebilirsin.` };
  }
  if (durum.acikGirisim) {
    return { ok: false, mesaj: 'Eline aldığın pusu henüz sonuçlanmadı.', ipucu: 'Kurban direnirse ya da süre dolarsa kart kendiliğinden sonuçlanır.' };
  }
  return { ok: true, durum, seviye };
}

// ── Üye soymak ────────────────────────────────────────────────────────────────
async function uyeSoy(interaction) {
  const kap = kapilar(interaction.user.id);
  if (!kap.ok) return replyError(interaction, kap.mesaj, kap.ipucu);

  const hedef = interaction.options.getUser('kullanici');
  if (!hedef) return replyError(interaction, 'Hedef bir üye değil.', '/çal uye kullanici:... ile sunucudan bir üye seç.');
  if (hedef.bot) return replyError(interaction, 'Botlar soyulmaz.', 'Bir üye seç.');
  if (hedef.id === interaction.user.id) return replyError(interaction, 'Kendi cebini soyamazsın.', 'Bir başkasını hedef al.');

  const hedefSeviye = seviyeOlcumu(hedef.id);
  if (hedefSeviye < config.korumaSeviye) {
    return replyError(interaction, 'Bu üye henüz korunuyor.', `Suç dünyası için seviye ${config.korumaSeviye} gerekir; seçtiğin üyenin ölçülen seviyesi ${hedefSeviye}.`);
  }
  const hdurum = store.durumOf(hedef.id);
  if (hdurum.hapis) return replyError(interaction, 'Kurban içeride.', 'Cezaevindeki üye soyulmaz; sokakta birini bul.');
  if (hdurum.dokunulmaz) {
    return replyError(interaction, 'Bu üye dokunulmaz.', `${core.rel(hdurum.dokunulmaz)} kadar hedef olamaz; yeni soyulan ya da direnen üye bir süre korunur.`);
  }
  const balance = coinStore.balance(hedef.id);
  if (balance < config.uye.taban) {
    return replyError(interaction, 'Bu üyenin cüzdanında soymalık coin yok.', `Hedefin kasasında en az ${coin(config.uye.taban)} coin durması gerekir.`);
  }
  const hedefBekleme = kap.durum.hedefBekleme(hedef.id);
  if (hedefBekleme > Date.now()) {
    return replyError(interaction, 'Bu üyeyi zaten hedef almıştın.', `Aynı üyeye sıradaki girişimin ${core.rel(hedefBekleme)} içinde olur.`);
  }

  const id = girisimNo();
  const sonAt = Date.now() + config.uye.pencere;
  store.girisimKaydet({ id, tip: 'uye', saldirgan: interaction.user.id, hedef: hedef.id, kanal: interaction.channelId, sonAt });

  await interaction.deferReply();
  const mesaj = await respond(
    interaction,
    ui.pusu({ saldirgan: interaction.user, hedef, girisimId: id, sonAt, risk: ui.riskHesabi(balance) }),
    { allowedMentions: { users: [interaction.user.id, hedef.id] } },
  );
  if (mesaj?.id) store.girisimMesajKaydet(id, mesaj.id);
  return mesaj;
}

// ── Kasayı soymak ─────────────────────────────────────────────────────────────
async function kasaSoy(interaction) {
  const kap = kapilar(interaction.user.id);
  if (!kap.ok) return replyError(interaction, kap.mesaj, kap.ipucu);

  if (kap.seviye < config.kasaMinSeviye) {
    return replyError(interaction, 'Kasa senin seviyene kapalı.', `Kasaya zorlama için seviye ${config.kasaMinSeviye} gerekir, ölçülen seviyen ${kap.seviye}.`);
  }
  const durum = kap.durum;
  if (durum.kasa < config.kasa.enAz) {
    return replyError(interaction, 'Kasa soyulacak kadar dolu değil.', `Kasada en az ${coin(config.kasa.enAz)} gerekir; ceza ve kefalet gelirleriyle dolar.`);
  }
  if (durum.kasaBekleme > Date.now()) {
    return replyError(interaction, 'Kasa yeni soyuldu.', `Sıradaki kasa girişimi ${core.rel(durum.kasaBekleme)} içinde olur.`);
  }

  const id = girisimNo();
  const sonAt = Date.now() + config.kasa.pencere;
  store.girisimKaydet({ id, tip: 'kasa', saldirgan: interaction.user.id, hedef: null, kanal: interaction.channelId, sonAt });

  await interaction.deferReply();
  const mesaj = await respond(
    interaction,
    ui.kasaPusu({ saldirgan: interaction.user, girisimId: id, sonAt, kasa: durum.kasa }),
    { allowedMentions: { users: [interaction.user.id] } },
  );
  if (mesaj?.id) store.girisimMesajKaydet(id, mesaj.id);
  return mesaj;
}

// ── Yakalanmak ────────────────────────────────────────────────────────────────
// Direnen kurban ya da müdahale eden üye başarılı olursa saldırgan cezasını öder ve hapis yatar. Cezasını
// karşılayamayacak kadar perişansa olduğunca alınır; borç yazılmaz.
function yakala(g, mudahiId, tur, at = Date.now()) {
  const ceza = kasayaYatir(g.saldirgan, config.ceza[tur]);
  store.hapisVer(g.saldirgan, config.hapis[tur], tur, at);
  store.yakalanmaKaydet(g.saldirgan, at);
  return ceza;
}

// Kurban direndi: kart yerinde sonuç kartına döner, kanal dolmaz
async function diren(interaction, id) {
  const g = store.girisim(id);
  if (!g || g.durum !== 'bekliyor') return replyError(interaction, 'Bu pusu zaten sonuçlandı.', '/sokak ile son girişimlere bakabilirsin.');
  if (interaction.user.id !== g.hedef) return replyError(interaction, 'Bu pusu seni ilgilendirmiyor.', 'Diren düğmesi yalnızca kurban içindir.');

  store.girisimKapat(id);
  store.direnisKaydet(g.hedef);

  const sans = yakalanmaSansi(seviyeOlcumu(g.hedef), seviyeOlcumu(g.saldirgan));
  const yakalandi = Math.random() < sans;
  const at = Date.now();
  const ceza = yakalandi ? yakala(g, g.hedef, 'uye', at) : 0;
  store.sicilEkle({
    tip: 'uye',
    saldirgan: g.saldirgan,
    saldirganAd: ad(interaction.client, g.saldirgan),
    hedef: g.hedef,
    hedefAd: ad(interaction.client, g.hedef),
    sonuc: yakalandi ? 'direnildi, saldırgan yakalandı' : 'direnildi, saldırgan kaçtı',
    miktar: 0,
    at,
  });

  const kart = ui.sonuc({
    title: yakalandi ? 'Direnç İşe Yaradı' : 'Soygun Boşa Gitti',
    sub: yakalandi
      ? `<@${g.hedef}> zamanında direndi; <@${g.saldirgan}> yakalandı ve cezasını kasaya yatırdı.`
      : `<@${g.hedef}> zamanında direndi; <@${g.saldirgan}> elini boş çekip sıyırdı.`,
    user: interaction.user,
    accent: 'success',
    pairs: [
      ['Saldırgan', `<@${g.saldirgan}>`],
      ['Kurban', `<@${g.hedef}>`],
      ['Yakalanma Şansı', `%${Math.round(sans * 100)}`],
      ...(yakalandi ? [['Ceza', coin(ceza)], ['Hapis', ui.sure(config.hapis.uye)]] : []),
    ],
    note: 'Direnç kurbanı dokunulmaz yapar; soyguncu bir süre daha aynı üyeyi hedef alamaz.',
  });

  return interaction.update({ components: [kart], allowedMentions: { users: [g.saldirgan, g.hedef] } });
}

// Kasa kartına ilk basan polis olur: yakalarsa ikramiye kasadan ona yatar
async function mudahale(interaction, id) {
  const g = store.girisim(id);
  if (!g || g.durum !== 'bekliyor') return replyError(interaction, 'Bu girişim zaten sonuçlandı.', '/sokak ile son kayıtlara bakabilirsin.');
  if (interaction.user.id === g.saldirgan) return replyError(interaction, 'Kendi pusuna müdahale edemezsin.', 'Kurban ya da tanık olman gerekir.');

  store.girisimKapat(id);

  const sans = yakalanmaSansi(seviyeOlcumu(interaction.user.id), seviyeOlcumu(g.saldirgan));
  const yakalandi = Math.random() < sans;
  const at = Date.now();
  const ceza = yakalandi ? yakala(g, interaction.user.id, 'kasa', at) : 0;

  // İkramiye kasadan çıkar ve kazanılan coin sayılır: günlük tavan doluysa yatmaz, kasa parasını korur
  let ikramiye = 0;
  if (yakalandi && store.kasa() >= config.kasa.ikramiye) {
    const odeme = coinStore.addWin(interaction.user.id, config.kasa.ikramiye, 'kasa ikramiyesi');
    if (odeme.odenen > 0) {
      store.kasaDus(odeme.odenen);
      store.ikramiyeKaydet(interaction.user.id, odeme.odenen);
      ikramiye = odeme.odenen;
    }
  }

  store.sicilEkle({
    tip: 'kasa',
    saldirgan: g.saldirgan,
    saldirganAd: ad(interaction.client, g.saldirgan),
    hedef: null,
    hedefAd: 'Devletin Kasası',
    sonuc: yakalandi ? 'müdahale edildi, saldırgan yakalandı' : 'müdahale edildi, saldırgan kaçtı',
    miktar: 0,
    at,
  });

  const kart = ui.sonuc({
    title: yakalandi ? 'Kasa Korundu' : 'Saldırgan Sıyırdı',
    sub: yakalandi
      ? `<@${interaction.user.id}> kasaya uzanan <@${g.saldirgan}> adlı üyeyi yakaladı; ceza kasaya yazıldı.`
      : `<@${interaction.user.id}> müdahale etti ama <@${g.saldirgan}> elini kolunu sallayarak sıyırdı.`,
    user: interaction.user,
    accent: yakalandi ? 'success' : 'warning',
    pairs: [
      ['Saldırgan', `<@${g.saldirgan}>`],
      ['Müdahale', `<@${interaction.user.id}>`],
      ['Yakalanma Şansı', `%${Math.round(sans * 100)}`],
      ...(yakalandi ? [['Ceza', coin(ceza)], ['Hapis', ui.sure(config.hapis.kasa)], ['İkramiye', coin(ikramiye)]] : []),
    ],
    note: ikramiye || !yakalandi ? undefined : 'Günlük oyun kazancı tavanın dolu olduğu için ikramiye cebine girmedi; kasa parasını korudu.',
  });

  return interaction.update({ components: [kart], allowedMentions: { users: [g.saldirgan, interaction.user.id] } });
}

// Kefalet: hapisten erken çıkışın bedeli kasaya yazar, hapis hanesi sıfırlanır
async function kefalet(interaction) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  const durum = store.durumOf(interaction.user.id);
  if (!durum.hapis) return replyError(interaction, 'İçeride değilsin.', '/sokak ile durumuna bakabilirsin.');

  const bedel = durum.kefalet;
  const balance = coinStore.balance(interaction.user.id);
  if (balance < bedel) {
    return replyError(interaction, 'Kefaleti karşılayacak coinin yok.', `Bedel ${coin(bedel)}; cüzdanında ${coin(balance)} coin var. Tahliye ${core.rel(durum.hapis)} içinde kendiliğinden gelir.`);
  }

  const odenen = kasayaYatir(interaction.user.id, bedel);
  const tur = durum.hapisTur ?? 'uye';
  store.hapisBitir(interaction.user.id);
  store.sicilEkle({
    tip: 'kefalet',
    saldirgan: interaction.user.id,
    saldirganAd: ad(interaction.client, interaction.user.id),
    hedef: null,
    hedefAd: 'Devletin Kasası',
    sonuc: 'kefalet ödeyip tahliye oldu',
    miktar: odenen,
    at: Date.now(),
  });

  return interaction.update({
    components: [ui.panel(durumOf(interaction.user.id, `**Kefalet ödendi:** ${coin(odenen)} kasaya yazıldı ve tahliye oldun.`))],
    allowedMentions: { parse: [] },
  });
}

// Üye adı kayıt defterine yazılır: kartlar zamanla eskiyebilir ama "kim kimi soymuş" kaydı sabit kalır.
// Önbellekte üye yoksa mention bırakılır, boşluk kalmaz.
const ad = (client, userId) => {
  const u = client?.users?.cache?.get(userId);
  return u ? (u.globalName ?? u.username) : `<@${userId}>`;
};

const kullanici = async (client, userId) =>
  (await client.users.fetch(userId).catch(() => null)) ?? client.users.cache.get(userId) ?? { id: userId };

// ── Bekçi ─────────────────────────────────────────────────────────────────────
// Süresi dolmuş, hiç dokunulmamış girişimler burada sonuçlanır. Üye direnmezse soygun olur, kasa müdahalesizse
// dağılır; her ikisi de toplum kayıt defterine ve kanalda herkese açık karta yazılır.
async function bildir(client, g, kart, kullaniciIdler) {
  const kanal = await client.channels.fetch(g.kanal).catch(() => null);
  if (!kanal || kanal.type !== ChannelType.GuildText) return null;
  const payload = { components: [kart], flags: core.CV2, allowedMentions: { users: kullaniciIdler } };
  // Kart zaten kanalda duruyor: yeni mesaj atmak yerine yerinde sonuç kartına döner
  if (g.mesaj) {
    const guncel = await kanal.messages.edit(g.mesaj, payload).catch(() => null);
    if (guncel) return guncel;
  }
  return kanal.send(payload).catch(() => null);
}

async function uyePusunuSonucLandir(client, g, at) {
  const balance = coinStore.balance(g.hedef);
  const oran = config.uye.oran.min + Math.random() * (config.uye.oran.max - config.uye.oran.min);
  const istenen = yuvarla(Math.min(config.uye.tavan, Math.round(balance * oran)));
  const oldu = istenen > 0 && coinStore.transfer(g.hedef, g.saldirgan, istenen, 'soygun');

  if (oldu) {
    store.basariKaydet(g.saldirgan, istenen);
    store.kayipKaydet(g.hedef, istenen, at);
  }
  store.sicilEkle({
    tip: 'uye',
    saldirgan: g.saldirgan,
    saldirganAd: ad(client, g.saldirgan),
    hedef: g.hedef,
    hedefAd: ad(client, g.hedef),
    sonuc: oldu ? 'direnç olmadı, coin el değiştirdi' : 'direnç olmadı ama cüzdan boşalmıştı',
    miktar: oldu ? istenen : 0,
    at,
  });

  const kart = ui.sonuc({
    title: oldu ? 'Soygun Gerçekleşti' : 'Pusu Boşa Çıktı',
    sub: oldu
      ? `<@${g.saldirgan}> direnen olmayınca <@${g.hedef}> adlı üyenin cüzdanından ${coin(istenen)} aldı.`
      : `<@${g.hedef}> direnmedi ama <@${g.saldirgan}> boş cüzdan buldu; kimse bir şey kaybetmedi.`,
    user: await kullanici(client, oldu ? g.saldirgan : g.hedef),
    accent: oldu ? 'danger' : 'warning',
    pairs: [
      ['Saldırgan', `<@${g.saldirgan}>`],
      ['Kurban', `<@${g.hedef}>`],
      ['El Değiştiren', coin(istenen)],
      ['Kurban Bakiyesi', coin(coinStore.balance(g.hedef))],
    ],
    note: 'Kurban artık dokunulmaz; bir süre daha aynı üyeyi hedef alamazsın.',
  });
  return bildir(client, g, kart, [g.saldirgan, g.hedef]);
}

async function kasaPusunuSonucLandir(client, g, at) {
  const kasa = store.kasa();
  const oran = config.kasa.oran.min + Math.random() * (config.kasa.oran.max - config.kasa.oran.min);
  const istenen = yuvarla(Math.min(config.kasa.tavan, kasa * oran));
  // Kasa ödülü günlük oyun tavanına sayılır: tavan dolmuşsa para kasada kalır, sistem havadan coin dağıtmaz
  const odeme = coinStore.addWin(g.saldirgan, istenen, 'kasa soygunu', at);
  const alinan = odeme.odenen;
  if (alinan > 0) store.kasaDus(alinan);
  store.kasaSoyuldu(at);
  if (alinan > 0) store.basariKaydet(g.saldirgan, alinan);
  store.sicilEkle({
    tip: 'kasa',
    saldirgan: g.saldirgan,
    saldirganAd: ad(client, g.saldirgan),
    hedef: null,
    hedefAd: 'Devletin Kasası',
    sonuc: alinan > 0 ? 'müdahale olmadı, kasa dağıldı' : 'müdahale olmadı ama ödeme yapılamadı',
    miktar: alinan,
    at,
  });

  const kart = ui.sonuc({
    title: alinan > 0 ? 'Kasa Soiuldu' : 'Kasa Elmada Kaldı',
    sub: alinan > 0
      ? `<@${g.saldirgan}> kimse müdahale edmeyince Devletin Kasasından ${coin(alinan)} aldı.`
      : `<@${g.saldirgan}> kasaya ulaştı ama ödenecek bir şey kalmadı; para kasada duruyor.`,
    user: await kullanici(client, g.saldirgan),
    accent: alinan > 0 ? 'danger' : 'warning',
    pairs: [
      ['Saldırgan', `<@${g.saldirgan}>`],
      ['Kasadan Çıkan', coin(alinan)],
      ['Kalan Kasa', coin(store.kasa())],
      ['Kesinti', coin(odeme.kesilen)],
    ],
    note: 'Kasa soyulan coin cezalarla birikmiş paraydı; sistem yeni coin üretmedi.',
  });
  return bildir(client, g, kart, [g.saldirgan]);
}

const kullanici = async (client, userId) => (await client.users.fetch(userId).catch(() => null)) ?? client.users.cache.get(userId) ?? { id: userId };

async function tara(client) {
  const at = Date.now();
  for (const g of store.bekleyenler(at)) {
    store.girisimKapat(g.id);
    if (g.tip === 'kasa') await kasaPusunuSonucLandir(client, g, at);
    else await uyePusunuSonucLandir(client, g, at);
  }
  store.girisimTemizle(at);
}

// ── Etkileşim kapısı ──────────────────────────────────────────────────────────
// Diren ve Müdahale düğmeleri pusuyu atanın mesajında durur, yani sayfa sahibiyle ilgisi yoktur: kapı burada
// isMenuOwner değil, kayıttaki taraflardır. Kefalet ise kişinin kendi sayfasındaki düğmedir.
async function handle(interaction) {
  if (!interaction.guild) return replyError(interaction, 'Sokaklar sunucuda çalışır.', 'Komutu bir sunucu içinde tekrar dene.');

  const [adim, ...kuyruk] = interaction.customId.slice(ui.IDS.prefix.length + 1).split(':');
  switch (adim) {
    case 'diren':
      return diren(interaction, kuyruk[0]);
    case 'mudahale':
      return mudahale(interaction, kuyruk[0]);
    case 'kefalet':
      return kefalet(interaction);
    default:
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/sokak ile sayfayı yeniden aç.');
  }
}

async function handleSokak(interaction) {
  await interaction.deferReply();
  return respond(interaction, panelFor(interaction));
}

async function handleCal(interaction) {
  const alt = interaction.options.getSubcommand();
  if (alt === 'kasa') return kasaSoy(interaction);
  return uyeSoy(interaction);
}

module.exports = {
  name: 'hirsizlik',
  commands,
  help: {
    category: ['oyun', 'Oyun ve Şans'],
    member: ['sokak', 'çal'],
    access: { sokak: 'Herkes', 'çal uye': 'Herkes', 'çal kasa': 'Herkes' },
  },
  slash: { sokak: handleSokak, 'çal': handleCal },
  prefixed: [[ui.IDS.prefix, handle]],
  panelFor,
  durumOf,
  hapista: (userId, at = Date.now()) => store.hapista(userId, at),
  events: {
    [Events.ClientReady]: (client) => {
      tara(client);
      setInterval(() => tara(client), config.bekciAralik).unref();
    },
  },
};
