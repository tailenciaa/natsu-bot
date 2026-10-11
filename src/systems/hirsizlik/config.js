// Suç Dünyası ayarları: kim kimi ne sıklıkla soyabilir, kurbanın ne kadar süresi var, yakalanan ne öder.
// Ekonomi düzeni: üye soymak parayı üyeden alıp soyguna taşır (coin/store.js transfer), kasa soymaksa kasada
// birikmiş olanı dağıtır. Kasa yalnızca ceza ve kefalet gelirleriyle dolar; yani suç dünyası baştan sona coin
// ÜRETMEZ, el değiştirir. Kasa soygunundan çıkan coin yine de günlük oyun kazancı tavanına sayılır (coin winCap),
// böylece tavanı aşmak için arka kapı kalmaz. Sayılar ritim içindir: kota ve bekleme üyeyi ekrana çivilemez,
// direnme penceresi ise botun mesajına bakmanın bir işe yaradığını gösterir.
module.exports = {
  // Gün anahtarı coin ve görev takvimiyle aynı takvimden gelir (İstanbul), gece 00:00'da döner
  dayKey: (ms = Date.now()) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }),

  // Suç işlemek için gereken ölçülen seviye (mesaj ya ses, büyük olanı): ilk günlerin üyesi pusu kuramaz,
  // seviye sunucuda vakit geçirmenin ölçüsü olduğu için suç da onunla açılır.
  minSeviye: 5,

  // Devletin Kasası ayrı bir büyüklük ister: oraya girenin yakalanma riski de bedeli de ağır.
  kasaMinSeviye: 12,

  // Kurban koruması: ölçülen seviyesi bundan düşük olan üye hedef olamaz (yeni gelen soyulmaz).
  korumaSeviye: 3,

  // Bir üye soyulduktan ya da direnip saldırganı yakalattıktan sonra bu kadar süre dokunulmaz olur; ardışık
  // soyulma olmadığı gibi, kaybettiği parayı aynı gün içinde yeniden kaybetme riski de kalkar.
  dokunulmazlik: 6 * 60 * 60 * 1000,

  // Aynı hedefe iki girişim arasında en az bu kadar süre olmalı (bir üye avlanmasın)
  hedefBekleme: 3 * 60 * 60 * 1000,

  // Suçlunun kendi iki girişimi arasındaki bekleme ve gün başına en fazla girişim sayısı. Girişim sayacı
  // sonuçtan bağımsızdır: yakalanmak da günün hakkından düşer, yoksa kotayı doldurmak risksiz olurdu.
  cooldown: 30 * 60 * 1000,
  gunlukAdet: 4,

  uye: {
    // Çalınan, kurbanın o anki bakiyesinin yüzdesi: zengin daha çok kaybeder ama cüzdanı bir girişimde
    // bitmez. Mutlak tavan tek elde el konulabilecek en fazla coin; taban ise cüzdanında bundan az coin olan
    // üyenin hedef sayılmaması (küçük bakiye için suça değmez).
    oran: { min: 0.05, max: 0.2 },
    taban: 150,
    tavan: 500,

    // Direnme penceresi: kartındaki "Diren" düğmesine bu sürede basılmazsa soygun gerçekleşir.
    pencere: 90 * 1000,
  },

  kasa: {
    // Kasa ilk açılışta bu kadar coinle kurulur; sonrasında yalnızca ceza ve kefalet gelirleriyle büyür,
    // soyulduğunda da içindekini dağıtır — kuruluş tutarı sistemin tek coin girişi.
    kurulus: 1500,
    oran: { min: 0.1, max: 0.25 },
    tavan: 800,

    // Kasada bundan az coin varsa soygun girişimi olmaz (boş kasaya girilmez)
    enAz: 200,

    // Müdahale penceresi: kasa kartındaki düğmeye saldırgan dışındaki herkes basabilir, ilk basan yakalar.
    pencere: 60 * 1000,

    // Kasa soyulduktan sonra kasada para birikmesi için bekleme; yoksa tek kasa sırayla boşaltılır.
    bekleme: 2 * 60 * 60 * 1000,

    // Yakalatan üyeye kasadan ödenen ikramiye: ihbar edenin de kazancı olsun
    ikramiye: 100,
  },

  // Yakalanma olasılığı: taban + (direnenin seviyesi − saldırganın seviyesi) × seviyeFarki, [min, max] arasında.
  // Yüksek seviyeli üye hem kendini korur hem kasayı korur; seviye burada paranın yanı sıra itibar da olur.
  yakalanma: { taban: 0.6, seviyeFarki: 0.02, min: 0.35, max: 0.9 },

  // Yakalananın kasaya yatırdığı coin, yattığı süre ve hapisten erken çıkmak için ödediği kefalet.
  // Kefalet de kasaya yazılır: cezaevinden çıkan para sistemde kalır ama üyenin cebinden çıkar.
  ceza: { uye: 150, kasa: 400 },
  hapis: { uye: 20 * 60 * 1000, kasa: 60 * 60 * 1000 },
  kefalet: { uye: 350, kasa: 900 },

  // Sayfanın "son girişimler" listesi ve kayıt defterinin tuttuğu satır sayısı
  sicilGoster: 3,
  sicilTut: 40,
};
