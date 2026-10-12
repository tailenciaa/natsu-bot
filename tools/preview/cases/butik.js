// Butik (src/systems/butik): cüzdan kartının yerini alan coin rafı — ek saygınlık hakkı, evlilik yüzüğü ve
// özel renkli roller — alım kartları ve hata cevapları.
// Sayfadaki sayılar elle kurulmaz: bakiye, elde duran hak/yüzük adedi ve sahip olunan renkler gerçek store'lara
// yazılır, sonra üretim kapısından (butik.sayfaDurumu) okunur. Renk rafının açılması da gerçek config okumasıdır:
// roleId doldurulunca raf kendiliğinden görünür oluyor, boşken kalkıyor. db.init() çağrılmadığı için save()
// hiçbir yere dokunmaz.
module.exports = ({ mock, ui, src }) => {
  const config = src('systems/butik/config');
  const store = src('systems/butik/store');
  const u = src('systems/butik/ui');
  const butik = src('systems/butik');
  const coinStore = src('systems/coin/store');
  const saygiUi = src('systems/saygi/ui');

  const noMentions = { allowedMentions: { parse: [] } };

  const caseOf = (id, title, where, container, visibility = 'public') => ({
    id,
    title,
    where,
    visibility,
    kind: 'message',
    build: () => ({ components: [container], flags: visibility === 'ephemeral' ? ui.EPHEMERAL_CV2 : ui.CV2, ...noMentions }),
  });

  const hataCase = (id, title, where, message, note) => caseOf(id, title, where, ui.alert(message, note, 'danger'), 'ephemeral');

  // ── Senaryo üyeleri ────────────────────────────────────────────────────────
  const alisveris = mock.user({ username: 'zeynep', displayName: 'Zeynep' });
  const yeni = mock.user({ username: 'kaan', displayName: 'Kaan' });
  const arkadas = mock.user({ username: 'mert', displayName: 'Mert' });

  // Alışveriş yapan üye: parası bakiyeye yazılır, hakları ve bir rengi butiğin kendi kayıtlarından gelir
  coinStore.add(alisveris.id, 24000, 'önizleme cüzdanı');
  store.ekle(config.hak.key, alisveris.id, 2);
  store.ekle(config.yuzuk.key, alisveris.id, 1);
  store.rolEkle(alisveris.id, 'kirmizi');

  // Rafın görünmesi için rol ID'leri doldurulur (canlıda bunları sunucu sahibi config'e yazar)
  const rolIdleri = config.roller.map((reng) => [reng.key, (reng.roleId = mock.id())]);
  const rolleriKapat = () => {
    for (const [key, id] of rolIdleri) config.roller.find((r) => r.key === key).roleId = id;
  };
  const rafKapali = () => config.roller.forEach((reng) => (reng.roleId = null));

  return [
    caseOf(
      'raf',
      'Butik rafı: bakiye, elde duran haklar, satıştaki renkler ve işleyiş',
      '/bakiye cüzdanındaki Butik düğmesi',
      u.panel(butik.sayfaDurumu(alisveris.id, alisveris)),
    ),
    caseOf(
      'raf-rolsuz',
      'Butik rafı: renkler henüz hazırlanmamış, yeni üye için hak da yüzük de yok',
      'Cüzdanından butiği ilk kez açan üye',
      u.panel((() => {
        const durum = butik.sayfaDurumu(yeni.id, yeni);
        rafKapali();
        return { ...durum, renkler: store.satisdakiRenkler() };
      })()),
    ),

    // ── Alım kartları ─────────────────────────────────────────────────────────
    caseOf(
      'alim-hak',
      'Ek saygınlık hakkı alındı: elde biriken adet yazılır',
      'Butik rafındaki Al düğmesi',
      u.tukenenAlindi({ user: alisveris, ...config.hak, total: 3 }),
    ),
    caseOf(
      'alim-yuzuk',
      'Evlilik yüzüğü alındı',
      'Butik rafındaki Al düğmesi',
      u.tukenenAlindi({ user: alisveris, ...config.yuzuk, total: 2 }),
    ),
    caseOf(
      'alim-rol',
      'Renkli rol alındı: rol verildiği için mention da kartta durur',
      'Butik rafındaki Al düğmesi',
      u.rolAlindi({ user: alisveris, ad: config.roller[3].ad, price: config.roller[3].price, roleId: config.roller[3].roleId }),
    ),

    // ── Bağlantının öteki ucu: hak saygınlık verirken yanar ────────────────────
    caseOf(
      'saygi-ek-hak',
      'Saygınlık verildi: bekleme dolmadan, Butikteki ek hakla verildiği kartta okunur',
      '/saygi-ver ya da mesaja +rep @üye yazılması',
      saygiUi.given(alisveris.id, arkadas.id, 17, true),
    ),

    // ── Hata cevapları ────────────────────────────────────────────────────────
    hataCase(
      'hata-bakiye',
      'Bakiye yetmiyor: fiyat ve bakiye yan yana',
      'Butikte Al düğmesine az parası olan üye basınca',
      'Bakiyen bu ürün için yetmiyor.',
      `Fiyatı ${ui.chip('4.000 coin')}, senin bakiyen ${ui.chip('1.200 coin')}. Günlük ödüller, görevler ve oyunlarla tamamlayabilirsin.`,
    ),
    hataCase(
      'hata-renk-yok',
      'Renk satışta değil: rol ID si config'e yazılmamış',
      'Rafı açılmamış renge eski mesajdan basılınca',
      'Bu renk şu anda satışta değil.',
      'Rol sunucuda hazırlanınca raf kendini gösterir.',
    ),
    hataCase(
      'hata-renk-sende',
      'Renk zaten sahip: ikinci kez para istenmez',
      'Sahip olunduğu rengin düğmesine basılınca',
      'Bu renk zaten sende.',
      'Sunucuda adın o rolün rengiyle yazılıyor.',
    ),
    hataCase(
      'hata-rol-verilemedi',
      'Rol verilemedi: para alınmadığı üye hemen öğrenir',
      'Botun rol yönetme yetkisi yokken Al düğmesi',
      'Rol verilemedi, para alınmadı.',
      'Botun rolleri yönetme yetkisi yoksa bir yetkiliye haber ver.',
    ),
    hataCase(
      'hata-baska-uye',
      'Sayfa sahibi olmayan üye butona basarsa',
      'Başkasının cüzdan kartındaki Butik düğmesi',
      'Bu menüyü sadece komutu kullanan kişi gezebilir.',
      null,
    ),
  ];
};
