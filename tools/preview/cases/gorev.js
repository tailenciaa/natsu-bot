// Görevler (src/systems/gorev): beş sekmeli panel, kutu açılış kartı ve reddetme bildirimleri.
// İlerleme satırları olcum.js'in kendi hesabından üretilir: senaryonun ölçüleri gerçek store haritalarına
// yazılır (db.init() çağrılmadığı için save() hiçbir yere dokunmaz), böylece düğme etiketleri ve çipler
// canlıdaki hesapla aynı yoldan gelir.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/gorev/config');
  const store = src('systems/gorev/store');
  const olcum = src('systems/gorev/olcum');
  const p = src('systems/gorev/ui');
  const coinStore = src('systems/coin/store');
  const noMentions = { allowedMentions: { parse: [] } };
  const user = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const uid = user.id;

  const m = olcum.olcumler();
  const sezon = config.sezonAnahtari(m.at);

  // ── Senaryo ────────────────────────────────────────────────────────────────
  // Bugün: 22 mesaj (20 hedefini aşar), 25 dk ses (30 dk hedefinin altında), 22 dk yayın (20 dk hedefini aşar)
  m.mesajGun.set(uid, 22);
  m.sesGun.set(uid, 1500);
  m.yayinGun.set(uid, 1320);
  // Bu hafta: 250 mesaj, 6 saat ses, 12 saygınlık
  m.mesajHafta.set(uid, 250);
  m.sesHafta.set(uid, 21600);
  m.repHafta[uid] = 12;

  coinStore.add(uid, 1840, 'önizleme senaryosu');
  // Yolun ilk adımı ölçümden gelir (günlük ödül alındı), ikinci adım gözlemden (kart açıldı)
  coinStore.claim(uid, 6);
  store.gorusuKaydet(uid, 'kartini-gor');
  store.yolAl(uid, 'gunluk-topla');
  store.puanEkle(uid, sezon, 160);
  store.sezonKademeAl(uid, sezon, 0);

  // Panelin satırları: görev havuzdan seçilir, alındı bilgisi store'a yazılır ve olcum.durum hesaplar
  const gunluk = (key, alindi = false) => {
    if (alindi) store.gunlukAl(uid, key, m.gun);
    return olcum.durum(config.GUNLUK_HAVUZU.find((g) => g.key === key), m, uid, null, alindi);
  };
  const haftalik = (key, alindi = false) => {
    if (alindi) store.haftalikAl(uid, key, m.hafta);
    return olcum.durum(config.HAFTALIK_HAVUZU.find((g) => g.key === key), m, uid, null, alindi);
  };
  // demetDurumu'nun döndürdüğü biçim: panel yalnızca kalan / alindi / alinabilir alanlarını okur
  const demet = (satirlar, alindi = false) => ({
    satirlar,
    kalan: satirlar.filter((s) => !s.alinabilir && !s.alindi).length,
    alindi,
    alinabilir: satirlar.every((s) => s.alindi) && !alindi,
  });

  const cüzdan = { balance: coinStore.balance(uid), anahtar: 7 };
  const ortak = { at: m.at, ...cüzdan };
  // Keşif Yolu'nun rozet/puan/ses adımları için ek ölçüler: senaryoda düşük tutulur ki sonraki adımlar kilitli kalsın
  const ek = { rozetSayisi: 0, puan: 120, sesToplam: 300 };

  const kutuSayilari = (anahtar) => ({
    anahtar,
    toplam: 12,
    hafta: 3,
    garantiKaldi: 2,
    yeterli: anahtar >= config.KUTU.anahtar,
    yeterliUc: anahtar >= config.KUTU.anahtar * 3,
  });

  const panelCase = (tab, state, id, title, where) => ({
    id,
    title,
    where,
    visibility: 'ephemeral',
    kind: 'message',
    build: () => ({
      components: [p.panel({ ...ortak, ...state, tab })],
      flags: ui.EPHEMERAL_CV2,
      ...noMentions,
    }),
  });

  // İki Yol anlık görüntüsü: ilkinde ikinci adım ödülünü bekler, ikincisinde toplanmış olur
  const yolOnce = olcum.yolDurumu(uid, m, ek);
  store.yolAl(uid, 'kartini-gor');
  const yolIki = olcum.yolDurumu(uid, m, ek);

  return [
    panelCase(
      'gunluk',
      { gunluk: [gunluk('mesaj-20', true), gunluk('ses-30'), gunluk('yayin-20')], demet: demet([gunluk('mesaj-20', true), gunluk('ses-30'), gunluk('yayin-20')]) },
      'gunluk-karma',
      'Günlük sekmesi: biri alınmış, biri hazır, biri yarıda',
      '/gorev komutunun açtığı panel (üyenin kendisi görür)',
    ),
    panelCase(
      'gunluk',
      {
        gunluk: [gunluk('mesaj-20', true), gunluk('ses-30', true), gunluk('yayin-20', true)],
        demet: demet([gunluk('mesaj-20', true), gunluk('ses-30', true), gunluk('yayin-20', true)]),
      },
      'gunluk-demet-hazir',
      'Günlük sekmesi: üç ödül de toplandı, demet alınabilir',
      'Günün üçüncü görevi alındığında panel',
    ),
    panelCase(
      'gunluk',
      {
        gunluk: [gunluk('mesaj-20', true), gunluk('ses-30', true), gunluk('yayin-20', true)],
        demet: demet([gunluk('mesaj-20', true), gunluk('ses-30', true), gunluk('yayin-20', true)], true),
        feedback: '**Günün demeti açıldı: 120 coin · 1 anahtar · 3 sezon puanı.** Yarın da üç görevi bitirirsen bir demet daha gelir; haftanın demetleri seri görevine sayılır.',
      },
      'gunluk-demet-alindi',
      'Günlük sekmesi: demet açıldı, üstte kazanç satırı duruyor',
      'Demet Al düğmesine basıldıktan sonra aynı panel',
    ),
    panelCase(
      'haftalik',
      { haftalik: [haftalik('mesaj-250'), haftalik('ses-10sa'), haftalik('rep-al-10', true)] },
      'haftalik-karma',
      'Haftalık sekmesi: hazır, yarıda ve alınmış görevler',
      'Panelde Haftalık sekmesine basıldığında',
    ),
    panelCase('yol', { yol: yolOnce }, 'yol-ilerleme', 'Keşif Yolu: ilk adım alındı, ikincisi hazır, sıradaki adım kalın', 'Panelde Keşif Yolu sekmesine basıldığında'),
    panelCase(
      'yol',
      {
        yol: yolIki,
        feedback: `**Ödül eklendi: 80 coin · 3 sezon puanı.** Bakiyeni /bakiye ile görebilirsin. Yolda ${yolIki.filter((s) => s.alindi).length} / ${config.YOL.length} adımı tamamladın.`,
      },
      'yol-odul-toplandi',
      'Keşif Yolu: hazır adımların ödülü toplandı, üstte kazanç satırı',
      'Ödülleri Topla düğmesinden sonra aynı panel',
    ),
    panelCase('kutu', { kutu: kutuSayilari(7) }, 'kutu-hazir', 'Kutu sekmesi: yedi anahtar var, açılabilir', 'Panelde Kutu sekmesine basıldığında'),
    panelCase('kutu', { anahtar: 2, kutu: kutuSayilari(2) }, 'kutu-anahtar-yok', 'Kutu sekmesi: anahtar yetmiyor, düğmeler pasif', 'Anahtarı az olan üyede Kutu sekmesi'),
    panelCase('sezon', { sezon: olcum.sezonDurumu(uid, m) }, 'sezon-ortada', 'Sezon sekmesi: bir eşik alındı, ikisi hazır, ikisi kilitli', 'Panelde Sezon sekmesine basıldığında'),
    {
      id: 'kutu-sonuc-tek',
      title: 'Kutu açıldı: tek kutu, kozmetik çıktı',
      where: 'Kutu Aç düğmesinden sonra kanala düşen herkese açık kart',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [p.chest({ user, sonuclar: [{ tur: 'cerceve', key: 'neon', name: 'Neon' }], kalanAnahtar: 4, balance: coinStore.balance(uid) })],
        flags: ui.CV2,
        allowedMentions: { users: [uid] },
      }),
    },
    {
      id: 'kutu-sonuc-uc',
      title: 'Kutu açıldı: üç kutu birden, coin ve anahtar',
      where: '3 Kutu Aç düğmesinden sonra kanala düşen herkese açık kart',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.chest({
            user,
            sonuclar: [{ tur: 'coin', miktar: 415 }, { tur: 'anahtar', miktar: 1 }, { tur: 'coin', miktar: 730 }],
            kalanAnahtar: 1,
            balance: coinStore.balance(uid) + 1145,
          }),
        ],
        flags: ui.CV2,
        allowedMentions: { users: [uid] },
      }),
    },
    {
      id: 'hata-gorev-bitmedi',
      title: 'Reddetme: görevin hedefi henüz dolmamış',
      where: 'Bitmemiş görevin düğmesine basıldığında üyeye görünür',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [ui.alert('Görev henüz bitmemiş.', 'Şu an 25 dk / 30 dk aşamadasın; hedefe ulaşınca düğme kendiliğinden açılır.', 'danger')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'hata-anahtar-yetmedi',
      title: 'Reddetme: açılacak kutunun anahtarı yok',
      where: 'Anahtarı yetmeyen üyede Kutu Aç düğmesi',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          ui.alert(
            'Anahtarın bu kadar kutuya yetmiyor.',
            '3 anahtar gerekiyor, sende 2 var. Anahtarlar haftalık görevlerden ve günün demetinden düşer.',
            'danger',
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
  ];
};
