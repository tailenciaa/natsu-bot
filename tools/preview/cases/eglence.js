// Eğlence katmanı (src/systems/eglence): /öp ve /tokat ile atılan şaka kartları, karşılık ve karşılıksız sonuç kartları.
// Sayfadaki hiçbir coin sayısı elle kurulmaz: ödüller gerçek yazım kapısından (coin/store.addWin) geçer, kartta
// okunan "cebine yatan" gerçekten yalandır; tavan doluysa kesinti de yine gerçek ölçümdür. Kartların sayısı,
// ikilinin bekleme süresi ve kota gerçek store'a yazılır, sonra store'un kendi okumasından (durumOf, ikiliBekleme)
// çıkarılır. Yalnızca zarın yüzü (ödül tutarı) senaryo seçimidir; canlıda o çekiliş rastgeledir.
// db.init() çağrılmadığı için save() hiçbir yere dokunmaz.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/eglence/config');
  const store = src('systems/eglence/store');
  const u = src('systems/eglence/ui');
  const coinStore = src('systems/coin/store');
  const coinConfig = src('systems/coin/config');

  const noMentions = { allowedMentions: { parse: [] } };

  const uye = ({ ad }) => {
    const user = mock.user({ username: ad.toLocaleLowerCase('tr'), displayName: ad });
    return { user, uid: user.id };
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

  // Atılan kart: kart numarası custom_id'de taşınır, süre penceresi config'den okunur
  const kartAc = (vuran, hedef, anahtar, sonAt = Date.now() + config.pencere, no) =>
    store.kartKaydet({
      no: no ?? `oniz-${anahtar}-${vuran.uid}`,
      eylem: anahtar,
      saldirgan: vuran.uid,
      hedef: hedef.uid,
      sonAt,
    });

  // Karşılık geldi: iki tarafın ödülü gerçek tavana sayılarak ödenir, sayılar karttan sonra okunur
  const karsilikOdeme = (g, tutarSaldirgan, tutarHedef) => {
    const saldirgan = coinStore.addWin(g.saldirgan, tutarSaldirgan, 'eğlence karşılığı');
    const hedef = coinStore.addWin(g.hedef, tutarHedef, 'eğlence karşılığı');
    store.karsilikSonuclandir(g, saldirgan.odenen, hedef.odenen);
    return { saldirgan, hedef };
  };

  // ── Senaryo üyeleri ────────────────────────────────────────────────────────
  const zal = uye({ ad: 'Kerem' });
  const nazli = uye({ ad: 'Ayşe' });
  const kavgaci = uye({ ad: 'Deniz' });
  const barisik = uye({ ad: 'Ece' });
  const serti = uye({ ad: 'Barış' });
  const tavandaki = uye({ ad: 'Merve' });
  const sabirsiz = uye({ ad: 'Sinan' });
  const umursamaz = uye({ ad: 'Tuana' });
  const ikiliA = uye({ ad: 'Umut' });
  const ikiliB = uye({ ad: 'Ceren' });
  const hircin = uye({ ad: 'Zeynep' });
  const yedek = uye({ ad: 'Kaan' });

  // Merve günün oyun tavanını bitirmiş olsun: karşılık ödülü doğduğu yerde kesilsin
  coinStore.addWin(tavandaki.uid, coinConfig.winCap, 'önizleme tavan doldurma');

  // ── Karşılık bekleyen kartlar ──────────────────────────────────────────────
  const opKart = kartAc(zal, nazli, 'op');
  const tokatKart = kartAc(sabirsiz, umursamaz, 'tokat');

  // ── Sonuçlanacak kartlar ───────────────────────────────────────────────────
  const karsilikGirisim = kartAc(kavgaci, barisik, 'op');
  const karsilikOdemeSonuc = karsilikOdeme(karsilikGirisim, 25, 35);

  const kesintiGirisim = kartAc(serti, tavandaki, 'tokat');
  const kesintiOdeme = karsilikOdeme(kesintiGirisim, 40, 20);

  // Süresi geçmiş kart: muhatap düğmeye son anda basar, kart ödül vermeden kapanır
  const karsizGirisim = kartAc(zal, umursamaz, 'op', mock.ago(mock.MIN), 'oniz-karsiz');
  store.karsizSonuclandir(karsizGirisim);

  // İkili bekleme: bu ikili yeni kart açtı, ardındaki deneme reddedilir — süre store'un kendi okumasından gelir
  kartAc(ikiliA, ikiliB, 'tokat');
  const ikiliBekleme = store.ikiliBekleme(ikiliA.uid, ikiliB.uid);

  // Kota: günün kartları tek tek gerçek yazım kapısından geçer, kalan hakkı sayfa değil sayaç söyler
  for (let i = 0; i < config.gunlukKart; i += 1) {
    const g = store.kartKaydet({
      no: `oniz-kota-${i}`,
      eylem: 'op',
      saldirgan: hircin.uid,
      hedef: yedek.uid,
      sonAt: Date.now() + config.pencere,
    }, mock.ago((i + 1) * mock.MIN));
    store.kartKapat(g.no);
  }
  const kotaDurum = store.durumOf(hircin.uid);

  const cases = [
    kartCase(
      'kart-op',
      'Şaka kartı: öpücük, karşılık düğmesi ve süre penceresi',
      '/öp kullanici:@ayşe sonrası kanalda',
      u.kart({ eylem: 'op', saldirgan: zal.user, hedef: nazli.user, girisimNo: opKart.no, sonAt: opKart.sonAt }),
    ),
    kartCase(
      'kart-tokat',
      'Şaka kartı: tokat, ödül aralığı ve muhatabın düğmesi',
      '/tokat kullanici:@tuana sonrası kanalda',
      u.kart({ eylem: 'tokat', saldirgan: sabirsiz.user, hedef: umursamaz.user, girisimNo: tokatKart.no, sonAt: tokatKart.sonAt }),
    ),
    kartCase(
      'sonuc-karsilik',
      'Sonuç kartı: karşılık geldi, ödül iki tarafa da yattı',
      'Muhatap karşılık düğmesine bastığında kartın yerini alır',
      u.karsilikSonuc({
        eylem: 'op',
        saldirgan: { id: kavgaci.uid },
        hedef: barisik.user,
        odenenSaldirgan: karsilikOdemeSonuc.saldirgan.odenen,
        odenenHedef: karsilikOdemeSonuc.hedef.odenen,
        kesinti: false,
        user: barisik.user,
      }),
    ),
    kartCase(
      'sonuc-kesinti',
      'Sonuç kartı: karşılık geldi ama muhatabın günlük tavanı doluydu, ödülü cebine girmedi',
      'Tavanını doldurmuş üyenin karşılık kartında',
      u.karsilikSonuc({
        eylem: 'tokat',
        saldirgan: { id: serti.uid },
        hedef: tavandaki.user,
        odenenSaldirgan: kesintiOdeme.saldirgan.odenen,
        odenenHedef: kesintiOdeme.hedef.odenen,
        kesinti: kesintiOdeme.hedef.kesilen > 0,
        user: tavandaki.user,
      }),
    ),
    kartCase(
      'sonuc-karsiz',
      'Sonuç kartı: süre doldu, kart karşılıksız kapandı',
      'Süresi geçmiş kartın düğmesine basıldığında kartın yerini alır',
      u.karsizSonuc({
        eylem: 'op',
        saldirgan: { id: zal.uid },
        hedef: umursamaz.user,
        user: umursamaz.user,
      }),
    ),

    // ── Reddetmeler ──────────────────────────────────────────────────────────
    hataCase(
      'hata-sunucu',
      'Reddetme: şaka sunucu dışında atılmaz',
      'DM’den kullanılan /öp komutunda',
      'Şakalar sunucuda atılır.',
      'Komutu bir sunucu içinde tekrar dene.',
    ),
    hataCase(
      'hata-uye',
      'Reddetme: seçilen üye bu sunucuda değil',
      '/tokat kullanici:... ile sunıcı dışı üye seçildiğinde',
      'Seçtiğin üye bu sunucuda değil.',
      '/tokat kullanici:... ile sunucudan bir üye seç.',
    ),
    hataCase(
      'hata-bot',
      'Reddetme: botlar şaka hedefi olmaz',
      '/öp kullanici:@bot seçildiğinde',
      'Botlar şaka hedefi olmaz.',
      'Bir üye seç.',
    ),
    hataCase(
      'hata-kendine',
      'Reddetme: üye kendine şaka atamaz',
      '/tokat kullanici:kendini seçtiğinde',
      'Kendine şaka atamazsın.',
      'Karşılık düğmesi başkasının kartındır; bir üye seç.',
    ),
    hataCase(
      'hata-kota',
      'Reddetme: günün şaka kartları bitti',
      `${config.gunlukKart}. karttan sonraki /öp denemesinde`,
      'Bugünkü şaka kartların doldu.',
      `Günde ${config.gunlukKart} kart atabilirsin; gece sıfırlanır. Kumarhane ve sokaklar açık.`,
    ),
    hataCase(
      'hata-ikili',
      'Reddetme: aynı ikili az önce şakalaştı',
      'İkinci /tokat denemesinde',
      'Bu üyeyle az önce şakalaştın.',
      `Aynı ikili arasında ${ui.rel(ikiliBekleme)} içinde yeni kart açılabilir.`,
    ),
    hataCase(
      'hata-kart-yok',
      'Reddetme: kart çoktan sonuçlandı',
      'Sonuçlanmış bir kartın düğmesine basıldığında',
      'Bu kart artık açık değil.',
      '/öp ya da /tokat ile yeni bir kart atabilirsin.',
    ),
    hataCase(
      'hata-muhap',
      'Reddetme: karşılık düğmesi yalnızca muhatabın',
      'Kartta yazmayan bir üye düğmeye bastığında',
      'Bu düğme yalnızca muhatabın içindir.',
      'Karşılık kartı atan kişi değil, muhatap verir.',
    ),
    hataCase(
      'hata-dugme',
      'Reddetme: tanınmayan eğlence düğmesi',
      'Eski bir mesajın bozuk düğmesinde',
      'Bu düğme artık kullanılamıyor.',
      '/öp ya da /tokat ile yeni bir kart atabilirsin.',
    ),
  ];

  return cases;
};
