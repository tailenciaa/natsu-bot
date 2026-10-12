// Eğlence mesajları: /öp ve /tokat ile atılan karşılık kartı, karşılık geldiğinde ya da süre dolduğunda kartın
// yerini alan sonuç kartı. Şaka kartı komutla açılan ve iki kişiyi ilgilendiren bir KAYIT olduğu için kanalda
// kalıcı ve herkese açıktır — görünen de gizlenen de toplumun önünde olsun ki karşılık verenin kazancı gözüksün.
// Sonuç ayrı mesaj değildir: kart yerinde sonuç kartına döner, kanal dolmaz.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const core = require('../../core/ui');
const { coin, number } = require('../coin/ui');
const config = require('./config');

const IDS = {
  prefix: 'eglence',
  karsilik: 'eglence:karsilik:', // + kart numarası — yalnızca muhatap basabilir
};

// Ödül aralığı tek kutuda okunur: kimse "ne kadar" sorusunu sormasın
const aralik = ([alt, ust]) => core.chip(`${number(alt)}-${number(ust)} coin`);

// {vuran} ve {hedef} yerlerine mention yazılır
const cumle = (sablon, vuran, hedef) =>
  String(sablon).replace('{vuran}', `<@${vuran.id}>`).replace('{hedef}', `<@${hedef.id}>`);

// ── Karşılık kartı ────────────────────────────────────────────────────────────
function kart({ eylem, saldirgan, hedef, girisimNo, sonAt }) {
  const e = config.eylemler[eylem];
  return core
    .page({
      title: e.baslik,
      sub: `${cumle(e.kart, saldirgan, hedef)} Karşılık gelmezse kart havada kalır, gelirse ödül iki tarafa birden yatar.`,
      blocks: [
        `### Taraflar\n${core.rows([
          ['Şakayı Yapan', `<@${saldirgan.id}>`],
          ['Muhatap', `<@${hedef.id}>`],
          ['Karşılık Ödülü', aralik(e.odul)],
          ['Süre', core.rel(sonAt)],
        ])}`,
        config.ipucu,
      ],
      accent: core.colors[e.renk],
    })
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.karsilik}${girisimNo}`).setLabel(e.karsilikEtiket).setStyle(ButtonStyle.Primary),
      ),
    )
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp()));
}

// ── Sonuç kartları ────────────────────────────────────────────────────────────
// Karşılık geldi: iki tarafın kazancı tek kartta. Bakiye açıklanmaz, yalnızca yatan ödeme yazılır.
function karsilikSonuc({ eylem, saldirgan, hedef, odenenSaldirgan, odenenHedef, kesinti, user, at = Date.now() }) {
  const e = config.eylemler[eylem];
  return core.receipt({
    title: config.sonucBaslik,
    sub: `${cumle(e.karsilik, saldirgan, hedef)} Şaka yerini buldu; iki taraf da karşılığını aldı.`,
    user,
    accent: 'success',
    pairs: [
      ['Eylem', core.chip(e.ad)],
      ['Şakayı Yapan', `<@${saldirgan.id}>`],
      ['Muhatap', `<@${hedef.id}>`],
      ['Şakayı Yapana Yatan', coin(odenenSaldirgan)],
      ['Muhataba Yatan', coin(odenenHedef)],
      ['Karttan Çıkan', coin(odenenSaldirgan + odenenHedef)],
    ],
    note: kesinti ? config.tavanNotu : undefined,
    at,
  });
}

// Süre doldu, karşılık gelmedi: kartın düğmesi yerinde kalkar
function karsizSonuc({ eylem, saldirgan, hedef, user, at = Date.now() }) {
  const e = config.eylemler[eylem];
  return core.receipt({
    title: config.karsizBaslik,
    sub: `${cumle(e.kart, saldirgan, hedef)} Süresi içinde karşılık gelmedi; kart ödül vermeden kapandı.`,
    user,
    accent: 'warning',
    pairs: [
      ['Eylem', core.chip(e.ad)],
      ['Şakayı Yapan', `<@${saldirgan.id}>`],
      ['Muhatap', `<@${hedef.id}>`],
      ['Kaçan Ödül', aralik(e.odul)],
    ],
    at,
  });
}

// ── Şakalaşma sayfası ─────────────────────────────────────────────────────────
// Dakikayı kısaca söyler: kartların ritmi dakika ile ölçülür
const dk = (ms) => `${Math.max(1, Math.round((ms ?? 0) / 60000))} dk`;

// Sayfadaki kart satırı: kim attı, ne attı, karşılık için ne kadar kaldı. Süresi geçmiş kart ayrı yazılır
// ki üye boşuna düğme aramasın.
const kartSatiri = (k, at) => {
  const e = config.eylemler[k.eylem];
  const sure = k.sonAt <= at ? 'süresi doldu' : `karşılık ${core.rel(k.sonAt)} içinde`;
  return `<@${k.saldirgan}> sana bir **${e.ad}** gönderdi — ${sure}`;
};

function karsilikBekleyenler(state) {
  if (!state.kartlar.length) {
    return state.kalan > 0
      ? 'Karşılık bekleyen kartın yok. Şakayı sen başlat: **/öp** ya da **/tokat**.'
      : `Karşılık bekleyen kartın yok, bugünkü ${config.gunlukKart} kart hakkın da bitti. Haklar yarın sıfırlanır.`;
  }
  return state.kartlar.map((k) => kartSatiri(k, state.at)).join('\n');
}

function sayilarBloku(state) {
  return `### Senin Sayıların\n${core.rows([
    ['Öpücük Attın', `${number(state.atilan.op)} kez`],
    ['Tokat Attın', `${number(state.atilan.tokat)} kez`],
    ['Karşılık Verdik', `${number(state.karsilikVerdi)} kez`],
    ['Karşılığın Geldi', `${number(state.karsilikAldi)} kez`],
    ['Karşılıksız Kaldı', `${number(state.kacirdi)} kez`],
    ['Cebine Yatan', coin(state.kazanc)],
  ])}`;
}

function gunBloku(state) {
  const siradaki = state.kalan > 0 ? `Bugün **${state.gunluk} / ${config.gunlukKart}** kart açtın, **${state.kalan}** hakkın var.` : `Bugünkü **${config.gunlukKart}** kartın bitti; gece sıfırlanır.`;
  return `### Bugün\n${siradaki} Aynı üyeyle arka arkaya kart açılamaz: iki kart arasında **${dk(config.ikiliAralik)}** beklenir.\n` +
    `Karşılık ödülü günlük oyun kazancı tavanına sayılır; tavan dolarsa kart yine sonuçlanır ama para cebine girmez.\n` +
    `Paranın diğer yolları: **/oyun** kumarhanesi, **/sokak** suç dünyası ve **/gorev** görevleri — hepsi /bakiye cüzdanından da açılıyor.`;
}

function kurallarBloku() {
  return `### Nasıl İşler?\n` +
    `1. **/öp kullanici:@üye** ya da **/tokat kullanici:@üye** yaz; kart kanala düşer.\n` +
    `2. Muhatap **${dk(config.pencere)}** içinde kartındaki düğmeye basarsa ödül **iki tarafa da** yatar: ` +
    `öpücükte ${aralik(config.eylemler.op.odul)}, tokatta ${aralik(config.eylemler.tokat.odul)}.\n` +
    `3. Düğmeye basılmazsa kart karşılıksız kalır; kimse bir şey kaybetmez, kart sayacına yazılır.\n` +
    `4. Karşılık vermek için tek yol düğme: yazıyla "tamam" demek işlemez.\n` +
    `5. Bu sayfa sana uzanan kartları da gösterir; kartın aslı kanalda durur.`;
}

function panel(state) {
  const container = core.page({
    title: 'Şakalaşma',
    sub: 'İki kişilik şaka kartları: bir üye atar, muhatap karşılık verirse **ikisi de** coin kazanır. ' +
      'Kartlar kanalda herkese açık durur; karşılık vermeyen kart havada kalır.',
    thumbnail: state.user.displayAvatarURL({ size: 256 }),
    blocks: [
      `### Sana Uzanan Kartlar\n${karsilikBekleyenler(state)}`,
      sayilarBloku(state),
      gunBloku(state),
      kurallarBloku(),
    ],
  });
  return container
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp(state.at)));
}

module.exports = { IDS, aralik, cumle, dk, kart, karsilikSonuc, karsizSonuc, panel };
