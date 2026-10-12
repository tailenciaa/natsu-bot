// Butik (src/systems/butik): cüzdan kartının yerini alan coin rafı — ek saygınlık hakkı, evlilik yüzüğü ve
// özel renkli roller — alım kartları ve hata cevapları.
// Sayfadaki sayılar elle kurulmaz: bakiye, elde duran hak/yüzük adedi ve sahip olunan renkler gerçek store'lara
// yazılır, sonra üretim kapısından (butik.sayfaDurumu) okunur. Renk rafının açılması da gerçek config okumasıdır:
// roleId doluysa raf görünür, boşsa kalkar. Kartlar bu sırayla çizildikten sonra config yine rol bekleyen hâline
// döndürülür. db.init() çağrılmadığı için save() hiçbir yere dokunmaz.
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

  // Alışveriş yapmış üye: parası cüzdana, hakları ve bir rengi butiğin kendi kaydına yazılır
  coinStore.add(alisveris.id, 24000, 'önizleme cüzdanı');
  store.ekle(config.hak.key, alisveris.id, 2);
  store.ekle(config.yuzuk.key, alisveris.id, 1);
  store.rolEkle(alisveris.id, 'kirmizi');

  // ── Kartlar, config'in rol ID'leriyle oynanarak sırayla çizilir ─────────────
  const rolIdleri = config.roller.map(() => mock.id());
  const rolleriAyarla = (dolu) => config.roller.forEach((reng, i) => (reng.roleId = dolu ? rolIdleri[i] : null));

  rolleriAyarla(true);
  const rafAcik = u.panel(butik.sayfaDurumu(alisveris.id, alisveris));
  const hakKarti = u.tukenenAlindi({ user: alisveris, ...config.hak, total: 3 });
  const yuzukKarti = u.tukenenAlindi({ user: alisveris, ...config.yuzuk, total: 2 });
  const reng = config.roller[3];
  const rolKarti = u.rolAlindi({ user: alisveris, ad: reng.ad, price: reng.price, roleId: reng.roleId });

  rolleriAyarla(false);
  const rafKapali = u.panel(butik.sayfaDurumu(yeni.id, yeni));
  rolleriAyarla(false);

  return [
    caseOf('raf', 'Butik rafı: bakiye, elde duran haklar, satıştaki renkler ve işleyiş', '/bakiye cüzdanındaki Butik düğmesi', rafAcik),
    caseOf(
      'raf-rolsuz',
      'Butik rafı: renkler henüz hazırlanmamış, üyenin elinde de hiç hak yok',
      'Cüzdanından butiği ilk kez açayan yeni üye',
      rafKapali,
    ),

    // ── Alım kartları ─────────────────────────────────────────────────────────
    caseOf('alim-hak', 'Ek saygınlık hakkı alındı: elde biriken adet yazılır', 'Raftaki Al düğmesi', hakKarti),
    caseOf('alim-yuzuk', 'Evlilik yüzüğü alındı', 'Raftaki Al düğmesi', yuzukKarti),
    caseOf('alim-rol', 'Renkli rol alındı: rol verildiği için etiketi de kartta durur', 'Raftaki Al düğmesi', rolKarti),

    // ── Bağlantının öteki ucu: hak saygınlık verirken kendiliğinden yanar ──────
    caseOf(
      'saygi-ek-hak',
      'Saygınlık verildi: bekleme dolmadan, Butikteki ek hakla verildiği kartta okunur',
      '/saygi-ver ya da mesaja +rep @üye yazılması',
      saygiUi.given(alisveris.id, arkadas.id, 17, true),
    ),

    // ── Hata cevapları ────────────────────────────────────────────────────────
    hataCase(
      'hata-bakiye',
      'Bakiye yetmiyor: fiyat ve bakiye yan yana yazılır',
      'Al düğmesine az parası olan üye basınca',
      'Bakiyen bu ürün için yetmiyor.',
      `Fiyatı ${ui.chip('4.000 coin')}, senin bakiyen ${ui.chip('1.200 coin')}. Günlük ödüller, görevler ve oyunlarla tamamlayabilirsin.`,
    ),
    hataCase(
      'hata-renk-yok',
      'Renk satışta değil: config'e rol ID'si henüz yazılmamış',
      'Rafı açılmamış rengin eski düğmesine basınca',
      'Bu renk şu anda satışta değil.',
      'Rol sunucuda hazırlanınca raf kendini gösterir.',
    ),
    hataCase(
      'hata-renk-sende',
      'Renk zaten sahip: ikinci kez para istenmez',
      'Sahip olunan rengin düğmesine basınca',
      'Bu renk zaten sende.',
      'Sunucuda adın o rolün rengiyle yazılıyor.',
    ),
    hataCase(
      'hata-rol-verilemedi',
      'Rol verilemedi: paranın alınmadığı hemen söylenir',
      'Botun rolleri yönetme yetkisi yokken Al düğmesi',
      'Rol verilemedi, para alınmadı.',
      'Botun rolleri yönetme yetkisi yoksa bir yetkiliye haber ver.',
    ),
    hataCase(
      'hata-baska-uye',
      'Sayfa sahibi olmayan üye basarsa raf açılmaz',
      'Başkasının cüzdan kartındaki Butik düğmesi',
      'Bu menüyü sadece komutu kullanan kişi gezebilir.',
      null,
    ),
  ];
};
