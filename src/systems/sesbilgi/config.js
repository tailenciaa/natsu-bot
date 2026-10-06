// Sesli bilgi paneli ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  // Panelin gönderildiği kanal (#sesli-bilgi)
  channel: '1538940522469662721',
  // Panelin görseli (doğrudan URL). Discord CDN ek dosya linkleri imzalı ve süreli olur; link çalışmaz olursa
  // Discord'da görseli tekrar açıp "Bağlantıyı Kopyala" ile yeni bir link alıp burayı güncellemek gerekir.
  banner:
    'https://cdn.discordapp.com/attachments/1538539811697332385/1556669906676617326/seslibilgikazuki.jpg?backend=b2&ex=6ac50153&is=6ac3afd3&hm=440493ec55aaff70f54f64d098a1059f8420af1f9e9cc7e5dbf58acfcb67846c&',

  // Panelde adı geçen kanallar
  channels: {
    createRoom: '1538940395663130674', // özel oda oluştur
    roomGuide: '1538940282895208518', // özel oda rehberi
    permanentRooms: '1538941087195074702', // kalıcı oda bilgi
    stream: '1538940642892324864', // yayın yetkisi
    weekly: '1538538279627132999', // haftanın aktifleri
    support: '1538535372588326973', // destek talebi
  },
  // Haftanın ses aktifleri rolü ve ses yetkilisi rolü
  roles: {
    weeklyVoice: '1554240785644396704',
    voiceStaff: '1554239999619375274',
  },

  // Ses seviyesi rollerinin ayrıcalıkları: seviye -> açıklama (roller seviye/config.js'ten gelir)
  perks: {
    5: 'Sesli kanallarda diğer üyelerden **ayrı renkte** görünürsün.',
    10: '**Ses panelini** (soundboard) kullanabilirsin.',
    15: 'Sesli kanallarda **yayın açıp ekran paylaşabilirsin**.',
    20: 'Etkinliklerde **oyun başkanı** olma şansı kazanırsın.',
    25: 'Sesli kanallarda **harici ses efektlerini** kullanabilirsin.',
    30: '**Günün sorusu** ve **sohbet bildirimi** konularını seçebilirsin.',
    40: 'Kazuki toplantılarına **misafir** olarak katılabilirsin.',
    50: 'Özel odanda **ekstra yönetim hakları** kazanırsın.',
    60: 'Sunucuya **1 ses efekti** ekletme hakkı kazanırsın (destek talebiyle).',
    70: 'Çekiliş ve etkinliklerde **önceliklisin**.',
    80: 'Kendine özel bir **rol** açtırabilirsin (destek talebiyle).',
    90: '**Ses yetkilisi** adaylığı için değerlendirilirsin.',
    100: 'Ses seviyesinin **zirvesi**, sunucunun en aktif seslilerinden birisin.',
  },
};
