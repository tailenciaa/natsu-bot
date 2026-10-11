// Görev paneli: /gorev ile açılır, beş sekme (Günlük, Haftalık, Keşif Yolu, Kutu, Sezon) tek mesajda gezilir.
// Sekme düğmesi aynı mesajı yerinde değiştirir; aktif sekmeye basmak ilerlemeyi baştan hesaplar.
// Panel üyenin kendi ilerlemesini gösterdiği için gizlidir, kutu açılışı ise herkesin gördüğü bir karttır.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SectionBuilder } = require('discord.js');
const core = require('../../core/ui');
const { coin, TUR_LABEL } = require('../coin/ui');
const config = require('./config');

const number = (n) => Number(n).toLocaleString('tr-TR');

// Tüm düğmeler gorev: önekinin altında toplanır ve index.js'te tek yerde karşılanır
const IDS = {
  prefix: 'gorev',
  sekme: 'gorev:sekme:', // + gunluk | haftalik | yol | kutu | sezon
  gunlukAl: 'gorev:al:g:', // + görev anahtarı
  haftalikAl: 'gorev:al:h:', // + görev anahtarı
  demet: 'gorev:demet',
  yolTopla: 'gorev:yol-topla',
  kutuAc: 'gorev:kutu-ac',
  kutuUc: 'gorev:kutu-ac-3',
  sezonAl: 'gorev:sezon:', // + kademe numarası
};

const TABLAR = { gunluk: 'Günlük', haftalik: 'Haftalık', yol: 'Keşif Yolu', kutu: 'Kutu', sezon: 'Sezon' };

const sekmeSatiri = (aktif) => core.tabRow(TABLAR, aktif, (key) => `${IDS.sekme}${key}`);

// ── Satır parçaları ───────────────────────────────────────────────────────────
// Süre hedefleri dakika/saat olarak okunur; ham saniye kimsenin içinden geçtiği bir sayı değil.
function sure(seconds) {
  const total = Math.max(0, Math.floor((seconds ?? 0) / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} dk`;
  return minutes ? `${number(hours)} sa ${minutes} dk` : `${number(hours)} sa`;
}

// Görevin birimi nasıl yazılır: süre, gün ya da düz sayı
function say(birim, value) {
  if (birim === 'sure') return sure(value);
  if (birim === 'gun') return `${number(value)} gün`;
  return number(value);
}

const ilerleme = (satir) => `${say(satir.gorev.birim, satir.deger)} / ${say(satir.gorev.birim, satir.hedef)}`;

// Ödül çipleri: coin, anahtar, sezon puanı ve kozmetik. Buradaki "puan" sezon puanıdır; profil puanıyla
// (skor.js, 1000 üstlü) aynı şey olmadığı için adıyla yazılır.
function odulCebi(odul = {}) {
  const parcalar = [
    odul.coin ? coin(odul.coin) : null,
    odul.anahtar ? core.chip(`${odul.anahtar} anahtar`) : null,
    odul.puan ? core.chip(`${odul.puan} sezon puanı`) : null,
    odul.kozmetik ? core.chip(TUR_LABEL[odul.kozmetik] ?? 'kozmetik') : null,
  ];
  return parcalar.filter(Boolean).join(' · ');
}

// Düğmenin üç hâli: ödülü alındı / hedefe kalan ilerleme (pasif, sayıyı gösterir) / ödül hazır
function alButton(id, satir, hazırLabel = 'Al') {
  const b = new ButtonBuilder().setCustomId(id);
  if (satir.alindi) return b.setLabel('Alındı').setStyle(ButtonStyle.Secondary).setDisabled(true);
  if (!satir.bitti) return b.setLabel(ilerleme(satir)).setStyle(ButtonStyle.Secondary).setDisabled(true);
  return b.setLabel(hazırLabel).setStyle(ButtonStyle.Success);
}

// Görev satırı: ad ve tarifi tek metinde, ilerleme ile ödül altında çiplerde; düğme sağda
function gorevSection(satir, id) {
  const { gorev } = satir;
  return new SectionBuilder()
    .addTextDisplayComponents(core.text(`**${gorev.ad}**\n${gorev.tarif}\n${core.chip(ilerleme(satir))} · ${odulCebi(gorev.odul)}`))
    .setButtonAccessory(alButton(id, satir));
}

// Günün demeti: üç günlük görevin ödülü de toplandığında verilir. Ayrı bir düğme gerektirmez,
// son görev alındığında index.js tarafından kendiliğinden ödenir; satır yalnızca durumunu söyler.
function demetSection(demet) {
  const b = new ButtonBuilder().setCustomId(IDS.demet);
  if (demet.alindi) b.setLabel('Demet Alındı').setStyle(ButtonStyle.Secondary).setDisabled(true);
  else if (demet.alinabilir) b.setLabel('Demeti Al').setStyle(ButtonStyle.Success);
  else b.setLabel(`${demet.kalan} görev kaldı`).setStyle(ButtonStyle.Secondary).setDisabled(true);
  return new SectionBuilder()
    .addTextDisplayComponents(core.text(`**Günün Demeti**\nBugünün üç görevinin de ödülünü topladığında açılır.\n${odulCebi(config.DEMET)}`))
    .setButtonAccessory(b);
}

// Yol satırları tek metinde: on bir adım Section olarak çizilemez (bileşen sınırı), liste tek blokta durur.
// Durumlar solda; sıradaki adım kalın yazılır ki üye ne yapacağını aramasın.
function yolSatiri(satir, index) {
  const durum = satir.alindi
    ? 'ödülü alındı'
    : satir.alinabilir
      ? 'ödülü hazır'
      : satir.kilit
        ? 'sıradaki adımdan sonra'
        : `${say(satir.adim.birim, satir.deger)} / ${say(satir.adim.birim, satir.hedef)}`;
  const ad = satir.alindi || satir.alinabilir || satir.kilit ? satir.adim.ad : `**${satir.adim.ad}**`;
  return `${index + 1}. ${ad} — ${durum}`;
}

// Cüzdan şeridi: her sekmenin altında aynı satır durur, üye ödülün nereye gittiğini görür
const cüzdan = ({ balance, anahtar }) =>
  `**Cüzdanın**\n${core.pills([['Bakiye', `${number(balance)} coin`], ['Anahtar', `${anahtar} adet · ${config.KUTU.anahtar} adedi 1 kutu`]])}`;

// Panelin iskeleti: başlık ve açıklama, istenirse hemen altında geri bildirim satırı, bloklar, satırlar, cüzdan ve sekmeler
function kabuk({ tab, title, sub, blocks = [], sections = [], rows, feedback, balance, anahtar, at }) {
  // Ödül aldın gibi geri bildirim üyenin az önce dokunduğu şeydir; listenin sonunda değil, başlığın hemen altında durur
  const container = core.page({
    title,
    sub,
    blocks: feedback ? [feedback, ...blocks] : blocks,
    accent: feedback ? core.colors.success : undefined,
  });
  for (const section of sections) container.addSectionComponents(section);
  for (const row of rows ?? []) container.addActionRowComponents(row);
  container.addSeparatorComponents(core.divider()).addTextDisplayComponents(core.text(cüzdan({ balance, anahtar })));
  return (
    container
      .addActionRowComponents(sekmeSatiri(tab))
      // Zaman damgası panelin en altında durur; üyenin gördüğü ilerlemenin hangi ana ait olduğunu bilir
      .addSeparatorComponents(core.divider())
      .addTextDisplayComponents(core.text(core.stamp(at)))
  );
}

const BASLIK = {
  gunluk: {
    title: 'Günlük Görevler',
    sub: 'Bugünün üç görevi sunucudaki gerçek etkinliğinden sayılır; ayrıca bir şey yapman gerekmez. Üçünün de ödülünü topladığında günün demeti açılır. Görevler her gece 00:00\u2019da yenilenir.',
  },
  haftalik: {
    title: 'Haftalık Görevler',
    sub: 'Haftanın üç ağır görevi pazartesi günü yenilenir. Anahtarlar asıl buradan düşer; üç anahtar bir kutu açar ve kutudan kartını süsleyen kozmetikler çıkar.',
  },
  yol: {
    title: 'Keşif Yolu',
    sub: 'Botun sistemlerini sırayla gezdiren on bir adım. Bir adım bittiğinde ödülünü toplarsın, sıradaki adım kalın yazılır; son adımda büyük ödül ve kartına takılacak bir sergi rozeti var.',
  },
  kutu: {
    title: 'Kutu',
    sub: 'Anahtarların kutuya dönüşür: üç anahtar yaktığında içinden coin, anahtar ya da doğrudan mağazandaki kozmetikler çıkar. Beş kutuda bir kozmetik mutlaka düşer.',
  },
  sezon: {
    title: 'Sezon',
    sub: 'Görevlerden toplanan sezon puanı ay boyunca birikir. Eşikleri geçtikçe ödüller açılır ve her eşik ayda yalnızca bir kez alınır; yeni ayda puan sıfırdan başlar.',
  },
};

// ── Sekmeler ──────────────────────────────────────────────────────────────────
function panel(state) {
  const { tab, at, balance, anahtar, feedback } = state;
  const ortak = { tab, at, balance, anahtar, feedback };

  if (tab === 'gunluk') {
    return kabuk({
      ...ortak,
      ...BASLIK.gunluk,
      sections: [
        ...state.gunluk.map((satir) => gorevSection(satir, `${IDS.gunlukAl}${satir.gorev.key}`)),
        demetSection(state.demet),
      ],
    });
  }

  if (tab === 'haftalik') {
    return kabuk({
      ...ortak,
      ...BASLIK.haftalik,
      sections: state.haftalik.map((satir) => gorevSection(satir, `${IDS.haftalikAl}${satir.gorev.key}`)),
    });
  }

  if (tab === 'yol') {
    const biten = state.yol.filter((s) => s.alindi).length;
    const hazir = state.yol.filter((s) => s.alinabilir).length;
    const b = new ButtonBuilder().setCustomId(IDS.yolTopla);
    if (hazir) b.setLabel('Ödülleri Topla').setStyle(ButtonStyle.Success);
    else b.setLabel(biten === config.YOL.length ? 'Yol tamamlandı' : 'Henüz hazır adım yok').setStyle(ButtonStyle.Secondary).setDisabled(true);
    return kabuk({
      ...ortak,
      ...BASLIK.yol,
      blocks: [
        core.fields([`**${biten} / ${config.YOL.length} adım tamamlandı**`, state.yol.map((s, i) => yolSatiri(s, i)).join('\n')]),
      ],
      rows: [new ActionRowBuilder().addComponents(b)],
    });
  }

  if (tab === 'kutu') {
    const k = state.kutu;
    const tek = new ButtonBuilder().setCustomId(IDS.kutuAc).setLabel('Kutu Aç').setStyle(k.yeterli ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!k.yeterli);
    const uc = new ButtonBuilder().setCustomId(IDS.kutuUc).setLabel('3 Kutu Aç').setStyle(k.yeterliUc ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(!k.yeterliUc);
    return kabuk({
      ...ortak,
      ...BASLIK.kutu,
      blocks: [
        core.rows([
          ['Kutu maliyeti', `${config.KUTU.anahtar} anahtar · üçlü açılım ${config.KUTU.anahtar * 3} anahtar`],
          ['Açtığın kutu', `${number(k.toplam)} (bu hafta ${k.hafta})`],
          ['Kozmetiğe kalan', `${k.garantiKaldi} kutu`],
        ]),
      ],
      rows: [new ActionRowBuilder().addComponents([tek, uc])],
    });
  }

  // Sezon: beş kademe satır çizilir, başlık ayın adını taşır
  const kademeSection = (k) => {
    const b = new ButtonBuilder().setCustomId(`${IDS.sezonAl}${k.index}`);
    if (k.alindi) b.setLabel('Alındı').setStyle(ButtonStyle.Secondary).setDisabled(true);
    else if (k.alinabilir) b.setLabel('Al').setStyle(ButtonStyle.Success);
    else b.setLabel(`${k.puan} puan`).setStyle(ButtonStyle.Secondary).setDisabled(true);
    return new SectionBuilder()
      .addTextDisplayComponents(core.text(`**${k.ad}**\n${core.chip(`${k.puan} sezon puanı`)} · ${odulCebi(k.odul)}`))
      .setButtonAccessory(b);
  };
  return kabuk({
    ...ortak,
    title: `${state.sezon.ad} Sezonu`,
    sub: BASLIK.sezon.sub,
    blocks: [core.fields([`**Sezon puanın: ${number(state.sezon.puan)}**`, 'Puanlar günlük, haftalık, Keşif Yolu ve demet ödüllerinden birikir.'])],
    sections: state.sezon.kademeler.map(kademeSection),
  });
}

// ── Kutu açılış kartı ─────────────────────────────────────────────────────────
// Kutu açmak anahtar yakar; sonuç herkese açık duyurulur (satın alma kartlarıyla aynı düzen): üye ne
// çıkardığını gösterir, kanalda gören kişi kutunun ne verdiğini öğrenir.
function chest({ user, sonuclar, kalanAnahtar, balance, at = Date.now() }) {
  const özet = (r) => {
    if (r.tur === 'coin') return core.chip(`${number(r.miktar)} coin`);
    if (r.tur === 'anahtar') return core.chip(`${r.miktar} anahtar geri`);
    return `**${r.name}** (${TUR_LABEL[r.tur]})`;
  };
  const adet = sonuclar.length;
  return core.receipt({
    title: adet === 1 ? 'Kutu Açıldı' : `${adet} Kutu Açıldı`,
    sub: `<@${user.id}> ${adet === 1 ? 'bir kutu açtı' : `${adet} kutu açtı`}: ${sonuclar.map(özet).join(', ')}.`,
    user,
    accent: 'success',
    pairs: [
      ['Harcanan', core.chip(`${adet * config.KUTU.anahtar} anahtar`)],
      ['Kalan Anahtar', core.chip(`${number(kalanAnahtar)} anahtar`)],
      ['Yeni Bakiye', core.chip(`${number(balance)} coin`)],
    ],
    at,
  });
}

module.exports = { IDS, TABLAR, panel, chest, ilerleme, odulCebi };
