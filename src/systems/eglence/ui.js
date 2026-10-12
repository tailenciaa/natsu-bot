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

module.exports = { IDS, aralik, cumle, kart, karsilikSonuc, karsizSonuc };
