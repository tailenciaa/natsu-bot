// Eğlence katmanı: /öp ve /tokat ile atılan şaka kartları, muhatabın bastığı karşılık düğmesi ve iki tarafa birden
// yatan ödül. Kart iki kişiyi ilgilendiren topluma açık bir kayıt olduğu için kanalda kalıcıdır; sonuç ayrı mesaj
// değildir, kart yerinde sonuç kartına döner.
// Ekonomi düzeni: karşılık ödülü coinStore.addWin ile ödenir, yani günlük oyun kazancı tavanına (coin winCap)
// sayılır. Tavan dolmuşsa ödeme cebine girmez ama kart yine de sonuçlanır; üye neden alamadığını kartta okur.
// Ritim düzeni: aynı ikili arasında ikiliAralik boyunca yeni kart açılamaz, kişi günde gunlukKart kart atabilir.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError } = require('../../core/helpers');
const coinStore = require('../coin/store');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName(config.sayfaKomut)
    .setDescription(config.sayfaAciklama)
    .setContexts(InteractionContextType.Guild),
  ...Object.entries(config.eylemler).map(([, e]) =>
    new SlashCommandBuilder()
      .setName(e.komut)
      .setDescription(e.aciklama)
      .setContexts(InteractionContextType.Guild)
      .addUserOption((o) => o.setName('kullanici').setDescription('Şakanın muhatabı olan üye.').setRequired(true)),
  ),
];

// Ödüller 5'in katına yuvarlanır: kartta okunur dursun (keşif ve görevle aynı teamül)
const yuvarla = (n) => Math.round(n / 5) * 5;
const odulCek = ([alt, ust]) => yuvarla(alt + Math.random() * (ust - alt));

// Kart numarası kısa tutulur: custom_id içinde taşınır ve kart sonuçlandığında kayıttan kalkar
const kartNo = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;

// Sayfanın okuduğu bütün durum: üyenin sayıları + sana uzanan açık kartlar (en acil üstte).
// Dışa açılır ki önizleme ve cüzdan düğmesi aynı kapıdan geçsin.
function sayfaDurumu(userId, user, at = Date.now()) {
  return {
    ...store.durumOf(userId, at),
    at,
    user,
    kartlar: store.acikKartlar(userId).slice(0, config.sayfaKart),
  };
}

const panelFor = (interaction) => ui.panel(sayfaDurumu(interaction.user.id, interaction.user));

// ── Şaka atmak ────────────────────────────────────────────────────────────────
async function eylem(interaction, anahtar) {
  const e = config.eylemler[anahtar];
  if (!interaction.guild) return replyError(interaction, 'Şakalar sunucuda atılır.', 'Komutu bir sunucu içinde tekrar dene.');

  const hedef = interaction.options.getMember('kullanici')?.user ?? null;
  if (!hedef) return replyError(interaction, 'Seçtiğin üye bu sunucuda değil.', `/${e.komut} kullanici:... ile sunucudan bir üye seç.`);
  if (hedef.bot) return replyError(interaction, 'Botlar şaka hedefi olmaz.', 'Bir üye seç.');
  if (hedef.id === interaction.user.id) return replyError(interaction, 'Kendine şaka atamazsın.', 'Karşılık düğmesi başkasının kartındır; bir üye seç.');

  const durum = store.durumOf(interaction.user.id);
  if (durum.kalan <= 0) {
    return replyError(interaction, 'Bugünkü şaka kartların doldu.', `Günde ${config.gunlukKart} kart atabilirsin; gece sıfırlanır. Kumarhane ve sokaklar açık.`);
  }
  const bekleme = store.ikiliBekleme(interaction.user.id, hedef.id);
  if (bekleme) {
    return replyError(interaction, 'Bu üyeyle az önce şakalaştın.', `Aynı ikili arasında ${core.rel(bekleme)} içinde yeni kart açılabilir.`);
  }

  const no = kartNo();
  const sonAt = Date.now() + config.pencere;
  store.kartKaydet({ no, eylem: anahtar, saldirgan: interaction.user.id, hedef: hedef.id, sonAt });
  store.kartTemizle();

  return respond(
    interaction,
    ui.kart({ eylem: anahtar, saldirgan: interaction.user, hedef, girisimNo: no, sonAt }),
    { allowedMentions: { users: [interaction.user.id, hedef.id] } },
  );
}

// ── Karşılık vermek ───────────────────────────────────────────────────────────
// Düğme kartı atanın mesajında durur ama muhatabın hakkıdır: kapı sayfa sahibi değil, kayıttaki taraflardır.
async function karsilik(interaction, no) {
  if (!interaction.guild) return replyError(interaction, 'Şakalar sunucuda atılır.', 'Komutu bir sunucu içinde tekrar dene.');

  const g = store.kart(no);
  if (!g) return replyError(interaction, 'Bu kart artık açık değil.', '/öp ya da /tokat ile yeni bir kart atabilirsin.');
  if (interaction.user.id !== g.hedef) return replyError(interaction, 'Bu düğme yalnızca muhatabın içindir.', 'Karşılık kartı atan kişi değil, muhatap verir.');

  const saldirgan = { id: g.saldirgan };
  const hedef = interaction.user;
  const at = Date.now();

  // Süre doldu: kart ödül vermeden kapanır ve düğme yerinde kalkar
  if (g.sonAt <= at) {
    store.karsizSonuclandir(g);
    return interaction.update({
      components: [ui.karsizSonuc({ eylem: g.eylem, saldirgan, hedef, user: hedef, at })],
      allowedMentions: { users: [g.saldirgan, g.hedef] },
    });
  }

  // İki taraf da kazanır: ödeme günlük tavana sayılır, tavan doluysa o tarafın payı kesilir
  const kazancSaldirgan = coinStore.addWin(g.saldirgan, odulCek(config.eylemler[g.eylem].odul), 'eğlence karşılığı', at);
  const kazancHedef = coinStore.addWin(g.hedef, odulCek(config.eylemler[g.eylem].odul), 'eğlence karşılığı', at);
  store.karsilikSonuclandir(g, kazancSaldirgan.odenen, kazancHedef.odenen);

  return interaction.update({
    components: [
      ui.karsilikSonuc({
        eylem: g.eylem,
        saldirgan,
        hedef,
        odenenSaldirgan: kazancSaldirgan.odenen,
        odenenHedef: kazancHedef.odenen,
        kesinti: kazancSaldirgan.kesilen > 0 || kazancHedef.kesilen > 0,
        user: hedef,
        at,
      }),
    ],
    allowedMentions: { users: [g.saldirgan, g.hedef] },
  });
}

// ── Etkileşim kapısı ──────────────────────────────────────────────────────────
async function handle(interaction) {
  const [adim, ...kuyruk] = interaction.customId.slice(ui.IDS.prefix.length + 1).split(':');
  switch (adim) {
    case 'karsilik':
      return karsilik(interaction, kuyruk[0]);
    default:
      return replyError(interaction, 'Bu düğme artık kullanılamıyor.', '/öp ya da /tokat ile yeni bir kart atabilirsin.');
  }
}

module.exports = {
  name: 'eglence',
  commands,
  help: {
    category: ['oyun', 'Oyun ve Şans'],
    member: Object.values(config.eylemler).map((e) => e.komut),
    access: Object.fromEntries(Object.values(config.eylemler).map((e) => [e.komut, 'Herkes'])),
  },
  slash: Object.fromEntries(Object.entries(config.eylemler).map(([anahtar, e]) => [e.komut, (interaction) => eylem(interaction, anahtar)])),
  prefixed: [[ui.IDS.prefix, handle]],
  durumOf: (userId, at = Date.now()) => store.durumOf(userId, at),
};
