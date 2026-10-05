// Elle yetki verme (/yetki-ver) ayarları.
// roleId boş (null) olanlar panelde görünür ama rol verilmez; roller ayarlanınca buraya yazılır.

module.exports = {
  // Tek tek verilebilen yetkiler
  perms: [
    { id: 'mesaj', label: 'Mesaj Yönetimi', roleId: '1554240782897119292' },
    { id: 'kayit', label: 'Kayıt', roleId: null },
    { id: 'mute', label: 'Susturma', roleId: '1554240782024704010' },
    { id: 'ses', label: 'Ses Yönetimi', roleId: '1554240781508681889' },
    { id: 'destek', label: 'Destek Talepleri', roleId: '1544337671340433569' },
    { id: 'kick', label: 'Atma', roleId: '1554240782024573048' },
    { id: 'ban', label: 'Yasaklama', roleId: '1554239999111864410' },
    { id: 'basvuru', label: 'Başvuru İnceleme', roleId: '1553398951816863844' },
  ],

  // Seviyeler: seçilince "perms" otomatik işaretlenir, seviyenin kendi rolü de verilir
  levels: [
    { id: '1', label: 'Deneme Yetkili', roleId: '1554237348940873758', perms: ['mesaj'] },
    { id: '2', label: 'Yetkili', roleId: '1554237348282245161', perms: ['mesaj', 'kayit', 'mute'] },
    { id: '3', label: 'Kıdemli Yetkili', roleId: '1554237347631997029', perms: ['mesaj', 'kayit', 'mute', 'ses', 'destek', 'kick'] },
    { id: '4', label: 'Üst Yetkili', roleId: '1554237341768482816', perms: ['mesaj', 'kayit', 'mute', 'ses', 'destek', 'kick', 'ban', 'basvuru'] },
  ],
};
