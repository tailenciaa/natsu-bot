// Log sistemi kanal ve görsel ayarları. ID değiştirince botu yeniden başlatmak yeterli.

module.exports = {
  channels: {
    // Grup log kanallarının açılacağı yer: bot, bu kanalın bulunduğu kategori klasöründe ve bu kanalın
    // izinleriyle her grubun kendi kanalını oluşturur (groups.js). Eski alt başlıklar burada arşivde kalır;
    // bir grubun kanalı açılamazsa (yetki yoksa) logları doğrudan bu kanala yazar.
    main: '1538944713103515789',
    // Log paneli (kategori seçim menüsü) bu kanala gönderilir
    panel: '1538944642685468702',
  },

  // Panelin görseli. Kalıcı kopyası assets/banners/logpanelitai.jpg altında durur; dosya adı bağlantıdaki adla
  // aynı olduğu sürece bot indirmeye hiç gerek duymaz, süresi dolan imza derdi olmaz (core/banner.js).
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1559159004536639488/logpanelitai.jpg',
};
