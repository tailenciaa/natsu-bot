// Önizleme ve lint ayarları
module.exports = {
  // Emoji kuralı dışında bırakılan simgeler (⭐ her zaman serbest). Varsayılan boş.
  ALLOW_EMOJI: [],
  // TAMAMEN BÜYÜK HARF uyarısından muaf kısaltmalar
  ABBREVIATIONS: ['NSFW', 'HTTP', 'HTTPS', 'JSON', 'HTML', 'LGBT', 'ASMR'],
  // Elle gözden geçirilmesi gereken yön sözcükleri
  DIRECTION_WORDS: ['aşağıdaki', 'yukarıdaki', 'sağdaki', 'soldaki', 'üstteki', 'alttaki', 'aşağıdan', 'yukarıdan'],
  // "tekrar" uyarısından muaf tutulan satırlar (listelerde her kayıtta yinelenen kalıplar)
  // Yardım menüsünde ardışık komutların gereksinimi aynı olabilir ("Gerekli: Yöneticiler"), tekrar sayılmaz
  REPEAT_IGNORE: [/^Gerekli: /],
  // Zaman damgalarının gösterileceği saat dilimi
  TIMEZONE: 'Europe/Istanbul',
  // Önizleme genişlikleri (px)
  WIDTHS: { desktop: 520, mobile: 360 },
};
