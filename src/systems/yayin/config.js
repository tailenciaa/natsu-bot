// Yayın yetkisi sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Butona basınca verilen, sesli kanallarda yayın açmayı sağlayan rol
  role: '1544356867294109746',
  // Panelin gönderildiği kanal
  channel: '1538940642892324864',
  // Panelin görseli (Discord CDN bağlantısı). Bot bu görseli indirip panele kalıcı bir ek olarak koyar (core/banner.js);
  // bağlantının süresi dolsa bile görsel görünmeye devam eder.
  banner:
    'https://cdn.discordapp.com/attachments/1538539811697332385/1556669860166115388/yaynyetkisikazuki.jpg?backend=b2&ex=6ac50148&is=6ac3afc8&hm=57b015216e593fce15733320fdc2e5f61e53088d68a1c88b4c7aa64237d1d0e0&',
};
