// Bot durumu (İzliyor / Oynuyor / Dinliyor) ayarları. Değiştirince botu yeniden başlatmak yeterli.

const { ActivityType } = require('discord.js');

module.exports = {
  // Durum türü: Watching (İzliyor), Playing (Oynuyor), Listening (Dinliyor), Competing (Yarışıyor)
  type: ActivityType.Watching,

  // Durum kaç saniyede bir güncellenir
  intervalSeconds: 30,

  // Seste kimse yoksa ve aktif üye sayısı alınamazsa sunucu adının yanında sırayla gösterilen yazılar
  phrases: ['Destek ekibi hizmetinizde', 'Yetkili alımları açık', 'Her zaman aktif'],
};
