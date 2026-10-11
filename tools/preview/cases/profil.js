// Profil sistemi (src/systems/profil): kart görseli canvas ile çizildiği için önizlemede aynı boyutta yer tutucu PNG
// kullanılır; mesaj düzeni ve metinler gerçek ui fonksiyonlarından gelir. Rozet ve vitrin listeleri buradan elle
// verilir, böylece boş/dolu durumların ikisi de denetlenir.
const { THEMES } = require('../../../src/systems/profil/themes');

module.exports = ({ mock, ui, src }) => {
  const p = src('systems/profil/ui');
  const kozmetik = src('systems/profil/kozmetik');
  const kapak = src('systems/profil/kapak');
  const rozet = src('systems/profil/rozet');
  // index.js'teki SHOP_TABS ile aynı sekmeler
  const SHOP_TABS = { cerceve: 'Çerçeveler', tema: 'Temalar', kapak: 'Arka Planlar', rozet: 'Rozetler' };
  // index.js'teki FEATURED listesiyle aynı içerik; kartta öne çıkan istatistik seçenekleri
  const featuredOptions = [
    { key: 'mesaj', label: 'Mesaj sıralaması', note: 'Tüm zamanların mesaj sıran' },
    { key: 'ses', label: 'Ses sıralaması', note: 'Tüm zamanların ses sıran' },
    { key: 'yayin', label: 'Yayın süresi', note: 'Toplam ekran paylaşımı' },
    { key: 'saygi', label: 'Saygınlık', note: 'Toplam aldığın saygınlık' },
    { key: 'seri', label: 'Giriş serisi', note: 'Art arda günlük ödül' },
    { key: 'coin', label: 'Coin bakiyesi', note: 'Harcayabileceğin coin' },
  ];
  const noMentions = { allowedMentions: { parse: [] } };
  const user = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const card = (name, height, label) => mock.pngFile(name, { width: 1200, height, label });

  // Mağaza satırları: index.js'teki shopRows aynı biçimde üretilir, burada statik veriyle denenir
  const shopRows = (items) =>
    items.map((item) => ({
      name: item.name,
      note: item.note,
      state: item.state,
      id: item.id,
      label: item.label,
      wearStyle: item.style,
      disabled: item.disabled,
    }));

  return [
    {
      id: 'profil-sahibi',
      title: 'Profil kartı: kendi profili, tema seçili',
      where: '/profil komutu, herkese açık; kontrolleri sadece sahibi kullanır',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.profile('profil.png', true, 'gece')], files: [card('profil.png', 988, 'Profil kartı')], ...noMentions }),
    },
    {
      id: 'profil-sahibi-temasiz',
      title: 'Profil kartı: kendi profili, tema seçilmemiş',
      where: '/profil komutu, ilk açılış ya da Sıfırla sonrası',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.profile('profil.png', true, null)], files: [card('profil.png', 988, 'Profil kartı')], ...noMentions }),
    },
    {
      id: 'profil-baskasi',
      title: 'Profil kartı: başka üyenin profili',
      where: '/profil komutu başka üyeyle; kontrol yok',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.profile('profil.png', false)], files: [card('profil.png', 878, 'Profil kartı')], ...noMentions }),
    },
    {
      id: 'bio-modal-bos',
      title: 'Biyografi formu: boş',
      where: 'Profilde Biyografi butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.bioModal({}),
    },
    {
      id: 'bio-modal-dolu',
      title: 'Biyografi formu: dolu',
      where: 'Profilde Biyografi butonuna basınca açılır, kayıtlı değerlerle',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.bioModal({ bio: 'Anime izlemeyi ve gece sohbetlerini severim.', title: 'Anime Sever' }),
    },
    {
      id: 'renk-modal',
      title: 'Renk formu',
      where: 'Profilde Renk butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.colorModal({ color: 0xff5599 }),
    },
    {
      id: 'kapak-modal',
      title: 'Kapak formu',
      where: 'Profilde Kapak butonuna basınca açılır',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.bannerModal({ banner: 'https://i.imgur.com/ornek.png' }),
    },
    {
      id: 'kapak-duzenleyici-bos',
      title: 'Kapak düzenleyici: görsel yok, hareket düğmeleri pasif',
      where: 'Profilde "Kapağı Düzenle" butonu',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [p.kapakPage('kapak.png', { bannerZoom: 1, bannerX: 0, bannerY: 0, cover: 'yok' })],
        files: [card('kapak.png', 300, 'Kapak önizlemesi')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'kapak-duzenleyici-gorsel',
      title: 'Kapak düzenleyici: görsel %180 yakın, sağa/aşağı kaydırılmış',
      where: 'Düzenleyicide büyüt/kaydır düğmelerine basınca',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [p.kapakPage('kapak.png', { banner: 'https://i.imgur.com/ornek.png', bannerZoom: 1.8, bannerX: 0.4, bannerY: -0.2, cover: 'cam' })],
        files: [card('kapak.png', 300, 'Kapak önizlemesi')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'gorunum-cam',
      title: 'Kart görünümü: cam tema, saydamlık ayarlanabiliyor',
      where: 'Profilde "Görünüm" butonu',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [p.gorunumPage('profil.png', { themeLabel: THEMES.nebula.label, glass: true, opacity: 30 })],
        files: [card('profil.png', 988, 'Profil kartı')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'gorunum-duz',
      title: 'Kart görünümü: düz tema, saydamlık düğmeleri pasif',
      where: 'Düz panelli bir temada Görünüm butonu; düğmeler kaybolmaz, sadece işlemez',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [p.gorunumPage('profil.png', { themeLabel: THEMES.sakura.label, glass: false, opacity: 50 })],
        files: [card('profil.png', 988, 'Profil kartı')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'vitrin-modal',
      title: 'Vitrin formu: zamir ve bağlantılar',
      where: 'Vitrin sayfasındaki "Zamir ve Bağlantılar" düğmesi',
      visibility: 'ephemeral',
      kind: 'modal',
      build: () => p.vitrinModal({ pronoun: 'o/onlar', links: { twitch: 'https://twitch.tv/kullanici', youtube: 'https://youtube.com/@kullanici' } }),
    },
    {
      id: 'vitrin-bos',
      title: 'Vitrin sayfası: hiçbiri doldurulmamış',
      where: 'Profilde Vitrin butonuna basınca',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.vitrinPage({}, null, featuredOptions, '**Profil ziyaretleri:** 0')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'vitrin-dolu',
      title: 'Vitrin sayfası: zamir, bağlantılar ve öne çıkan dolu',
      where: 'Profilde Vitrin butonuna basınca',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.vitrinPage(
            { pronoun: 'o/onlar', featured: 'seri', links: { twitch: 'https://twitch.tv/kullanici', youtube: 'https://youtube.com/@kullanici', site: 'https://ornek.com' } },
            'seri',
            featuredOptions,
            '**Profil ziyaretleri:** 128 · son görenler: mehmet, ayşe',
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'rozet-bos',
      title: 'Rozet sayfası: henüz rozet yok',
      where: 'Profilde Rozetler butonuna basınca',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.rozetPage(
            rozet.BADGES.map((b) => ({ ...b, value: 0, done: false })),
            0,
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'rozet-kismen',
      title: 'Rozet sayfası: kazanılanlar ve ilerlemeler',
      where: 'Profilde Rozetler butonuna basınca',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.rozetPage(
            [
              { label: 'Kurucu', note: 'Sunucunun sahibi', goal: 1, value: 1, done: true },
              { label: 'Takviye', note: 'Sunucuyu takviye ediyor', goal: 1, value: 1, done: true },
              { label: 'Kararlı', note: 'Yedi günlük giriş serisi', goal: 7, value: 7, done: true },
              { label: 'Eski Üye', note: 'Sunucuda bir yılı doldurdu', goal: 365, value: 212, done: false },
              { label: 'Sohbet Kuşu', note: 'Binden fazla mesaj', goal: 1000, value: 640, done: false },
              { label: 'Ses Ustası', note: 'Ses seviyesi 25', goal: 25, value: 9, done: false },
            ],
            3,
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'rozet-gorev',
      title: 'Rozet sayfası: görev rozetleri ve ilerlemeleri',
      where: 'Profilde Rozetler butonu; uzun vadeli hedefler ayrı blokta, hedef dolunca rol de verilir',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.rozetPage(
            [
              { label: 'Kurucu', note: 'Sunucunun sahibi', goal: 1, value: 1, done: true },
              { label: 'Kararlı', note: 'Yedi günlük giriş serisi', goal: 7, value: 7, done: true },
              { label: 'Eski Üye', note: 'Sunucuda bir yılı doldurdu', goal: 365, value: 212, done: false },
              { label: 'Sohbet Efsanesi', note: 'Yirmi beş bin mesaj', goal: 25000, value: 18400, done: false, gorev: true },
              { label: 'Ses Efsanesi', note: 'Beş yüz saat sesli sohbet', goal: 500, value: 486, done: false, gorev: true },
              { label: 'Hazine Avcısı', note: 'Yirmi bin coin kazandı', goal: 20000, value: 12480, done: false, gorev: true },
              { label: 'Koleksiyon Efsanesi', note: 'Sekiz kozmetik sahibi', goal: 8, value: 3, done: false, gorev: true },
            ],
            2,
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'magaza-cerceve',
      title: 'Mağaza: çerçeveler, bazıları satın alınmış',
      where: 'Profilde Mağaza butonuna basınca',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.shopPage(
            'cerceve',
            SHOP_TABS,
            5400,
            shopRows([
              { name: 'Çerçevesiz', note: kozmetik.FRAMES[0].note, state: 'Ücretsiz', id: `${p.IDS.wear}cerceve:yok`, label: 'Giy', style: 2 },
              { name: 'Bronz', note: kozmetik.FRAMES[1].note, state: '1.200 coin', id: `${p.IDS.buy}cerceve:bronz`, label: 'Al · 1.200', style: 2 },
              { name: 'Gümüş', note: kozmetik.FRAMES[2].note, state: 'Sahipsin', id: `${p.IDS.wear}cerceve:gumus`, label: 'Giy', style: 1 },
              { name: 'Altın', note: kozmetik.FRAMES[3].note, state: 'Kartında bu var', id: `${p.IDS.wear}cerceve:altin`, label: 'Giyili', disabled: true },
              { name: 'Neon', note: kozmetik.FRAMES[4].note, state: '7.200 coin', id: `${p.IDS.buy}cerceve:neon`, label: 'Al · 7.200', style: 2 },
            ]),
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'magaza-cuzdan',
      title: 'Mağaza: cüzdan kartından açılmış, geri düğmesi cüzdana döner',
      where: '/bakiye cüzdanındaki Mağaza düğmesi; kartın yerini alır, ayrı mesaj atmaz',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.shopPage(
            'cerceve',
            SHOP_TABS,
            5400,
            shopRows([
              { name: 'Çerçevesiz', note: kozmetik.FRAMES[0].note, state: 'Ücretsiz', id: `${p.IDS.wear}cerceve:yok:cuzdan`, label: 'Giy', style: 2 },
              { name: 'Bronz', note: kozmetik.FRAMES[1].note, state: '1.200 coin', id: `${p.IDS.buy}cerceve:bronz:cuzdan`, label: 'Al · 1.200', style: 2 },
              { name: 'Altın', note: kozmetik.FRAMES[3].note, state: 'Kartında bu var', id: `${p.IDS.wear}cerceve:altin:cuzdan`, label: 'Giyili', disabled: true },
            ]),
            'cuzdan',
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'magaza-tema',
      title: 'Mağaza: temalar sekmesi',
      where: 'Mağaza sayfasındaki Temalar sekmesi',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.shopPage(
            'tema',
            SHOP_TABS,
            5400,
            shopRows(
              Object.entries(THEMES)
                .filter(([, theme]) => theme.price > 0)
                .map(([key, theme], i) =>
                  i === 0
                    ? { name: theme.label, note: theme.description, state: 'Sahipsin', id: `${p.IDS.wear}tema:${key}`, label: 'Giy', style: 1 }
                    : { name: theme.label, note: theme.description, state: `${theme.price} coin`, id: `${p.IDS.buy}tema:${key}`, label: `Al · ${theme.price}`, style: 2 },
                ),
            ),
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'magaza-kapak',
      title: 'Mağaza: arka planlar sekmesi, biri satın alınmış',
      where: 'Mağazadaki "Arka Planlar" sekmesi ya da kapak düzenleyicinin aynı adlı düğmesi',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.shopPage(
            'kapak',
            SHOP_TABS,
            5400,
            shopRows(
              kapak.COVERS.map((c) =>
                c.key === 'yok'
                  ? { name: c.label, note: c.note, state: 'Kartında bu var', id: `${p.IDS.wear}kapak:yok`, label: 'Giyili', style: 2, disabled: true }
                  : c.key === 'aurora'
                    ? { name: c.label, note: c.note, state: 'Sahipsin', id: `${p.IDS.wear}kapak:aurora`, label: 'Giy', style: 1 }
                    : { name: c.label, note: c.note, state: `${c.price} coin`, id: `${p.IDS.buy}kapak:${c.key}`, label: `Al · ${c.price}`, style: 2 },
              ),
            ),
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'magaza-rozet',
      title: 'Mağaza: rozetler sekmesi, satın alınan kartta görünüyor',
      where: 'Mağazadaki Rozetler sekmesi',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.shopPage(
            'rozet',
            SHOP_TABS,
            5400,
            shopRows(
              kozmetik.SHOP_BADGES.map((b) =>
                b.key === 'kalp'
                  ? { name: b.label, note: b.note, state: 'Kartında görünüyor', id: `${p.IDS.wear}rozet:kalp`, label: 'Sahipsin', style: 2, disabled: true }
                  : { name: b.label, note: b.note, state: `${b.price} coin`, id: `${p.IDS.buy}rozet:${b.key}`, label: `Al · ${b.price}`, style: 2 },
              ),
            ),
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'hata-bos-bakiye',
      title: 'Mağaza: bakiye yetmiyor',
      where: 'Ürün alma düğmesine basınca',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [
          ui.alert(
            'Bakiyen bu ürün için yetmiyor.',
            'Fiyatı **7.200** coin, senin bakiyen **5.400** coin. Günlük ödüller ve haftalık derecelerle artırabilirsin.',
            'danger',
          ),
        ],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'hata-uygun-tema',
      title: 'Tema seçimi: ücretli tema satın alınmamış',
      where: 'Tema menüsünden ücretli bir tema seçilince',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [ui.alert('Bu tema ücretli.', '**Elmas** teması mağazada **6.000** coin. Mağaza sekmesinden satın alıp kullanabilirsin.', 'danger')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'vitrin-kayit',
      title: 'Vitrin: zamir ve bağlantılar kaydedildi',
      where: 'Vitrin formu gönderilince',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.vitrinSaved({ user })], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'hata-vitrin-baglanti',
      title: 'Vitrin formu: bağlantılardan biri geçersiz',
      where: 'Vitrin formu gönderilince',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.vitrinSaved({ user, bad: ['github'] })], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'onay-satin-alma',
      title: 'Mağaza: satın alma tamam, ürün kartına uygulandı',
      where: 'Ürün alma düğmesine basınca, kanala düşen harcama kartı',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [p.purchase({ user, tur: 'cerceve', name: 'Altın', price: 4800, balance: 600, worn: true })],
        flags: ui.CV2,
        allowedMentions: { users: [user.id] },
      }),
    },
    {
      id: 'onay-satin-alma-kapak',
      title: 'Mağaza: kapak alındı ama kartta kendi görseli var',
      where: 'Arka Plan sekmesinden kapak alınırken',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          p.purchase({
            user,
            tur: 'kapak',
            name: 'Buzlu Cam',
            price: 3400,
            balance: 2000,
            worn: true,
            note: 'Kartında kendi görselin durduğu için arka plan şimdilik görünmez; kapak düzenleyiciden görseli kaldırabilirsin.',
          }),
        ],
        flags: ui.CV2,
        allowedMentions: { users: [user.id] },
      }),
    },
    {
      id: 'onay-giyme',
      title: 'Mağaza: sahip olunan ürün giyildi',
      where: 'Giy düğmesine basınca',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [p.equip({ user, tur: 'tema', name: 'Elmas' })], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
    {
      id: 'hata-renk',
      title: 'Hata: geçersiz renk',
      where: 'Renk formu gönderilince',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({
        components: [ui.alert('Renk kodu geçersiz.', 'Altı haneli bir hex kod yaz, örneğin #ff5599.', 'danger')],
        flags: ui.EPHEMERAL_CV2,
        ...noMentions,
      }),
    },
    {
      id: 'hata-bot-profil',
      title: 'Hata: bot profili',
      where: '/profil komutu bir botla',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [ui.alert('Botların profili bulunmaz.', 'Bir üye seçerek tekrar dene.', 'danger')], flags: ui.EPHEMERAL_CV2, ...noMentions }),
    },
  ];
};
