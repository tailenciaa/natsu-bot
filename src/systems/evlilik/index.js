// Evlilik: /evlilik ile teklif götürülen, butonla kabul edilen iki kişilik bağ.
// Ekonomi düzeni: sistemin tek girişi Butikte satılan yüzüktür ve yüzük kabul anında yakılır (coin sistemden çıkar).
// Boşanma bedeli de üyenin cebinden çıkıp Devletin Kasasına yazar — burada coin üretilmez, para el değiştirir.
// Yıl dönümü ödülü tek coin girişidir ve çiftin birlikte geçirdiği her yedi günde bir, iki tarafa birden ödenir.
// Zamanlama kuralı: teklif kartı kanalda bekler; muhatap config'in verdiği pencerede düğmeye basmazsa bekçi
// kartı yerinde kapatır. Bekçi bot açılırken bir kez, sonra sabit aralıkla çalışır.
// Rol düzeni: çiftin rolünü bot kabul anında yaratır; ad, renk ve simge teklifi götüren üye tarafından seçilir,
// muhatap kabul ederken kartta neyi kabul ettiğini görür. Rol boşanmada silinir. Yaratılamazsa evlilik yine
// kaydedilir ve gerekçe evlilik kartına yazılır.
const { Events, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, isMenuOwner, menuOwnerError, stillMember } = require('../../core/helpers');
const { coin } = require('../coin/ui');
const coinStore = require('../coin/store');
const butik = require('../butik/store');
const butikConfig = require('../butik/config');
const hirsizlik = require('../hirsizlik/store');
const { levelFromXp } = require('../seviye/level');
const seviyeStore = require('../seviye/store');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const DAY = 24 * 60 * 60 * 1000;

const commands = [
  new SlashCommandBuilder()
    .setName('evlilik')
    .setDescription('Evliliğini yürüt: yüzükle teklif götür, kendi hâline bak, çiftleri gör ya da boşan.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s.setName('durum').setDescription('Kendi evlilik hâlini, bekleyen tekliflerini ve yıl dönümü ödülünü açar.'),
    )
    .addSubcommand((s) =>
      s
        .setName('teklif')
        .setDescription('Bir üyeye yüzükle evlilik teklifi götürürsün; kart kanala düşer.')
        .addUserOption((o) => o.setName('kullanici').setDescription('Teklif götüreceğin üye.').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('rol_adi')
            .setDescription('Çift rolünüzün adı. Boş bırakırsan ikinizin adı yan yana yazılır.')
            .setMaxLength(32),
        )
        .addStringOption((o) =>
          o
            .setName('renk')
            .setDescription('Çift rolünüzün rengi. Boş bırakırsan ilk renk verilir.')
            .addChoices(...config.rol.renkler.map((r) => ({ name: r.ad, value: r.key }))),
        )
        .addStringOption((o) =>
          o.setName('simge').setDescription('Rol adının başına konan emoji. Boş bırakırsan yüzük konur.'),
        ),
    )
    .addSubcommand((s) => s.setName('liste').setDescription('Sunucudaki evli çiftleri ve birlikte geçirdikleri günü listeler.'))
    .addSubcommand((s) => s.setName('bosan').setDescription('Eşinden boşanırsın; bedel Devletin Kasasına yazar.')),
];

// Teklif numarası custom_id'de taşınır; kart sonuçlanınca kayıt da kalkar
const teklifNo = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;

// Ölçülen seviye suç dünyasıyla aynı: mesaj ya ses, büyük olanı
const seviyeOlcumu = (userId) =>
  Math.max(levelFromXp(seviyeStore.xpOf('mesaj', userId)), levelFromXp(seviyeStore.xpOf('ses', userId)));

// Sayfanın okuduğu bütün durum. Dışa açılır ki önizleme ile düğmeler aynı kapıdan geçsin.
function durumOf(userId, user, at = Date.now()) {
  const evlilik = store.evlilikOf(userId);
  const bosanma = store.bosanmaAni(userId);
  return {
    user,
    at,
    balance: coinStore.balance(userId),
    yuzuk: butik.yuzukSay(userId),
    seviye: seviyeOlcumu(userId),
    hapista: hirsizlik.hapista(userId, at) || 0,
    bosanmaBekleme: bosanma ? bosanma + config.bosanma.bekleme : 0,
    evlilik: evlilik
      ? { es: evlilik.es, at: evlilik.at, gun: store.birlikteGun(userId, at), bonus: store.bonusDurumu(userId, at) }
      : null,
    giden: store.teklifGiden(userId),
    gelen: store.teklifGelen(userId),
    ciftler: [],
  };
}

const durumPaneli = (interaction, feedback) => ui.durumPaneli({ ...durumOf(interaction.user.id, interaction.user), feedback });

// Çiftler listesi: sunucudan ayrılanların satırı gösterilmez, yoksa tablo boş isimlerle dolar
function listePaneli(interaction, at = Date.now()) {
  const guild = interaction.guild;
  const ciftler = store.ciftler().filter((c) => !guild || (stillMember(guild, c.a) && stillMember(guild, c.b)));
  return ui.listePaneli({ user: interaction.user, at, ciftler });
}

// Sayfanın iki yolu var: düğme sayfayı yerinde yeniler, komut ertelenmiş cevabı düzenler.
async function sayfayiGoster(interaction, feedback) {
  const payload = { components: [durumPaneli(interaction, feedback)], allowedMentions: { parse: [] } };
  return interaction.isMessageComponent() ? interaction.update(payload) : interaction.editReply(payload);
}

// ── Kapılar ───────────────────────────────────────────────────────────────────
// Sıra önemli: önce mevcut evlilik, sonra cezaevi ve seviye, en son yüzük ile bekleyen teklif.
function teklifKapisi(userId, at = Date.now()) {
  if (store.evliMi(userId)) {
    return { ok: false, mesaj: 'Zaten evlisin.', ipucu: 'Yeni teklif götüremezsin; /evlilik durum ile kendi hâline bakabilirsin.' };
  }
  const hapis = hirsizlik.hapista(userId, at);
  if (hapis) {
    return { ok: false, mesaj: 'İçerideyken teklif götürülmez.', ipucu: `Tahliyen ${core.rel(hapis)} içinde; sonra /evlilik teklif yaz.` };
  }
  const seviye = seviyeOlcumu(userId);
  if (seviye < config.teklif.minSeviye) {
    return { ok: false, mesaj: 'Teklif için seviyen düşük.', ipucu: `Teklif götürmek için seviye ${config.teklif.minSeviye} gerekir, senin seviyen ${seviye}.` };
  }
  if (store.teklifGiden(userId)) {
    return { ok: false, mesaj: 'Bekleyen bir teklifin zaten var.', ipucu: '/evlilik durum sayfasından vazgeçebilir ya da yanıtı bekleyebilirsin.' };
  }
  const bosanma = store.bosanmaAni(userId);
  if (bosanma && bosanma + config.bosanma.bekleme > at) {
    return { ok: false, mesaj: 'Boşandıktan sonra kısa bir süre teklif götüremezsin.', ipucu: `Sıradaki teklif ${core.rel(bosanma + config.bosanma.bekleme)} içinde açılır.` };
  }
  if (!butik.yuzukSay(userId)) {
    return {
      ok: false,
      mesaj: 'Cüzdanında yüzük yok.',
      ipucu: `Evliliğin tek şartı yüzük: ${coin(butikConfig.yuzuk.price)}. Almak için /bakiye > Butik.`,
    };
  }
  return { ok: true, seviye };
}

// ── Teklif ────────────────────────────────────────────────────────────────────
async function teklifEt(interaction) {
  const kap = teklifKapisi(interaction.user.id);
  if (!kap.ok) return replyError(interaction, kap.mesaj, kap.ipucu);

  const hedef = interaction.options.getUser('kullanici');
  if (!hedef) return replyError(interaction, 'Hedef bir üye değil.', '/evlilik teklif kullanici:... ile sunucudan bir üye seç.');
  if (hedef.bot) return replyError(interaction, 'Botlarla evlenilmez.', 'Bir üye seç.');
  if (hedef.id === interaction.user.id) return replyError(interaction, 'Kendine teklif götüremezsin.', 'Bir başkasını seç.');
  if (store.evliMi(hedef.id)) return replyError(interaction, 'Bu üye zaten evli.', 'Sunucudaki çiftleri /evlilik liste ile görebilirsin.');
  if (store.teklifGelen(hedef.id)) {
    return replyError(interaction, 'Bu üye zaten bir teklifin yanıtını bekliyor.', 'Yanıtı yalnızca o üye verir; kartı kanalda duruyor.');
  }
  const ret = store.retAni(interaction.user.id, hedef.id);
  if (ret && ret + config.teklif.retBekleme > Date.now()) {
    return replyError(interaction, 'Bu üyeye kısa süre önce teklif götürmüştün.', `Yeni teklif ${core.rel(ret + config.teklif.retBekleme)} içinde açılır.`);
  }

  const hedefUye = await interaction.guild.members.fetch(hedef.id).catch(() => null);
  if (!hedefUye) return replyError(interaction, 'Bu üye sunucuda değil.', 'Sunucudan bir üye seç.');

  const no = teklifNo();
  const sonAt = Date.now() + config.teklif.pencere;
  store.teklifKaydet({ oneren: interaction.user.id, hedef: hedef.id, no, sonAt, kanal: interaction.channelId });

  await interaction.deferReply();
  const mesaj = await respond(
    interaction,
    ui.teklif({ oneren: interaction.user, hedef, no, sonAt }),
    { allowedMentions: { users: [interaction.user.id, hedef.id] } },
  );
  if (mesaj?.id) store.teklifMesaj(no, mesaj.id);
  return mesaj;
}

// ── Çift rolü ─────────────────────────────────────────────────────────────────
// Rol config'de yazılı değilse hiç dokunulmaz. Rol verilemezse evlilik yine kaydedilir: rol görünür bir ekcedir,
// bağın kendisi değil. Bot rol yaratmaz, ID Discord'da hazır rolünki olmalıdır.
async function rolVer(guild, userId, aciklama) {
  if (!config.roles.evli || !guild) return false;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return member.roles.add(config.roles.evli, aciklama).then(
    () => true,
    (err) => {
      console.error('[evlilik] Evli rolü verilemedi:', err.message);
      return false;
    },
  );
}

async function rolAl(guild, userId) {
  if (!config.roles.evli || !guild) return false;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  return member.roles.remove(config.roles.evli, 'Evlilik sona erdi').then(
    () => true,
    (err) => {
      console.error('[evlilik] Evli rolü geri alınamadı:', err.message);
      return false;
    },
  );
}

// ── Teklifin yanıtlanması ──────────────────────────────────────────────────────
// Kabul ve Ret yalnızca muhatabın düğmeleridir; kart yerinde sonuç kartına döner ki kanal dolmasın.
async function kabul(interaction, no) {
  const t = store.teklifByNo(no);
  if (!t) return replyError(interaction, 'Bu teklif zaten sonuçlanmış.', '/evlilik durum ile kendi hâline bakabilirsin.');
  if (t.sonAt <= Date.now()) {
    store.teklifSil(t.oneren);
    return interaction.update({
      components: [ui.sureKarti({ oneren: t.oneren, hedef: t.hedef })],
      allowedMentions: { users: [t.oneren, t.hedef] },
    });
  }
  if (interaction.user.id !== t.hedef) {
    return replyError(interaction, 'Bu teklif sana uzanmadı.', 'Kabul düğmesi yalnızca muhatabın içindir.');
  }
  if (store.evliMi(t.hedef) || store.evliMi(t.oneren)) {
    store.teklifSil(t.oneren);
    return replyError(interaction, 'Taraflardan biri zaten evli.', 'Evlilik kaydı açılmadı, yüzüğün cebinde duruyor.');
  }

  // Yüzük burada yakılır: kabul olmadan ödeme olmaz, reddedilen ya da süresi dolan teklif yüzük kaybettirmez
  if (!butik.yuzukYak(t.oneren)) {
    store.teklifSil(t.oneren);
    return interaction.update({
      components: [ui.gecersizKarti({ oneren: t.oneren, hedef: t.hedef, user: interaction.user })],
      allowedMentions: { users: [t.oneren, t.hedef] },
    });
  }

  const at = Date.now();
  store.evlendir(t.oneren, t.hedef, at);
  await rolVer(interaction.guild, t.oneren, 'Evlilik');
  await rolVer(interaction.guild, t.hedef, 'Evlilik');

  return interaction.update({
    components: [ui.evlilikKarti({ oneren: t.oneren, hedef: t.hedef, user: interaction.user, roleId: config.roles.evli, at })],
    allowedMentions: { users: [t.oneren, t.hedef] },
  });
}

async function ret(interaction, no) {
  const t = store.teklifByNo(no);
  if (!t) return replyError(interaction, 'Bu teklif zaten sonuçlanmış.', '/evlilik durum ile kendi hâline bakabilirsin.');
  if (interaction.user.id !== t.hedef) {
    return replyError(interaction, 'Bu teklif sana uzanmadı.', 'Yanıtı yalnızca muhatap verir.');
  }
  store.teklifSil(t.oneren);
  store.retKaydet(t.oneren, t.hedef);
  return interaction.update({
    components: [ui.retKarti({ oneren: t.oneren, hedef: t.hedef, user: interaction.user })],
    allowedMentions: { users: [t.oneren, t.hedef] },
  });
}

// Tekliften vazgeçme kişinin kendi sayfasından yapılır; kanalda duran kart da yerinde kapatılır
async function iptal(interaction, no) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  const t = store.teklifByNo(no);
  if (!t) return sayfayiGoster(interaction, 'Bekleyen teklifin zaten sonuçlanmıştı.');
  if (t.oneren !== interaction.user.id) {
    return replyError(interaction, 'Bu teklif senin değil.', 'Kendi sayfan için /evlilik durum yaz.');
  }

  store.teklifSil(t.oneren);
  const kanal = await interaction.guild?.channels.fetch(t.kanal).catch(() => null);
  if (t.mesaj && kanal?.isTextBased?.()) {
    await kanal.messages
      .edit(t.mesaj, {
        components: [ui.iptalKarti({ oneren: t.oneren, hedef: t.hedef })],
        flags: core.CV2,
        allowedMentions: { parse: [] },
      })
      .catch(() => null);
  }
  return sayfayiGoster(interaction, `Teklifin geri çekildi; ${ui.mention(t.hedef)} artık beklemiyor ve yüzüğün cebinde duruyor.`);
}

// ── Yıl dönümü ────────────────────────────────────────────────────────────────
// Düğmeye kim basarsa bassın ödeme iki tarafa birden yatar: çiftin ödülü ortak olsun.
async function yilDonumu(interaction) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  const evlilik = store.evlilikOf(interaction.user.id);
  if (!evlilik) return replyError(interaction, 'Evli değilsin.', '/evlilik teklif ile yüzükle uzanabileceğin birini seç.');
  const bonus = store.bonusDurumu(interaction.user.id);
  if (!bonus?.hazir) {
    return replyError(interaction, 'Sıradaki yıl dönümü henüz gelmedi.', `Ödül ${core.rel(bonus.sonrakiAt)} içinde açılır.`);
  }

  coinStore.add(evlilik.es, config.yilDonumu.odul, 'evlilik yıl dönümü');
  coinStore.add(interaction.user.id, config.yilDonumu.odul, 'evlilik yıl dönümü');
  const sonrasi = store.bonusAl(interaction.user.id);

  await sayfayiGoster(interaction);
  return respond(
    interaction,
    ui.yilDonumuKarti({
      a: interaction.user.id,
      b: evlilik.es,
      odul: config.yilDonumu.odul,
      sayi: sonrasi?.sayi ?? 1,
      sonrakiAt: sonrasi?.sonrakiAt ?? Date.now() + config.yilDonumu.gun * DAY,
      user: interaction.user,
    }),
    { followUp: true, allowedMentions: { users: [interaction.user.id, evlilik.es] } },
  );
}

// ── Boşanma ───────────────────────────────────────────────────────────────────
// Bedeli ödeyen taraf başlar; bekleme iki tarafa da yazılır ki evlilik dönülüp dönülüp toplandığı bir oyun olmasın.
// Komutun içinden de düğmesinden de aynı yola yürür: slash tarafı cevap ertelenmiş gelir, mesaj yerinde yenilenir.
async function bosan(interaction) {
  const evlilik = store.evlilikOf(interaction.user.id);
  if (!evlilik) return replyError(interaction, 'Evli değilsin.', '/evlilik durum ile kendi hâline bakabilirsin.');
  const bedel = config.bosanma.price;
  const balance = coinStore.balance(interaction.user.id);
  if (balance < bedel) {
    return replyError(interaction, 'Boşanma bedeli cüzdanına sığmıyor.', `Bedel ${coin(bedel)}, cebinde ${coin(balance)} var. Evliliğin yerinde duruyor.`);
  }

  coinStore.spend(interaction.user.id, bedel);
  hirsizlik.kasaEkle(bedel);
  const at = Date.now();
  const es = evlilik.es;
  store.bosan(interaction.user.id, es, at);
  await rolAl(interaction.guild, interaction.user.id);
  await rolAl(interaction.guild, es);

  await sayfayiGoster(
    interaction,
    `Boşandın: ${coin(bedel)} kasaya yazıldı, yeni teklif ${core.rel(at + config.bosanma.bekleme)} içinde açılır.`,
  );
  return respond(interaction, ui.bosanmaKarti({ a: interaction.user.id, b: es, user: interaction.user, bedel, at }), {
    followUp: true,
    allowedMentions: { users: [interaction.user.id, es] },
  });
}

// Boşanma düğmesi kişinin kendi sayfasında durur; başkasının sayfasında alım yapılamaz.
async function bosanDugmesi(interaction) {
  if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
  return bosan(interaction);
}

// ── Bekçi ─────────────────────────────────────────────────────────────────────
// Karşılık görmeden süresi dolan teklifler burada kapanır; kart kanalda duruyorsa yerinde sonuç kartına döner.
async function tara(client) {
  const at = Date.now();
  for (const t of store.bekleyenler(at)) {
    store.teklifSil(t.oneren);
    if (!t.mesaj || !t.kanal) continue;
    const kanal = await client.channels.fetch(t.kanal).catch(() => null);
    if (!kanal?.isTextBased?.()) continue;
    await kanal.messages
      .edit(t.mesaj, {
        components: [ui.sureKarti({ oneren: t.oneren, hedef: t.hedef, user: client.users.cache.get(t.oneren) })],
        flags: core.CV2,
        allowedMentions: { users: [t.oneren, t.hedef] },
      })
      .catch(() => null);
  }
}

// İlk tarama açılışta bekletilir ki zamanlayıcı kurulmadan önce kapanacak kartlar bitsin ve bir hata olursa
// olay dağıtıcısının yakalama kapısına düşsün (src/index.js).
async function handleReady(client) {
  if (!client.guilds.cache.get(guildId)) return;
  await tara(client);
  setInterval(() => tara(client), config.bekciAralik).unref();
}

// ── Etkileşim kapısı ──────────────────────────────────────────────────────────
// Kabul ve Ret pusulası teklifi götürenin kartında durur, yani sayfa sahibiyle ilgisi yoktur: isMenuOwner bu iki
// düğmeye işlemez, kapı kayıttaki taraflardır.
async function handle(interaction) {
  if (!interaction.guild) return replyError(interaction, 'Evlilik sunucuda yürür.', 'Düğmeyi bir sunucu içinde tekrar dene.');

  const [adim, ...kuyruk] = interaction.customId.slice(ui.IDS.prefix.length + 1).split(':');
  switch (adim) {
    case 'durum': {
      if (!isMenuOwner(interaction)) return menuOwnerError(interaction);
      return interaction.update({ components: [durumPaneli(interaction)], allowedMentions: { parse: [] } });
    }
    case 'list':
      return interaction.update({ components: [listePaneli(interaction)], allowedMentions: { parse: [] } });
    case 'kabul':
      return kabul(interaction, kuyruk[0]);
    case 'ret':
      return ret(interaction, kuyruk[0]);
    case 'iptal':
      return iptal(interaction, kuyruk[0]);
    case 'bonus':
      return yilDonumu(interaction);
    case 'bosan':
      return bosanDugmesi(interaction);
    default:
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/evlilik ile sayfayı yeniden aç.');
  }
}

// ── Komutlar ──────────────────────────────────────────────────────────────────
async function handleDurum(interaction) {
  await interaction.deferReply();
  return respond(interaction, durumPaneli(interaction));
}

async function handleListe(interaction) {
  await interaction.deferReply();
  return respond(interaction, listePaneli(interaction));
}

async function handleBosan(interaction) {
  await interaction.deferReply();
  return bosan(interaction);
}

async function handleEvlilik(interaction) {
  const alt = interaction.options.getSubcommand();
  if (alt === 'teklif') return teklifEt(interaction);
  if (alt === 'liste') return handleListe(interaction);
  if (alt === 'bosan') return handleBosan(interaction);
  return handleDurum(interaction);
}

module.exports = {
  name: 'evlilik',
  commands,
  help: {
    category: ['oyun', 'Oyun ve Şans'],
    member: ['evlilik durum', 'evlilik teklif', 'evlilik liste', 'evlilik bosan'],
    access: { 'evlilik durum': 'Herkes', 'evlilik teklif': 'Herkes', 'evlilik liste': 'Herkes', 'evlilik bosan': 'Herkes' },
  },
  slash: { evlilik: handleEvlilik },
  prefixed: [[ui.IDS.prefix, handle]],
  events: {
    [Events.ClientReady]: handleReady,
    // Üye düşüp dönerse evli rolü de kaybolur: dönüşte bot satın alınan bağı yeniden giydirir
    [Events.GuildMemberAdd]: (member) =>
      member.guild.id === guildId && !member.user.bot && store.evliMi(member.id) ? rolVer(member.guild, member.id, 'Evlilik rolü geri verildi') : null,
  },
  durumPaneli,
  durumOf,
  listePaneli,
  esOf: store.esOf,
};
