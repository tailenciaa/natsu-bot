// Haftanın aktifleri ayarları: her hafta pazartesi geçen haftanın ses, mesaj ve yayın (ekran paylaşımı)
// şampiyonları duyurulur, kazananlara kategorisine özel rol verilir (önceki haftanın sahibinden geri alınır).
module.exports = {
  // Duyurunun gönderileceği kanal
  channel: '1538538279627132999',

  // Kategori başına verilecek rol
  roles: {
    ses: '1554240785644396704', // Haftanın ses aktifleri
    mesaj: '1555890043560792094', // Haftanın yazılı aktifleri
    yayin: '1554240786034594042', // Haftanın en iyi yayıncıları
  },
};
