// Önizleme ve lint ayarları
module.exports = {
  // Emoji kuralı dışında bırakılan simgeler (⭐ her zaman serbest). Varsayılan boş.
  ALLOW_EMOJI: [],
  // TAMAMEN BÜYÜK HARF uyarısından muaf kısaltmalar
  ABBREVIATIONS: ['NSFW', 'HTTP', 'HTTPS', 'JSON', 'HTML', 'LGBT', 'ASMR'],
  // Elle gözden geçirilmesi gereken yön sözcükleri
  DIRECTION_WORDS: ['aşağıdaki', 'yukarıdaki', 'sağdaki', 'soldaki', 'üstteki', 'alttaki', 'aşağıdan', 'yukarıdan'],
  // "tekrar" uyarısından muaf tutulan satırlar (listelerde her kayıtta yinelenen kalıplar)
  REPEAT_IGNORE: [],
  // Bitişik yineleme uyarısından (kelime kelime) muaf ikilemeler: "ağır ağır", "adım adım" gibi doğru kalıplar
  IKILEME: ['ağır', 'yavaş', 'bir', 'birer', 'ikişer', 'uzun', 'güneş', 'yeşil', 'adım', 'satır', 'kendi', 'ayrı', 'hafta', 'harfi', 'tekrar', 'kelime', 'göz', 'bak', 'dur', 'aşağı', 'öne', 'geri', 'tane', 'kez'],
  // Zaman damgalarının gösterileceği saat dilimi
  TIMEZONE: 'Europe/Istanbul',
  // Önizleme genişlikleri (px)
  WIDTHS: { desktop: 520, mobile: 360 },
};
