// Coin ekonomisi ayarları. Coin yalnızca sınırlı ve ölçülü kaynaklardan kazanılır (günlük giriş, seviye atlama,
// haftalık derece, saygınlık verme, görevler, keşif ve eğlence); mesaj ya da mesaj spam'iyle doğrudan üretilemez.
// Harcama yerleri profil kozmetikleri (çerçeve, tema, kapak, rozet) ve butiktir (yüzük, özel rol, saygı hakkı);
// kumarhane bahsi ile soygun kefaleti parayı üyeden alıp yok eder ya da kasaya geçirir. Kazanç kanalları
// çoğaldığı için tavan şart: oyun, eğlence ve kasa soygunundan gelen coin günde winCap'ı geçemez.
module.exports = {
  // Günlük ödül: taban + seri bonusu (art arda gün, en fazla streakMax kadar) + seviye bonusu (ulaşılan en yüksek
  // mesaj/ses seviyesi başına, levelCap ile sınırlı)
  daily: { base: 40, streakBonus: 12, streakMax: 6, perLevel: 3, levelCap: 60 },

  // Etkinlik ödülleri
  awards: {
    levelUp: 20, // her seviye atlama (mesaj ya da ses)
    weekly: [150, 70, 35], // haftalık dereceler: 1., 2., 3. (mesaj, ses ve yayın kategorilerinin her biri için)
    repGiven: 10, // birine saygınlık veren üyeye (sistemde zaten günde bir kez sınırı var)
  },

  // Keşif ganimeti, eğlence karşılığı ve kasa soygunundan gün başına en fazla kazanılabilen coin. Kumarhane
  // bahsi bu tavana sayılmaz: kumarhane uzun vadede para yakan yer, oraya tavan koymak anlamsızlaşırdı.
  winCap: 1200,
};
