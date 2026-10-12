// Butik: cüzdan kartından açılan harcama rafı. Profil mağazası kartın GÖRÜNÜMÜNÜ satarken butik üyeliğin
// karşılığını satar: saygınlık vermede kullanılan ek hak, evlilikte harcanan yüzük ve sunucuda adı renklendiren
// özel rol. Üçü de coin ile alınır; coinler günlük giriş, seviye atlama, haftalık derece, görevler ve oyunlardan
// birikir.
// Fiyat ölçüsü profil mağazasından alınır (çerçeveler 1.200-7.200, rozetler 1.500-6.400 coin): bir kez kullanıp
// biten haklar alt bantta, kalıcı ve gösterişli olanlar üst bantta durur.
// ROL DÜZENİ: bot rol YARATMAZ. Her rengin roleId'si Discord'da önceden açılmış rolün ID'si olarak buraya yazılır.
// Boş bırakılan renk rafta hiç görünmez, hepsi boşsa raf tamamen kalkar: rol hazırlanmadan satış başlamaz.
module.exports = {
  // Tükenen ürünler: satın alınınca elde adet olarak durur, ilgili iş yapıldığında bir adet yanar
  hak: {
    key: 'ek-hak',
    tur: 'hak',
    ad: 'Ek Saygınlık Hakkı',
    price: 1500,
    note: 'Bekleme süren dolmadan bir üyeye daha saygınlık verir',
    adetAdi: 'hak',
    kullanim: 'saygınlık verirken',
  },
  yuzuk: {
    key: 'yuzuk',
    tur: 'yuzuk',
    ad: 'Evlilik Yüzüğü',
    price: 4000,
    note: '/evlilik ile teklif götürürken harcanır',
    adetAdi: 'yüzük',
    kullanim: 'evlilik teklifinde',
  },

  // Kalıcı renkler: bir kez alınır, rol olduğu için üye sunucudan düştüğünde kendiliğinden geri verilir
  roller: [
    { key: 'kirmizi', tur: 'rol', ad: 'Kızıl', price: 9000, note: 'Sunucuda adın kızıl yazılır', roleId: null },
    { key: 'mor', tur: 'rol', ad: 'Orkide', price: 9000, note: 'Sunucuda adın mor yazılır', roleId: null },
    { key: 'zumrut', tur: 'rol', ad: 'Zümrüt', price: 12000, note: 'Sunucuda adın yeşil yazılır', roleId: null },
    { key: 'inci', tur: 'rol', ad: 'İnci', price: 15000, note: 'Sunucuda adın beyaz yazılır', roleId: null },
  ],

  // Cüzdan kartındaki düğmenin etiketi ve raf başlıkları: metinler burada durur ki iki sistem aynı sözü versin
  cuzdanEtiket: 'Butik',
  hakRafBasligi: 'Haklar ve Yüzükler',
  rolRafBasligi: 'Özel Renkli Roller',

  // Raf boşken (hiçbir rol ID'si dolmamışsa) okunan satır
  rolRafNotu: 'Renkli roller sunucuda henüz hazır değil. Yetkililer rolleri açtığında raf kendiliğinden görünür.',
};
