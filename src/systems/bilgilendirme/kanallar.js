// Bilgilendirme kanallarının kalıcı metinleri. Her panel kendi kanalına, bölüm başına bir mesaj olarak gönderilir
// (src/systems/bilgilendirme/index.js): metin değişince bot açılışta eski mesajları silip yenilerini koyar, kanal
// boş kalmaz. Kanal bağlantıları adla değil ID ile kurulur, kanal adı değişse de metin doğru yere gider.
// Roller ve kanallar <@&ID> / <#ID> şeklinde yazılır; Discord bunları ada çevirir. Gönderim hep
// allowedMentions: { parse: [] } ile yapılır, yani hiçbir etiket bildirim üretmez.
const partnerConfig = require('../partner/config');

// 1) Yetkili kuralları: sadece yetkili rolü taşıyanları bağlayan, sunucu kurallarının üstüne geçen maddeler
const yetkiliKurallari = {
  key: 'yetkili-kurallar',
  name: 'Yetkili Kuralları Paneli',
  title: 'Yetkili Kuralları',
  intro: 'Yetkili rolü taşıyan herkesi bağlayan kurallar. Sunucu kurallarının **yerine** değil **üstüne** geçer.',
  channel: '1538944989432774746',
  sections: [
    {
      title: 'Bu Kanal Ne İçin',
      sub: 'Üye rolündeki herkes sunucu kurallarına uyar; yetkiliden beklenen aynı kuralları harfi harfine uygulaması ve bir adım önde durmasıdır.',
      blocks: [
        {
          text: '<#1538533642832318517> kanalındaki kuralları **yetkili olarak yeniden** okuman gerekir: çünkü ihlali sen değerlendireceksin ve maddeyi bilmediğinde verdiğin karar savunulamaz hâle gelir.',
        },
        {
          heading: 'Kimleri bağlar',
          items: [
            '<@&1555890043992940614> rolünden başlayan her yetkili, rütbesi ne olursa olsun bu maddelere tabidir.',
            'Oryantasyonda bu kanal gezilir; yetki verilmesi bu kuralların **kabul edildiği** anlamına gelir.',
            'Burada yazmayan bir durumda **sağduyu** ve <#1538945273378639913> kanalında istişare esastır.',
          ],
        },
      ],
    },
    {
      title: 'Yetkilinin Davranışı',
      sub: 'Beş ilke: tarafsızlık, sakinlik, örneklik, gizlilik ve yetkinin ölçülü kullanımı. Bunların hiçbiri rütbeyle büyümez, hepsi herkese aynı geçer.',
      blocks: [
        {
          heading: 'Beş ilke',
          items: [
            '**Tarafsız ol:** Arkadaşın, yakınını ya da tartıştığın kişiyi de aynı ölçüyle değerlendir.',
            '**Sakin kal:** Üyeyle tartışmaya girme; gerilim büyüyorsa konuyu başka bir yetkiliye devret.',
            '**Örnek ol:** Küfür, caps, spam, ayrımcılık ve reklam sana da yasaktır; sohbetteki üslubun sunucunun yüzüdür.',
            '**Gizli tut:** Sana gelen şikayet ve bilgiyi üyeyle ya da başka üyelerle paylaşma.',
            '**Ölçülü kullan:** Yetkini kişisel meselede, avantaj sağlamak için ya da izin almadan rol vererek kullanma.',
          ],
          note: 'Sevip sevmemen, kiminle daha önce tartıştığın cezanın ağırlığını hiç etkilemez.',
        },
      ],
    },
    {
      title: 'Ceza Verirken',
      sub: 'Cezanın sırası, kanıtı ve kaydı vardır; ölçüyü kaçıran ya da kanıtsız verilen her işlem üye tarafından itiraz edilebilir hâle gelir.',
      blocks: [
        {
          heading: 'Sıra ve ölçü',
          text: 'Hafif ihlalde önce **uyarı**, tekrarında **susturma** ya da **jail**, ağır ya da süregiden ihlalde **yasaklama** uygulanır. Alt basamak denenmeden üste geçilmez; açıkça ağır olan ihlallerde sıra atlanır.',
        },
        {
          heading: 'Kanıt ve kayıt',
          items: [
            'Ceza öncesi **ekran görüntüsü** al ve <#1538535676000211034> kanalına bırak.',
            'Sebebi tek cümle ve **somut** yaz; "kural ihlali" gibi belirsiz sebep itirazda seni savunmaz.',
            'Sesli ihlallerde mümkünse tanık adı ya da kayıt göster.',
            'Verdiğin her ceza üyenin siciline işler; `/sicil` kartından görülebilir.',
          ],
        },
        {
          heading: 'Yapamayacakların',
          items: [
            'Kişisel bir mesele için ceza vermek.',
            'Başka bir yetkilinin verdiği cezayı kendi başına kaldırmak.',
            'Kendi verdiğin cezanın itirazını sonuçlandırmak.',
            'Rütbenin hakkı olmayan cezayı başka bir yoldan uygulamaya çalışmak.',
            'Test, şaka ya da örnek amacıyla ceza vermek.',
          ],
          note: 'Ceza komutları (`/uyari`, `/mute`, `/jail`, `/ban`, `/unmute`, `/unjail`, `/unban`, `/ceza-kaldir`, `/ceza-sil`) yalnızca <#1538535501420826794> kanalında çalışır; Discord\'un yerleşik "Zaman Aşımı / At / Yasakla" menüleri kullanılmaz.',
        },
      ],
    },
    {
      title: 'Gizlilik',
      sub: 'Yetkili gördüğü bilgiyi taşımaz. Gizlilik ihlali, yanlış verilen bir cezadan daha ağır sonuç doğurur.',
      blocks: [
        {
          items: [
            'Yetkili kanallarında konuşulan hiçbir konu üyeyle paylaşılmaz.',
            'Bir üyenin sicili, cezası, DM içeriği ya da şikayeti sohbette anlatılmaz; üye `<@etiket>` ile hedef gösterilmez.',
            'Ceza kanıtları yalnızca <#1538535676000211034> ve <#1538944713103515789> içinde dolaşır.',
            'İsim, adres, fotoğraf, hesap bilgisi gibi kişisel veri ne üyeyle ne ekip dışıyla paylaşılır.',
            'Ekran görüntülerini yetkili kanalının dışında kullanma.',
          ],
          note: 'İzinsiz kayıt almak ve sunucu adına dış platformlarda paylaşmak kurallar gereği yasaktır.',
        },
      ],
    },
    {
      title: 'Ekip Düzeni',
      sub: 'Kendi başına denemek yerine danış, alanının dışında işe el atma, kaybolma. Taleplerin sahipsiz kalması ekip kusurudur.',
      blocks: [
        {
          items: [
            'Kararından emin değilsen önce <#1538945273378639913> kanalında danış.',
            'Uzun süre ortada olmayacaksan <@&1555890044768624662> ekibinden birine haber ver.',
            'Görev alanın dışındaki işe, o alanında biri dururken el atma.',
            'Yetki isteyen üyeyi DM\'e çekme; tek yolun <#1538544076910104636> kanalı olduğunu yaz.',
            'Başka bir yetkilinin kararını kanalda düzeltme; eleştirini yetkili sohbetinde yap.',
          ],
        },
        {
          heading: 'Denetim',
          text: '<@&1554237780736090112> ekibi işlemleri kaydından denetler. Haksız bulduğun ceza ya da değerlendirme için itiraz hakkın saklıdır; itirazı kişisel bir meseleye çevirmek ayrı bir ihlaldir.',
        },
      ],
    },
    {
      title: 'Bu Kurallara Uymadığında',
      sub: 'Yetki bir ayrıcalık değil sorumluluktur; kuralı çiğneyen yetkili de cezalandırılır ve yetkisi geri alınabilir.',
      blocks: [
        {
          items: [
            'Üyeyle aynı ceza basamaklarına tabisin, üstelik **görevi kötüye kullanma** kaydı siciline işlenir.',
            'Tekrarlanan ya da ağır durumlarda yetki geri alınır; <#1538945093921153206> kanalındaki işleyiş yeniden kurulur.',
            'Yetkiyi geri almak için yeni başvuru, mülakat ve oryantasyon gerekir.',
          ],
        },
      ],
    },
  ],
};

// 2) Yetkili bilgilendirmesi: işleyiş rehberi (kanallar, rütbeler, görev alanları, bot araçları, talep sırası)
const yetkiliBilgisi = {
  key: 'yetkili-bilgi',
  name: 'Yetkili Bilgilendirme Paneli',
  title: 'Yetkili Bilgisi',
  intro: 'Yetkili olduktan sonra işlerinin geçtiği kanallar, rütbeler, görev alanları ve botun yetkili araçları tek yerde.',
  channel: '1538945093921153206',
  sections: [
    {
      title: 'Yetkili Kanalları',
      sub: 'Her işin bir kanalı var; doğru kanalda yapılan işlem hem hızlı çözülür hem de üye önünde tartışma üretmez.',
      blocks: [
        {
          items: [
            '<#1538944989432774746>: bağlayıcı **yetkili kuralları**.',
            '<#1538945093921153206>: işleyiş rehberi, yani bu kanal.',
            '<#1538945164394106990>: kadro ve kural değişikliklerinin duyurulduğu yer.',
            '<#1538945273378639913>: istişare, devir ve ekip içi sohbet.',
            '<#1538535501420826794>: ceza ve yetki komutlarının **tek** çalıştığı kanal.',
            '<#1538535676000211034>: ceza kanıtları ve ekran görüntüleri.',
            '<#1538945636085268580>: genel yetkili toplantısı ses kanalı.',
            '<#1538536351119446127>: üye komutlarının kanalı; burada düzen tutulur, yetkili işi yazılmaz.',
          ],
        },
      ],
    },
    {
      title: 'Rütbeler ve Yetkiler',
      sub: 'On bir rütbe alttan üste dizilir ve her biri alttakinin yetkisini de taşır; ceza yetkisi kademeli açılır.',
      blocks: [
        {
          items: [
            '**Genin, Kōhai, Chūrai** (deneme, yeni ve orta seviye yetkili): uyarı ve mesaj yönetimi; Kōhai ile susturma, Chūrai ile jail ve ses yönetimi.',
            '**Tsukai, Shido** (yetkili): görev alanı rolü eklenir, Shido ile üyeyi sunucudan çıkarma.',
            '**Kaizen, Kyōrin** (deneyimli ve üst yetkili): yetkili alım sürecinde görev, Kyōrin ile yasaklama.',
            '**Shōzen, Daichi, Ryūsei, Tenshi** (Yönetim Ekibi): moderatör, üst moderatör, asistan yönetici ve yönetici; nihai karar kademesi.',
          ],
          note: 'Rütbe, yetki ve görev rolleri tek yerden verilir: `/yetki-ver` (yalnızca yöneticiler, <#1538535501420826794> kanalında). Elle rol vermek yasaktır.',
        },
      ],
    },
    {
      title: 'Görev Alanları',
      sub: 'Yetki verilirken seçilen alan ne iş yapacağını belirler; bir alanda duran üye başka alanın işine sırf boşta diye atlamaz.',
      blocks: [
        {
          items: [
            '**Destek Talepleri** <@&1554237787421548704>: panelden düşen talebi **Talebi Üstlen** ile al, çözünce **Talebi Kapat** ile sebep seçerek kapat.',
            '**Sorun Çözücü** <@&1544337671340433569>: sorun çözme ses kanallarında üyeyi dinle, çözemediğini lidere devret.',
            '**Oryantasyon** <@&1554240783929049168>: yeni yetkililere kuralları, davranışı, ceza sistemini ve komutları anlat.',
            '**Sohbet Moderasyonu** <@&1554239997559705720>: yazılı kanalları izle, spam-küfür-reklamı sil, önce uyar sonra sustur.',
            '**Ses Moderasyonu** <@&1554239999619375274>: sesli kanalları gez, mikrofon spamı ve trollüğe müdahale et, özel odaya izinsiz girme.',
            '**Etkinlik** <@&1554240000529539083>: programı kur, <#1538538618468040714> kanalından duyur, düzeni sağla, sonucu ilan et.',
            '**Partner** <@&1554237785416794202>: talepleri <#1538943678926557205> kanalından yürüt, <#1555293036026658957> listesini güncel tut.',
            '**Yetkili Alım** <@&1553398951816863844>: başvuruları incele, mülakata çağır, oryantasyondan sonra yetki verilmesini onayla.',
            '**Karşılama** <@&1555890045599223868>: yeni gelen üyeyi karşıla, kurallara ve sohbete yönlendir.',
          ],
        },
      ],
    },
    {
      title: 'Botun Yetkili Araçları',
      sub: 'Bot, yetkilinin işini kayıtlı ve tek yerden yapması için kuruldu: talep, sicil, değerlendirme, log ve yetki hepsi birbiriyle konuşur.',
      blocks: [
        {
          items: [
            '**Destek paneli** <#1538535372588326973>: talep alt başlık olarak açılır; **Talebi Üstlen**, **Talebi Kapat** ve **Talebi Reddet** kartın butonlarıdır.',
            '**Yeni talep bildirimi** <#1553111362765459526>: talepler burada düşer ve <@&1544337671340433569> ekibi etiketlenir.',
            '**Canlı durum** <#1557464223208968304>: açık talepler tek mesajda listelenir; kimde, hangi aşamada, oradan okunur.',
            '**Sicil** `/sicil`: üyenin ya da yetkilinin puanlarını, taleplerini, cezalarını ve geçmişini gösterir; **Ceza Ver** butonu da aynı karttadır.',
            '**Değerlendirme** <#1538941536094519316>: üyenin talep kapandıktan sonra bıraktığı yıldızlar burada; **Yorum Ekle** ile yanıtlar, haksız bulursan **İtiraz Et** ile lidere taşırsın.',
            '**İtiraz kaydı** <#1538941597301997700>: itiraz edilen değerlendirmeler burada toplanır, kararı <@&1553133497781325954> verir.',
            '**Log paneli** <#1538944642685468702>: silinen ve düzenlenen mesajlar, ses hareketleri, giriş-çıkış ve ceza kayıtları; `/log` ile kategori seçilir.',
            '**Görüşme kanalları** <#1538544966282911884> / <#1538545004920971284> / <#1538545038751965265>: itiraz ve mülakat sesleri.',
          ],
        },
      ],
    },
    {
      title: 'Bir Talebi Yürütme',
      sub: 'Beş adım: üstlen, dinle, karar ver, kapat, puanı izle. Aradaki hiçbir adım üyeye DM üzerinden yürütülmez.',
      blocks: [
        {
          items: [
            '`1.` Bildirimden **Talebi Üstlen** butonuna bas; talebin üstlenen kişisi sen olursun.',
            '`2.` Alt başlıkta üyeyi dinle, konuyu netleştir; kanıt istenecekse <#1538535676000211034> kanalına yönlendir.',
            '`3.` Çözüm üret ya da karar ver; ceza gerekiyorsa botla uygula ve gerekçesini alt başlığa yaz.',
            '`4.` **Talebi Kapat** ile doğru sebebi seç. Kapanışta üye seni puanlar ve kayıt siciline işlenir.',
            '`5.` Gerçek bir sorun yoksa **Talebi Reddet** ile sebebi formdan seç; reddin izi alt başlıkta kalır, panel kanalına mesaj düşmez.',
          ],
          note: 'Çözemediğin talebi bekletme: <@&1554239996645613638> ya da <@&1553133497781325954> üzerinden üst yetkiliye devret.',
        },
      ],
    },
    {
      title: 'Aktiflik, Devir ve İzin',
      sub: 'Sessiz kaybolmak talebi sahipsiz bırakır; yoğun dönemi önceden haber ver, işi yarım bırakırsan devret.',
      blocks: [
        {
          items: [
            'Devir: <#1538945273378639913> kanalında "bende şu talep var, şu aşamada" diye yaz, başka bir yetkili üstlensin.',
            'İzin ya da yoğunluk dönemini <@&1555890044768624662> ekibinden birine bildir.',
            'Yanıtsız kalan talepler için hatırlatma otomatik düşer; hatırlatmayı görmezden gelmek kaydına işler.',
            'Yetkili olarak puanın `<@&1555890043992940614>` ekibinde değil sicillinde görünür; haftalık derece tabloları seni de kapsar.',
          ],
        },
      ],
    },
  ],
};

// 3) Etkinlik kuralları: etkinlik düzenini ve adil oyunu koruyan maddeler
const etkinlikKurallari = {
  key: 'etkinlik-kurallar',
  name: 'Etkinlik Kuralları Paneli',
  title: 'Etkinlik Kuralları',
  intro: 'Etkinlikler ortak vakit geçirdiğimiz yerler; bu kurallar **etkinliği bozan** davranışları engellemek için var.',
  channel: '1538540261737758850',
  sections: [
    {
      title: 'Etkinliğe Katılırken',
      sub: 'Katılım bir söz vermektir: saatinde gel, yer kapma, katılamayacaksan haber ver ki sıra başkaya geçsin.',
      blocks: [
        {
          items: [
            'Duyuru <#1538538618468040714> kanalından gelir; saatten **5 dakika önce** toplanma kanalında hazır bulun.',
            'Yer ayırtıp gelmemek, etkinliğin ortasında kalkmak yerine **etkinliği yöneten yetkiliye** haber verilir.',
            'Aynı etkinlikte ikinci şans için **ikinci hesap** kullanmak yasaktır; tek hesap, tek ödül.',
            'Sunucudan çıkarılan ya da cezalı durumdaki üye etkinliğe alınmaz; cezalı kanaldayken etkinlik çağırmak da yasaktır.',
            'Kontenjan dolmadan önce **çıkacağını yazmayan** üye yerini korumuş sayılır.',
          ],
        },
      ],
    },
    {
      title: 'Sesli Kanalda Düzen',
      sub: 'Etkinliğin sesi de sözü de sırayla alınır; mikrofonu domine eden kişi etkinliği bitirmiş olur.',
      blocks: [
        {
          items: [
            'Moderatör konuşurken **söz kesme**; soruların için el kaldır ya da sohbet kanalından yaz.',
            'Bağırma, mikrofon spamı, ses efekti ve müzik açmak yasaktır; kurallar sesli kanallarda da geçerlidir.',
            'Etkinlik dışı konu açma: sohbet <#1538538736189571133> kanalında, öneri <#1538540051028381696> kanalında.',
            'Yayın açtığında gösterdiğin her şey sunucu kurallarına tabidir; +18, kanlı ya da rahatsız edici içerik anında kapatılır.',
            'Rahatsız olduğun bir davranışı kanalda tartışma; yetkiliye bildir, o çözer.',
          ],
        },
      ],
    },
    {
      title: 'Adil Oyun',
      sub: 'Ödül olan her etkinlikte ölçü aynı: hile yok, bilgi sızdırma yok, kasıtlı kaybetme yok.',
      blocks: [
        {
          items: [
            'Hile, makro, izinsiz eklenti ve oyunun dosyalarını değiştirmek **kesin yasak**; tespit edilirse etkinlikten ve sunucudan atılma sebebi.',
            'Gizli rol ve bilgi sızdırma: rolünü, ipucunu ya da cevabı kanal dışında paylaşmak oyunun tamamını bozar.',
            'Kasıtlı kaybetme, takım arkadaşını engelleme, slot ve yer çalma yasaktır.',
            'AFK kalma: aktif etkinlikte sıran geldiğinde hazır ol, yoksa sıra geçilir.',
            'Sonucu etkileyecek bir kural tartışması çıkarsa karar **etkinliği yöneten yetkilinindir**; maç oynanmaya devam eder.',
          ],
        },
      ],
    },
    {
      title: 'Sonuç ve İtiraz',
      sub: 'Karara itiraz edilir, tartışma çıkarılmaz. İtirazın yolu kapalı değil, ama sıra kanalda değil talepte.',
      blocks: [
        {
          items: [
            'Sonuç <#1538538618468040714> kanalından ilan edilir; kazananı etkinlik yetkilisi belirler ve kayda geçer.',
            'İtirazını <#1538535372588326973> kanalından **talep açarak** yap; kanalda bağırarak değil.',
            'İtirazı, o etkinliği yöneten yetkili sonuçlandırmaz; dosyayı başka bir yetkili yürütür.',
            'Kazanmadığın bir ödülü kazandım diye iddia etmek ceza sebebidir.',
          ],
        },
      ],
    },
    {
      title: 'Ödüller',
      sub: 'Ödül etkinliğin sonunda verilir; kural çiğneyen, etkinliğin ödülünü de kaybeder.',
      blocks: [
        {
          items: [
            'Kazananlara <@&1555890043250282496> rolü verilir; başka ödül varsa **duyuruda yazan** kadardır.',
            'Ödül devredilemez ve başkasına satılamaz; takas ya da satış girişimi yasaktır.',
            'Etkinlik bitişine kadar kalmayan, ödül anında bulunmayan üye hakkını sıradakine bırakır.',
            'Çekilişler ayrı yürür: güncel çekilişler <#1538533903130828851> kanalındadır.',
          ],
          note: 'Haftalık dereceler ve saygınlık ödülleri etkinlik ödülünden ayrıdır; o roller her pazartesi yenilenir.',
        },
      ],
    },
    {
      title: 'Etkinlik Kanalları',
      sub: 'Her kanalın bir işi var; kuralları okumak için buradasın, geri kalanı aşağıda değil bu listede.',
      blocks: [
        {
          items: [
            '<#1538540261737758850>: etkinlik kuralları, yani bu kanal.',
            '<#1538538532958638160>: hangi etkinlikler var, nasıl oynanır.',
            '<#1538538618468040714>: etkinlik duyuruları ve sonuç ilanları.',
            '<#1538538736189571133>: etkinlik sohbeti.',
            '<#1538540051028381696>: etkinlik önerileri; hangi etkinliği istiyorsan buraya yaz.',
            '<#1538540812986744842>: Kırmızı Koltuk sahnesi.',
            '<#1538540926186815560>: etkinlik sesli kanalı.',
            '<@&1555890045175595128> rolünü alırsan etkinlikler senden habersiz geçmez.',
          ],
        },
      ],
    },
  ],
};

// 4) Etkinlik bilgilendirmesi: Discord üzerinden oynanabilen etkinliklerin tanıtımı
const etkinlikBilgisi = {
  key: 'etkinlik-bilgi',
  name: 'Etkinlik Bilgilendirme Paneli',
  title: 'Etkinlik Bilgisi',
  intro: 'Sunucumuzda dönen etkinlikler ve **nasıl oynandıkları**: hiçbirini indirmek zorunda değilsin, hepsi Discord içinden yürür.',
  channel: '1538538532958638160',
  sections: [
    {
      title: 'Nasıl Bir Etkinlik?',
      sub: 'Etkinlikler <@&1554240000529539083> ekibi tarafından kurulur, duyurulur ve yönetilir; hepsi ücretsiz ve Discord üzerinden.',
      blocks: [
        {
          items: [
            'Saat ve konu <#1538538618468040714> kanalından duyurulur; etkinlik sesi <#1538540926186815560> kanalıdır.',
            'Kayıt gerekmez, katılım serbesttir; kontenjanlı etkinliklerde yer duyurudaki mesajdan alınır.',
            'Tarayıcıda oynananlarda bağlantıyı **etkinliği yöneten yetkili** paylaşır, kimse senden link ya da kod istemez.',
            'Bilmen gereken tek şey oynanıştır; rol gerektiren oyunlarda rolleri yetkili dağıtır.',
            '<@&1555890045175595128> rolüyle etkinlik bildirimlerini açabilirsin.',
          ],
        },
      ],
    },
    {
      title: 'Vampir Köylü',
      sub: 'Gündüz tartışıp gece öldüren sosyal oyun: en kalabalık ve en çok tekrarlanan etkinliğimiz.',
      blocks: [
        {
          heading: 'Nasıl oynanır',
          items: [
            'Gece herkes gözünü kapatır, yetkili sırayla rolleri uyandırır; gündüz ise konuşarak kimi şüphelendiğini anlatırsın.',
            'Amaç köylü tarafındaysa gün sonunda **bir kişiyi linç etmek**, vampir tarafındaysa köylüleri eşitleyip geçmek.',
            'Rolünü kimseye söylemezsin; söylemek oyunun sonunu getirir ve kural ihlalidir.',
            'En az yedi kişiyle açılır, sesli kanalda oynanır, metinden değil **sesten** yürür.',
          ],
        },
        {
          heading: 'Roller',
          text: 'Temel üçlü **Köylü**, **Vampir** ve **gece bir yetenek kullanan özel roller** (koruma, sorgulama, oy engelleme gibi). Tam rol listesi ve yetenekleri, oyunun başında yöneten yetkili tarafından sesli olarak anlatılır; oyunlar arasında rol seti değişebilir.',
          note: 'İlk kez katılacaksan köylü rolüyle başla: tek yapman gereken dinlemek, tartışmak ve şüpheni söylemek.',
        },
      ],
    },
    {
      title: 'Kırmızı Koltuk',
      sub: 'Sırayla doğruluk ya da cesaret seçilen sohbet etkinliği; sahne kanalda, izleyen çok, oynayan az.',
      blocks: [
        {
          items: [
            'Oyuncular <#1538540812986744842> sahne kanalında sırayla oturur, sıradaki kişi **doğruluk** ya da **cesaret** seçer.',
            'Soru ve isteği sıradaki oyuncu ya da yetkili verir; **istememe hakkın saklıdır**, hiçbir cezası yoktur.',
            'Cinsellik, aşağılama ve kişisel sır içeren istekler yasaktır; +18 içerik kuralı burada da geçerlidir.',
            'İzleyici rolü de serbest: sahnedekini rahatsız edici biçimde sıkıştıramazsın.',
          ],
        },
      ],
    },
    {
      title: 'Çizim ve Kelime Oyunları',
      sub: 'Gartic Phone ve Spyfall: tarayıcıdan girilen, indirme gerektirmeyen, kalabalık grup oyunlarımız.',
      blocks: [
        {
          heading: 'Gartic Phone',
          items: [
            'Klasik telefona yazmanın çizimlisi: bir cümle yazarsın, sıradaki onu **çizer**, sonraki çizimi **yorumlar**.',
            'Sonunda hepsi sırayla gösterilir; en komik bozulma kazanır.',
            'Altı kişiyle güzel, on iki kişiyle çok daha iyi gider.',
            'Bağlantıyı etkinlik yetkilisi paylaşır, sadece katılanlar girer.',
          ],
        },
        {
          heading: 'Spyfall',
          items: [
            'Herkes gizli bir mekan bilir, tek bir kişi hariç: **hain** mekanı bilmez ama diğerlerinin kim olduğunu bulmaya çalışır.',
            'Karşılıklı soru-cevap oynanır; hain yakalanırsa köylüler, süresi dolarsa hain kazanır.',
            'Sesli kanalda konuşarak, cevaplar yazılı olarak verilir.',
          ],
        },
      ],
    },
    {
      title: 'İndirilmesi Gereken Oyunlar',
      sub: 'Aynı etkinliklerin masa oyunu tarafı: Among Us, Goose Goose Duck, Crab Game ve Brawlhalla.',
      blocks: [
        {
          items: [
            '**Among Us** ve **Goose Goose Duck**: görev yap, haini bul; tartışma kısmı bizim sesli kanalımızda yürür. Goose Goose Duck ücretsizdir.',
            '**Crab Game**: yüz kişiye kadar eleme usulü mini oyunlar, tarayıcıdan girilir, indirilmez.',
            '**Brawlhalla**: ücretsiz dövüş oyunu; 1v1 ya da takım turnuvası olarak açılır.',
            'Bu oyunlar için sunucu hesabından başka bir kayıt ya da ödeme istenmez; isteyenler için <@&1555890043237826630> gibi oyun rolleri sohbeti kolaylaştırır.',
          ],
        },
      ],
    },
    {
      title: 'Discord İçi Etkinlikler',
      sub: 'Ses kanalının içinden açılan hazır etkinlikler: izleme, çizme ve kart oyunları.',
      blocks: [
        {
          items: [
            'Ses kanalının **Etkinlik Başlat** menüsünden açılır, indirme ve bağlantı gerekmez.',
            '**Watch Together** ile ortak izleme: anime partileri bu şekilde yürür.',
            '**Sketch Heads** ve benzeri çizme oyunları, kart ve masa oyunlarının birkaçı bu menüdedir.',
            'Anime izleme partilerinde telifli yayın paylaşmak yerine ortak izleme etkinliği kullanılır.',
          ],
        },
      ],
    },
    {
      title: 'Hangi Etkinlik Olsun İstersin',
      sub: 'Etkinlik listesi üyelerden büyür; <#1538540051028381696> kanalı tam bu iş için var.',
      blocks: [
        {
          items: [
            'Öneri kanalına ne izlemek, ne oynamak ya da ne yarışmak istediğini yaz.',
            'Aynı öneri tekrar tekrar yazılmasın diye öneriler tek mesajda toplanır.',
            'Programı <@&1554240000529539083> kurar, <@&1554239995412488304> onaylar.',
            'Kuralları merak ediyorsan <#1538540261737758850> kanalı burada.',
          ],
          note: 'Etkinlik takvimi değişkendir; duyurusu olmayan bir gün için "neden etkinlik yok" baskısı kurallara göre yaptırım sebebidir.',
        },
      ],
    },
  ],
};

// 5) Oyun kuralları: ortak davranış kuralları ve oyuna özel maddeler
const oyunKurallari = {
  key: 'oyun-kurallar',
  name: 'Oyun Kuralları Paneli',
  title: 'Oyun Kuralları',
  intro: 'Birlikte oynadığımız oyunlarda uyulacak kurallar. **Sunucu kuralları** oyun içinde de olduğu gibi geçerlidir.',
  channel: '1538541309634285678',
  sections: [
    {
      title: 'Her Oyunda Geçerli',
      sub: 'Oyun fark etmez; takım arkadaşı da rakip de üyedir ve saygı sırayı beklemez.',
      blocks: [
        {
          items: [
            'Hakaret, küfür, ayrımcılık ve tehdit **rakibe de takım arkadaşına da** yasaktır.',
            'Kendi takım arkadaşını Susturma / oyundan atma tehdidiyle sıkıştırmak tacizdir.',
            'Hesap, şifre, e-posta ve kişisel bilgi paylaşılmaz; "oynayıp hesap vereyim" teklifi kabul edilmez.',
            'Gerçek para ile bahis, hesap satışı ve ödül takası yasaktır.',
            'Hile, makro, izinsiz eklenti ve spoof yasaktır; tespit edilen ceza alır, etkinlikten çıkarılır.',
            'Oyun içi iletişimimiz Discord\'tur: dış platforma çağırma, Discord etiketi vererek reklam yapma yasaktır.',
          ],
          note: 'Oyun sırasında gösterdiğin her şey (yayın, isim, avatar, sohbet) sunucu kurallarına tabidir.',
        },
      ],
    },
    {
      title: 'Takım ve Lobi Düzeni',
      sub: 'Yerini, sıranı ve sözünü koru: takım oyunlarıda en çok tartışma çıkaran şeyler bunlar.',
      blocks: [
        {
          items: [
            'Lobiye **çağrılmadan** girmek ve başkasının slotunu almak yasaktır.',
            'Sıran gelmeden oynamaya başlama, AFK kalma; gelmeyeceksen <@&1555890043992940614> ekibinden birine yaz.',
            'Takım arkadaşın hata yapınca bağırma, hakaret etme; düzeltmek istiyorsan oyun sonunda söyle.',
            'Kasıtlı kaybetme, kendi kuleyi/objeyi vurma ve teslim alma (aggro) yasaktır.',
            'Rapor butonunu misilleme için kullanmak kural ihlalidir; gerçek ihlalde ise kanıt senin oyun kaydındır.',
            'Oyuncu aramak için <#1538542760506822656>, kurulan lobiler için <#1538542814680453281> kanalı kullanılır.',
          ],
        },
      ],
    },
    {
      title: 'Oyunlara Özel',
      sub: 'Kısa hatırlatmalar: her oyunun kendi içinde tartışma çıkaran yerleri ve bizim oradaki duruşumuz.',
      blocks: [
        {
          heading: 'Valorant ve Counter-Strike 2',
          items: [
            'Sıra ve ekonomi konuşulur, suçlama edilmez.',
            'Rakibin konumunu kanal dışına taşımak (info sızdırma) oyunun tadını bozar; şikayetini hakeme bildir.',
            'Eklenti ve script: yalnızca oyunun izin verdikleri kullanılır.',
            'Retake ve özel lobiler <#1538542814680453281> üzerinden duyurulur.',
          ],
        },
        {
          heading: 'League of Legends',
          items: [
            'Draft ve sıra dışı kademeler için önceden anons yap; tanımadığın üyeyle özelden anlaşma yapma.',
            'Kasıtlı ölme, AFK kalma ve "int" yasaktır; takımda biri yaparsa oyun sonunda yetkiliye bildir.',
            'Takım içi sesli iletişim bizim ses kanallarımızda kalır, orada da kurallar geçerlidir.',
          ],
        },
        {
          heading: 'Brawlhalla ve 1v1',
          items: [
            'Turneya eşleşmeleri <#1538541416387448944> kanalındaki gibi duyurulur; saatte olmayan üye elenmiş sayılır.',
            'Rakip bağlantı koparsa maç **bir kez** baştan alınır, sonraki denemeler kura ile yürür.',
            'Karakter ve arenayı seçerken rakiple pazarlık yapılır, tek taraflı dayatma olmaz.',
          ],
        },
      ],
    },
    {
      title: 'Turnuva ve Etkinlik Maçları',
      sub: 'Ödül olan her maçta ölçü şeffaflıktır; kurayı, eşleşmeyi ve sonucu yetkili ilan eder.',
      blocks: [
        {
          items: [
            'Kayıt, saat ve format **duyuruda** yazılır; duyuruda olmayan bir kural sonradan eklenmez.',
            'Kura ve eşleşme <@&1554240000529539083> tarafından çekilir ve kanalda gösterilir.',
            'Maç sonucu ekran görüntüsü ile kayda geçer; itiraz <#1538535372588326973> kanalından talep açılarak yapılır.',
            'Etkinlik maçında karar **hakemlik yapan yetkilinindir**; tartışmayı maç sırasında yapmak her iki takımın da aleyhinedir.',
          ],
        },
      ],
    },
    {
      title: 'Klip ve Sohbet',
      sub: 'Oynadıklarını paylaşabilirsin; paylaşırken de kurallar seninle gelir.',
      blocks: [
        {
          items: [
            'Klipler <#1538542919084941333>, oyun sohbeti ve tartışma <#1538543035346849913> kanalındadır.',
            'Klipte arkadaşının yüzünü, sesini ya da kişisel bilgisini izinsiz gösterme.',
            'Oyun tartışmasında rakip takımın üyelerini hedef gösterme, isim vererek suçlama.',
            'OwO ve Mudae gibi topluluk botları yalnızca kendi kanallarında kullanılır.',
          ],
        },
      ],
    },
  ],
};

// 6) 5v5 bilgilendirmesi: sunucunun takım etkinliklerinin işleyişi
const besVBesBilgisi = {
  key: 'bes-v-bes-bilgi',
  name: '5v5 Bilgilendirme Paneli',
  title: '5v5 Bilgilendirmesi',
  intro: 'Sunucunun **takım oyunları**: iki beşli, tek maç, tek kazanan. Nasıl kurulur, nasıl yürür, ödülü kim alır.',
  channel: '1538541416387448944',
  sections: [
    {
      title: '5v5 Nedir',
      sub: 'Beşe beş oynanan takım etkinliklerimiz: Valorant, League of Legends ve Counter-Strike 2 tarafında açılır.',
      blocks: [
        {
          items: [
            'İki takım, beşer üye; maç **etkinlik yetkilisinin** kurduğu saatte oynanır.',
            'Takımlar ya kendi kurduğun beşliyle ya da <#1538542760506822656> kanalından çağrı yaparak dolar.',
            'Maç öncesi format (harita, taraf, uzatma) duyuruda yazılı gelir.',
            'Kazanan takıma <@&1555890043250282496> rolü verilir.',
          ],
        },
      ],
    },
    {
      title: 'Takım Nasıl Kurulur',
      sub: 'Beş kişi bulmak zor değil; sırayı bilince lobiler kendi kendine doluyor.',
      blocks: [
        {
          heading: 'Adımlar',
          items: [
            '`1.` <#1538538618468040714> kanalındaki duyuruyu bekle ya da kendin "5v5 çıkar mı" diye <@&1555890045175595128> ekibine haber ver.',
            '`2.` <#1538542760506822656> kanalında oyun rolünle birlikte arayışını yaz; <@&1555890043221049355> gibi oyun rolleri seni bulunur kılar.',
            '`3.` Beşli olunca <#1538542814680453281> kanalında lobi kur; saat ve tarafı yaz.',
            '`4.` Maçtan önce <#1538543237940117586> kanalında toplan, takım odasına oradan geç.',
          ],
        },
        {
          heading: 'Takım kaptanı',
          text: 'Her takımın bir kaptanı olur: üye listesini yetkiliye bildirir, eksik ya da geç kalanı **oyundan önce** söyler, itirazı maç içinde değil maç sonunda kaptan taşır.',
          note: 'Kaptan ceza vermeye yetkili değildir; kural dışı davranışı yetkiliye iletir.'
        },
      ],
    },
    {
      title: 'Maç Günü',
      sub: 'Saat, kanal, taraf: karışan şeyler değil, takipte geciken şeyler maçı uzatır.',
      blocks: [
        {
          heading: 'Sıra',
          items: [
            'Duyurudan **10 dakika önce** <#1538543237940117586> kanalında toplanılır.',
            'Eksik varsa sıradan önce <@&1555890043992940614> ekibinden birine yazılır.',
            'Takım odaları: mavi taraf <#1538938368141041664> ve <#1538942533319786546>, kırmızı taraf <#1538938411589566554> ve <#1538942550038282280>.',
            'Maç bittikten sonra skor ekran görüntüsü yetkiliye gösterilir; sonuç kanalda ilan edilir.',
          ],
        },
        {
          heading: 'Yayın ve izleme',
          text: 'Maç yayını açılabilir; yayında gösterdiğin her şey sunucu kurallarına tabidir. İzleme kısmı sohbet kanallarından yürür, maç sırasında takım odalarına sızma yapılmaz.',
          note: 'Rakip takımın taktik sesini kendi yayınından duyurmak bilgi sızdırma sayılır.'
        },
      ],
    },
    {
      title: 'Kurallar ve İtiraz',
      sub: 'Oyun kuralları 5v5 için de geçerlidir; maç içinde durdurma yetkisi yalnızca yetkilidedir.',
      blocks: [
        {
          items: [
            'Hile, makro ve izinsiz eklenti: anında maçtan ve etkinlikten çıkarılma.',
            'AFK kalma ve kasıtlı kaybetme: kaptan ya da yetkili uyarır, tekrarında takım eksik oynar.',
            'Saatte hazır olmayan üye yerine yedek alınabilir; yedek bulanamazsa maç ertelenir.',
            'Skor tartışması, itiraz ve ceza isteği <#1538535372588326973> kanalından talep açılarak yürür.',
            'Karar hakemlik yapan yetkilinindir; kanalda bağırarak değiştiremezsin.',
          ],
          note: 'Ayrıntılı maddeler <#1538541309634285678> kanalında.',
        },
      ],
    },
    {
      title: 'Ödül ve Sonrası',
      sub: 'Kazanan rolü alır, kaybeden tekrar ister; ikisi de sohbette kalır.',
      blocks: [
        {
          items: [
            'Birinci takıma <@&1555890043250282496> rolü verilir; başka ödül varsa duyuruda yazan kadardır.',
            'Sonuç <#1538538618468040714> kanalından ilan edilir, katılımcılara teşekkür edilir.',
            'Klip ve skorlar <#1538542919084941333> kanalında paylaşılır.',
            'Sürekli aynı takımla oynanmaması için sonraki etkinlikte eşleşme yeniden kurulur.',
          ],
        },
      ],
    },
  ],
};

// 7) Sorun çözme bilgilendirmesi: üyeler arası ve üyeler-yetkililer arası anlaşmazlıkların yürütüldüğü alan
const sorunCozmeBilgisi = {
  key: 'sorun-cozme-bilgi',
  name: 'Sorun Çözme Bilgilendirme Paneli',
  title: 'Sorun Çözme Bilgisi',
  intro: 'Bir üyeyle ya da bir yetkiliyle **aranda çözülemeyen** konuların konuşulduğu alan: yazılı değil, sesli ve kayıtlı.',
  channel: '1538544294388961300',
  sections: [
    {
      title: 'Bu Alan Ne İşe Yarar',
      sub: 'Sorun çözme, tek kişinin derdini anlattığı yer değil; iki tarafın yüz yüze geldiği arabuluculuk alanıdır.',
      blocks: [
        {
          heading: 'Buraya gelir',
          items: [
            'İki üye arasındaki tartışma sohbeti kirlenecek kadar büyüdüğünde.',
            'Bir yetkilinin kararını haksız bulduysan ve gerekçesini duymak istiyorsan.',
            'Etkinlik, takım ya da oda içinde çıkan anlaşmazlıklarda.',
            'Hakkında çıkan iddianın doğru olmadığını düşünüyorsan.',
          ],
        },
        {
          heading: 'Bunun yerine destek talebi aç',
          items: [
            'Tek taraflı işler: rol, ödül, ceza itirazının ilk adımı, hesap ve teknik sorun.',
            'Bir kural ihlalini bildirmek.',
            'Gizli kalmasını istediğin, karşı tarafı olmayan konular.',
          ],
          note: 'İlk durak her zaman <#1538535372588326973> kanalıdır; karşı taraf çağrılacaksa talebi yürüten yetkili görüşmeyi buradan kurar.',
        },
      ],
    },
    {
      title: 'Nasıl Başvurulur',
      sub: 'Numara ya da ID yazılmaz; buton ve talep üzerinden yürür, sıra kendiliğinden kurulur.',
      blocks: [
        {
          items: [
            '`1.` <#1538535372588326973> kanalında **Talep Oluştur** butonuna bas.',
            '`2.` Konuyu, karşındakini ve ne istediğini tek mesajda yaz; kanıt varsa ekle.',
            '`3.` Talebi yürüten üye <@&1544337671340433569> ekibinden biridir; gerekirse karşı tarafı da çağırır.',
            '`4.` Sesli görüşme gerekiyorsa seni <#1538544966282911884>, <#1538545004920971284> ya da <#1538545038751965265> kanalına yönlendirir.',
          ],
        },
      ],
    },
    {
      title: 'Görüşme Nasıl Yürür',
      sub: 'Arabulucu tarafsızdır, kimse tek başına karar vermez ve iki taraf da söz hakkı alır.',
      blocks: [
        {
          items: [
            'Sırayla konuşulur; söz kesme, bağırma ve hakaret görüşmeyi bitirir.',
            'Arabulucu olan <@&1544337671340433569> üyesi çözüm önerir, kararı taraflar birlikte onaylar.',
            'Karar bağlayıcı değilse de kayda geçer; çözümsüzlükte <@&1553133497781325954> devreye girer.',
            'Görüşme sırasında yeni ceza pazarlığı yapılmaz; ceza konusu ayrı dosyadır.',
            'Taraflardan biri gelmezse görüşme ertelenir, üçüncü yoklamada dosya kapanır.',
          ],
        },
      ],
    },
    {
      title: 'Kanallar',
      sub: 'Bu alanın yazılı, sesli ve kayıt tarafı ayrı ayrı duruyor; hepsi yetkili gözetiminde.',
      blocks: [
        {
          items: [
            '<#1538544294388961300>: bilgilendirme, yani bu kanal.',
            '<#1538544350185914389>: sorun çözme sohbeti; yazılı yürüyen konular.',
            '<#1538544966282911884> / <#1538545004920971284> / <#1538545038751965265>: görüşme ses kanalları.',
            '<#1538942392613208164>: sonuç raporlarının tutulduğu kanal.',
            '<#1538941536094519316>: üyelerin bıraktığı memnuniyet bildirimleri.',
            '<#1538941597301997700>: itiraz edilen değerlendirmelerin kaydı.',
          ],
        },
      ],
    },
    {
      title: 'Gizlilik',
      sub: 'Görüşme odada kalır; kayıt yalnızca ekip içinde dolaşır.',
      blocks: [
        {
          items: [
            'Görüşmede konuşulanlar sohbette anlatılmaz, ekran görüntüsü dışarı taşınmaz.',
            'Karşı tarafın kişisel bilgisi ifşa edilmez; ifşa ayrıca ihlaldir.',
            'Kayıtlar yalnızca <#1538942392613208164> ve log kanalında durur.',
            'Görüşmeyi izlemek serbest değildir; taraf olmayan üye çağrılmaz.',
          ],
          note: 'Yetkili de sana aynı gizlilikle davranır; "ben kimseye söylemem" diyerek bilgi toplamaz.',
        },
      ],
    },
    {
      title: 'Sonuç ve İtiraz',
      sub: 'Açılan dosya kapanmadan sonuç öğrenilir; kapanan dosyaya itiraz yolu kapalı değil.',
      blocks: [
        {
          items: [
            'Çözüm uygulandıysa talep kapatılır ve sana kısa bir sonuç yazılır.',
            'Anlaşmazlıkta karar lider kademesindedir; itirazın <@&1553133497781325954> tarafından incelenir.',
            'Memnun kalmadıysan değerlendirme kartındaki yıldızı kullan ya da <#1538941597301997700> kaydına taşınan itirazı bekle.',
            'Aynı konuyu ısrarla yeniden açmak yerine yeni bir bulgu getir.',
          ],
        },
      ],
    },
  ],
};

// 8) Partner şartları: karşı sunucuya kabul ettirdiğimiz maddeler ve teklifin yürüdüğü yol
const partnerSartlari = {
  key: 'partner-sartlari',
  name: 'Partner Şartları Paneli',
  title: 'Partner Şartları',
  intro: 'Sunucular arası **karşılıklı tanıtım**: dört bağlayıcı madde, tek bir başvuru yolu ve şeffaf bir kayıt.',
  channel: '1538943458864005150',
  sections: [
    {
      title: 'Partnerlik Nedir',
      sub: 'İki sunucu birbirinin tanıtım metnini kendi kanalında paylaşır; karşılıklı, kayıtlı ve geri çekilebilir.',
      blocks: [
        {
          items: [
            'Paylaşım <#1538943593665007696> kanalımızda görünür; bizim metnimiz <#1538943528225476810> kanalındadır.',
            'Süreci <@&1554237785416794202> yürütür, ağır kararlar <@&1554239996058411068> tarafından verilir.',
            'Partnerlik rol vermez, yetki vermez, sunucular arasında hiçbir taahhüt içermez.',
            'Kayıtlı partnerler <#1555293036026658957>, dost partnerler <#1538943785344704562>, yasaklılar <#1538944004148957244> kanallarında durur.',
          ],
        },
      ],
    },
    {
      title: 'Şartlar',
      sub: 'Teklif kabul edilmeden önce bu maddeler onaylatılır; kabul etmeyen metni paylaşamaz.',
      blocks: [
        {
          items: [
            'Reklam metni **Discord kurallarına** aykırı içerik barındıramaz.',
            'Sunucular karşılıklı olarak **aynı gün içinde** birbirini paylaşır.',
            'Onaylanan reklam metni **değiştirilemez**; değişiklik için yeni talep açılması gerekir.',
            'Kurallara uymayan partnerlikler yetkililerce **tek taraflı sonlandırılabilir**.',
          ],
        },
        {
          heading: 'Pratikte neye bakarız',
          items: [
            'Sunucu Türkçe ve kurallara uyumlu olsun: +18 içerik, taciz, ayrımcılık ya da yasa dışı paylaşık olmamalı.',
            'Davet bağlantısı **kalıcı** olmalı ve gerçekten o sunucuya gitmeli.',
            'Metin okunabilir olsun: sunucunun adı, ne vaat ettiği ve davet bağlantısı tek mesajda.',
            'Karşı tarafta iletişime geçilebilir bir **yetkili** bulunsun; muhatapsız kayıtlar yenilenmez.',
            'Sunucu ya da yetkilisi daha önce yasaklı listeye girmemiş olsun.',
          ],
          note: 'Üye sayısı gibi ölçütler sabit bir eşikle değil, kaydı inceleyen yetkilinin değerlendirmesiyle yürür.',
        },
      ],
    },
    {
      title: 'Teklif Nasıl Verilir',
      sub: 'Dört adım, hepsi botun içinde: numara yazılmaz, ID sorulmaz, sonuç DM ile gelir.',
      blocks: [
        {
          items: [
            '`1.` <#1538536775956566117> kanalına mesajında **partner** ya da **dm** yaz; bot sana teklif kartı gönderir.',
            '`2.` Karttan **Evet** de, açılan forma partner metnini yapıştır; sunucun davetten tanınır.',
            '`3.` Sana DM\'den **şartlar** gelir, **Şartları Kabul Et** butonuna basarsın.',
            '`4.` Talebin <#1538943678926557205> kanalında incelemeye düşer; onaylanınca metnin <#1538943593665007696> kanalımızda paylaşılır.',
          ],
          note: 'Onaylayan yetkiliye bastığında sunucun güvenilir partnerler listesine alınır; listeye giren partnerin yetkililerine DM\'den Partner Paneli gider.',
        },
      ],
    },
    {
      title: 'Partner Olduktan Sonra',
      sub: 'Ortaklık tek seferlik ilan değildir: yenileme, müsaitlik ve karşılıklı saygı ile yürür.',
      blocks: [
        {
          items: [
            'Metnin zamanı geçerse partner yetkilimiz sana **"Partner Yenile"** teklifi gönderir; kabul eder, metni onaylar, günceller ya da reddedersin.',
            'Onayladığın metin bizim kanalımızda yeniden yayımlanır; bizim metnimiz de senin yetkiline DM olarak gider.',
            '<#1538943369089126553> kanalındaki butonla <@&1555327703882928168> rolünü alıp partner kanallarımızı görebilirsin.',
            'Yetkililer <#1538536775956566117> sohbetinde muhataplarını bulur; meşgul olan için teklif bekletilmez.',
            'Karşı tarafın metnini ya da üyelerini kendi kanalında kötülemek ortaklığı bitiren bir davranıştır.',
          ],
        },
      ],
    },
    {
      title: 'Sonlandırma ve Yasak',
      sub: 'Kayıt tek taraflı düşürülebilir; ağır ihlalde sunucu yasaklı listeye geçer.',
      blocks: [
        {
          items: [
            '**Partneri Sil** kaydın sahibine ve lidere, **İptal Et** ve **Yasaklıya Al** yalnızca lidere açıktır.',
            'İptal ve yasaklama, paylaşım kanalındaki bütün mesajları kaldırır, kaydı güvenilir listeden düşürür ve karşı tarafın yetkililerine DM gider.',
            'Yasaklı sunuculara yeniden teklif açılmaz; itiraz <@&1554239996058411068> tarafından değerlendirilir.',
            'Karar gerekçesi kayıtta durur; sebepsiz düşürme yapılmaz.',
          ],
          note: 'Metnini kaldırmak istiyorsan tek yapman gereken partner yetkilisine yazmak; ortaklık zorla yürütülmez.',
        },
      ],
    },
    {
      title: 'Partner Kanallarımız',
      sub: 'Nereye bakacağını bilirsen bekleme süren kısalır.',
      blocks: [
        {
          items: [
            '<#1538943458864005150>: şartlar, yani bu kanal.',
            '<#1538943528225476810>: bizim partner metnimiz.',
            '<#1538943593665007696>: onaylanan partner paylaşımları.',
            '<#1538943678926557205>: oto partner taleplerinin incelemesi.',
            '<#1555293036026658957>: güvenilir partnerler listesi.',
            '<#1538943785344704562>: dost partnerler.',
            '<#1538944004148957244>: yasaklı partnerler.',
            '<#1538536775956566117>: teklifin başladığı sohbet.',
          ],
        },
      ],
    },
  ],
};

// 9) Partner metnimiz: karşı tarafa verdiğimiz, bizim sunucumuzu tanıtan sabit ilanın kanaldaki hali
const partnerMetnimiz = {
  key: 'partner-metni',
  name: 'Partner Metni Paneli',
  title: 'Partner Metnimiz',
  intro: 'Sunucumuzu tanıtan, karşı tarafa gönderdiğimiz **tek sabit ilan**. Kopyala, paylaş, davet linki güncel kalsın.',
  channel: '1538943528225476810',
  sections: [
    {
      title: 'İlanımız',
      sub: 'Partner yetkililerimiz bu metni karşı sunucunun yetkilisine DM olarak iletir; kanalda gördüğün hali de budur.',
      blocks: [
        {
          text: partnerConfig.ourAdText,
        },
      ],
    },
    {
      title: 'Nerede Kullanılır',
      sub: 'Metin tek yerde durur, iki yolda gider: karşı tarafa DM ve bizim paylaşım kanalımız.',
      blocks: [
        {
          items: [
            'Onaylanan partnerliklerde karşı sunucunun yetkilisine **DM** olarak bu metin gönderilir.',
            'Kendi üyelerimiz partner paylaşí yaparken <#1538943593665007696> kanalına bu metni koyar.',
            '<#1538536775956566117> kanalında **partner** ya da **dm** yazan her üyeye bot bu metni teklif olarak sunar.',
          ],
        },
      ],
    },
    {
      title: 'Metni Değiştirme',
      sub: 'İlan sunucunun yüzüdür; değişiklik kararını yetki kademesi verir, metin tek yerden yenilenir.',
      blocks: [
        {
          items: [
            'Metin botun ayarında durur; değiştirmek için <@&1554239996058411068> kararı gerekir.',
            'Davet bağlantısı değişirse bu kanal ve bot ayarı **aynı gün** yenilenir.',
            'Yayınlanmış bir partner metni kurallara aykırı içerik taşıyorsa paylaşım geri çekilir.',
            'Metne kendi sunucunun bilgisini ekleyerek paylaşma; karşı tarafın gördüğü haliyle gönderilir.',
          ],
          note: '<@everyone> ya da rol etiketiyle paylaşım yapılmaz; partner kanallarında bildirim üretmek yetki gerektirir.',
        },
      ],
    },
    {
      title: 'Soru ve Muhatap',
      sub: 'Partnerlikle ilgili her konu tek kapıdan yürür.',
      blocks: [
        {
          items: [
            'Muhatap rolü: <@&1554237785416794202>, üst karar: <@&1554239996058411068>.',
            'Durumu öğrenmek için <#1555293036026658957> listesine bak; oradaki satır senin kaydının halidir.',
            'Şartlarda takıldıysan <#1538943458864005150> kanalı ve <#1538535372588326973> talep paneli var.',
            'Yetkili olmayan üyeler partner kanallarını göremez; <#1538943369089126553> kanalından rol alınır.',
          ],
        },
      ],
    },
  ],
};

module.exports = [
  yetkiliKurallari,
  yetkiliBilgisi,
  etkinlikKurallari,
  etkinlikBilgisi,
  oyunKurallari,
  besVBesBilgisi,
  sorunCozmeBilgisi,
  partnerSartlari,
  partnerMetnimiz,
];
