// Bilgilendirme kanallarının kalıcı metinleri. Her panel kendi kanalına, bölüm başına bir mesaj olarak gönderilir
// (src/systems/bilgilendirme/index.js): metin değişince bot açılışta eski mesajları silip yenilerini koyar, kanal
// boş kalmaz. Kanal bağlantıları adla değil ID ile kurulur, kanal adı değişse de metin doğru yere gider.
// Roller ve kanallar <@&ID> / <#ID> şeklinde yazılır; Discord bunları ada çevirir. Gönderim hep
// allowedMentions: { parse: [] } ile yapılır, yani hiçbir etiket bildirim üretmez.
const partnerConfig = require('../partner/config');
const { IDS } = require('./ui');

// 1) Yetkili kuralları: sadece yetkili rolü taşıyanları bağlayan, sunucu kurallarının üstüne geçen maddeler
const yetkiliKurallari = {
  key: 'yetkili-kurallar',
  name: 'Yetkili Kuralları Paneli',
  title: 'Yetkili Kuralları',
  intro: 'Yetkili rolü taşıyan herkesi bağlayan kurallar. Sunucu kurallarının **yerine** değil **üstüne** geçer.',
  channel: '1538944989432774746',
  sections: [
    {
      title: 'Kimleri Bağlar',
      sub: 'Üye rolündeki herkes sunucu kurallarına uyar; yetkiliden beklenen aynı kuralları harfi harfine uygulaması ve bir adım önde durmasıdır.',
      blocks: [
        {
          text: '<#1538533642832318517> kanalındaki kuralları **yetkili olarak yeniden** okuman gerekir: çünkü ihlali sen değerlendireceksin ve maddeyi bilmediğinde verdiğin karar savunulamaz hâle gelir.',
        },
        {
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
      sub: 'Beş ilke: tarafsızlık, sakinlik, örneklik, gizlilik ve yetkinin ölçülü kullanımı. Hiçbiri rütbeyle büyümez: en üst rütbe de en alt rütbe de aynı ölçüyle değerlendirilir.',
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
      sub: 'Cezanın sırası, kanıtı ve kaydı vardır: her ceza numarasıyla <#1538535676000211034> kanalına düşer. Kanıtsız ya da ölçüsüz verilen her işlem üye tarafından itiraz edilebilir hâle gelir.',
      blocks: [
        {
          heading: 'Sıra ve ölçü',
          text: 'Hafif ihlalde önce **uyarı**, tekrarında **susturma** ya da **jail**, ağır ya da süregiden ihlalde **yasaklama** uygulanır. Alt basamak denenmeden üste geçilmez; açıkça ağır olan ihlallerde sıra atlanır.',
        },
        {
          heading: 'Kanıt ve kayıt',
          items: [
            'Verdiğin **her ceza** (uyarı, susturma, jail, yasaklama) kanıtıyla birlikte <#1538535676000211034> kanalına bırakılır; bu son adım atılmadıysa ceza tamamlanmış sayılmaz.',
            'Mesajın ilk satırı ceza numarası olsun: bot işlem sonrası sana `Ceza #12` biçiminde numara verir, kanala da aynen öyle yazarsın.',
            'Kanıt cezanın sebebidir: yazılı ihlalde mesaj ekran görüntüsü, seste klip ya da tanık adı, yayında alınan ekran görüntüsü.',
            'Numarayla düşen kayıt denetimde o numaradan bulunur; aynı ceza için iki ayrı mesaj atılmaz.',
            'Sebebi tek cümle ve **somut** yaz; "kural ihlali" gibi belirsiz sebep itirazda seni savunmaz.',
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
      sub: 'Yetkili gördüğü bilgiyi taşımaz; gizlilik ihlali, yanlış verilen bir cezadan daha ağır sonuç doğurur. Sana gelen şikayet de kanıt da yalnızca ekip içinde kalır.',
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
      sub: 'Yetki bir ayrıcalık değil sorumluluktur: kuralı çiğneyen yetkili de aynı ceza basamaklarından geçer, gerekirse yetkisi geri alınır ve görev alanı boş sayılır.',
      blocks: [
        {
          items: [
            'Üyeyle aynı ceza basamaklarına tabisin, üstelik **görevi kötüye kullanma** kaydı siciline işlenir.',
            'Tekrarlanan ya da ağır durumlarda yetki geri alınır ve görev alanın boş sayılır.',
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
      title: 'İşlem Nerede Yapılır',
      sub: 'Her işin bir kanalı var; doğru kanalda yapılan işlem daha hızlı çözülür ve üye önünde tartışma üretmez. Yanlış kanala yazılan kayıt, sonradan düzeltilmesi zor bir iz bırakır.',
      blocks: [
        {
          items: [
            'Ceza ve yetki komutları **yalnızca** <#1538535501420826794> kanalında çalışır; başka kanalda yazılan komut işlemez.',
            'Ceza kanıtı <#1538535676000211034> kanalına **ceza numarasıyla** bırakılır, üye önünde gösterilmez.',
            'Danışma, devir ve ekip içi sohbet <#1538945273378639913> kanalında yürür.',
            '<#1538536351119446127> üye komutlarının kanalıdır; yetkili işi orada yazılmaz.',
          ],
        },
      ],
    },
    {
      title: 'Rütbeler ve Yetkiler',
      sub: 'On bir rütbe alttan üste dizilir ve her biri alttakinin yetkisini de taşır; ceza yetkisi kademeli açılır. Rütbe yalnızca ne yapabileceğini değil, kimin kararına uyacağını da belirler.',
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
      sub: 'Yetki verilirken seçilen alan ne iş yapacağını belirler; bir alanda duran üye, başka alanın işine sırf o an boşta diye atlamaz. Alanın rolü de yetkiyle birlikte verilir.',
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
            '**Görüşme odaları** <#1538544966282911884> / <#1538545004920971284> / <#1538545038751965265>: üyeyle sesli görüşme ve yetkili mülakatı burada yürür.',
          ],
        },
      ],
    },
    {
      title: 'Bir Talebi Yürütme',
      sub: 'Beş adım: üstlen, dinle, karar ver, kapat, puanı izle. Aradaki hiçbir adım üyeye DM üzerinden yürütülmez; talep alt başlığı dışında yazılan mesaj kayda geçmez.',
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
      sub: 'Sessiz kaybolmak talebi sahipsiz bırakır: yoğun dönemi önceden haber ver, işi yarım bırakacaksan devret. Haber verilmiş bir yokluk kusur sayılmaz, verilmemiş olan sayılır.',
      blocks: [
        {
          items: [
            'Devir: <#1538945273378639913> kanalında "bende şu talep var, şu aşamada" diye yaz, başka bir yetkili üstlensin.',
            'İzin ya da yoğunluk dönemini <@&1555890044768624662> ekibinden birine bildir.',
            'Yanıtsız kalan talepler için hatırlatma otomatik düşer; hatırlatmayı görmezden gelmek kaydına işler.',
            'Puanın ve geçmişin sicil kartında durur: `/sicil`. Haftalık derece tabloları yetkilileri de kapsar.',
          ],
        },
      ],
    },
  ],
};

// 3) Etkinlik kuralları: etkinlik düzenini ve adil oyunu koruyan maddeler. Kural kanalında yalnızca bağlayıcı
// maddeler durur; "hangi kanal ne işe yarar" listesi etkinlik bilgilendirme panelinin işidir.
const etkinlikKurallari = {
  key: 'etkinlik-kurallar',
  name: 'Etkinlik Kuralları Paneli',
  title: 'Etkinlik Kuralları',
  intro: 'Etkinlikler ortak vakit geçirdiğimiz yerler; bu kurallar **etkinliği bozan** davranışları engellemek için var.',
  channel: '1538540261737758850',
  sections: [
    {
      title: 'Etkinliğe Katılırken',
      sub: 'Katılım bir söz vermektir: saatinde gel, yer kapma, gelemeyeceksen önceden haber ver ki sıra başkasına geçsin. Listede tutulan bir yer, gelinmediğinde sıradakine yazılır.',
      blocks: [
        {
          items: [
            'Duyurulan saatte etkinlik sesli kanalında hazır bulun.',
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
      sub: 'Etkinliğin sesi de sözü de sırayla alınır; mikrofonu domine eden kişi etkinliği kendi başına bitirmiş olur. Sessiz kalmak da bir seçimdir, söz almadan dinlemek rahatsızlık sayılmaz.',
      blocks: [
        {
          items: [
            'Moderatör konuşurken **söz kesme**; soruların için el kaldır ya da sohbet kanalından yaz.',
            'Bağırma, mikrofon spamı, ses efekti ve müzik açmak yasaktır; kurallar sesli kanallarda da geçerlidir.',
            'Etkinlik dışı konuyu etkinlik kanalında açma.',
            'Yayın açtığında gösterdiğin her şey sunucu kurallarına tabidir; +18, kanlı ya da rahatsız edici içerik anında kapatılır.',
            'Rahatsız olduğun bir davranışı kanalda tartışma; yetkiliye bildir, o çözer.',
          ],
        },
      ],
    },
    {
      title: 'Adil Oyun',
      sub: 'Ödül olan her etkinlikte ölçü aynıdır: hile yok, bilgi sızdırma yok, kasıtlı kaybetme yok. Adil sayılan oyun, kazananı kadar kaybedeni de rahatsız etmeyen oyundur.',
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
      title: 'Ödüller',
      sub: 'Ödül listesi duyuruda yazan kadardır; kural çiğneyen, oyunun ödülünü de kaybeder. Kazandığını sen değil, etkinliği yöneten yetkili ilan eder; ilan edilmemiş şey ödül sayılmaz.',
      blocks: [
        {
          items: [
            'Ödül **etkinlik bitiminde** ve tek seferde dağıtılır; eksik kaldığını düşündüğün ödül için <@&1554240000529539083> ekibine yazılır.',
            'Ödül devredilemez ve başkasına satılamaz; takas ya da satış girişimi yasaktır.',
            'Etkinlik bitişine kadar kalmayan, ödül anında bulunmayan üye hakkını sıradakine bırakır.',
            'Kazanmadığın bir ödülü kazandım diye iddia etmek ceza sebebidir.',
          ],
          note: 'Haftalık dereceler ve saygınlık ödülleri etkinlik ödülünden ayrıdır; o roller her pazartesi yenilenir.',
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
      sub: 'Etkinlikler <@&1554240000529539083> ekibi tarafından kurulur, duyurulur ve yönetilir; hepsi ücretsiz ve Discord üzerinden yürür. Katılmak için oyun satın almana ya da bir şey indirmene gerek yok.',
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
      sub: 'Sırayla doğruluk ya da cesaret seçilen sohbet etkinliği: sahne kanalda, izleyen çok, oynayan az. Koltuğa oturmak zorunda değilsin; izleyici olmak da tam bir katılım sayılır.',
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
      sub: 'Gartic Phone ve Spyfall: tarayıcıdan girilen, indirme gerektirmeyen kalabalık grup oyunlarımız. İkisinde de rekabetten çok kahkaha hedeflenir; iyi çizmek ya da hızlı konuşmak şart değildir.',
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
      sub: 'Aynı etkinliklerin indirilen tarafı: Among Us, Goose Goose Duck, Crab Game ve Brawlhalla. Dördü de ücretsizdir ve tartışma kısmı yine bizim sesli kanallarımızda yürür.',
      blocks: [
        {
          items: [
            '**Among Us** ve **Goose Goose Duck**: görev yap, haini bul; tartışma kısmı bizim sesli kanalımızda yürür. Goose Goose Duck ücretsizdir.',
            '**Crab Game**: yüz kişiye kadar eleme usulü mini oyunlar; ücretsizdir, tarayıcıdan da oynanır.',
            '**Brawlhalla**: ücretsiz dövüş oyunu; 1v1 ya da takım turnuvası olarak açılır.',
            'Bu oyunlar için sunucu hesabından başka bir kayıt ya da ödeme istenmez; isteyenler için <@&1555890043237826630> gibi oyun rolleri sohbeti kolaylaştırır.',
          ],
        },
      ],
    },
    {
      title: 'Discord İçi Etkinlikler',
      sub: 'Ses kanalının içinden açılan hazır etkinlikler: ortak izleme, çizme ve kart oyunları. Hiçbir şey indirmen, hesap açman ya da bağlantı kurman gerekmez; kanala girip katılman yeter.',
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
      sub: 'Etkinlik listesi üyelerden gelen önerilerle büyür; <#1538540051028381696> kanalı tam bu iş için var. Daha önce oynanmamış bir oyunu ya da bir izleme partisini yazarsan program oradan kurulur.',
      blocks: [
        {
          items: [
            'Öneri kanalına ne izlemek, ne oynamak ya da ne yarışmak istediğini yaz.',
            'Aynı öneri tekrar tekrar yazılmasın diye öneriler tek mesajda toplanır.',
            'Programı <@&1554240000529539083> kurar, <@&1554239995412488304> onaylar.',
          ],
          note: 'Etkinlik takvimi değişkendir; duyurusu olmayan bir gün için "neden etkinlik yok" baskısı kurallara göre yaptırım sebebidir.',
        },
      ],
    },
  ],
};

// 5) Oyun kuralları: ortak davranış kuralları ve oyuna özel maddeler. Kanal listesine ve "nerede ne var" bilgilerine
// yer yok: 5v5 bilgilendirme paneli kanal tarafını zaten anlatıyor, burada sadece uyulacak maddeler durur.
const oyunKurallari = {
  key: 'oyun-kurallar',
  name: 'Oyun Kuralları Paneli',
  title: 'Oyun Kuralları',
  intro: 'Birlikte oynadığımız oyunlarda uyulacak kurallar. **Sunucu kuralları** oyun içinde de olduğu gibi geçerlidir.',
  channel: '1538541309634285678',
  sections: [
    {
      title: 'Her Oyunda Geçerli',
      sub: 'Oyun fark etmez: takım arkadaşı da rakip de önce sunucunun üyesidir ve saygı sırayı beklemez. Maçın gerilimi dinlendiğinde yazdıkların ve söylediklerin hâlâ kayıttadır.',
      blocks: [
        {
          items: [
            'Hakaret, küfür, ayrımcılık ve tehdit **rakibe de takım arkadaşına da** yasaktır.',
            'Takım arkadaşını susturma ya da oyundan atma tehdidiyle sıkıştırmak tacizdir.',
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
      sub: 'Yerini, sıranı ve sözünü koru: takım oyunlarında en çok tartışma çıkaran şeyler bunlardır. Bir kişi yerini bildirmeden boşalttığında maç herkes için uzar.',
      blocks: [
        {
          items: [
            'Lobiye **çağrılmadan** girmek ve başkasının slotunu almak yasaktır.',
            'Sıran gelmeden oynamaya başlama, AFK kalma; gelmeyeceksen <@&1554240000529539083> ekibinden birine yaz.',
            'Takım arkadaşın hata yapınca bağırma, hakaret etme; düzeltmek istiyorsan oyun sonunda söyle.',
            'Kasıtlı kaybetme, kendi takımının oyununu bozma ve başkalarını teslim olmaya zorlama yasaktır.',
            'Rapor butonunu misilleme için kullanmak kural ihlalidir; gerçek ihlalde ise kanıt senin oyun kaydındır.',
          ],
        },
      ],
    },
    {
      title: 'Oyunlara Özel',
      sub: 'Kısa hatırlatmalar: her oyunun kendi içinde tartışma çıkaran yerleri ve bizim o yerlerdeki duruşumuz. Bu maddeler sunucu kurallarının yerine değil, yanına geçer.',
      blocks: [
        {
          heading: 'Valorant ve Counter-Strike 2',
          items: [
            'Sıra ve ekonomi konuşulur, suçlama edilmez.',
            'Rakibin konumunu kanal dışına taşımak (info sızdırma) oyunun tadını bozar; şikayetini hakeme bildir.',
            'Eklenti ve script: yalnızca oyunun izin verdikleri kullanılır.',
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
            'Eşleşme duyurulduktan sonra saatte hazır olmayan üye sırasını kaybeder.',
            'Rakip bağlantı koparsa maç **bir kez** baştan alınır; tekrar koparsa kararı maçı yöneten yetkili verir.',
            'Karakter ve arenayı seçerken rakiple pazarlık yapılır, tek taraflı dayatma olmaz.',
          ],
        },
      ],
    },
    {
      title: 'Etkinlik Maçları',
      sub: 'Ödül olan her maçta ölçü şeffaflıktır: takımı, eşleşmeyi ve sonucu maçı yöneten yetkili ilan eder. Kendi maçının kararını kendin veremezsin; konu maçın içinde, sesli odada kapanır.',
      blocks: [
        {
          items: [
            'Kayıt, saat ve format **duyuruda** yazılır; duyuruda olmayan bir kural sonradan eklenmez.',
            'Takımlar ve eşleşme <@&1554240000529539083> tarafından kurulur, kanalda gösterilir.',
            'Maç sonucu ekran görüntüsü ile kayda geçer.',
            'Karar maçı yöneten yetkilinindir: itirazını maçın içinde, odada edersin; kanalda uzatılan tartışma her iki takımın da aleyhinedir.',
          ],
        },
      ],
    },
    {
      title: 'Klip ve Tartışma',
      sub: 'Oynadıklarını paylaşabilirsin; paylaşırken de kurallar seninle gelir. Klipte görünen isim, ses ve yazı da birer kişisel veridir; izinsiz gösterilen hiçbir şey geri alınamaz.',
      blocks: [
        {
          items: [
            'Klipte arkadaşının yüzünü, sesini ya da kişisel bilgisini izinsiz gösterme.',
            'Oyun tartışmasında rakip takımın üyelerini hedef gösterme, isim vererek suçlama.',
            'OwO ve Mudae gibi topluluk botları yalnızca kendi kanallarında kullanılır.',
          ],
        },
      ],
    },
  ],
};

// 6) 5v5 bilgilendirmesi: iç takım maçları. Turnuva değil: takımları etkinlik yetkilisi sesli odada karma ve
// dengeli kurar, üye kendi beşlisini aramak zorunda değildir. Muhatap her zaman <@&1554240000529539083> ekibidir,
// genel yetkili kadrosu değil.
const besVBesBilgisi = {
  key: 'bes-v-bes-bilgi',
  name: '5v5 Bilgilendirme Paneli',
  title: '5v5 Bilgilendirmesi',
  intro: 'Sunucunun **takım oyunları**: iki beşli, tek maç, tek kazanan. Takımları etkinlik yetkilisi kurar, sen duyuruyu bekleyip odaya girersin.',
  channel: '1538541416387448944',
  sections: [
    {
      title: '5v5 Nedir',
      sub: 'Beşe beş oynanan iç maçlarımız: Valorant, League of Legends ve Counter-Strike 2 tarafında açılır. İki takım, tek maç, tek kazanan; sıradan bir ranked değil, duyurulup saati belli olan bir programdır.',
      blocks: [
        {
          items: [
            'Duyuru <#1538538618468040714> kanalından gelir; <@&1554240000529539083> ekibi saati kurar, odayı yönetir ve sonucu ilan eder.',
            'Takımları etkinlik yetkilisi kurar: kimse kendi beşlisini aramak zorunda değildir, oyun rolün ve kademen ne olursa odaya gelirsin.',
            'Eksik kalan tarafa aynı odada üye bulunur; takım yüzünden dışarıda kalan üye olmaz.',
            'Maç öncesi format (harita, taraf, uzatma) duyuruda yazılı gelir.',
            'Kazanan takıma <@&1555890043250282496> rolü verilir.',
          ],
        },
      ],
    },
    {
      title: 'Maç Günü',
      sub: 'Saat, kanal, taraf: karışan şeyler değil, takipte geciken şeyler maçı uzatır. Odaya geç gelen yalnızca kendi sırasını değil, iki takımın da maçını bekletir.',
      blocks: [
        {
          heading: 'Sıra',
          items: [
            'Duyurudan **10 dakika önce** <#1538543237940117586> kanalında toplanılır; sesli katılım beklenir.',
            'Takımlar sesli odada kurulur: <@&1554240000529539083> ekibi karma yapar ve iki beşliyi dengeli tutar.',
            'Geleceğin saatte belli olursa sıradan önce <@&1554240000529539083> ekibine yazılır; yerin boşa gitmez.',
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
      title: 'Kurallar',
      sub: 'Oyun kuralları 5v5 için de geçerlidir; maç içinde durdurma yetkisi yalnızca yetkilidedir. Konu maçın içinde, sesli odada kapanır: skor ekran görüntüsü yetkilidedir ve tartışma uzatılmaz.',
      blocks: [
        {
          items: [
            'Hile, makro ve izinsiz eklenti: anında maçtan ve etkinlikten çıkarılma.',
            'AFK kalma ve kasıtlı kaybetme: yetkili uyarır, tekrarında yerine yedek alınır.',
            'Saatte hazır olmayan üye yerine yedek bulunabilir; yedek de çıkmazsa maç ertelenir.',
            'Karar maçı yöneten yetkilinindir; itiraz odada, maçın içinde edilir, kanalda bağırarak sonuç değişmez.',
          ],
          note: 'Ayrıntılı maddeler <#1538541309634285678> kanalında.',
        },
      ],
    },
    {
      title: 'Ödül ve Sonrası',
      sub: 'Kazanan rolü alır, kaybeden rövanşı ister; ikisi de sohbette kalır. Maç bittiğinde skor kayda geçer, takım odaları boşalır ve gecenin izi sohbet kanalında durur.',
      blocks: [
        {
          items: [
            'Birinci takıma <@&1555890043250282496> rolü verilir; başka ödül varsa duyuruda yazan kadardır.',
            'Sonuç <#1538538618468040714> kanalından ilan edilir, katılımcılara teşekkür edilir.',
            'Klip ve skorlar <#1538542919084941333> kanalında paylaşılır.',
            'Sürekli aynı takımla oynanmaması için sonraki 5v5\'te takımlar baştan kurulur.',
          ],
        },
      ],
    },
  ],
};

// 7) Sorun çözme: kanalın tek işi üyeye anlık sesli yardımın yolunu göstermek. Görüşmenin yürüyüşü, gizlilik ve
// itiraz gibi süreç anlatımı bilerek burada değil; üye buraya "derdim var, şimdi ne yapacağım" diye giriyor.
const sorunCozmeBilgisi = {
  key: 'sorun-cozme-bilgi',
  name: 'Sorun Çözme Bilgilendirme Paneli',
  title: 'Sorun Çözme',
  intro: 'Seste bir sorun mu oldu? Ses odasına gir, <@&1544337671340433569> çağır, konuşarak çöz: buranın işi **anlık yardım**.',
  channel: '1538544294388961300',
  sections: [
    {
      hideTitle: true,
      blocks: [
        {
          heading: 'Şimdi ne yapacaksın',
          items: [
            '`1.` <#1538544966282911884>, <#1538545004920971284> ya da <#1538545038751965265> odalarından boş olanına gir, mikrofonu aç.',
            '`2.` Odada yetkili yoksa <#1538544350185914389> sohbetinde <@&1544337671340433569> rolünü etiketle; yardım istemek ihlal değildir.',
            '`3.` Tek cümleyle anlat: kim, ne oldu, ne istiyorsun. Elinde ekran görüntüsü ya da klip varsa sohbete bırak.',
            '`4.` Yetkili odaya gelir, konu sesli çözülür; uzayacaksa <#1538535372588326973> içindeki **Talep Oluştur** ile yazılı kayıt açılır.',
          ],
        },
        {
          heading: 'Kanıtla konuş',
          items: [
            'İddianın arkasında ekran görüntüsü, klip ya da mesaj bağlantısı varsa yardım hızlanır; kanıtsız suçlama kayda girer ama ilerlemez.',
            'Karşı taraf da dinlenir: sesli görüşmede tek anlatan sen olmazsın.',
            'Görüşmenin sonucu <#1538942392613208164> rapor kanalına işlenir, yani yardım isteğinin izi kalır.',
          ],
          note: 'Rol, ödül ve ceza itirazı gibi tek taraflı işler sesli görüşmenin değil destek talebinin konusudur.',
        },
      ],
    },
  ],
};

// 8) Partner şartları: kanalın tamamı tek kart ve yalnızca şartlar. Buraya "nasıl teklif verilir" gibi süreç
// anlatımı girmez; kanala şartlar nedir diye bakılır. Maddeler partner DM kartındaki (partner/ui.js termsDm)
// dört bağlayıcı şartla aynı metinledir, yani kanalda okunan ile kabul edilen aynıdır.
const partnerSartlari = {
  key: 'partner-sartlari',
  name: 'Partner Şartları Paneli',
  title: 'Partner Şartları',
  intro: 'Partnerlik için kabul ettiğin **dört bağlayıcı madde** ve kaydı incelerken baktığımız ölçütler.',
  channel: '1538943458864005150',
  sections: [
    {
      hideTitle: true,
      blocks: [
        {
          heading: 'Bağlayıcı maddeler',
          items: [
            'Reklam metni **Discord kurallarına** aykırı içerik barındıramaz.',
            'Sunucular karşılıklı olarak **aynı gün içinde** birbirini paylaşır.',
            'Onaylanan reklam metni **değiştirilemez**; değişiklik için yeni talep açılması gerekir.',
            'Kurallara uymayan partnerlikler yetkililerce **tek taraflı sonlandırılabilir**.',
          ],
        },
        {
          heading: 'İncelemede bakılanlar',
          items: [
            'Sunucu Türkçe ve kurallara uyumlu olsun: +18 içerik, taciz, ayrımcılık ya da yasa dışı paylaşım olmamalı.',
            'Davet bağlantısı **kalıcı** olmalı ve gerçekten o sunucuya gitmeli.',
            'Metin okunabilir olsun: sunucunun adı, ne vaat ettiği ve davet bağlantısı tek mesajda.',
            'Karşı tarafta iletişime geçilebilir bir **yetkili** bulunsun; muhatapsız kayıtlar yenilenmez.',
            'Sunucu ya da yetkilisi daha önce yasaklı listeye girmemiş olsun.',
          ],
          note: 'Üye sayısı gibi ölçütler sabit bir eşikle değil, kaydı inceleyen yetkilinin değerlendirmesiyle yürür.',
        },
      ],
    },
  ],
};

// 9) Partner metnimiz: kanalın tamamı tek kart. Başlık sunucunun adı, gövde karşı tarafa giden sabit ilan;
// Kopyala düğmesi ilanının tamamını (başlık satırı dahil) kod kutusu içinde gizli mesajla verir.
const partnerMetnimiz = {
  key: 'partner-metni',
  name: 'Partner Metni Paneli',
  title: 'Anime & Public',
  intro: 'Partnerlere verdiğimiz **tek sabit ilan**; kopyala, paylaş, davet bağlantısı güncel kalsın.',
  channel: '1538943528225476810',
  sections: [
    {
      hideTitle: true,
      button: { id: IDS.partnerMetniKopyala, label: 'Metni Kopyala' },
      blocks: [
        {
          // İlanın ilk satırı sunucunun adı; kartın başlığında zaten durduğu için gövdede tekrarlanmaz
          text: partnerConfig.ourAdText.split('\n').slice(1).join('\n'),
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
