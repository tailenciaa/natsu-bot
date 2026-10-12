// Saygınlık sistemi ayarları: üyeler birbirine günde bir kez +1 saygınlık verebilir (/saygi-ver, bir mesajda "+rep
// @kullanıcı" yazarak ya da bir değerlendirmenin altındaki saygınlık butonuyla). Her hafta pazartesi, geçen haftanın
// en çok saygınlık kazanan üyesi bu kanala duyurulur ve rolü verilir (önceki haftanın sahibinden geri alınır).
module.exports = {
  // Haftalık duyurunun gönderileceği kanal
  channel: '1538538325521080391',

  // Her verilen saygınlığın herkese açık kaydının düşeceği kanal (#bot-komutları). Verme zaten bu kanaldaysa
  // cevap mesajının kendisi kayıt olur, ikinci bir mesaj atılmaz.
  feed: '1538536351119446127',

  // Haftanın birincisine verilecek rol
  roleId: '1556348584365133844',

  // Aynı kişi en erken kaç saatte bir tekrar saygınlık verebilir
  cooldownHours: 24,
};
