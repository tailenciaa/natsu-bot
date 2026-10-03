// Sunucu etiketi sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.

module.exports = {
  channels: {
    // Etiketi takan üyenin etiketlenip teşekkür edildiği kanal
    announce: '1538944779298275368',
  },

  roles: {
    // Sunucu etiketini profilinde gösteren üyelere verilir, etiketi çıkarınca geri alınır
    tag: '1554403288424644738',
  },

  // Etiketi çıkarıp tekrar takan üye için kanala en erken kaç saat sonra yeniden mesaj atılır (rol yine hemen verilir)
  announceCooldownHours: 24,

  // Teşekkür mesajının kenar rengi (etiket rozetiyle uyumlu pembe)
  color: 0xff8fc7,
};
