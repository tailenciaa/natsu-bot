// Görev rozetlerinin (rozet.js'te `gorev: true` olanlar) ödül rolleri. Roller sunucuda oluşturulup ID'leri buraya
// yazılır; boş (null) bırakılan görev için yalnızca rozet kazanılır, rol verilmez. Amaç: üyelerin bot üzerinde
// uzun vadeli bir uğraşı olsun ve ilerlemeleri görünür bir karşılığa bağlansın.
module.exports = {
  gorevRolleri: {
    'sohbet-efsanesi': null, // 25 000 mesaj
    'ses-efsanesi': null, // 500 saat sesli sohbet
    'yayin-efsanesi': null, // 100 saat ekran paylaşımı
    'iki-yuzluk': null, // mesaj ve ses seviyesinin ikisi de 50
    sadakat: null, // 3 yıl
    hazine: null, // 20 000 coin kazanmak
    muzayede: null, // 8 kozmetik sahibi
  },
};
