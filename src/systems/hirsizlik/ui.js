// Suç Dünyası mesajları: /sokak ile açılan "Arka Sokaklar" sayfası, /çal ile atılan pusu kartları ve sonuç kartları.
// Sayfa komutla açıldığı için kanalda kalıcı ve herkese açıktır; pusular da öyledir — kurban direnme düğmesini
// bulsun, toplum olup biteni görsün. Sonuçlar ayrı mesaj değildir: pusu kartı yerinde sonuç kartına döner, kanal
// dolmaz. Yalnızca bekçi tarafından zamanında fark edilmeyen (kurban hiç dokunmayan) girişimler yeni mesajla anılır.
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

// Süreler okunur yazılır: dakikadan kısası saniyeyle, saati geçense saatle anılır
const sure = (ms) => {
  const sn = Math.max(0, Math.floor((ms ?? 0) / 1000));
  if (sn < 60) return `${sn} sn`;
  const dk = Math.floor(sn / 60);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  return dk % 60 ? `${sa} sa ${dk % 60} dk` : `${sa} sa`;
};

const yuzde = (v) => `${Math.round(v * 100)}%`;

// Tek girişimde el konulabilecek en fazla tavan: kurbanın o anki bakiyesinin üst oranı, mutlak tavanla dizginlenir.
// Bakiye açıklanmaz, yalnızca riskin üst sınırı söylenir — kimsenin cüzdanı kamuya dökülmez.
const riskHesabi = (balance) => Math.min(config.uye.tavan, Math.round(balance * config.uye.oran.max));

// ── Arka Sokaklar sayfası ─────────────────────────────────────────────────────
// Cüzdan şeridi: üye sayfada gezinirken parasını ve hakkını aramasın.
function cuzdan(state) {
  const siradaki = state.bekleme > state.at ? core.rel(state.bekleme) : 'şu an hazır';
  return `### Cüzdanın\n${core.pills([
    ['Bakiye', `${number(state.balance)} coin`],
    ['Günün Hakkı', `${state.kalan} girişim`],
    ['Sıradaki Girişim', siradaki],
  ])}`;
}

function hapisBlok(state) {
  if (state.hapis) {
    return `### İçeridesin\n**${state.hapisTur === 'kasa' ? 'Kasaya zorlama' : 'Üye soyma'}** girişiminden yakalandın. ` +
      `Tahliye ${core.rel(state.hapis)} içinde olur; o ana kadar Oyun Salonu, keşif ve yeni suç kapalı.\n` +
      `Kefaleti ödersen hemen çıkarsın: ${coin(state.kefalet)} doğrudan Devletin Kasasına yazar, geri verilmez.`;
  }
  // Seviyesi sokağa henüz çıkmamış üye "açık" sanmasın: kapılar ölçülen seviyeye göre tek tek sayılır
  if (state.seviye < config.minSeviye) {
    return `### Sokak sana kapalı\nÖlçülen seviyen **${state.seviye}**. Suç işleyebilmen için **${config.minSeviye}**, ` +
      `Devletin Kasasını zorlaman için **${config.kasaMinSeviye}** seviye gerekir. Seviyen mesaj ve ses seviyenden ` +
      `büyük olanıdır; kasa ve sicil şimdiden izlenebilir, **/oyun** açık.`;
  }
  const kasa = state.seviye < config.kasaMinSeviye ? ` Kasa zorlaması seviye **${config.kasaMinSeviye}** ister.` : '';
  return `### Sokaktasın\nİçeride değilsin; **/çal uye** açık.${kasa} Bugün **${state.gunluk} / ${config.gunlukAdet}** girişim yaptın.`;
}

function kasaBlok(state) {
  const doluyor = state.kasaBekleme > state.at;
  const bos = state.kasa < config.kasa.enAz;
  const durum = doluyor
    ? `Sıradaki kasa soygunu ${core.rel(state.kasaBekleme)} içinde olur.`
    : bos
      ? `Kasa ${coin(config.kasa.enAz)} altında; para birikmeden kasa hedef olmaz.`
      : `Kasa hedef olabilir: tek elde en fazla ${coin(config.kasa.tavan)} dağılır.`;
  return `### Devletin Kasası\n${coin(state.kasa)} — yakalananların cezeleri ve ödenen kefaletler burada birikir; ` +
    `soyulduğunda da buradan dağılır, yani kasa coin üretmez. ${durum}`;
}

function sicilBlok(state) {
  return `### Sicilin\n${core.rows([
    ['Girişim', `${number(state.girisim)} kez`],
    ['Başarı', `${number(state.basari)} kez`],
    ['Yakalanma', `${number(state.yakalanma)} kez`],
    ['Direnç', `${number(state.direnis)} kez`],
    ['Avladığın', coin(state.avladigi)],
    ['Kaybın', coin(state.kaybi)],
  ])}`;
}

// Toplum kayıt defteri: üye olup biteni tek sayfada görsün ki hem kurbanlar tedbirli hem saldırganlar tedirgin olsun
const kayitSatiri = (k) => `**${k.saldirganAd}** → ${k.hedefAd}: ${k.sonuc}${k.miktar ? ` (${coin(k.miktar)})` : ''}`;

function sonKayitlar(sicil) {
  if (!sicil.length) return `Sokak henüz sessiz; kayda geçmiş bir girişim yok.`;
  return sicil.map((k) => kayitSatiri(k)).join('\n');
}

function kurallarBloku() {
  return `### Nasıl İşler?\n` +
    `1. **/çal uye kullanici:@üye** ile bir üyeyi hedef alırsın; kurbanın **${sure(config.uye.pencere)}** direnme süresi doğar.\n` +
    `2. Kurban **Diren** düğmesine basarsa yüksek olasılıkla yakalanırsın: ceza kasaya yatar, hapis sana.\n` +
    `3. Kurban dokunmazsa bakiyesinin **${yuzde(config.uye.oran.min)}-${yuzde(config.uye.oran.max)}** arası el değiştirir.\n` +
    `4. **/çal kasa** daha büyük oyun: kartı gören herkes müdahale edebilir, ilk basan polistir.\n` +
    `5. Seviyen her iki tarafta da ağırlık taşır: yüksek seviye daha az yakalanır, daha çok yakalatır.\n` +
    `6. Kapılar seviyeyle açılır: suç için **${config.minSeviye}**, kasa için **${config.kasaMinSeviye}** seviye gerekir; ` +
    `hedef seçtiğin üyenin de en az **${config.korumaSeviye}** seviyede olması şart.`;
}

function panel(state) {
  const blocks = [
    hapisBlok(state),
    kasaBlok(state),
    sicilBlok(state),
    `### Son Girişimler\n${sonKayitlar(state.sicil)}`,
    kurallarBloku(),
  ];
  const container = core.page({
    title: 'Arka Sokaklar',
    sub: 'Burada coin üretilmez, el değiştirir: üye soymak parayı kurbanın cebinden çıkarır, kasa soymak cezalardan ' +
      'biriken kasayı dağıtır. Botun mesajına bakmak işe yarar — direnmezsen kaybedersin.',
    blocks: state.feedback ? [state.feedback, ...blocks] : blocks,
    accent: state.feedback ? core.colors.success : undefined,
  });

  if (state.hapis) {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.kefalet).setLabel(`Kefalet ${number(state.kefalet)}`).setStyle(ButtonStyle.Success),
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
// Üye soyma girişi: kart kurbanın düğmesini taşır. Düğme girişim numarasıyla gider ki eski bir karttan basıldığında
// kayıt bulunamasın ve ödül üremesin.
function pusu({ saldirgan, hedef, girisimId, sonAt, risk }) {
  return core
    .page({
      title: 'Pusu',
      sub: `<@${saldirgan.id}> adlı üye **<@${hedef.id}>** kişisini soymaya kalkıştı. Kurban ${core.rel(sonAt)} içinde ` +
        `direnmezse bakiyesinin ${yuzde(config.uye.oran.min)} ile ${yuzde(config.uye.oran.max)} arası el değiştirir.`,
      blocks: [
        `### Taraflar\n${core.rows([
          ['Saldırgan', `<@${saldirgan.id}>`],
          ['Kurban', `<@${hedef.id}>`],
          ['Tek Seferde Risk', coin(risk)],
          ['Direnme Süresi', core.rel(sonAt)],
        ])}`,
      ],
      accent: core.colors.danger,
    })
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.diren}${girisimId}`).setLabel('Diren').setStyle(ButtonStyle.Danger),
      ),
    )
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp()));
}

// Kasa girişi: muhbir herkes olabilir, ilk basan polistir
function kasaPusu({ saldirgan, girisimId, sonAt, kasa }) {
  return core
    .page({
      title: 'Kasaya Zorlama',
      sub: `<@${saldirgan.id}> Devletin Kasasını soymaya kalkıştı. Kasada ${coin(kasa)} var; müdahale edilmezse ` +
        `${sure(config.kasa.pencere)} içinde ${coin(Math.min(config.kasa.tavan, kasa))} dağılır.`,
      blocks: [
        `### Müdahale\n${core.rows([
          ['Saldırgan', `<@${saldirgan.id}>`],
          ['Kasa', coin(kasa)],
          ['İkramiye', coin(config.kasa.ikramiye)],
          ['Pencere', core.rel(sonAt)],
        ])}`,
        'İlk basan yakalar; yakalarsan ikramiye kasadan sana yatar, yakalamazsan soygun yine de boşa gider.',
      ],
      accent: core.colors.warning,
    })
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${IDS.mudahale}${girisimId}`).setLabel('Müdahale Et').setStyle(ButtonStyle.Primary),
      ),
    )
    .addSeparatorComponents(core.divider())
    .addTextDisplayComponents(core.text(core.stamp()));
}

// Sonuç kartı: pusunun yerini alır ya da bekçi tarafından yeni mesaj olarak anılır. Kazanan tarafın rengi kartta
// okunur: saldırgan kazandıysa danger, direnç ya da müdahale işe yaradıysa success.
function sonuc({ title, sub, pairs, user, accent = 'success', at = Date.now(), note }) {
  return core.receipt({ title, sub, pairs, note, user, accent, at });
}

module.exports = { IDS, sure, yuzde, riskHesabi, panel, pusu, kasaPusu, sonuc };
