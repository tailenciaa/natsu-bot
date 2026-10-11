// Oyun Salonu (src/systems/oyun): üç sekmeli sayfa, ganimet satırları, büyük kazanç kartları ve reddetmeler.
// Panel durumları elle kurulmaz: senaryonun ölçüleri gerçek store'lara yazılır (coin bakiyesi, seviye XP'si,
// bahis, gezi sayacı, kumar sicili, masadaki tırmanış), sonra sayfanın kendi okuma kapısından (index.durumOf)
// geçirilir. Ganimet satırlarının sayıları da coin/store'un gerçek ödemesinden gelir; yalnızca bölge masasından
// hangi satırın çekildiği senaryo seçimidir, çünkü canlıda o çekiliş rastgeledir.
// db.init() çağrılmadığı için save() hiçbir yere dokunmaz.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/oyun/config');
  const store = src('systems/oyun/store');
  const p = src('systems/oyun/ui');
  const oyun = src('systems/oyun');
  const coinStore = src('systems/coin/store');
  const seviyeStore = src('systems/seviye/store');
  const seviyeConfig = src('systems/seviye/config');
  const { number } = src('systems/coin/ui');

  const noMentions = { allowedMentions: { parse: [] } };

  // Senaryo üyesi: seviyesi gerçek XP eğrisinden, bakiyesi ve oyun kazancı gerçek cüzdandan gelir
  const uye = ({ ad, seviye = 0, coin = 0, kazanilan = 0 }) => {
    const user = mock.user({ username: ad.toLocaleLowerCase('tr'), displayName: ad });
    const uid = user.id;
    if (seviye) seviyeStore.addXp('mesaj', uid, seviyeConfig.xpForLevel(seviye));
    if (coin) coinStore.add(uid, coin, 'önizleme senaryosu');
    if (kazanilan) coinStore.addWin(uid, kazanilan, 'önizleme oyunu');
    return { user, uid };
  };

  const panelCase = (state, id, title, where) => ({
    id,
    title,
    where,
    visibility: 'public',
    kind: 'message',
    build: () => ({ components: [p.panel(state)], flags: ui.CV2, ...noMentions }),
  });

  const hataCase = (id, title, where, message, note) => ({
    id,
    title,
    where,
    visibility: 'ephemeral',
    kind: 'message',
    build: () => ({ components: [ui.alert(message, note, 'danger')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
  });

  // ── Keşif ──────────────────────────────────────────────────────────────────
  const yeni = uye({ ad: 'Elif', coin: 640 });
  const kesifYeni = oyun.durumOf(yeni.uid, 'kesif');

  // Orta seviye: iki bölge açık, gezi yeni hazır, nadir bir kozmetik bulunmuş
  const kaan = uye({ ad: 'Kaan', seviye: 22, coin: 2100, kazanilan: 400 });
  store.kesifKaydet(kaan.uid, 'kasaba', mock.ago(45 * mock.MIN));
  store.kesifKaydet(kaan.uid, 'orman', mock.ago(30 * mock.MIN));
  const kozmetik = p.ganimetSatiri({ tur: 'kozmetik', name: 'Neon', nitelik: 'nadir' });
  const kesifBasari = oyun.durumOf(kaan.uid, 'kesif', `**Fısıltı Ormanı:** ${kozmetik}`);

  // Kota dolmuş: sekiz gezinin hepsi bugün yapılmış (gün anahtarı kaymasın diye hepsi aynı anın içinde)
  const derya = uye({ ad: 'Derya', seviye: 40, coin: 3400 });
  for (let i = 0; i < config.kesif.gunlukAdet; i++) {
    store.kesifKaydet(derya.uid, config.kesif.bolgeler[i % config.kesif.bolgeler.length].key);
  }
  const kesifKota = oyun.durumOf(derya.uid, 'kesif');

  // Tavan dolu: kazançlarının tamamı günlük tavana sayılmış, coin ganimeti cebine girmiyor
  const sinan = uye({ ad: 'Sinan', seviye: 22, coin: 520 });
  const bosEl = coinStore.addWin(sinan.uid, config.winCap, 'önizleme oyunu');
  const kesik = coinStore.addWin(sinan.uid, 180, 'keşif');
  const tavanDolu = oyun.durumOf(
    sinan.uid,
    'kesif',
    `**Kırık Mağara:** ${p.ganimetSatiri({ tur: 'coin', miktar: kesik.odenen, kesilen: kesik.kesilen, nitelik: 'degerli' })}`,
  );

  // ── Rulet ──────────────────────────────────────────────────────────────────
  const zeynep = uye({ ad: 'Zeynep', seviye: 6, coin: 1200 });
  const ruletBos = oyun.durumOf(zeynep.uid, 'rulet');

  const ali = uye({ ad: 'Ali', seviye: 31, coin: 4300 });
  store.setBahis(ali.uid, 500);
  store.elKaydet(ali.uid, { net: -500, odul: 0 });
  store.elKaydet(ali.uid, { net: -500, odul: 0 });
  store.elKaydet(ali.uid, { net: 500, odul: 1000 });
  const ruletKazan = oyun.durumOf(
    ali.uid,
    'rulet',
    `**Rulet:** ${config.rulet.renkler.siyah.ad} geldi. ${config.rulet.renkler.kirmizi.ad} tuttu: ${number(1000)} coin geri döndü.`,
  );

  // ── Şans Merdiveni ─────────────────────────────────────────────────────────
  const mert = uye({ ad: 'Mert', seviye: 12, coin: 2600 });
  store.setBahis(mert.uid, 250);
  const merdivenBos = oyun.durumOf(mert.uid, 'merdiven');

  const elif = uye({ ad: 'Berk', seviye: 18, coin: 1500 });
  store.setBahis(elif.uid, 250);
  store.merdivenBaslat(elif.uid, 250);
  for (let i = 0; i < 4; i++) store.merdivenYukselt(elif.uid);
  const merdivende = oyun.durumOf(
    elif.uid,
    'merdiven',
    `**4. basamaktasın:** pot ${number(770)} coin. Çekersen cebine girer. Sıradaki basamak 50% risk taşır.`,
  );

  const can = uye({ ad: 'Can', seviye: 26, coin: 5900 });
  store.setBahis(can.uid, 500);
  store.merdivenBaslat(can.uid, 500);
  for (let i = 0; i < 3; i++) store.merdivenYukselt(can.uid);
  store.merdivenDusur(can.uid);
  store.elKaydet(can.uid, { net: 650, odul: 1150 });
  const merdivenCekim = oyun.durumOf(
    can.uid,
    'merdiven',
    `**Çekildi:** 3 basamakta pot ${number(1150)} coin cüzdanına yattı.`,
  );

  // ── Duyuru kartları ────────────────────────────────────────────────────────
  const efsaneviUye = uye({ ad: 'Ece', seviye: 37, coin: 7100, kazanilan: 200 });
  const efsanevi = coinStore.addWin(efsaneviUye.uid, 1300, 'keşif');
  const efsaneviSatir = p.ganimetSatiri({ tur: 'coin', miktar: efsanevi.odenen, kesilen: efsanevi.kesilen, nitelik: 'efsanevi' });

  return [
    panelCase(kesifYeni, 'kesif-yeni', 'Keşif sekmesi: yeni üye, tek bölge açık, gezisi hazır', '/oyun komutunun açtığı sayfa'),
    panelCase(kesifBasari, 'kesif-ganimet', 'Keşif sekmesi: üç bölge açık, bulunmuş kozmetik satırının üstte', 'Gezi düğmesinden sonra aynı sayfa'),
    panelCase(kesifKota, 'kesif-kota', 'Keşif sekmesi: günlük gezi kotası dolu, düğmeler pasif', 'Sekizinci geziden sonra aynı sayfa'),
    panelCase(tavanDolu, 'kesif-tavan', 'Keşif sekmesi: günlük oyun kazancı tavanı dolu, coin yatmadı', 'Tavanı dolu üyede gezi sonrası'),
    panelCase(ruletBos, 'rulet-bos', 'Rulet sekmesi: sicili boş üye, bahis 50 coin', 'Sayfada Rulet sekmesine basıldığında'),
    panelCase(ruletKazan, 'rulet-kazan', 'Rulet sekmesi: kazanç satırı, seçili bahis 500 coin, sicilde üç el', 'Renk düğmesinden sonra aynı sayfa'),
    panelCase(merdivenBos, 'merdiven-bos', 'Merdiven sekmesi: masada tırmanış yok, nasıl oynanır anlatımı', 'Sayfada Merdiven sekmesine basıldığında'),
    panelCase(merdivende, 'merdiven-masada', 'Merdiven sekmesi: dördüncü basamakta, pot ve sıradaki risk', 'Bir Basamak Çık düğmesinden sonra'),
    panelCase(merdivenCekim, 'merdiven-cekim', 'Merdiven sekmesi: pot çekildi, tırmanış masadan kalktı', 'Parayı Çek düğmesinden sonra'),
    {
      id: 'duyuru-efsanevi',
      title: 'Duyuru kartı: efsanevi ganimet kanalda anılıyor',
      where: 'Efsanevi ganimet düşen geziden sonra kanalda herkese açık kart',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.bigWin({
            user: efsaneviUye.user,
            title: 'Efsanevi Ganimet',
            sub: `<@${efsaneviUye.uid}> Ay Işığı Bahçesi yolunda efsanevi ganimet buldu: ${efsaneviSatir}`,
            pairs: [['Bölge', 'Ay Işığı Bahçesi'], ['Bugünkü Gezi', `3 / ${config.kesif.gunlukAdet}`]],
            accent: 'danger',
          }),
        ],
        flags: ui.CV2,
        allowedMentions: { users: [efsaneviUye.uid] },
      }),
    },
    {
      id: 'duyuru-buyuk-el',
      title: 'Duyuru kartı: rulette büyük el',
      where: 'Eşik üstü kumarhane kazancından sonra kanalda herkese açık kart',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.bigWin({
            user: ali.user,
            title: 'Kumarhanede Büyük El',
            sub: `<@${ali.uid}> rulette ${config.rulet.renkler.kirmizi.ad} oynadı, ${config.rulet.renkler.siyah.ad} geldi. ${number(1000)} coin kazandı.`,
            pairs: [
              ['Bahis', `${number(500)} coin`],
              ['Geri Dönen', number(1000)],
              ['Cüzdan', `${number(coinStore.balance(ali.uid))} coin`],
            ],
          }),
        ],
        flags: ui.CV2,
        allowedMentions: { users: [ali.uid] },
      }),
    },
    hataCase(
      'hata-seviye-kilitli',
      'Reddetme: bölge üyenin seviyesine kapalı',
      'Kilitli bölge düğmesine eski bir sayfadan basıldığında',
      'Bu bölge senin seviyene açık değil.',
      `Kırık Mağara için seviye 20 gerekir, senin ölçülen seviyen 6.`,
    ),
    hataCase(
      'hata-kota',
      'Reddetme: günün gezi kotası dolu',
      'Kota dolmuş üyenin gezi düğmesi',
      'Bugünkü gezi kotasın doldu.',
      `Günde ${config.kesif.gunlukAdet} gezi yapabilirsin; gece sıfırlanır. Kumarhane açık.`,
    ),
    hataCase(
      'hata-bakiye-yetmez',
      'Reddetme: bahsi karşılayacak coin yok',
      'Bakiyesi seçili bahsin altında kalan üyede renk düğmesi',
      'Bahsini karşılayacak coinin yok.',
      `Masaya ${number(1000)} coin konuyor; cüzdanında ${number(240)} coin var.`,
    ),
    hataCase(
      'hata-cekilis-yok',
      'Reddetme: masada tırmanış yokken basamak düğmesi',
      'Eski sayfadan basılan Bir Basamak Çık düğmesi',
      'Masada tırmanışın yok.',
      '"Tırman" düğmesiyle yeni bir el aç.',
    ),
  ];
};
