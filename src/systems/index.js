// Botun sistemleri. Her sistem kendi klasöründe: index.js (komutlar ve işleyiciler), config.js (kanal, rol ve
// metin ayarları), ui.js (mesajlar), store.js (kayıtlar). Yeni bir sistem eklemek için klasörünü açıp buraya eklemek yeterli.
//
// Bir sistemin dışa verdiği alanlar (hepsi isteğe bağlı):
//   commands : slash komut tanımları
//   help     : { category: [anahtar, ad], access: { 'komut yolu': 'kimler kullanabilir' } } (yardım menüsü için)
//   slash   : { komutAdı: işleyici }
//   buttons  : { butonID: işleyici }          (tam eşleşen buton ID'leri)
//   modals   : { formID: işleyici }           (tam eşleşen form ID'leri)
//   prefixed : [[önek, işleyici], ...]        (önek:veri şeklindeki buton/form/menü ID'leri, DM'de de çalışır)
//   events   : { discordOlayı: işleyici }
module.exports = [
  require('./kurallar'),
  require('./bilgilendirme'), // #bilgilendirme paneli: sunucu hakkında bölümler halinde bilgi
  require('./destek'),
  require('./degerlendirme'),
  require('./basvuru'),
  require('./oryantasyon'),
  require('./yetki'),
  require('./otorol'),
  require('./etiket'),
  require('./boost'),
  require('./sicil'),
  require('./yenihesap'),
  require('./sicil/commands'), // Hızlı ceza komutları (/ban, /mute...); sicil'in motorunu kullanır, kendi yardım kategorisi var
  require('./cezalarim'), // #cezalarım paneli; sicil'in kayıtlarını okur
  require('./partner'),
  require('./partnergorme'),
  require('./siralama'),
  require('./seviye'),
  require('./aktif'),
  require('./saygi'),
  require('./vip'),
  require('./profil'),
  require('./emoji'),
  require('./ses'),
  require('./ozel-oda'),
  require('./durum'),
  require('./temizle'), // /sil: kanaldaki mesajları toplu siler
  require('./log'), // Mesaj, ses, üye, moderasyon, sunucu ve boost logları; ana log kanalının altında kategori alt başlıkları
  require('./yardim'),
];
