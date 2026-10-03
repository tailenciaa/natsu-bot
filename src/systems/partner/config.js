// Partner sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  channels: {
    // Üyelerin partner talebiyle geldiği kanal: burada "partner" / "dm" gibi kelimeler geçince ya da partner
    // yetkilisi rolü etiketlenince bot mesaja yanıt olarak oto partner teklifini sunar
    request: '1538536775956566117',
    // Oto partner isteklerinin onay/red için yetkililere düştüğü kanal
    review: '1538943678926557205',
    // Onaylanan partner metinlerinin bulunduğu kanal. Bu kanala düşen her mesaj (oto onaylı ya da elle atılmış,
    // fark etmez) bot tarafından silinip kendi standart kartıyla yeniden paylaşılır; @everyone/@here hiçbir
    // zaman gerçek bir bildirim göndermez (hem kanal izniyle hem bot her zaman mention'ları kapalı gönderir).
    posts: '1538943593665007696',
    // Güvenilir partnerler listesinin sürekli güncel tutulan panelinin bulunduğu kanal: sunucu ID'si, partner
    // yetkilisi (iletişim) ve eklenme tarihiyle; liste her değiştiğinde (ekleme/çıkarma) otomatik güncellenir
    trustedList: '1555293036026658957',
    // Yasaklı partnerler listesi
    banned: '1538944004148957244',
  },

  roles: {
    // Partner tekliflerini onaylayabilen, partner gönderisini silebilen, güvenilir partner kaydındaki yetkiliyi
    // ekleyip çıkarabilen rol
    staff: '1554237785416794202',
    // Güvenilir listeden çıkarma ve kullanıcı yasaklama gibi ağır kararları verebilen üst rol
    lead: 'BURAYA_PARTNER_LIDERI_ROL_IDSI',
  },

  // Partner talebini tetikleyen kelimeler (mesaj küçük harfe çevrilip tam kelime olarak aranır)
  triggerWords: ['partner', 'dm'],

  // Teklifte bulunma (yenileme) onaylanınca karşı sunucuya gönderilen, bizim sunucumuzu tanıtan sabit metin
  ourAdText: 'BURAYA_SUNUCUMUZU_TANITAN_METNI_YAZ',
};
