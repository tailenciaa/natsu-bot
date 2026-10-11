// Görev paneli: /gorev ile açılır, beş sekme (Günlük, Haftalık, Keşif Yolu, Kutu, Sezon) tek mesajda gezilir.
// Sekme düğmesine basmak aynı mesajı yerinde değiştirir; aktif sekmeye basmak ilerlemeyi yeniden hesaplar.
// Sayfa üyenin kendi ilerlemesini gösterdiği için gizlidir, kutu açılışı ise herkesin gördüğü bir karttır.
const { ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder } = require('discord.js');
const core = require('../../core/ui');
const { coin } = require('../coin/ui');
const config = require('./config');

const number = (n) => Number(n).toLocaleString('tr-TR');

// Tüm düğmeler gorev: öneki altında toplanır ve index.js'te tek yerde karşılanır
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
// Süre hedefleri dakika/saat olarak okunur; ham saniye kimse için anlam taşımaz.
function sure(seconds) {
  const total = Math.max(0, Math.floor((seconds ?? 0) / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} dk`;
  return minutes ? `${number(hours)} sa ${minutes} dk` : `${number(hours)} sa`;
}

// Görevin birimi nasıl yazılır: mesaj adedi, süre, yoksa düz sayı
function say(gorev, value) {
  if (gorev.birim === 'sure') return sure(value);
  if (gorev.birim === 'gun') return `${value} gün`;
  return number(value);
}

const ilerleme = (satir) => `${say(satir.gorev, satir.deger)} / ${say(satir.gorev, satir.hedef)}`;

// Ödül çipi: coin, anahtar ve sezon puanı tek kutucukta. "puan" burada sezon puanıdır; profil puanıyla karışmasın
// diye adıyla yazılır (skor.js'teki 1000 puanlık hesap ayrı bir şey).
function odulCebi(odul) {
  const parcalar = [odul.coin ? `${number(odul.coin)} coin` : null, odul.anahtar ? `${odul.anahtar} anahtar` : null, odul.puan ? `${odul.puan} sezon puanı` : null];
  if (odul.kozmetik) parcalar.push('kozmetik');
  return core.chip(parcalar.filter(Boolean).join(' · '));
}

// Düğmenin üç hâli: ödülü alındı / hedefe kalan ilerleme (pasif, sayıyı gösterir) / ödül hazır
function alButton(id, satir, hazırLabel = 'Al') {
  const b = new ButtonBuilder().setCustomId(id);
  if (satir.alindi) return b.setLabel('Alındı').setStyle(ButtonStyle.Secondary).setDisabled(true);
  if (!satir.bitti) return b.setLabel(ilerleme(satir)).setStyle(ButtonStyle.Secondary).setDisabled(true);
  return b.setLabel(hazırLabel).setStyle(ButtonStyle.Success);
}

// Görev satırı: ad ve tarifi tek metinde, ilerleme ile ödül altında çip olarak; düğme sağda
function gorevSection(satir, id) {
  const { gorev } = satir;
  return new SectionBuilder()
    .addTextDisplayComponents(core.text(`**${gorev.ad}**\n${gorev.tarif}\n${core.chip(ilerleme(satir))} · ${odulCebi(gorev.odul)}`))
    .setButtonAccessory(alButton(id, satir));
}

// Cüzdan şeridi: panelin altında, sekmelerin üstünde durur. Üye "ödülü alınca ne oluyor"u görmek zorunda kalmasın.
const cüzdanSatiri = ({ balance, anahtar }) =>
  core.fields([`**Cüzdanın**`, core.pills([['Bakiye', `${number(balance)} coin`], ['Anahtar', anahtar], ['Görev ödülü', `${core.chip('Mağaza')} profil kartından açılır`].filter(Boolean)])]);

// Panelin iskeleti: başlık ve açıklama, altındaki bloklar, en altta cüzdan ve sekmeler
function kabuk({ tab, title, sub, blocks = [], sections = [], note, at }) {
  const container = core.page({ title, sub, blocks });
  for (const section of sections) container.addSectionComponents(section);
  if (note) container.addSeparatorComponents(core.divider()).addTextDisplayComponents(core.text(note));
  container.addSeparatorComponents(core.divider()).addTextDisplayComponents(core.text(cüzdanSatiri({ balance: container, anahtar: undefined })));
  return container;
}

module.exports = { IDS, TABLAR };
