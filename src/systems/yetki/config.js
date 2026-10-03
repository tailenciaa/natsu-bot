// Elle yetki verme (/yetki-ver) ayarları.
// roleId boş (null) olanlar panelde görünür ama rol verilmez; roller ayarlanınca buraya yazılır.

module.exports = {
  // Tek tek verilebilen yetkiler
  perms: [
    { id: 'mesaj', label: 'Mesaj Yönetimi', roleId: null },
    { id: 'kayit', label: 'Kayıt', roleId: null },
    { id: 'mute', label: 'Susturma', roleId: null },
    { id: 'ses', label: 'Ses Yönetimi', roleId: null },
    { id: 'destek', label: 'Destek Talepleri', roleId: null },
    { id: 'kick', label: 'Atma', roleId: null },
    { id: 'ban', label: 'Yasaklama', roleId: null },
    { id: 'basvuru', label: 'Başvuru İnceleme', roleId: null },
  ],

  // Seviyeler: seçilince "perms" otomatik işaretlenir, seviyenin kendi rolü de verilir
  levels: [
    { id: '1', label: 'Deneme Yetkili', roleId: null, perms: ['mesaj'] },
    { id: '2', label: 'Yetkili', roleId: null, perms: ['mesaj', 'kayit', 'mute'] },
    { id: '3', label: 'Kıdemli Yetkili', roleId: null, perms: ['mesaj', 'kayit', 'mute', 'ses', 'destek', 'kick'] },
    { id: '4', label: 'Üst Yetkili', roleId: null, perms: ['mesaj', 'kayit', 'mute', 'ses', 'destek', 'kick', 'ban', 'basvuru'] },
  ],
};
