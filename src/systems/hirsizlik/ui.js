// Suç Dünyası mesajları: /sokak ile açılan "Arka Sokaklar" sayfası, /çal ile atılan pusu kartları ve sonuç kartları.
// Sayfa komutla açıldığı için kanalda kalıcı ve herkese açıktır; pusular da öyledir — kurban direnme düğmesini
// bulsun, toplum olup biteni görsün. Yakalanma ve soygun sonuçları ayrı mesaj değildir: pusu kartı yerinde
// sonuç kartına döner, kanal dolmaz.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const core = require('../../core/ui');
const { coin, number } = require('../coin/ui');
const config = require('./config');

const IDS = {
  prefix: 'hirsizlik',
  diren: 'hirsizlik:diren:', // + girişim ID — yalnızca kurban basabilir
  mudahale: 'hirsizlik:mudahale:', // + girişim ID — saldırgan dışındaki herkes basabilir
  kefalet: 'hirsizlik:kefalet',
};

// Bekleme ve tahliye süreleri dakika/saat olarak okunur
const sure = (ms) => {
  const total = Math.max(0, Math.floor((ms ?? 0) / 60000));
  const hours = Math.floor(total / 60);
  return hours ? `${hours} sa ${total % 60} dk` : `${total} dk`;
};

const yuzde = (v) => `${Math.round(v * 100)}%`;

// ── Arka Sokaklar sayfası ─────────────────────────────────────────────────────
// Cüzdan şeridi: üye sayfada gezinirken parasını ve hakkını aramasın.
function cuzdan({ balance, kalan, bekleme, at }) {
  const siradaki = bekleme > at ? core.rel(bekleme) : 'şu an hazır';
  return `### Cüzdanın\n${core.pills([
    ['Bakiye', `${number(balance)} coin`],
    ['Günün Hakkı', `${kalan} girişim`],
    ['Sıradaki Girişim', siradaki],
  ])}`;
}

function hapisBlok(state) {
  if (!state.hapis) {
    return `### Sokaktasın\nİçeride değilsin; **Oyun Salonu** ve suç dünyası açık. Bugün **${state.gunluk} / ${config.gunlukAdet}** girişim yaptın.`;
  }
  const bedel = state.kefalet;
  return `### İçeridesin\n**${state.hapisTur === 'kasa' ? 'Kasaya zorlama' : 'Üye soyma'}** girişiminden yakalandın. Tahliye ${core.rel(state.hapis)} içinde olur; o ana kadar **/oyun** ve **/çal** kapalı.` +
    `\nKefaleti ödersen hemen çıkarsın: ${coin(bedel)} doğrudan Devletin Kasasına yazar, geri verilmez.`;
}

function kasaBlok(state) {
  const doluyor = state.kasaBekleme > state.at;
  const bos = state.kasa < config.kasa.enAz;
  const durum = doluyor
    ? `Sıradaki kasa soygunu ${core.rel(state.kasaBekleme)} içinde olur.`
    : bos
      ? `Kasa ${coin(config.kasa.enAz)} altında; para birikmeden kasa hedef olmaz.`
      : `Kasa hedef olabilir: tek elde ${coin(config.kasa.tavan)} kadarı dağılır.`;
  return `### Devletin Kasası\n${coin(state.kasa)} — yakalananların cezeleri ve kefaletler burada birikir; ` +
    `soyulduğunda da buradan dağılır, yani kasa coin üretmez. ${durum}`;
}

function sicilBlok(state) {
  return `### Sicilin\n${core.rows([
    ['Girişim', `${number(state.girisim)} girişim`],
    ['Başarı', `${number(state.basari)} girişim`],
    ['Yakalanma', `${number(state.yakalanma)} girişim`],
    ['Direnç', `${number(state.direnis)} kez direndin`],
    ['Avladığın', coin(state.avladigi)],
    ['Kaybın', coin(state.kaybi)],
  ])}`;
}

// Son girişimler: toplum neyin olduğunu görsün ki hem kurbanlar tedbirli hem saldırganlar tedirgin olsun
function sonKayitlar(sicil) {
  if (!sicil.length) return `-# Son kayıt yok.`;
  return sicil
    .map((k) => `${sicirLine(k)}`)
    .join('\n');
}

const sicirLine = (k) => `**${k.saldirganAd}** → ${k.hedefAd}: ${k.sonuc}${k.miktar ? ` (${coin(k.miktar)})` : ''}`;

function kurallarBloki() {
  return `### Nasıl İşler?\n` +
    `1. **/çal kullanici** ile bir üyeyi hedef alırsın; kurbanın ${sure(config.uye.pencere)} süresi var.\n` +
    `2. Kurban **Diren** düğmesine basarsa büyük olasılıkla yakalanırsın: ceza kasaya, hapis sana.\n` +
    `3. Kurban basmazsa ${yuzde(config.uye.oran.min)} ile ${yuzde(config.uye.oran.max)} arasında coin onun cebinden seninkine geçer.\n` +
    `4. **/çal kasa** riski büyük oyun: kartı gören herkes müdahale edebilir, ilk basan polistir.\n` +
    `5. İçerideyken salona giremez, yeni suç işleyemezsin; kefalet tek erken çıkış yolun.`;
}

function panel(state) {
  const container = core.page({
    title: 'Arka Sokaklar',
    sub: 'Burada coin üretilmez, el değiştirir: üye soymak parayı kurbanın cebinden çıkarır, kasa soymak cezalardan ' +
      'biriken kasayı dağıtır. Seviyen hem kepenk hem kelepçe: yüksek seviyeli üye daha az yakalanır, daha çok yakalatır.',
    blocks: state.feedback ? [state.feedback, hapisBlok(state), kasaBlok(state), sicilBlok(state), `### Son Girişimler\n${sonKayitlar(state.sicil)}`, kurallarBloki()]
      : [hapisBlok(state), kasaBlok(state), sicilBlok(state), `### Son Girişimler\n${sonKayitlar(state.sicil)}`, kurallarBloki()],
    accent: state.feedback ? core.colors.success : undefined,
  });

  if (state.hapis) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.kefalet).setLabel(`Kefalet Ver ${number(state.kefalet)}`).setStyle(ButtonStyle.Success),
      ),
    );
  }

  return container
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(cuzdan(state)))
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp(state.at)));
}

// ── Pusu kartları ─────────────────────────────────────────────────────────────
// Üye soyma girişi: kart kurbanın düğmesini taşır. Kurbanın bakiyesi açıklanmaz; ne kadar risk altında olduğunu
// yüzde ve tavan ile bilmek yeterli.
function pusu({ saldirgan, hedef, sonAt, balance, at = Date.now() }) {
  const risk = Math.min(config.uye.tavan, Math.round(balance * config.uye.oran.max));
  return core
    .page({
      title: 'Pusu',
      sub: `<@${saldirgan.id}> **<@${hedef.id}>** adlı üyeyi soymaya kalkıştı. Kurban ${core.rel(sonAt)} içinde direnmezse ` +
        `bakiyesinin ${yuzde(config.uye.oran.min)}-${yuzde(config.uye.oran.max)} arası el değiştirir.`,
      blocks: [
        `### Tarafar\n${core.rows([
          ['Saldırgan', `<@${saldirgan.id}>`],
          ['Kurban', `<@${hedef.id}>`],
          ['En Fazla Kayıp', coin(risk)],
          ['Direnme', core.rel(sonAt)],
        ])}`,
      ],
      accent: core.colors.danger,
      at,
    })
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.diren}PLACEHOLDER`).setLabel('Diren').setStyle(ButtonStyle.Danger),
      ),
    );
}

module.exports = { IDS, sure, yuzde, panel, pusu };
