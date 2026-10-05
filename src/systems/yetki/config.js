// Elle yetki verme (/yetki-ver) ayarları.
// roleId boş (null) olanlar panelde görünür ama rol verilmez; roller ayarlanınca buraya yazılır.

module.exports = {
  // Tek tek verilebilen yetkiler. Roller sunucudaki "yetki rolleri"dir; çoğu işareti rol olarak durur, bot kendi
  // rol kontrolüyle ne yapılabileceğine karar verir (sicil/config.js punishPerms). Gerçek Discord izinleri aşağıda.
  perms: [
    { id: 'uyari', label: 'Uyarı', roleId: '1556362726912294954' },
    { id: 'mesaj', label: 'Mesaj Yönetimi', roleId: '1554240782897119292' },
    { id: 'mute', label: 'Susturma', roleId: '1554240782024704010' },
    { id: 'jail', label: 'Jail', roleId: '1556403486827089950' },
    { id: 'ses', label: 'Ses Yönetimi', roleId: '1554240781508681889' },
    { id: 'destek', label: 'Destek Talepleri', roleId: '1544337671340433569' },
    { id: 'kick', label: 'Atma', roleId: '1554240782024573048' },
    { id: 'ban', label: 'Yasaklama', roleId: '1554239999111864410' },
    { id: 'basvuru', label: 'Başvuru İnceleme', roleId: '1553398951816863844' },
  ],

  // Seviyeler: seçilince "perms" otomatik işaretlenir, seviyenin kendi rolü de verilir. Her seviye alttakinin yetkilerini kapsar.
  levels: [
    { id: '1', label: 'Deneme Yetkili', roleId: '1554237348940873758', perms: ['uyari', 'mesaj'] },
    { id: '2', label: 'Yetkili', roleId: '1554237348282245161', perms: ['uyari', 'mesaj', 'mute'] },
    { id: '3', label: 'Kıdemli Yetkili', roleId: '1554237347631997029', perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'destek', 'kick'] },
    { id: '4', label: 'Üst Yetkili', roleId: '1554237341768482816', perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'destek', 'kick', 'ban', 'basvuru'] },
  ],

  // Yetki rollerinin Discord'daki gerçek izinleri. Bot açılırken eksikse ekler, hiçbir zaman izin almaz.
  discord: {
    // Sunucu genelinde verilen izinler. perm: yukarıdaki yetki id'si; roleId: doğrudan rol (Yetkili Ekibi)
    rolePerms: [
      { perm: 'kick', allow: ['KickMembers'] },
      { perm: 'ban', allow: ['BanMembers'] },
      // Yetkili komutlarının sadece yetkililere görünmesi için (core/config.js staffPermission)
      { roleId: '1555890043992940614', allow: ['PrioritySpeaker'] },
    ],
    // Sadece belirtilen kanallarda verilen izinler: Mesaj Yetkisi sohbet kanallarında mesaj silebilir ama
    // kurallar, duyuru, bilgilendirme gibi kanallarda silemez
    channelPerms: [
      {
        perm: 'mesaj',
        allow: ['ManageMessages'],
        channels: [
          '1538536247138590801', // sohbet
          '1538536775956566117', // partner sohbet
          '1538536351119446127', // bot komut
          '1538536448674766878', // medya link edit
          '1538536951395913759', // çizim
          '1538537038792630293', // patili dostlar
          '1538537529035202642', // owo
          '1538537611554201650', // mudae
          '1538538736189571133', // etkinlik sohbet
          '1538540051028381696', // etkinlik öneri
          '1538542760506822656', // oyuncu arama
          '1538542814680453281', // lobiler
          '1538542919084941333', // oyun clipler
          '1538543035346849913', // oyun tartışmaları
          '1538544350185914389', // sorun çözme sohbet
        ],
      },
    ],
  },
};
