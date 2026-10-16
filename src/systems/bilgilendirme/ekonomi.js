// Kazu Coin paneli: coin sisteminin kapılarını anlatan, ayrı kanala giden panel. Altı kısa bölüm; ödül cetvelinin
// tamamı sistemlerin kendi panellerinde duruyor, burada yalnızca karar verirken gereken sayılar tekrar edilir.
// Sayılar sistem config'lerinden alındığı için bir ödül değişirse buradaki metin de yenilenmeli.
module.exports = {
  key: 'ekonomi',
  name: 'Kazu Coin Paneli',
  title: 'Kazu Coin',
  intro: 'Coin nasıl kazanılır, nerede harcanır ve seni ne bekliyor: botun para sisteminin bütün kapıları, **kısa** kartlar hâlinde.',
  channel: '1558968836420665615',
  sections: [
    {
      title: 'Coin Nedir',
      sub: 'Kazuki\'nin kendi parası: kazanmak için sunucuda vakit geçirmen, harcamak için üç raftan birini seçmen gerekiyor. Cüzdan kendi kendine büyümüyor: coin komutla gelir, harcayınca da aynı hızla çıkar.',
      blocks: [
        {
          text: 'Coin **mesaj sayısıyla ya da spamle üretilmez**; günlük ödülden, görevlerden, oyunlardan ve etkinliklerden gelir. Yani cüzdanı dolu üye gerçekten burada vakit geçirmiş üyedir.',
        },
        {
          heading: 'Üç kapı',
          items: [
            '**`/gunluk`** — günde bir kez yazdığın komut; coinini verir, arka arkaya geldikçe serin büyür.',
            '**`/gorev`** — bugün için üç görev çeker; üçünü bitirince günün demeti açılır.',
            '**`/bakiye`** — cüzdanın. Bakiye, kazanç ve harcama tek kartta; kazanma ve harcama kapılarının butonları da yanında.',
          ],
        },
        {
          note: 'Günlük ve görevlerle günde **350-500 coin** birikir. Keşif, şakalaşma ve suç dünyasından gelen kazanç **günde 1200 coin** ile sınırlı; kumarhane bahsi ve üye→üye transfer bu sayıya girmez. Hiçbir şey almasan bile coin, **`/siralama`** içindeki coin listesinde yerini belirler.'
        },
      ],
    },
    {
      title: 'Günde İki Komut',
      sub: 'Alışkanlık iki komut: **`/gunluk`** serini büyütür, **`/gorev`** bugünün üç görevini bitirince demetini açar. Gün **İstanbul saatiyle 00:00\'da** yenilenir.',
      blocks: [
        {
          heading: 'Günlük ödül',
          items: [
            'Taban **40 coin**, her seri günü **+12** (tavan **+72**), her seviye **+3** (tavan **+180**): bir günde en fazla **292 coin**.',
            'Bir gün kaçırırsan seri **1\'e** döner ama kaybettiğin coin geri istenmez. Her seri günü profil puanına **+5** yazılır.',
          ],
        },
        {
          heading: 'Üç görev ve demet',
          items: [
            'Havuzdan çekilen görevler örneğin **20 mesaj** (70 coin), **30 dakika seste** (90 coin), **günlük ödülünü topla** (50 coin), **saygınlık ver** (60 coin), **3 gezi** (100 coin).',
            'Üçünün ödülünü de alınca **Demeti Al** butonu aktifleşir: **120 coin + 1 anahtar + 3 sezon puanı**. Haftalıklar her pazartesi değişir: **250-500 coin + 1 anahtar**.',
            '**Keşif Yolu** tek seferlik, **18 adımlık** tur: botun sistemlerini sırayla gezdirir, sonunda **600 coin + 3 anahtar** ve **Sevilen** rütbesi var.',
          ],
          note: 'Görev kaydı tutulmaz: ilerleme mesaj ve ses sayılarından okunur, yani bot kurulmadan önce attığın mesajlar da sayılır.',
        },
      ],
    },
    {
      title: 'Anahtar, Kutu ve Sezon',
      sub: 'Anahtarlar görevlerden ve demetten birikir, **üçü bir kutu** açar. Görevlerin ikinci ölçüsü olan sezon puanı ay boyunca yükselir, ay başında sıfırlanır.',
      blocks: [
        {
          heading: 'Kutu',
          text: '**`/gorev`** panosundaki **Kutu** sekmesinde **Kutu Aç** üç, **3 Kutu Aç** dokuz anahtar harcar. Ödülün **%62\'si coin** (**120-900**), kalanı anahtar, profil çerçevesi, tema ya da rozet. Her **5 kutuda bir** kozmetik garanti; sıradaki kozmetik zaten sendeyse kutu **600 coin** verir, anahtar boşa yanmaz.'
        },
        {
          heading: 'Sezon eşikleri',
          items: ['**40 puan** 400 coin · **90** 5 anahtar · **150** 1200 coin · **220** 10 anahtar · **300** profil çerçevesi'],
          note: 'Her eşik **ayda bir kez** alınır; hangi eşikte olduğunu **`/gorev`** panosunun **Sezon** sekmesi gösterir.',
        },
      ],
    },
    {
      title: 'Kazanmanın Diğer Yolları',
      sub: 'Keşif ücretsiz, şakalaşma karşılıklı, sokak riskli. Kumarhane ise coin **yakar**: iki masada da kasa uzun vadede kazanır. Bahis ve üye→üye transfer günlük sayıya girmediği için burası kazanma kapısı değil, harcama kapısıdır.',
      blocks: [
        {
          heading: 'Keşif gezileri',
          items: [
            '**`/oyun`** içinde günde **8 gezi**, aralarında **20 dakika**. **Kıyı Kasabası** herkese açık: **25-80 coin**, ara sıra anahtar ve çerçeve.',
            'Seviye **8**: Fısıltı Ormanı, **20**: Kırık Mağara, **35**: Ay Işığı Bahçesi. Bölge büyüdükçe yağma **900-1600 coin**\'e, rozet ve kozmetiğe çıkar.',
            'Bir gezide **500 coin** ve üstünü kazanırsan kazancın kanalda duyurulur.',
          ],
        },
        {
          heading: 'Şakalaşma',
          items: [
            '**`/öp`** ve **`/tokat`** muhataba kanalda görünen şaka kartı atar; **3 dakika** içinde karşılık verilirsen ödül **ikinize de** yatar: öp **10-40 coin**, tokat **5-45 coin**.',
            'Günde **12 kart**; karşılık gelmezse kart boşta kalır, kimse coin kaybetmez. Sana uzanan kartları **`/şakalaş`** toplar.',
          ],
        },
        {
          heading: 'Arka Sokaklar',
          items: [
            '**`/sokak`** suç tarafının sayfası. Üye soymak için **seviye 5**, kasa soymak için **seviye 12** gerekir.',
            'Başarıda kurbanın cüzdanının **%5-%20**\'si (tek elde en fazla **500 coin**) ya da kasadan **%10-%25** (en fazla **800 coin**) çıkar.',
            'Yakalanırsan ceza ve kefalet **Devletin Kasasına** yazar; kasayı büyüten tek şey ödenen cezalardır.',
          ],
        },
        {
          heading: 'Kumarhane',
          text: 'Rulette kırmızı ya da siyah **%47** tutar ve **2 katı** verir, yeşil **%7** tutar ve **14 katı** verir. **Şans Merdiveni** **8 basamak**, tepeden çekilirse kazanç **182 katına** çıkar. Bahis **50 / 100 / 250 / 500 / 1000 coin** butonlarından seçilir, elle coin yazdırılmaz. Masa her elden **%5-%7** pay alır: burası para basan yer değil, para yakan yer.',
        },
      ],
    },
    {
      title: 'Nerede Harcanır',
      sub: 'Coin üç rafta harcanır: **Mağaza · Kart Süsü**, **Butik · Yüzük & Renk** ve **evlilik**. Üçüne de **`/bakiye`** cüzdanının yanındaki butonlardan girilir.',
      blocks: [
        {
          heading: 'Mağaza · Kart Süsü',
          items: [
            'Çerçeveler Bronz **1200** / Gümüş **2600** / Altın **4800** / Neon **7200** · profil temaları **2500-7800 coin**',
            'Kapak arka planları **1800-4800** · sergi rozetleri **1500-6400 coin**',
          ],
        },
        {
          heading: 'Butik · Yüzük & Renk',
          items: [
            'Ek saygınlık hakkı (günde bir hak daha) **1500** · evlilik yüzüğü **4000 coin**',
            'Renkli rol: sunucuda adın renkli yazılır, **9000-15000 coin**, kalıcı',
          ],
        },
        {
          heading: 'Evlilik',
          items: [
            'Yüzüğü butikten alır **`/evlilik teklif`** ile uzanırsın; kabul edilirse yüzük **o anda** yanar ve bot **çift rolünüzü** açıp ikinize giydirir. Rolün adını, rengini ve simgesini teklif ederken sen seçersin.',
            'Evli kalırsanız **her 7 günde bir ikinize de 400 coin**; boşanma bedeli **1200 coin**, doğrudan Devletin Kasasına yazar.',
          ],
        },
        {
          note: 'Profil puanı coinle değil sahip olduklarınla büyür: her kozmetik **+10**, her görev **+2**, her seri günü **+5** (tavan **1000**). Harcadığın coin puandan **düşmez**, cüzdanındaki coin ise anlık bakiyendir.',
        },
      ],
    },
    {
      title: 'İlk Beş Dakika',
      sub: 'Beş adım, hepsi bir-iki dakika. Sırayla yaparsan botun bütün kapıları bir kez açılmış olur ve ertesi gün ne yapacağını bilirsin.',
      blocks: [
        {
          items: [
            '`1.` **`/gunluk`** yaz, ilk coinlerini topla.',
            '`2.` **`/gorev`** yaz, bugünün üç görevine bak ve **Keşif Yolu** sekmesinden yürümeye başla.',
            '`3.` **`/bakiye`** yaz; cüzdanın açılır, yanındaki butonlar kazanma ve harcama kapılarının hepsini adlarıyla gösterir.',
            '`4.` **`/oyun`** ile ilk gezine çık ya da en düşük bahisle bir el çevir.',
            '`5.` **`/seviye`** ve **`/siralama`** ile nerede olduğunu gör.',
          ],
          plain: true,
        },
        {
          heading: 'Takılırsan',
          text: 'Görev satırları neyi ölçtüğünü yazıyor. Yine de takılırsan <#1538535372588326973> kanalından **Talep Oluştur** butonuyla destek alabilirsin; komutların tam listesi <#1538536351119446127> kanalında **`/yardim`** içinde.',
        },
      ],
    },
  ],
};
