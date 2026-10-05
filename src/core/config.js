// Tüm sistemlerin ortak ayarları. Her sistemin kendi kanal, rol ve metin ayarları kendi klasöründeki config.js'te.

module.exports = {
  // Panel başlıklarında görünen ad
  botName: 'Kazuki',

  // Bot tek bir sunucuda çalışır; komutlar ve paneller sadece bu sunucuya kurulur (.env içindeki GUILD_ID)
  guildId: process.env.GUILD_ID?.trim(),

  // Yetkili komutları (/sicil ile başkalarının sicili ve ceza işlemleri, /yetki-ver) sadece bu kanalda kullanılabilir
  staffCommandChannel: '1538535501420826794',

  // Yetkili komutlarının (/uyari, /mute, /sil...) Discord'da görünmesi için gereken izin. Yetkili Ekibi rolüne bot açılırken
  // "Öncelikli Konuşmacı" izni eklenir (yetki/access.js); böylece komutlar sadece yetkililere görünür, kimin ne yapabileceğine
  // ise bot kendi rol kontrolüyle karar verir. Yöneticiler izne bakılmadan hepsini görür.
  staffPermission: 1n << 8n,

  // Panel başlığı sola hizalı: Discord'da ortalama yok, baştaki boşlukları (bölünmez boşluk dahil) gösterirken
  // kendisi kırpıyor, bu yüzden boşlukla ortalamanın bir yolu yok.
  panelTitle: (title) => `## ${title}`,

  colors: {
    primary: 0x5865f2,
    success: 0x57f287,
    warning: 0xfee75c,
    danger: 0xed4245,
  },
};
