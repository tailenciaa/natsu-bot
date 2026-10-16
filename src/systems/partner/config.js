// Partner sistemi ayarları. ID değiştirince botu yeniden başlatmak yeterli.
module.exports = {
  channels: {
    // Üyelerin partner talebiyle geldiği kanal: burada "partner" / "dm" gibi kelimeler geçince ya da partner
    // yetkilisi rolü etiketlenince bot mesaja yanıt olarak oto partner teklifini sunar
    request: '1538536775956566117',
    // Oto partner isteklerinin onay/red için yetkililere düştüğü kanal
    review: '1538943678926557205',
    // Onaylanan partner metinlerinin bulunduğu kanal. Bu kanala düşen her mesaj (oto onaylı ya da elle atılmış,
    // fark etmez) bot tarafından silinip iki mesajla yeniden paylaşılır: üstte düz metin ilanı (Discord davet
    // önizlemesini ve ekleri ancak düz mesajda gösterir), altta partner sayılarını ve butonları taşıyan CV2 kart.
    // @everyone/@here hiçbir zaman gerçek bir bildirim göndermez (hem kanal izniyle hem bot her zaman mention'ları
    // kapalı gönderir).
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
    lead: '1554239996058411068',
  },

  // Partner talebini tetikleyen kelimeler (mesaj küçük harfe çevrilip tam kelime olarak aranır)
  triggerWords: ['partner', 'dm'],

  // Partner yenileme onaylanınca karşı sunucuya gönderilen, bizim sunucumuzu tanıtan sabit metin.
  // İlk satır sunucunun adı: partner metni panelinde kartın başlığında durur, gövde ondan sonrasıdır.
  ourAdText: '**Kazuki Anime & Public**\n' +
    'Türkçe anime, oyun ve sohbet sunucusu: seviye sistemi ödüllü, etkinlik haftada birkaç kez, destek ekibi seste anında yanında.\n' +
    '\n' +
    '**Neden Kazuki?**\n' +
    '· Mesaj ve ses seviyesi ayrı yürür; her 5 seviyede yeni rol ve ayrıcalık gelir\n' +
    '· Coin ekonomisi: günlük giriş, görev kutuları, Keşif Yolu ve sezon ödülleri\n' +
    '· Profil kartı, rozetler ve sıralama tabloları: mesaj, ses, yayın, saygınlık, coin\n' +
    '· Kendi sesli odanı açarsın; ismi, limiti ve devri sen yönetirsin\n' +
    '· Vampir Köylü, Kırmızı Koltuk, Gartic Phone, Spyfall, Among Us, Brawlhalla ve 5v5 iç maçlar\n' +
    '· Düzenli çekilişler, haftanın şampiyonları ve üyelerin verdiği saygınlık ödülleri\n' +
    '· Oyun Salonu ve Arka Sokaklar: rulet, şans merdiveni, keşif gezileri ve soygun riski\n' +
    '· Yüzükle evlilik teklifi et, çift rolünü al; yetkili alımı da her zaman açık\n' +
    '\n' +
    '**Kurallarımız net:** küfür, taciz, ayrımcılık ve +18 içerik yok; sorun seste anında çözülür.\n' +
    'Davet: https://discord.gg/kazuki',
};
