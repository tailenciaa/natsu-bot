// Evlilik (src/systems/evlilik): /evlilik durum sayfası, kanala düşen teklif kartı, kabul/ret/süre sonuç
// kartları, çiftler listesi ve reddetmeler.
// Sayfadaki hiçbir sayı elle kurulmaz: bakiye, elde duran yüzük, ölçülen seviye, hapis ve evlilik kaydı gerçek
// store'lara yazılır, sonra sayfanın kendi okuma kapısından (index.durumOf / durumPaneli) geçirilir. Çift rolünün
// görünmesi de gerçek config okumasıdır: roleId yazılırsa kartta ve kurallar satırında durur, boşsa kalkar.
// Boş liste perdesi evlilikler kurulmadan ÖNCE çizilir; container'lar dosya yüklenirken hazırlandığı için sıra önemli.
// db.init() çağrılmadığı için save() hiçbir yere dokunmaz.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/evlilik/config');
  const store = src('systems/evlilik/store');
  const p = src('systems/evlilik/ui');
  const evlilik = src('systems/evlilik');
  const butikStore = src('systems/butik/store');
  const butikConfig = src('systems/butik/config');
  const coinStore = src('systems/coin/store');
  const seviyeStore = src('systems/seviye/store');
  const seviyeConfig = src('systems/seviye/config');
  const sucStore = src('systems/hirsizlik/store');
  const { coin } = src('systems/coin/ui');

  const noMentions = { allowedMentions: { parse: [] } };
  const DAY = mock.DAY;
  const HOUR = mock.HOUR;

  const kartCase = (id, title, where, kart, visibility = 'public') => ({
    id,
    title,
    where,
    visibility,
    kind: 'message',
    build: () => ({ components: [kart], flags: visibility === 'ephemeral' ? ui.EPHEMERAL_CV2 : ui.CV2, ...noMentions }),
  });

  const hataCase = (id, title, where, message, note) =>
    kartCase(id, title, where, ui.alert(message, note, 'danger'), 'ephemeral');

  // ── Senaryo üyeleri ────────────────────────────────────────────────────────
  const uye = ({ ad, seviye = 0, para = 0, yuzuk = 0, hapis = 0 }) => {
    const user = mock.user({ username: ad.toLocaleLowerCase('tr'), displayName: ad });
    const uid = user.id;
    if (seviye) seviyeStore.addXp('mesaj', uid, seviyeConfig.xpForLevel(seviye));
    if (para) coinStore.add(uid, para, 'önizleme cüzdanı');
    if (yuzuk) butikStore.ekle(butikConfig.yuzuk.key, uid, yuzuk);
    if (hapis) sucStore.hapisVer(uid, hapis, 'uye');
    return { user, uid };
  };

  const yeni = uye({ ad: 'Elif', seviye: 2, para: 180 });
  const aday = uye({ ad: 'Kaan', seviye: 14, para: 5200, yuzuk: 1 });
  const giden = uye({ ad: 'Deniz', seviye: 9, para: 800 });
  const gelen = uye({ ad: 'Ece', seviye: 11, para: 640 });
  const tutuklu = uye({ ad: 'Sinan', seviye: 20, para: 900, yuzuk: 1, hapis: 2 * HOUR });
  const bosanan = uye({ ad: 'Berk', seviye: 18, para: 300 });
  const bosananinEsi = uye({ ad: 'Cem', seviye: 15, para: 700 });
  const zeynep = uye({ ad: 'Zeynep', seviye: 22, para: 2100 });
  const mert = uye({ ad: 'Mert', seviye: 19, para: 1500 });
  const ayse = uye({ ad: 'Ayşe', seviye: 7, para: 260 });
  const can = uye({ ad: 'Can', seviye: 8, para: 410 });

  const etki = (member) => mock.interaction({ user: member.user });
  const sayfa = (member, feedback) => evlilik.durumPaneli(etki(member), feedback);

  // ── Boş liste: hiçbir evlilik yokken çizilmeli ─────────────────────────────
  const listeBos = evlilik.listePaneli(etki(yeni));

  // ── Kayıtlar: teklif, evlilikler ve bir boşanma gerçek yazım kapılarından geçer
  store.teklifKaydet({
    oneren: giden.uid,
    hedef: gelen.uid,
    no: 'oniz1',
    sonAt: Date.now() + config.teklif.pencere,
    kanal: '1',
  });
  store.evlendir(zeynep.uid, mert.uid, mock.ago(8 * DAY));
  store.evlendir(ayse.uid, can.uid, mock.ago(2 * HOUR));
  store.bosan(bosanan.uid, bosananinEsi.uid, mock.ago(DAY));

  // ── Çift rolü config'i: önce ID'li perde, sonra ID'siz hâli ────────────────
  const rolId = mock.id();
  config.roles.evli = rolId;
  const durumRolu = sayfa(zeynep);
  const evlilikKartiRol = p.evlilikKarti({ oneren: giden.uid, hedef: gelen.uid, user: giden.user, roleId: rolId });
  config.roles.evli = null;

  const evlilikKarti = p.evlilikKarti({ oneren: giden.uid, hedef: gelen.uid, user: giden.user, roleId: null });

  return [
    // ── Kişinin kendi hâl sayfası ─────────────────────────────────────────────
    kartCase(
      'durum-yeni',
      'Evlilik sayfası: seviyesi ve yüzüğü olmayan yeni üye, iki kapı da kapalı',
      '/evlilik durum komutu',
      sayfa(yeni),
    ),
    kartCase(
      'durum-hazir',
      'Evlilik sayfası: yüzük elde, seviye geçmiş, teklif götürmeye hazır',
      '/evlilik durum komutu',
      sayfa(aday),
    ),
    kartCase(
      'durum-giden',
      'Evlilik sayfası: uzatılan teklif ve ondan vazgeçme düğmesi',
      '/evlilik durum komutu (teklif götüren üyede)',
      sayfa(giden),
    ),
    kartCase(
      'durum-gelen',
      'Evlilik sayfası: sana uzanan teklif, yanıtın kanalda duran karttan verildiği',
      '/evlilik durum komutu (muhatapta)',
      sayfa(gelen),
    ),
    kartCase(
      'durum-evli-rol',
      'Evlilik sayfası: evli üye, yıl dönümü ödülü hazır ve çift rolü verilmiş',
      'Aynı sayfa, config\'de evli rolü ID\'si doluysa',
      durumRolu,
    ),
    kartCase(
      'durum-evli',
      'Evlilik sayfası: evli üye, rol sunucuda henüz hazır olmadığı için kural satırı da bunu söylüyor',
      '/evlilik durum komutu',
      sayfa(mert),
    ),
    kartCase(
      'durum-iceride',
      'Evlilik sayfası: hapisteki üye, teklif kapısı cezaevi satırıyla kapalı',
      'Aynı sayfa, içerideki üyede',
      sayfa(tutuklu),
    ),
    kartCase(
      'durum-bosanma',
      'Evlilik sayfası: boşanma sonrası aynı mesajda geri bildirim ve iki tarafa yazılan bekleme',
      'Boşan düğmesinden sonra aynı sayfa',
      sayfa(bosanan, `Boşandın: ${coin(config.bosanma.price)} kasaya yazıldı.`),
    ),

    // ── Kanalda duran teklif kartı ────────────────────────────────────────────
    kartCase(
      'teklif',
      'Teklif kartı: iki isim, yanıt süresi ve kabul/ret düğmeleri kanalda',
      '/evlilik teklif kullanici:@ece sonrası kanalda',
      p.teklif({ oneren: giden.user, hedef: gelen.user, no: 'oniz1', sonAt: Date.now() + config.teklif.pencere }),
    ),

    // ── Sonuç kartları: teklif kartının yerini alırlar ────────────────────────
    kartCase(
      'sonuc-evlilik',
      'Evlilik ilanı: yüzük kabul anında yakıldı, çift rolü yoksa satır hiç yazılmıyor',
      'Kabul Ediyorum düğmesiyle kartın yerini alır',
      evlilikKarti,
    ),
    kartCase(
      'sonuc-evlilik-rol',
      'Evlilik ilanı: config\'de çift rolü hazır, kartta rolün etiketi de duruyor',
      'Aynı kart, rol ID\'si doldurulmuş sunucuda',
      evlilikKartiRol,
    ),
    kartCase(
      'sonuc-ret',
      'Ret kartı: yüzük yanmadı, elde kaldı',
      'Geri Çevir düğmesiyle kartın yerini alır',
      p.retKarti({ oneren: giden.uid, hedef: gelen.uid, user: gelen.user }),
    ),
    kartCase(
      'sonuc-sure',
      'Süre doldu kartı: karşılık gelmeyen teklif kendiliğinden kapanır',
      'Bekçi, yanıtsız kalan kartın yerini alır',
      p.sureKarti({ oneren: giden.uid, hedef: gelen.uid, user: giden.user }),
    ),
    kartCase(
      'sonuc-gecersiz',
      'Teklif geçersiz: kabul geldi ama elde yüzük kalmamış, hiçbir şey kaydedilmedi',
      'Kabul anında yüzük bulunamayınca kartın yerini alır',
      p.gecersizKarti({ oneren: giden.uid, hedef: gelen.uid, user: gelen.user }),
    ),
    kartCase(
      'sonuc-iptal',
      'Teklif geri çekildi: vazgeçen üye yüzüğünü de koruyor',
      'Tekliften Vazgeç düğmesinden sonra kanalda',
      p.iptalKarti({ oneren: giden.uid, hedef: gelen.uid, user: giden.user }),
    ),
    kartCase(
      'sonuc-bosanma',
      'Boşanma ilanı: bedel Devletin Kasasına yazıldı, iki tarafa bekleme kondu',
      'Boşan düğmesinden sonra sayfayı izleyen açık kart',
      p.bosanmaKarti({ a: zeynep.uid, b: mert.uid, user: zeynep.user, bedel: config.bosanma.price }),
    ),
    kartCase(
      'sonuc-donum',
      'Yıl dönümü: ödül her iki tarafa birden yatar, sıradaki dönüm yazılır',
      'Yıl Dönümü Ödülü düğmesinden sonra sayfayı izleyen açık kart',
      p.yilDonumuKarti({
        a: zeynep.uid,
        b: mert.uid,
        odul: config.yilDonumu.odul,
        sayi: 2,
        sonrakiAt: Date.now() + config.yilDonumu.gun * DAY,
        user: zeynep.user,
      }),
    ),

    // ── Çiftler listesi ───────────────────────────────────────────────────────
    kartCase('liste', 'Sunucudaki çiftler: en yeni evlilik üstte, birlikte geçen gün', '/evlilik liste komutu', evlilik.listePaneli(etki(aday))),
    kartCase('liste-bos', 'Sunucudaki çiftler: henüz evlenen olmamış', 'Aynı sayfa, sunucu boşken', listeBos),

    // ── Reddetmeler ───────────────────────────────────────────────────────────
    hataCase(
      'hata-yuzuk',
      'Reddetme: teklifin tek şartı olan yüzük elde yok',
      '/evlilik teklif denemesinde',
      'Cüzdanında yüzük yok.',
      `Evliliğin tek şartı yüzük: ${coin(butikConfig.yuzuk.price)}. Almak için /bakiye > Butik.`,
    ),
    hataCase(
      'hata-seviye',
      'Reddetme: sunucuda henüz az vakit geçirmiş üye teklif götüremiyor',
      '/evlilik teklif denemesinde',
      'Teklif için seviyen düşük.',
      `Teklif götürmek için seviye ${config.teklif.minSeviye} gerekir, senin seviyen ${evlilik.durumOf(yeni.uid, yeni.user).seviye}.`,
    ),
    hataCase(
      'hata-hapis',
      'Reddetme: içerideki üye evlilik teklifi götüremez',
      '/evlilik teklif denemesinde',
      'İçerideyken teklif götürülmez.',
      `Tahliyen ${ui.rel(evlilik.durumOf(tutuklu.uid, tutuklu.user).hapista)} içinde; sonra /evlilik teklif yaz.`,
    ),
    hataCase(
      'hata-evli',
      'Reddetme: evli üye yeni teklif götüremez',
      '/evlilik teklif denemesinde',
      'Zaten evlisin.',
      'Yeni teklif götüremezsin; /evlilik durum ile kendi hâline bakabilirsin.',
    ),
    hataCase(
      'hata-bekleyen',
      'Reddetme: elde zaten yanıtsız bir teklif var',
      'İkinci /evlilik teklif denemesinde',
      'Bekleyen bir teklifin zaten var.',
      '/evlilik durum sayfasından vazgeçebilir ya da yanıtı bekleyebilirsin.',
    ),
    hataCase(
      'hata-hedef-evli',
      'Reddetme: seçilen üye başka biriyle evli',
      '/evlilik teklif kullanici:@mert denemesinde',
      'Bu üye zaten evli.',
      'Sunucudaki çiftleri /evlilik liste ile görebilirsin.',
    ),
    hataCase(
      'hata-bosanma-bekleme',
      'Reddetme: boşanan üye kısa süre yeni teklif götüremez',
      '/evlilik teklif denemesinde',
      'Boşandıktan sonra kısa bir süre teklif götüremezsin.',
      `Sıradaki teklif ${ui.rel(evlilik.durumOf(bosanan.uid, bosanan.user).bosanmaBekleme)} içinde açılır.`,
    ),
    hataCase(
      'hata-baska-teklif',
      'Reddetme: kabul düğmesi yalnızca muhatabındır',
      'Başkasına uzanan teklif kartının düğmesine basınca',
      'Bu teklif sana uzanmadı.',
      'Kabul düğmesi yalnızca muhatabın içindir.',
    ),
    hataCase(
      'hata-bedel',
      'Reddetme: boşanma bedeli cüzdana sığmıyor, evlilik yerinde duruyor',
      'Evli ama parası yetersiz üyenin Boşan düğmesinde',
      'Boşanma bedeli cüzdanına sığmıyor.',
      `Bedel ${coin(config.bosanma.price)}, cebinde ${coin(coinStore.balance(can.uid))} var. Evliliğin yerinde duruyor.`,
    ),
    hataCase(
      'hata-sonuclanmis',
      'Reddetme: kart zaten sonuçlanmış, düğme eski hâlde kalmış',
      'Eski bir teklif kartının düğmesine basınca',
      'Bu teklif zaten sonuçlanmış.',
      '/evlilik durum ile kendi hâline bakabilirsin.',
    ),
    hataCase(
      'hata-sahip',
      'Reddetme: boşanma düğmesi başkasının sayfasında çalışmaz',
      'Başkasının evlilik sayfasındaki Boşan düğmesi',
      'Bu menüyü sadece komutu kullanan kişi gezebilir.',
      null,
    ),
  ];
};
