// Kurallar paneli ayarları ve metni. Metni değiştirip botu yeniden başlatınca panel kendiliğinden güncellenir.
// Maddeler bölüm numarasıyla otomatik numaralanır (1.1, 1.2 ...). Bir mesaj en fazla 4000 karakter olabilir.
const destekConfig = require('../destek/config');

module.exports = {
  // Panelin gönderileceği kanal (#kurallar)
  channel: '1538533642832318517',

  // Panel görseli (doğrudan URL)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555878836359397506/kurallarkazuki.jpg?backend=b2&ex=6ac37215&is=6ac22095&hm=f34047a435a7a6dc96bfccab26216339d5e5b41fdf8d671d46d522a72e28fa95&',

  sections: [
    {
      title: 'Genel & Teknik Kurallar',
      rules: [
        'Discord sunucusu, YouTube, Instagram vb. yerlerin **reklamını yapmak** (DM dahil) yasaktır.',
        'Oyun hesabı, ürün satışı ve her türlü **ticaret** yasaktır.',
        'Kanalları **amacı dışında** kullanmak yasaktır.',
        'Bot komutları **yalnızca ilgili kanallarda** kullanılır, eğlence botlarını normal komut kanalında kullanmayın.',
        'Yetkilileri **gereksiz yere etiketlemek** yasaktır, sadece önemli durumlarda etiketleyin.',
        '**Yetki istemek** yasaktır.',
        '**Boş destek talebi** ya da satın alım talebi açmak yasaktır.',
      ],
    },
    {
      title: 'Sohbet & Saygı Kuralları',
      rules: [
        '**Küfür, hakaret** ve aşağılayıcı ifadelerin her türlüsü kesinlikle yasaktır.',
        'Din, dil, ırk, cinsiyet, yönelim ve siyaset üzerinden **ayrımcılık** ve tartışma başlatmak yasaktır.',
        'Üyeleri küçük düşürmek, **alay etmek** ya da psikolojik baskı kurmak yasaktır.',
        'Aşırı **caps lock**, **spam** ya da **flood** yasaktır.',
        'Kişiye ait **özel hayatı ifşa** edecek paylaşımlar yasaktır.',
        'Bayatlamış espriler (sus knk, 31, napim vb.) ve rahatsız edici şakalar yasaktır.',
        'Sohbeti **izdivaç/evcilik** oyununa çevirmek yasaktır.',
        'Sohbette **yabancı dil** kullanımı yasaktır.',
        'Tanımadığın kişileri **DM\'e çağırmak** ya da rahatsız etmek yasaktır.',
      ],
    },
    {
      title: 'İçerik Kuralları',
      rules: [
        '**+18 içerik** (NSFW, kan, vahşet, cinsellik vb.) kesinlikle yasaktır.',
        '**Terör**, yasa dışı faaliyet ya da bunlara özenen içerikler yasaktır.',
        'Anime **spoilerları** etiketlenmeden paylaşılamaz.',
        'Aşırı GIF ve sohbeti kirleten medya paylaşımı yasaktır.',
        'Profil fotoğrafında ve isimde **+18 ya da rahatsız edici** içerik yasaktır.',
      ],
    },
    {
      title: 'Sesli Kanal Kuralları',
      rules: [
        'Sesli kanallarda **troll** dahil rahatsızlık veren her davranış yasaktır.',
        'Sesli kanallarda da yazılı kanallardaki gibi **küfür** yasaktır.',
        '**Bas açıp bağırmak**, mikrofonla ortamı domine etmek yasaktır.',
        'Özel odalarda **kuralları çiğneyen isimler** kullanmak ve sürekli gir-çık yapmak yasaktır.',
        'Yayın açtığında gösterdiğin her şeyde de **bu kurallar geçerlidir**.',
        'Müzik botlarını ve ses panelini **troll amaçlı** kullanmak yasaktır.',
      ],
    },
    {
      title: 'Reklam & Dış Etkileşim',
      rules: [
        '**Başka sunuculara davet linki** paylaşmak yasaktır.',
        'DM yoluyla gelen reklamları **yetkililere bildirin**.',
        'Yönetimden **izinsiz** sunucuyu kayda almak ve sosyal medyada paylaşmak yasaktır.',
        'Sunucu adına başka platformlarda rahatsızlık vermek yasaktır.',
      ],
    },
    {
      title: 'Yetki & Ceza Sistemi',
      rules: [
        'Yetkililerin **uyarı ve yönlendirmelerine** uymak zorunludur.',
        'Yetkili olmayan birinin **uyarı ya da ceza vermeye** kalkışması yasaktır.',
        'Yetkililerin **vaktini boşa harcamak** cezalandırılır.',
        'Cezalar sicile işlenir: **Uyarı → Susturma / Jail → Yasaklama**. Tekrarlanan ihlallerde ceza puanı artar.',
      ],
    },
  ],

  // En alttaki not. Destek kanalı otomatik etiketlenir.
  note:
    '**Kurallarda yazmıyor olması bir davranışı serbest kılmaz;** topluluk düzenini bozan her davranış cezalandırılabilir. ' +
    'Sunucuya katılan herkes bu kuralları ve **Discord Hizmet Şartları**\'nı kabul etmiş sayılır. ' +
    `Bir sorun yaşarsan <#${destekConfig.channels.panel}> kanalından bize ulaşabilirsin.`,
};
