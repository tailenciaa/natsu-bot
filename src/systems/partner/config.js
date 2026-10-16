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
  // Anlatılan şey oyun listesi değil (o oyunlar her sunucuda var): bizdeki fark sunucunun kendi botunun
  // içinde yürüyen oda, evlilik, ekonomi ve sicil düzeni; bir de kurulduğundan beri tuttuğumuz söz.
  // Süs dili örnek ilanlardan alındı ve bilerek seçildi: bu metin kopyalanıp karşı tarafın ilan kanalına
  // yapıştırılıyor. Kanat/elmas/çizgi glifleri (U+029A, U+029E, U+2756, U+02D6, U+2500, U+231E, U+27A4)
  // gerçek emoji değil; bot metinlerindeki emoji yasağına takılmaz.
  ourAdText: [
    "**Kazuki Anime & Public**",
    "",
    "˖ ʚ ˖ *Türkçe anime & public topluluğu* ˖ ɞ",
    "",
    "──────────── ˖ ❖ ˖ **Neden Kazuki?** ˖ ❖ ˖ ────────────",
    "",
    "˖ ❖ ˖ Sunucunun içinde **kendi botumuz** çalışır: odan, kasan, evliliğin ve sicilin tek yerden yürür.",
    "˖ ❖ ˖ **Kendi ses odan** bir komutla açılır; ismi, limiti, kilidi ve davetleri tamamen senin.",
    "˖ ❖ ˖ Haftanın ses şartını tutan oda **kalıcı** olur, seninle birlikte büyür.",
    "˖ ❖ ˖ **Yüzükle evlilik teklifi** edersin: çift rolü ve tören dahil her şey burada.",
    "˖ ❖ ˖ **Görev → kutu → anahtar:** her gün üç görev, üçü birden bitince günün demeti açılır.",
    "˖ ❖ ˖ **Mesaj ve ses seviyesi ayrı** yürür, her 5 seviyede yeni rol; profil kartın çizilip gelir.",
    "˖ ❖ ˖ **Kanıtsız ceza yok:** her ceza numarasıyla kanıt kanalına düşer, sicilin tek yerden görünür.",
    "",
    "──────────── ˖ ❖ ˖ **Sözümüz** ˖ ❖ ˖ ────────────",
    "",
    "˖ ❖ ˖ Küfür, taciz, ayrımcılık ve +18 içerik yok; anime izlememiş olman da sorun değil.",
    "˖ ❖ ˖ Aktif olan görülür: rol, ödül ve yetki dağıtımı buna göre yürür.",
    "",
    "➤ **Davet:** https://discord.gg/kazuki",
    "➤ @everyone ┇ @here",
  ].join('\n'),
};
