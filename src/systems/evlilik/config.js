// Evlilik ayarları: teklifin şartları, karşılık süresi, boşanmanın bedeli ve yıl dönümü ödülü.
// Ekonomi düzeni: evliliğin tek girişi Butikte satılan yüzüktür (butik/config.js yuzuk) — teklif kabul edildiğinde
// yüzük yakılır, yani coin sistemden çıkar. Boşanma bedeli de üyenin cebinden çıkar ve Devletin Kasasına yazar
// (hirsizlik): sistem burada coin üretmez, para el değiştirir. Üretilen tek coin yıl dönümü ödülüdür ve o da
// çiftin birlikte geçirdiği her yedi günde bir, iki kişiye birden yatar.
// Ritim düzeni: ret ve boşanma beklemeleri evliliği ucuz bir tekrar oyununa dönüştürmesin; teklif penceresi ise
// üyenin botunun mesajına bakmasının bir işe yaramasını sağlar.
// ROL DÜZENİ: bot rol YARATMAZ. evli rolü Discord'da önceden açılmış olmalı ve ID'si buraya yazılmalı.
// null bırakılırsa evlilik yine çalışır, yalnızca çift rol verilmez.
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

module.exports = {
  teklif: {
    // Teklifi götürmek için ölçülen seviye (mesaj ya ses, büyük olanı): sunucuda vakit geçirmeden evlilik kapısı açılmaz
    minSeviye: 3,

    // Karşılık penceresi: bu sürede Kabul ya da Ret basılmazsa teklif süresi dolmuş sayılır ve yüzük yanmaz
    pencere: 24 * HOUR,

    // Geri çevrilen tekliften sonra aynı kişiye yeniden teklif götürmek için bekleme
    retBekleme: 12 * HOUR,
  },

  bosanma: {
    // Boşanma bedeli: coin yakılmaz, Devletin Kasasına geçer
    price: 1200,

    // Boşanan üye bu süre yeni teklif götüremez: rol ve yıl dönümü ödülünün dönülüp dönülüp toplandığı bir
    // oyun hâline gelmesin
    bekleme: 3 * DAY,
  },

  // Yıl dönümü: evliliğin başlangıcından itibaren her bu kadar günde bir, iki tarafa birden ödenen ödül
  yilDonumu: { gun: 7, odul: 400 },

  // Çift rolü: Discord'da hazır rolün ID'si. Boşsa rol verilmez, evlilik yine kaydedilir
  roles: { evli: null },

  // Bekçinin aralığı: hiç karşılık görmemiş teklifler burada sonuçlanır ve kartları yerinde kapanır
  bekciAralik: 10 * 60 * 1000,

  // Liste sayfasında tek sayfada gösterilen çift sayısı
  listeGoster: 10,

  // Kart başlıkları ve alt notlar: metin burada dursun ki arayüz değiştirirken koda dokunmak gerekmesin
  basliklar: {
    teklif: 'Evlilik Teklifi',
    evlilik: 'Evlilik İlan Edildi',
    ret: 'Teklif Geri Çevrildi',
    sure: 'Teklif Süresi Doldu',
    iptal: 'Teklif Geri Çekildi',
    bosanma: 'Boşanma Gerçekleşti',
    durum: 'Evlilik Halim',
    liste: 'Sunucudaki Çiftler',
  },

  // Kartların altındaki tek cümlelik notlar
  notlar: {
    yuzuk: 'Yüzük Butikte satılır ve kabul anında yakılır: /bakiye > Butik.',
    ret: 'Geri çevrilen teklif yüzük kaybettirmez; aynı kişiye yeniden teklif için kısa bir bekleme var.',
    sure: 'Karşılık gelmeyen teklif kendiliğinden kapanır, yüzük elde kalır.',
    evli: 'Evli rolü çiftin ikisine de verilir; üye sunucudan düşüp dönerse bot rolü geri verir.',
    bosanma: 'Boşanma bedeli Devletin Kasasına yazar; bir gün bir soyguncuya dağılır.',
  },
};
