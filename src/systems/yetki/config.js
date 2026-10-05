// Elle yetki verme (/yetki-ver) ayarları.
// roleId boş (null) olanlar panelde görünür ama rol verilmez; roller ayarlanınca buraya yazılır.

module.exports = {
  // Yeni yetkiliye giden DM'lerde "Başlarken" bölümünde gösterilen kanallar (yetkili komut kanalı core/config.js'ten gelir)
  guide: {
    rules: '1538944989432774746', // yetkili kuralları
    info: '1538945093921153206', // yetkili bilgilendirme
    chat: '1538945273378639913', // yetkili sohbet
  },

  // Yetkiler: botun ve Discord'un kontrol ettiği yetki rolleri. Çoğu işaret rolü olarak durur, bot kendi rol kontrolüyle ne
  // yapılabileceğine karar verir (sicil/config.js punishPerms); gerçek Discord izinleri en aşağıda.
  perms: [
    { id: 'uyari', label: 'Uyarı', roleId: '1556362726912294954' },
    { id: 'mesaj', label: 'Mesaj Yönetimi', roleId: '1554240782897119292' },
    { id: 'mute', label: 'Susturma', roleId: '1554240782024704010' },
    { id: 'jail', label: 'Jail', roleId: '1556403486827089950' },
    { id: 'ses', label: 'Ses Yönetimi (Taşıma)', roleId: '1554240781508681889' },
    { id: 'kick', label: 'Atma', roleId: '1554240782024573048' },
    { id: 'ban', label: 'Yasaklama', roleId: '1554239999111864410' },
  ],

  // Görev rolleri: yetkilinin hangi alanda çalıştığını gösteren roller (yetkili ve lider ayrı). Denetleyici gibi
  // yönetici rolleri buraya konmaz.
  duties: [
    { id: 'ticket', label: 'Ticket Yetkilisi', roleId: '1554237787421548704' },
    { id: 'ticket-lider', label: 'Ticket Lideri', roleId: '1554239996645613638' },
    { id: 'sorun', label: 'Sorun Çözücü', roleId: '1544337671340433569' },
    { id: 'sorun-lider', label: 'Sorun Çözücü Lideri', roleId: '1553133497781325954' },
    { id: 'ses', label: 'Ses Yetkilisi', roleId: '1554239999619375274' },
    { id: 'ses-lider', label: 'Ses Lideri', roleId: '1554239998214152222' },
    { id: 'sohbet', label: 'Sohbet Sorumlusu', roleId: '1554239997559705720' },
    { id: 'sohbet-lider', label: 'Sohbet Lideri', roleId: '1554240000177078322' },
    { id: 'etkinlik', label: 'Etkinlik Yetkilisi', roleId: '1554240000529539083' },
    { id: 'etkinlik-lider', label: 'Etkinlik Lideri', roleId: '1554239995412488304' },
    { id: 'partner', label: 'Partner Yetkilisi', roleId: '1554237785416794202' },
    { id: 'partner-lider', label: 'Partner Lideri', roleId: '1554239996058411068' },
    { id: 'oryantasyon', label: 'Oryantasyon Yetkilisi', roleId: '1554240783929049168' },
    { id: 'oryantasyon-lider', label: 'Oryantasyon Lideri', roleId: '1554240783769669663' },
    { id: 'alim', label: 'Yetkili Alım DM', roleId: '1553398951816863844' },
    { id: 'alim-lider', label: 'Yetkili Alım Lideri', roleId: '1554240783580667954' },
    { id: 'karsilama', label: 'Karşılama Ekibi', roleId: '1555890045599223868' },
  ],

  // Seviyeler (rütbeler), alttan üste: seçilince perms ve duties otomatik işaretlenir, rütbenin kendi rolü de verilir.
  // Her rütbe alttakinin yetkilerini kapsar. starter: oryantasyonda başlangıç seviyesi olarak seçilebilir.
  // extraRoleIds: rütbeyle birlikte verilen takım rolleri (Yönetim Ekibi)
  levels: [
    { id: '1', label: 'Genin', description: 'Deneme yetkili, adaylık sürecini tamamlar.', roleId: '1554237348940873758', starter: true, perms: ['uyari', 'mesaj'], duties: [] },
    { id: '2', label: 'Kōhai', description: 'Yeni yetkili, ekibe yeni katılmıştır.', roleId: '1554237348282245161', starter: true, perms: ['uyari', 'mesaj', 'mute'], duties: [] },
    { id: '3', label: 'Chūrai', description: 'Orta seviye yetkili, sohbet ve ses düzenini takip eder.', roleId: '1554237347631997029', starter: true, perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses'], duties: [] },
    { id: '4', label: 'Tsukai', description: 'Yetkili, destek ve sohbet düzeninde görev alır.', roleId: '1554237342917726249', perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses'], duties: ['sorun'] },
    { id: '5', label: 'Shido', description: 'Yetkili, sunucu düzeninde aktif rol oynar.', roleId: '1554237786809307206', perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick'], duties: ['sorun'] },
    { id: '6', label: 'Kaizen', description: 'Deneyimli yetkili, düzenin sürdürülmesinde görev alır.', roleId: '1554237342296969216', perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick'], duties: ['sorun', 'alim'] },
    { id: '7', label: 'Kyōrin', description: 'Üst yetkili, yetkili ekibine yol gösterir.', roleId: '1554237341768482816', perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick', 'ban'], duties: ['sorun', 'alim'] },
    { id: '8', label: 'Shōzen', description: 'Yönetim Ekibi, moderatör.', roleId: '1554237340321448038', extraRoleIds: ['1555890044768624662'], perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick', 'ban'], duties: ['sorun', 'alim'] },
    { id: '9', label: 'Daichi', description: 'Yönetim Ekibi, üst moderatör.', roleId: '1554237339671208077', extraRoleIds: ['1555890044768624662'], perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick', 'ban'], duties: ['sorun', 'alim'] },
    { id: '10', label: 'Ryūsei', description: 'Yönetim Ekibi, asistan yönetici.', roleId: '1554237339100774490', extraRoleIds: ['1555890044768624662'], perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick', 'ban'], duties: ['sorun', 'alim'] },
    { id: '11', label: 'Tenshi', description: 'Yönetim Ekibi, yönetici.', roleId: '1554237337993486377', extraRoleIds: ['1555890044768624662'], perms: ['uyari', 'mesaj', 'mute', 'jail', 'ses', 'kick', 'ban'], duties: ['sorun', 'alim'] },
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
