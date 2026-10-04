// Sunucu takviyesi (boost) ayarları. ID değiştirince botu yeniden başlatmak yeterli.

module.exports = {
  // Biri takviye başlattığında kısa teşekkür mesajının gönderileceği kanal
  channel: '1538534176276619264',

  // Takviye eden bir üyenin ücretsiz ekleyebileceği emoji ve çıkartma sayısı (emoji sistemi bu haktan yararlanır)
  perks: { emoji: 1, sticker: 1 },

  // "Booster İşlemleri" panelinin gönderileceği kanal
  panelChannel: '1538534459836473366',

  // Panel görseli (doğrudan URL)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555882725863325846/boosterpanelikazuki.jpg?backend=b2&ex=6ac375b4&is=6ac22434&hm=99488a08584b6f5093b8aa82814e1b8248f9aa8e8ba0604098189683f7525014&',

  // Boosterların seçebileceği hazır renk rolleri (tek seçimli, gradyanlar dahil). Her biri { roleId, label }.
  // Roller Discord'da oluşturulup buraya eklenene kadar liste boş kalır, panelde renk seçimi görünmez.
  colorRoles: [],
};
