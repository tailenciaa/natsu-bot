// Coin ekonomisi ayarları. Coin yalnızca sınırlı ve ölçülü kaynaklardan kazanılır (günlük giriş, seviye atlama,
// haftalık derece, saygınlık verme); mesaj ya da mesaj spam'iyle doğrudan üretilemez. Tek harcama yeri profil
// kozmetikleridir (çerçeve ve tema), bu yüzden enflasyonu tutmak için fiyatlar kozmetikte kalır.
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
};
