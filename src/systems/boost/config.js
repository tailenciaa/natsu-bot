// Sunucu takviyesi (boost) ayarları. ID değiştirince botu yeniden başlatmak yeterli.

module.exports = {
  // Biri takviye başlattığında kısa teşekkür mesajının gönderileceği kanal
  channel: '1538534176276619264',

  // Takviye eden bir üyenin ücretsiz ekleyebileceği emoji ve çıkartma sayısı (emoji sistemi bu haktan yararlanır)
  perks: { emoji: 1, sticker: 1 },

  // "Booster İşlemleri" panelinin gönderileceği kanal
  panelChannel: '1538534459836473366',

  // Boosterların seçebileceği hazır renk rolleri (tek seçimli, gradyanlar dahil). Her biri { roleId, label }.
  // Roller Discord'da oluşturulup buraya eklenene kadar liste boş kalır, panelde renk seçimi görünmez.
  colorRoles: [],
};
