// Saygınlık sistemi ayarları: üyeler birbirine günde bir kez +1 saygınlık verebilir (/saygi-ver). Her hafta
// pazartesi, geçen haftanın en çok saygınlık kazanan üyesi bu kanala duyurulur ve rolü verilir (önceki haftanın
// sahibinden geri alınır).
module.exports = {
  // Haftalık duyurunun gönderileceği kanal
  channel: '1538538325521080391',

  // Haftanın birincisine verilecek rol
  roleId: '1556348584365133844',

  // Aynı kişi en erken kaç saatte bir tekrar saygınlık verebilir
  cooldownHours: 24,
};
