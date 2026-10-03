// Haftanın aktifleri ayarları: her hafta pazartesi geçen haftanın ses, mesaj ve yayın (ekran paylaşımı)
// şampiyonları duyurulur, kazananlara kategorisine özel rol verilir (önceki haftanın sahibinden geri alınır).
module.exports = {
  // Duyurunun gönderileceği kanal
  channel: '1538538279627132999',

  // Kategori başına verilecek rol; Discord'da oluşturulup ID'si buraya eklenene kadar rol verilmez, sadece duyurulur
  roles: {
    ses: null,
    mesaj: null,
    yayin: null,
  },
};
