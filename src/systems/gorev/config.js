// Görevler: üyenin botla her gün temas hâlinde kalması için kurulu ilerleme katmanı. Dört katmanı var:
//   Günlük   : havuzdan çekilen üç görev, gece 00:00'da yenilenir. Üçü birden bitirilince demet ödülü verilir.
//   Haftalık : havuzdan çekilen üç ağır görev, pazartesi yenilenir. Anahtar asıl buradan düşer.
//   Keşif Yolu: botun sistemlerini sırayla gezdiren, tek seferlik on bir adım. Her adım bir sonrakini çeker.
//   Kutu      : anahtar harcanan ödül çekilişi; kozmetikler doğrudan mağazadaki sahipliğe geçer.
// Sezon ise ayın birikimli yarışı: görevlerden puan toplanır, ay eşikleri geçilince tek seferlik ödül alınır.
//
// GÖREV KAYDI TUTULMAZ: ilerlemenin tamamı zaten başka sistemlerde duran veriden okunur (mesaj ve ses sayıları
// sıralamada, verilen saygınlık saygi cooldown'unda, alınan saygınlık haftalık tablosunda, günlük ödül ve
// siparişler coin kaydında, kozmetik sahipliği profil kaydında). Böylece görevler açılmadan önceki etkinlikler de
// sayılır, bir sayaç bozulsa bile ilerleme yeniden hesaplanır ve bu sistem başka bir sistemin verisine yazmaz.
// Yalnızca *ödüllerin alınması* ve Keşif Yolu'nun butonla görülen iki adımı kendi kaydında tutulur (store.js).
const { weekKey } = require('../aktif/week');

const dayKey = (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
// Sezon ay takvimiyle yürür: anahtar "2026-10" gibi ayın kendisidir
const sezonAnahtari = (ms = Date.now()) => dayKey(ms).slice(0, 7);
// Hafta anahtarı (pazartesi tarihi) İstanbul takviminden gelir; görevin haftalık mı günlük mü olduğu aynı kaynaktan
const haftaAnahtari = (ms = Date.now()) => weekKey(ms);
// Bir haftanın başlangıcı: anahtar zaten pazartesi tarihidir, İstanbul saatiyle 03:00 farkıyla saniyeye çevrilir
const haftaBaslangici = (anahtar) => Date.parse(`${anahtar}T00:00:00+03:00`);

// Günlük görev havuzu. Ölçüm adları olcum.js'teki OLCUMLER tablosundan gelir; `hedef` o ölçümün birimidir
// (mesaj adedi, saniye, yoksa 1). Ödüller: coin + sezon puanı, haftalıkta bir de anahtar.
const GUNLUK_HAVUZU = [
  { key: 'mesaj-20', ad: '20 mesaj yaz', tarif: 'Herhangi bir yazı kanalında bugün toplam 20 mesaj at.', hedef: 20, birim: 'mesaj', olcum: 'mesajGun', odul: { coin: 70, puan: 4 } },
  { key: 'mesaj-60', ad: '60 mesaj yaz', tarif: 'Herhangi bir yazı kanalında bugün toplam 60 mesaj at.', hedef: 60, birim: 'mesaj', olcum: 'mesajGun', odul: { coin: 140, puan: 7 } },
  { key: 'ses-30', ad: '30 dakika seste kal', tarif: 'Bir sesli kanala gir ve bugün toplam 30 dakika orada kal.', hedef: 1800, birim: 'sure', olcum: 'sesGun', odul: { coin: 90, puan: 5 } },
  { key: 'ses-90', ad: '1,5 saat seste kal', tarif: 'Bir sesli kanalda bugün toplam 1,5 saat geçirmiş ol.', hedef: 5400, birim: 'sure', olcum: 'sesGun', odul: { coin: 180, puan: 8 } },
  { key: 'yayin-20', ad: '20 dakika ekran paylaş', tarif: 'Seslide ekran paylaşımı aç ve bugün 20 dakika yayında kal.', hedef: 1200, birim: 'sure', olcum: 'yayinGun', odul: { coin: 120, puan: 6 } },
  { key: 'gunluk-odul', ad: 'Günlük ödülünü topla', tarif: '/gunluk yaz; coinlerin cebine girsin ve serin uzasın.', hedef: 1, birim: 'adet', olcum: 'gunlukBugun', odul: { coin: 50, puan: 3 } },
  { key: 'rep-ver', ad: 'Birine saygınlık ver', tarif: 'Sohbette "+rep @üye" yaz ya da /saygi-ver kullan.', hedef: 1, birim: 'adet', olcum: 'repVerdiBugun', odul: { coin: 60, puan: 3 } },
];

// Haftalık görev havuzu. Anahtar ödül bu katmanda: kutu üç anahtar ister, haftada ortalama dört anahtar düşer.
const HAFTALIK_HAVUZU = [
  { key: 'mesaj-250', ad: '250 mesaj yaz', tarif: 'Bu hafta toplam 250 mesaj at; pazartesi sıfırlanır.', hedef: 250, birim: 'mesaj', olcum: 'mesajHafta', odul: { coin: 400, anahtar: 1, puan: 10 } },
  { key: 'ses-10sa', ad: '10 saat seste kal', tarif: 'Bu hafta sesli kanallarda toplam 10 saat geçirmiş ol.', hedef: 36000, birim: 'sure', olcum: 'sesHafta', odul: { coin: 450, anahtar: 1, puan: 10 } },
  { key: 'yayin-2sa', ad: '2 saat ekran paylaş', tarif: 'Bu hafta ekran paylaşımıyla toplam 2 saat geçir.', hedef: 7200, birim: 'sure', olcum: 'yayinHafta', odul: { coin: 300, anahtar: 1, puan: 8 } },
  { key: 'rep-al-10', ad: '10 saygınlık al', tarif: 'Bu hafta diğer üyeler sana toplam 10 saygınlık versin; veren kişi /saygi-ver ile değerlendirir.', hedef: 10, birim: 'adet', olcum: 'repHafta', odul: { coin: 350, anahtar: 1, puan: 9 } },
  { key: 'magaza-al-1', ad: 'Mağazadan bir şey al', tarif: 'Profilindeki Mağaza sekmesinden bir kozmetik satın al.', hedef: 1, birim: 'adet', olcum: 'satinAlmaHafta', odul: { coin: 250, anahtar: 1, puan: 6 } },
  { key: 'kutu-2', ad: '2 kutu aç', tarif: 'Bu hafta anahtarlarınla 2 kutu aç.', hedef: 2, birim: 'adet', olcum: 'kutuHafta', odul: { coin: 300, anahtar: 1, puan: 7 } },
  { key: 'seri-4', ad: '4 gün görevleri bitir', tarif: 'Bu hafta üst üste değil, toplam 4 günün üç günlük görevini de tamamla.', hedef: 4, birim: 'gun', olcum: 'demetHafta', odul: { coin: 500, anahtar: 2, puan: 12 } },
];

// Üç günlük görevin hepsi bitirilince verilen demet ödülü: her günün sonunda bir anahtar, yani haftada yedi
// anahtar iki buçuk kutu eder. Asıl amaç seri kurmak: yarın ne olduğunu görmek için geri gelinir.
const DEMET = { coin: 120, anahtar: 1, puan: 3 };

// Keşif Yolu: botun sistemlerini gezdiren sıralı adımlar. Sıra bilinçli: kartını tanırsın, sonra yazı yazarsın,
// sonra sese girersin, sonra mağazayı görürsün. Her adım bir sonrakini tarif eder, sonunda ücretsiz rozet var.
const YOL = [
  { key: 'gunluk-topla', ad: 'Günlük ödülünü topla', tarif: '/gunluk yaz ve ilk coinlerini al.', hedef: 1, olcum: 'gunlukHic', odul: { coin: 100, puan: 5 } },
  { key: 'kartini-gor', ad: 'Kendi profil kartını aç', tarif: '/profil yaz; kartını ve altındaki düzenleme düğmelerini gör.', hedef: 1, olcum: 'goruldu:kartini-gor', odul: { coin: 80, puan: 3 } },
  { key: 'renk-sec', ad: 'Kartına bir renk seç', tarif: 'Kartının altındaki Renk düğmesinden bir renk ver.', hedef: 1, olcum: 'renkVar', odul: { coin: 120, puan: 4 } },
  { key: 'bio-yaz', ad: 'Biyografi yaz', tarif: 'Biyografi düğmesine bas, iki cümle yaz; kartın boş kalmasın.', hedef: 1, olcum: 'bioVar', odul: { coin: 120, puan: 4 } },
  { key: 'rep-ver', ad: 'Birine saygınlık ver', tarif: 'Sohbette "+rep @üye" yaz. Saygınlık hem rozet hem puan getirir.', hedef: 1, olcum: 'repVerdiHic', odul: { coin: 150, anahtar: 1, puan: 5 } },
  { key: 'seste-kal', ad: 'Seslide 10 dakika geçir', tarif: 'Bir sesli kanala gir; 10 dakika kaldığında bu adım kendiliğinden dolar.', hedef: 600, birim: 'sure', olcum: 'sesToplam', odul: { coin: 150, anahtar: 1, puan: 5 } },
  { key: 'cekilis-katil', ad: 'Bir çekilişe katıl', tarif: 'Çekiliş duyurusundaki Katıl düğmesine bas; kazananlar otomatik çekilir.', hedef: 1, olcum: 'goruldu:cekilis-katil', odul: { coin: 120, puan: 4 } },
  { key: 'rozet-kazan', ad: 'İlk rozetini kazan', tarif: 'Profilindeki Rozetler sayfası hangi rozete ne kadar yaklaştığını gösterir.', hedef: 1, olcum: 'rozetSayisi', odul: { coin: 200, anahtar: 1, puan: 6 } },
  { key: 'ilk-kozmetik', ad: 'Mağazadan ilk kozmetiğini al', tarif: 'Mağaza sekmesinden çerçeve, tema ya da sergi rozeti al; kartın değişsin.', hedef: 1, olcum: 'kozmetikSahibi', odul: { coin: 200, anahtar: 1, puan: 6 } },
  { key: 'ilk-kutu', ad: 'İlk kutunu aç', tarif: 'Üç anahtar biriktir ve Kutu sekmesinden aç.', hedef: 1, olcum: 'kutuToplam', odul: { coin: 250, anahtar: 1, puan: 7 } },
  { key: 'sevilen-ol', ad: 'Sevilen rütbesine çık', tarif: 'Profil puanını 360 yap. Puanım düğmesi eksiğini söyler.', hedef: 360, olcum: 'puan', odul: { coin: 600, anahtar: 3, kozmetik: 'rozet', puan: 15 } },
];

// Kutu: anahtar yakılır, ödül weighted tablodan çekilir. `garanti` sayılı kutuda kozmetik düşer; böylece
// "hep coin çıktı" hissi oluşmaz ve anahtar biriktirmenin sonu hep bir kart süsüdür.
// `kozmetikYedek`: üyenin aldığı türden tüm kozmetikler zaten sahipliğindeyse ödül coin'e döner, kutu boşa yanmasın.
const KUTU = {
  anahtar: 3,
  garanti: 5,
  kozmetikYedek: 600,
  hazinede: [
    { agirlik: 40, tur: 'coin', aralik: [120, 400] },
    { agirlik: 22, tur: 'coin', aralik: [400, 900] },
    { agirlik: 15, tur: 'anahtar', adet: 1 },
    { agirlik: 13, tur: 'kozmetik', secim: 'cerceve' },
    { agirlik: 7, tur: 'kozmetik', secim: 'rozet' },
    { agirlik: 3, tur: 'kozmetik', secim: 'tema' },
  ],
};

// Sezon: ay puan eşikleri. Her eşik ayda bir kez açılır; puan ay boyunca görevlerden birikir.
const SEZON = {
  ad: (anahtar) => {
    const [yil, ay] = anahtar.split('-');
    const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return `${aylar[Number(ay) - 1]} ${yil}`;
  },
  kademe: [
    { puan: 40, odul: { coin: 400 }, ad: 'Ayın başlangıcı' },
    { puan: 90, odul: { anahtar: 5 }, ad: 'Beş anahtar' },
    { puan: 150, odul: { coin: 1200 }, ad: 'Büyük ödeme' },
    { puan: 220, odul: { anahtar: 10 }, ad: 'Kutu deposu' },
    { puan: 300, odul: { kozmetik: 'cerceve' }, ad: 'Ayın kozmetiği' },
  ],
};

// Keşif Yolu'ndaki iki adım hiçbir depoda tutulmaz (kartını açtın mı, çekilişe katıldın mı): bunlar tek yerde,
// etkileşim izlenerek görülür. Yalnızca okur; hiçbir işleyiciye dokunmaz, cevap vermez.
const IZLENEN = {
  komut: { profil: 'kartini-gor' },
  buton: { 'cekilis-katil': 'cekilis-katil' },
};

// Görev duyurularının düşeceği kanal. Boş bırakılırsa hiçbir yerde duyuru yapılmaz; doldurulunca Keşif Yolu'nda
// son adıma çıkan üyeler ve sezon eşikleri kanala yazılır.
const kanal = { duyuru: null };

module.exports = {
  gunlukAdet: 3,
  haftalikAdet: 3,
  GUNLUK_HAVUZU,
  HAFTALIK_HAVUZU,
  DEMET,
  YOL,
  KUTU,
  SEZON,
  IZLENEN,
  kanal,
  dayKey,
  haftaAnahtari,
  haftaBaslangici,
  sezonAnahtari,
};
