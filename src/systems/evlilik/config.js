// Evlilik ayarları: teklifin şartları, karşılık süresi, boşanmanın bedeli ve yıl dönümü ödülü.
// Ekonomi düzeni: evliliğin tek girişi Butikte satılan yüzüktür (butik/config.js yuzuk) — teklif kabul edildiğinde
// yüzük yakılır, yani coin sistemden çıkar. Boşanma bedeli de üyenin cebinden çıkar ve Devletin Kasasına yazar
// (hirsizlik): sistem burada coin üretmez, para el değiştirir. Üretilen tek coin yıl dönümü ödülüdür ve o da
// çiftin birlikte geçirdiği her yedi günde bir, iki kişiye birden yatar.
// Ritim düzeni: ret ve boşanma beklemeleri evliliği ucuz bir tekrar oyununa dönüştürmesin; teklif penceresi ise
// üyenin botunun mesajına bakmasının bir işe yaramasını sağlar.
// ROL DÜZENİ: bot her çift için rolü KENDİSİ yaratır. Rolün adı, rengi ve simgesi teklifi götüren üye tarafından
// seçilir; muhatap kabul ederken hangi rolün açılacağını kartta görür, yani seçim ikisinin de önündedir. Rol
// boşanmada silinir, sunucudan düşüp dönen eşe geri verilir. Yaratılamazsa (botun izni yok ya da sunucu rol
// sayısı dolu) evlilik yine kaydedilir ve gerekçe kartta okunur.
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// Renk paleti: komuttaki seçenek listesi buradan kurulur, elle hex yazılmaz. `color` Discord'ın sayısal rengidir
// (hem rol rengi hem kart vurgusu aynı sayıyı alır). Seçilmeyen teklif ilk sıradakini alır.
const renkler = [
  { key: 'gul', ad: 'Gül Kurusu', color: 0xf2789f },
  { key: 'pembe', ad: 'Pembe', color: 0xff5ec4 },
  { key: 'kizil', ad: 'Kızıl', color: 0xed4245 },
  { key: 'turuncu', ad: 'Turuncu', color: 0xf39c12 },
  { key: 'altin', ad: 'Altın', color: 0xf1c40f },
  { key: 'yesil', ad: 'Yeşil', color: 0x52be80 },
  { key: 'turkuaz', ad: 'Turkuaz', color: 0x1abc9c },
  { key: 'mavi', ad: 'Mavi', color: 0x5dade2 },
  { key: 'mor', ad: 'Mor', color: 0x9b59b6 },
];

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

  // Çift rolü: kabul anında bot tarafından açılır. Ad boş bırakılırsa iki eşin adı yan yana yazılır, simge boşsa
  // yüzük kullanılır. maxUzunluk rol adının (simge dahil) taşıyabileceği en fazla karakter.
  rol: {
    renkler,
    renk: (key) => renkler.find((r) => r.key === key) ?? renkler[0],
    varsayilanEmoji: '💍',
    maxUzunluk: 32,
  },

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
    gecersiz: 'Teklif Geçersiz',
    iptal: 'Teklif Geri Çekildi',
    bosanma: 'Boşanma Gerçekleşti',
    durum: 'Evlilik Halim',
    liste: 'Sunucudaki Çiftler',
  },

  // Kartların altındaki tek cümlelik notlar
  notlar: {
    yuzuk: 'Yüzük **Butik** rafından alınır, teklif kabul edildiği anda yakılır: `/bakiye` > Butik.',
    rol: 'Kabul edince bot bu rolü açıp ikinize giydirir; ad, renk ve simge teklifte seçilir.',
    ret: 'Geri çevrilen teklif yüzük kaybettirmez; aynı kişiye yeniden teklif için kısa bir bekleme var.',
    sure: 'Karşılık gelmeyen teklif kendiliğinden kapanır, yüzük elde kalır.',
    gecersiz: 'Yüzük yanmadığı için hiçbir şey kaydedilmedi; raftan yeniden alıp teklif edebilirsin.',
    evli: 'Çift rolünüz ikinize de giydirildi; sunucudan düşüp dönersen bot rolü geri verir, **boşanınca rol silinir**.',
    bosanma: 'Boşanma bedeli Devletin Kasasına yazar; bir gün bir soyguncuya dağılır. Ortak çift rolünüz de **silinir**.',
  },
};
