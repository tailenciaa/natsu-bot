// Suç Dünyası (src/systems/hirsizlik): Arka Sokaklar sayfası, pusu kartları, sonuç kartları, hapis ve reddetmeler.
// Sayfadaki hiçbir sayı elle kurulmaz: hapis, kasa, kota ve sicil gerçek store'a yazılır, sonra sayfanın kendi
// okuma kapısından (index.durumOf) geçirilir. Pusu kartlarının risk tutarı da kurbanın gerçek bakiyesinden
// hesaplanır. Yalnızca zarın yüzü (yakalanma/oran) senaryo seçimidir; canlıda o çekiliş rastgeledir.
// db.init() çağrılmadığı için save() hiçbir yere dokunmaz.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/hirsizlik/config');
  const store = src('systems/hirsizlik/store');
  const p = src('systems/hirsizlik/ui');
  const suc = src('systems/hirsizlik');
  const oyun = src('systems/oyun');
  const coinStore = src('systems/coin/store');
  const seviyeStore = src('systems/seviye/store');
  const seviyeConfig = src('systems/seviye/config');
  const { number, coin } = src('systems/coin/ui');

  const noMentions = { allowedMentions: { parse: [] } };

  const uye = ({ ad, seviye = 0, coin = 0 }) => {
    const user = mock.user({ username: ad.toLocaleLowerCase('tr'), displayName: ad });
    const uid = user.id;
    if (seviye) seviyeStore.addXp('mesaj', uid, seviyeConfig.xpForLevel(seviye));
    if (coin) coinStore.add(uid, coin, 'önizleme senaryosu');
    return { user, uid };
  };

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

  const sayfa = (member, feedback) => suc.durumOf(member.uid, feedback);

  // ── Senaryo üyeleri ────────────────────────────────────────────────────────
  const yeni = uye({ ad: 'Elif', coin: 240 });
  const mafya = uye({ ad: 'Kaan', seviye: 28, coin: 3100 });
  const kurban = uye({ ad: 'Deniz', seviye: 19, coin: 2400 });
  const tutuklu = uye({ ad: 'Sinan', seviye: 16, coin: 900 });
  const tanik = uye({ ad: 'Ece', seviye: 31, coin: 1500 });

  // Kasa cezalarla birikmiş olsun: topluluk sayfasında gerçek bir kasa rakamı dursun
  store.kasaEkle(905);

  // Kaan'ın geçmişi: girişimler gerçek sayaca yazılır, kartları kapatıldıktan sonra sicilde kalır.
  // soyulan zarın yüzüdür: canlıda oran rastgele çekilir, burada senaryonun seçtiği sonuç yazılır.
  const soyulan = 380;
  store.girisimKaydet({ id: 'oniz1', tip: 'uye', saldirgan: mafya.uid, hedef: kurban.uid, kanal: '1', sonAt: mock.ago(2 * mock.MIN) }, mock.ago(4000));
  store.girisimKapat('oniz1');
  store.girisimKaydet({ id: 'oniz2', tip: 'kasa', saldirgan: mafya.uid, hedef: null, kanal: '1', sonAt: mock.ago(60 * mock.MIN) }, mock.ago(6 * mock.MIN));
  store.girisimKapat('oniz2');
  store.basariKaydet(mafya.uid, soyulan);
  store.basariKaydet(mafya.uid, 240);
  store.yakalanmaKaydet(mafya.uid);
  store.kayipKaydet(mafya.uid, 120, mock.ago(1000));
  store.direnisKaydet(mafya.uid, mock.ago(1000));

  // Toplum kayıt defteri: sayfada görünecek üç satır gerçek yazım kapısından geçer
  store.sicilEkle({ tip: 'uye', saldirgan: mafya.uid, saldirganAd: 'Kaan', hedef: kurban.uid, hedefAd: 'Deniz', sonuc: 'direnç olmadı, coin el değiştirdi', miktar: soyulan, at: mock.ago(40 * mock.MIN) });
  store.sicilEkle({ tip: 'uye', saldirgan: kurban.uid, saldirganAd: 'Deniz', hedef: mafya.uid, hedefAd: 'Kaan', sonuc: 'direnildi, saldırgan yakalandı', miktar: 0, at: mock.ago(25 * mock.MIN) });
  store.sicilEkle({ tip: 'kasa', saldirgan: tanik.uid, saldirganAd: 'Ece', hedef: null, hedefAd: 'Devletin Kasası', sonuc: 'kefalet ödeyip tahliye oldu', miktar: config.kefalet.kasa, at: mock.ago(6 * mock.MIN) });

  // Mert sokağa yeni çıkmış: üye soyabiliyor ama kasaya henüz erişemiyor, tek girişiminden sonra beklemede
  const yarim = uye({ ad: 'Mert', seviye: 8, coin: 760 });
  store.girisimKaydet({ id: 'oniz3', tip: 'uye', saldirgan: yarim.uid, hedef: kurban.uid, kanal: '1', sonAt: mock.ago(28 * mock.MIN) }, mock.ago(2 * mock.MIN));
  store.girisimKapat('oniz3');
  store.direnisKaydet(kurban.uid, mock.ago(2 * mock.MIN));

  // Sinan kasaya zorlamaktan yakalandı: içerideki üyenin sayfasında kefalet düğmesi doğar
  store.hapisVer(tutuklu.uid, config.hapis.kasa, 'kasa', mock.ago(6 * mock.MIN));

  // Berk kefaletini ödeyip tahliye oldu: hapis gerçek kapıdan kurulur, para coin kuralıyla kasaya yazar,
  // sonra tahliye de store'un kendi kapısından temizlenir. Sayfa o üyenin okumasından gelir.
  const serbest = uye({ ad: 'Berk', seviye: 21, coin: 1200 });
  store.hapisVer(serbest.uid, config.hapis.uye, 'uye', mock.ago(9 * mock.MIN));
  const bedel = store.kefaletBedeli(serbest.uid);
  coinStore.spend(serbest.uid, bedel);
  store.kasaEkle(bedel);
  store.hapisBitir(serbest.uid);

  // Onur da içeride ama kefaleti karşılayacak parası yok: bedel, bakiye ve tahliye saati gerçek okumadan gelir
  const gariban = uye({ ad: 'Onur', seviye: 18, coin: 120 });
  store.hapisVer(gariban.uid, config.hapis.kasa, 'kasa', mock.ago(4 * mock.MIN));
  const garibanDurum = suc.durumOf(gariban.uid);
  const iceride = suc.durumOf(tutuklu.uid);

  // Sonucu yazılmamış bir kasa soygunu: dağılan para kasadan gerçekten düşsün ki sonuç kartındaki
  // "Kasadan Çıkan" ile "Kalan Kasa" birbirini tutmasın
  const kasaGanimeti = 600;
  store.kasaDus(kasaGanimeti);

  // ── Arka Sokaklar sayfası ─────────────────────────────────────────────────
  const cases = [
    kartCase(
      'sokak-yeni',
      'Suç sayfası: hiç geçmişi olmayan üye, kasa dolu',
      '/sokak komutunun açtığı sayfa',
      p.panel(sayfa(yeni)),
    ),
    kartCase(
      'sokak-suclu',
      'Suç sayfası: girişi, başarısı ve kaybı olan üye, son kayıt listesi dolu',
      'Aynı sayfa sicil birikmiş üyede',
      p.panel(sayfa(mafya)),
    ),
    kartCase(
      'sokak-kapidan',
      'Suç sayfası: seviyesi üyeye ama kasaya yetmeyen üye, iki kapı ayrı sayılır',
      '/sokak komutunun açtığı sayfa (orta seviye)',
      p.panel(sayfa(yarim)),
    ),
    kartCase(
      'sokak-iceride',
      'Suç sayfası: içerideki üye, kefalet düğmesi açık',
      'Kasaya zorlamadan yakalanan üyede',
      p.panel(sayfa(tutuklu)),
    ),
    kartCase(
      'sokak-kefalet',
      'Suç sayfası: kefalet ödendikten sonra aynı mesajda geri bildirim',
      'Kefalet Ver düğmesinden sonra aynı sayfa',
      p.panel(sayfa(serbest, `**Kefalet ödendi:** ${coin(bedel)} kasaya yazıldı ve tahliye oldun.`)),
    ),

    // ── Pusu kartları ────────────────────────────────────────────────────────
    kartCase(
      'pusu-uye',
      'Pusu kartı: kurbanın direnme düğmesi, süre ve risk tavanı',
      '/çal uye kullanici:@deniz sonrası kanalda',
      p.pusu({
        saldirgan: mafya.user,
        hedef: kurban.user,
        girisimId: 'oniz9',
        sonAt: Date.now() + config.uye.pencere,
        risk: p.riskHesabi(coinStore.balance(kurban.uid)),
      }),
    ),
    kartCase(
      'pusu-kasa',
      'Pusu kartı: kasa zorlaması, herkese açık müdahale düğmesi ve ikramiye',
      '/çal kasa sonrası kanalda',
      p.kasaPusu({
        saldirgan: kurban.user,
        girisimId: 'oniz8',
        sonAt: Date.now() + config.kasa.pencere,
        kasa: store.kasa(),
      }),
    ),

    // ── Sonuç kartları ───────────────────────────────────────────────────────
    kartCase(
      'sonuc-direnildi',
      'Sonuç kartı: direnç işe yaradı, saldırgan yakalandı ve cezasını ödedi',
      'Kurban Diren düğmesine bastığında pusu kartının yerini alır',
      p.sonuc({
        title: 'Direnç İşe Yaradı',
        sub: `<@${kurban.uid}> zamanında direndi; <@${mafya.uid}> yakalandı ve cezasını kasaya yatırdı.`,
        user: kurban.user,
        accent: 'success',
        pairs: [
          ['Saldırgan', `<@${mafya.uid}>`],
          ['Kurban', `<@${kurban.uid}>`],
          ['Yakalanma Şansı', `%${Math.round(config.yakalanma.taban * 100)}`],
          ['Ceza', `${number(config.ceza.uye)} coin`],
          ['Hapis', p.sure(config.hapis.uye)],
        ],
        note: 'Direnç kurbanı dokunulmaz yapar; soyguncu bir süre daha aynı üyeyi hedef alamaz.',
      }),
    ),
    kartCase(
      'sonuc-soygun',
      'Sonuç kartı: kurban direnmedi, coin el değiştirdi',
      'Bekçi süresi dolan pusuyu sonuçlandırdığında kanalda',
      p.sonuc({
        title: 'Soygun Gerçekleşti',
        sub: `<@${mafya.uid}> kimse direnmeyince <@${kurban.uid}> adlı üyenin cüzdanından ${number(380)} coin aldı.`,
        user: mafya.user,
        accent: 'danger',
        pairs: [
          ['Saldırgan', `<@${mafya.uid}>`],
          ['Kurban', `<@${kurban.uid}>`],
          ['El Değiştiren', `${number(380)} coin`],
          ['Kurbanın Dokunulmazlığı', ui.rel(Date.now() + config.dokunulmazlik)],
        ],
        note: 'Kurban artık dokunulmaz; bir süre daha aynı üyeyi hedef alamazsın.',
      }),
    ),
    kartCase(
      'sonuc-mudahale',
      'Sonuç kartı: müdahale edildi, kasa korundu ve ikramiye yattı',
      'İlk müdahale eden üye yakaladığında kartın yerini alır',
      p.sonuc({
        title: 'Kasa Korundu',
        sub: `<@${tanik.uid}> kasaya uzanan <@${kurban.uid}> adlı üyeyi yakaladı; ceza kasaya yazıldı.`,
        user: tanik.user,
        accent: 'success',
        pairs: [
          ['Saldırgan', `<@${kurban.uid}>`],
          ['Müdahale', `<@${tanik.uid}>`],
          ['Yakalanma Şansı', `%${Math.round(config.yakalanma.taban * 100)}`],
          ['Ceza', `${number(config.ceza.kasa)} coin`],
          ['Hapis', p.sure(config.hapis.kasa)],
          ['İkramiye', `${number(config.kasa.ikramiye)} coin`],
        ],
      }),
    ),
    kartCase(
      'sonuc-kasa',
      'Sonuç kartı: kasa soyuldu, kasada kalan ve tavan kesintisi',
      'Müdahale edilmeyen kasa girişiminde bekçi kartı anır',
      p.sonuc({
        title: 'Kasa Soyuldu',
        sub: `<@${mafya.uid}> kimse müdahale etmeyince Devletin Kasasından ${number(600)} coin aldı.`,
        user: mafya.user,
        accent: 'danger',
        pairs: [
          ['Saldırgan', `<@${mafya.uid}>`],
          ['Kasadan Çıkan', `${number(600)} coin`],
          ['Kalan Kasa', `${number(store.kasa())} coin`],
          ['Kesinti', `${number(0)} coin`],
        ],
        note: 'Kasadan çıkan coin cezalarla birikmiş paraydı; sistem yeni coin üretmedi.',
      }),
    ),

    // ── Salonun hapis perdesi ────────────────────────────────────────────────
    {
      id: 'oyun-hapiste',
      title: 'Oyun Salonu: içerideki üye, tüm oyun düğmeleri kilitli',
      where: 'Hapisteki üye /oyun ile sayfayı açtığında',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [oyun.panelFor({ user: tutuklu.user }, 'rulet')], flags: ui.CV2, ...noMentions }),
    },

    // ── Reddetmeler ──────────────────────────────────────────────────────────
    hataCase(
      'hata-seviye',
      'Reddetme: suç dünyası üyenin seviyesine kapalı',
      '/çal uye kullanan yeni hesapta',
      'Suç dünyası senin seviyene kapalı.',
      `Girişim için seviye ${config.minSeviye} gerekir, ölçülen seviyen ${suc.durumOf(yeni.uid).seviye}.`,
    ),
    hataCase(
      'hata-hapis',
      'Reddetme: içerideki üye yeni suç işleyemez',
      '/çal uye ya da /çal kasa denemesinde',
      'İçeridesin, yeni suç işleyemezsin.',
      `Tahliyen ${ui.rel(iceride.hapis)} içinde. Erken çıkmak için /sokak sayfasından kefalet ödeyebilirsin.`,
    ),
    hataCase(
      'hata-salon',
      'Reddetme: içerideki üye salonun oyununu oynayamaz',
      'Eski sayfadan basılan Kumsalda Gezi düğmesinde',
      'İçeridesin, salon kapalı.',
      `Tahliyen ${ui.rel(iceride.hapis)} içinde. Erken çıkmak için /sokak sayfasından kefalet ödeyebilirsin.`,
    ),
    hataCase(
      'hata-kota',
      'Reddetme: günün suç kotası doldu',
      'Dördüncü girişimden sonraki /çal denemesinde',
      'Bugünkü suç kotan doldu.',
      `Günde ${config.gunlukAdet} girişim yapabilirsin; gece sıfırlanır. Kumarhane açık.`,
    ),
    hataCase(
      'hata-dokunulmaz',
      'Reddetme: hedef üye yeni soyulduğu için korunuyor',
      'Dokunulmazlık süresinde /çal uye denemesinde',
      'Bu üye dokunulmaz.',
      `${ui.rel(suc.durumOf(mafya.uid).dokunulmaz)} kadar hedef olamaz; yeni soyulan ya da direnen üye bir süre korunur.`,
    ),
    hataCase(
      'hata-kasa-bos',
      'Reddetme: kasada soymalık para yok',
      'Kasa yeni boşaltılmışken /çal kasa denemesinde',
      'Kasa soyulacak kadar dolu değil.',
      `Kasada en az ${number(config.kasa.enAz)} gerekir; ceza ve kefalet gelirleriyle dolar.`,
    ),
    hataCase(
      'hata-acik-pusu',
      'Reddetme: elindeki pusu henüz sonuçlanmadı',
      'Açık kart varken ikinci /çal denemesinde',
      'Eline aldığın pusu henüz sonuçlanmadı.',
      'Kurban direnirse ya da süre dolarsa kart kendiliğinden sonuçlanır.',
    ),
    hataCase(
      'hata-kefalet-bakiye',
      'Reddetme: kefaleti karşılayacak coin yok',
      'İçerideki perişan üyenin Kefalet Ver düğmesinde',
      'Kefaleti karşılayacak coinin yok.',
      `Bedel ${number(garibanDurum.kefalet)}; cüzdanında ${number(coinStore.balance(gariban.uid))} coin var. Tahliye ${ui.rel(garibanDurum.hapis)} içinde kendiliğinden gelir.`,
    ),
  ];

  return cases;
};
