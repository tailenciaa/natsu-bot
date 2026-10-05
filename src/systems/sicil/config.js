// Sicil ve ceza sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
//
// Kim ne yapabilir (Discord izinlerine göre, yöneticiler her şeyi yapabilir):
//   Uyarı, Susturma, Jail, Yasaklama: aşağıdaki punishPerms'teki yetki rolleri (ya da Discord'da Zaman Aşımı / Yasakla izni)
//   Değerlendirme kaldırma: yöneticiler ve ratingManagers rollerindekiler
// Başkalarının sicilini görmek için yukarıdaki izinlerden biri ya da viewerRoles rollerinden biri gerekir.

const destekConfig = require('../destek/config');
const degerlendirmeConfig = require('../degerlendirme/config');
const basvuruConfig = require('../basvuru/config');

module.exports = {
  roles: {
    // Jail rolü: verilince üyenin diğer rolleri alınıp saklanır, jail bitince geri verilir. null: jail kapalı
    jail: '1555281318324207647',
  },

  channels: {
    // Jail rolündeyken görünecek tek kanal; bot açılışta ve her yeni kanalda, jail rolünün diğer tüm kanalları
    // görmesini engeller, sadece bu kanalı görünür bırakır. null: kanal görünürlüğü senkronize edilmez
    jail: '1538944385041956924',
  },

  // Başkalarının sicilini görebilen roller (izinlerden bağımsız): Yetkili Ekibi (bütün yetkililer) ve Sorun Çözücü
  viewerRoles: [basvuruConfig.roles.accept, destekConfig.roles.staff],

  // Hangi ceza için hangi yetki (yetki/config.js içindeki perm id'leri) gerekir. Yetkililerin Discord'da bu işlemler için
  // gerçek izni olması gerekmez, bot rolüne bakar. Üst bir yetki alttakini de kapsar (ban verebilen uyarı da verebilir).
  // Yönetici ya da Discord'da Üyelere Zaman Aşımı / Yasakla izni olanlar da yapabilir.
  punishPerms: {
    uyari: ['uyari', 'mute', 'jail', 'kick', 'ban'],
    mute: ['mute', 'jail', 'ban'],
    jail: ['jail', 'ban'],
    ban: ['ban'],
  },

  // Değerlendirme kaldırabilen roller: Sorun Çözücü Lideri
  ratingManagers: [degerlendirmeConfig.roles.leader],

  // Sicildeki "Toplam Ceza Puanı": her ceza türünün puanı (sicilden silinen kayıtlar sayılmaz, kaldırılan/süresi
  // dolan cezalar da toplama dahil kalır; puan kalıcı bir sicil notu gibidir)
  penaltyPoints: {
    uyari: 5,
    mute: 10,
    jail: 20,
    ban: 30,
  },

  // Ceza puanı kısıtlama kademeleri: toplam puan eşiği geçilince rol otomatik verilir, puan eşiğin altına düşünce
  // (örneğin sicilden silinince) rol geri alınır. Rolün kanallarda neyi kısıtlayacağını (mesaj atamama, ses
  // kısıtlaması, tepki verememe vb.) Discord'da o role izin olarak sen tanımlarsın, bot sadece rolü yönetir.
  // roleId null olduğu sürece o kademe devre dışıdır.
  pointTiers: [
    { points: 15, roleId: null, label: 'Kısıtlama I' },
    { points: 30, roleId: null, label: 'Kısıtlama II' },
    { points: 50, roleId: null, label: 'Kısıtlama III' },
  ],

  // Süreli cezaların bitip bitmediği kaç saniyede bir kontrol edilir
  sweepSeconds: 30,
};
