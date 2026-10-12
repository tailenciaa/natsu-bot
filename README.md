# Kazuki

**Kazuki**, tek bir Discord sunucusunun bütün sistemlerini bir çatı altında toplayan Türkçe yönetim botudur (discord.js 14).
Hiçbir mesajda embed yoktur, hepsi Components V2 ile yazılmıştır. Kanal ve rol ID'leri koda sabit yazılır; hiçbir kurulum komutu kanal ya da rol sormaz.
Görünüm kuralları `docs/TASARIM.md` dosyasında, çalışma notları `CLAUDE.md` dosyasındadır.

## Kurulum

1. [Discord Developer Portal](https://discord.com/developers/applications) > uygulama > **Bot** sekmesinde:
   - **Reset Token** ile tokeni al.
   - **SERVER MEMBERS INTENT** ve **MESSAGE CONTENT INTENT** seçeneklerini aç.
2. Botu sunucuya ekle (`CLIENT_ID` yerine uygulamanın ID'sini yaz):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=8`
3. `.env` dosyasına tokeni ve sunucu ID'sini yaz:
   ```
   TOKEN=tokenin_buraya
   GUILD_ID=sunucu_id
   ```
4. Botu başlat (Node 20.12 ve üzeri):
   ```
   npm install
   npm start
   ```

Bot açılınca komutları sunucuya yükler ve panelleri (destek, yetkili alımı, kurallar, bilgilendirme, booster, özel oda rehberi vb.) ayarlı kanallara kendisi gönderir.
Panel metni ya da görseli değişmediyse panele dokunulmaz; değiştiyse yeni panel gönderilir ve eskisi silinir (gönderim başarısız olursa kanal panelsiz kalmaz).

> **Aynı token ile aynı anda tek yerde çalıştır.** Hem kendi bilgisayarında hem Railway'de açık olursa her olay iki kez işlenir (çift mesaj, çift panel).

## Veri

Veri MongoDB'de tutulur: ortam değişkenlerine `MONGODB_URI` (ve isteğe bağlı `MONGODB_DB`) yazılırsa kullanılır. Yazılmazsa `data/db.json` dosyası kullanılır.
Sık değişen kayıtlar (XP, sıralama, haftalık aktifler, saygınlık) birkaç saniyede bir toplu yazılır ve bot kapanırken diske boşaltılır.

## Komutlar

Butonla yapılabilen işler için komut yoktur. Komutlar şunlardır; `/yardim` tek mesajda gezilir: kısa bir panel açılır (başlık, tek açıklama, kategori menüsü) ve kategori seçilince panelin yerini o kategorinin komut kartı alır, kartın altındaki düğme panele döndürür. Panel tek katmanlıdır ve kim açarsa açsın yalnızca sistemin `help.member` listesindeki, yani HERKESİN kullanabildiği komutları gösterir; yetkili ve kurulum komutları menüde hiç yer almaz. Ayrıntılı erişim her komutun `help.access` kaydındadır:

| Komut | Açıklama | Kimler |
| --- | --- | --- |
| `/yardim` | Komutları kategorilere göre gösterir | Herkes |
| `/sicil [kullanici]` | Üyenin cezalarını, destek taleplerini ve değerlendirme kayıtlarını gösterir | Herkes kendisininkini, yetkililer herkesinkini |
| `/seviye [kullanici]` | Mesaj ve ses aktivitesi seviyeni, tecrübeni ve sıradaki ödülleri kartla gösterir | Herkes |
| `/profil [kullanici]` | Geniş profil panosu: kapakta kimlik (evliyse kalp etiketli **eş ve birlikte geçen gün** hapı), **profil puanı bandı** (puan, rütbe, bir üst rütbe hedefi, sunucu sırası ve puanın geldiği sekiz bölüm), sayı şeridi (mesaj/ses seviyesi, mesaj, ses süresi, ziyaret, sicil, sunucuda geçen süre; yayın, soygun, keşif ve şakalaşma sütunları yalnızca üyenin o sistemde kaydı varsa doğar), rozetler, biyografi ve vitrin. Altındaki butonlarla biyografi, renk, kapak, panel görünümü, tema, mağaza ve **Puanım** sayfası açılır | Herkes |
| `/gunluk` | Günlük coin ödülünü toplar, art arda günlerle seri bonusu büyür; kazanç kartı kanala düşer | Herkes |
| `/bakiye` | Coin cüzdanı: bakiye, kazanç, harcanan, seri ve mağazadan alınanlar. Altında iki satır buton var: ilk satır **Görevler**, **Oyun Salonu**, **Arka Sokaklar**, **Şakalaş** ile kazanma kapılarını, ikinci satır **Mağaza**, **Butik** ve **Siparişlerim** ile harcama kapılarını açar. **Butik** cüzdan kartının yerini alan coin harcama rafıdır: ek saygınlık hakkı, evlilik yüzüğü ve özel renkli roller | Herkes |
| `/gorev` | İlerleme panosu: beş sekmede günlük görevler ve günün demeti, haftalık görevler, Keşif Yolu (botun sistemlerini sırayla gezdiren adımlar), anahtarla açılan kutu ve ayın sezon eşikleri | Herkes |
| `/oyun` | Oyun Salonu: gezi (keşif), rulet ve şans merdiveni. Bahis butonlardan seçilir, coin kazanılır ya da yitirilir; masalar uzun vadede daima kârlıdır | Herkes |
| `/sokak` | Arka Sokaklar sayfası: suç sicilin, cezaevin ve kefalet hakkın, Devletin Kasası ile kasaya uzanan son girişimler. Soyma ve müdahale butonları bu sayfada ve pusunun kendi kartında | Herkes |
| `/çal uye kullanici` | Bir üyeyi soymaya kalkışmak. Kurban direnme düğmesine basmazsa para el değiştirir, basarsa soyguncu yakalanıp cezası kasaya yatar | Herkes (suç için ölçülen seviye gerekir) |
| `/çal kasa` | Devletin Kasasını zorlamak. Kasadaki para cezalarla birikir; herkes müdahale edebilir, ilk müdahale edene ikramiye düşer | Herkes (suç için ölçülen seviye gerekir) |
| `/şakalaş` | Şakalaşma sayfası: sana uzanan ve karşılık bekleyen kartlar, senin şaka sayıların ve kuralların. Cüzdandaki **Şakalaş** düğmesi de aynı sayfayı açar | Herkes |
| `/öp kullanici` ve `/tokat kullanici` | Muhataba şaka kartı atar; kart kanala düşer. Muhatap süre içinde karşılık düğmesine basarsa ödül **iki tarafa da** yatar (günlük oyun kazancı tavanına sayılır), basmazsa kart karşılıksız kalır | Herkes |
| `/evlilik teklif kullanici` | Butikte aldığın **yüzükle** bir üyeye teklif götürürsün; teklif kartı kanala düşer, muhatap **Kabul Ediyorum** ya da **Geri Çevir**'e basar. Yüzük yalnızca kabul anında yanar — ret ve sessizlik yüzük kaybettirmez | Herkes (teklif için ölçülen seviye gerekir) |
| `/evlilik durum` | Kendi evlilik hâlin: eşin, birlikte geçen gün, yıl dönümü ödülü, bekleyen teklifin ve teklif şartların. Sayfadaki düğmeler dönüm ödülünü toplar, tekliften vazgeçer ve boşanma bedelini öder | Herkes |
| `/evlilik liste` | Sunucudaki evli çiftler ve birlikte geçirdikleri gün | Herkes |
| `/evlilik bosan` | Eşinden boşanırsın; bedel Devletin Kasasına yazar ve iki tarafa da yeni teklif beklemesi konur | Evliler |
| `/siralama` | Tek menüden altı sıralama: mesaj, ses, yayın, saygınlık, coin ve VIP; rol ile filtrelenir, dönem yalnızca mesaj/ses/yayında seçilir | Herkes |
| `/saygi-ver kullanici` | Bir üyeye +1 saygınlık verirsin (günde bir kez, mesaja `+rep @üye` yazarak ya da puanladığın bir değerlendirmenin altındaki **Saygınlık Ver** butonuyla da verilir); her verme bot komutları kanalındaki herkese açık kayıtta görünür, haftanın birincisi ödül rolünü alır, tüm zamanların tablosu `/siralama`'da | Herkes |
| `/vip-ver kullanici` | Bir üyeye VIP rolünü kalıcı olarak verir; üye profilinde ve sıralamada VIP görünür | Yöneticiler |
| `/guvenilir-partnerler` | Güvenilir partner sunucuların listesi; menüden seçilen sunucunun tanıtım metni, kaydı ve **davet bağlantısı** açılır | Herkes |
| `/partner-musaitlik` | Partner sunucu yetkilisiysen yeni tekliflere açık olup olmadığını ayarlarsın | Partner yetkilileri |
| `/emoji-ekle emoji [isim]` | Başka sunucudaki emojiyi ekler | Emoji yönetme izni olanlar, takviye edenler (1 emoji) |
| `/cikartma-ekle dosya isim etiket` | Görseli çıkartma olarak ekler | Emoji yönetme izni olanlar, takviye edenler (1 çıkartma) |
| Mesaja sağ tık > **Emojileri Sunucuya Ekle** | Mesajdaki emojileri seçip ekler | Emoji yönetme izni olanlar |
| `/destek ekle` ve `/destek cikar` | Bulunduğun destek talebine üye ekler ya da çıkarır | Yetkililer |
| `/yetki-ver kullanici` | Rütbe, yetki ve görev rolü seçerek yetki verir | Yöneticiler |
| `/yetki-al kullanici` | Üyenin rütbe, yetki ve görev rollerini seçerek ya da hepsini birden alır | Yöneticiler |
| `/uyari`, `/mute`, `/unmute`, `/jail`, `/unjail`, `/ban`, `/unban` | Hızlı ceza komutları (sicile işlenir) | İlgili ceza yetkisi olanlar |
| `/ceza-kaldir`, `/ceza-sil` | Cezayı numarasıyla kaldırır ya da sicilden siler | Yetkisi olanlar |
| `/sil sayi` | Kanalda belirtilen sayıda mesajı siler | Mesajları Yönet yetkisi olanlar |
| `/cekilis baslat`, `bitir`, `yeniden-cek`, `iptal`, `liste` | Çekilişleri yönetir | Yöneticiler |
| `/kalici-oda` | Kendi kalıcı odasının kontrol panelini açar: ismi, kişi limiti, üye ekleme-çıkarma ve sahiplik devri. Odası olmayan üyeye başvuru kapısını gösterir, odası olmayan yöneticiye doğrudan oda listesini açar; bu yüzden üye yardım menüsünde durur | Herkes; panel odası olana, oda listesi yöneticiye açılır |
| Oda panelindeki **Odaları Yönet** düğmesi | Yöneticiler için oda listesi: bir oda seçilince kartından sahibi devredilir ya da oda kapatılır (oda numarası yazılmaz). Başvuru onayı inceleme kanalındaki kartlarda; başvuru panelden yapılır: önce üye seçme menüsü, sonra form, ID yazılmaz | Yöneticiler |
| `/log` | Log kurulum menüsünü açar: alt başlıkların durumunu gösterir, kurar ve sıfırlar | Yöneticiler |

Ceza komutları (`/uyari`, `/mute`, `/unmute`, `/jail`, `/unjail`, `/ban`, `/unban`, `/ceza-kaldir`, `/ceza-sil`) ve `/yetki-ver` ile `/yetki-al` sadece yetkili komut kanalında çalışır.

## Sistemler

Her sistem `src/systems` altında kendi klasöründe durur ve birbirine karışmaz:

| Grup | Sistemler |
| --- | --- |
| Destek ve yetkili | `destek` (talep alt başlıkları), `degerlendirme` (memnuniyet puanı, saygınlık ve itiraz), `basvuru` (yetkili alımı), `oryantasyon` (onaylanan başvuranın son aşaması), `yetki` (elle yetki verme) |
| Moderasyon | `sicil` (üye sicili ve hızlı ceza komutları), `cezalarim` (üyenin kendi cezaları ve itirazı), `temizle`, `yenihesap` (yeni hesap kısıtlaması), `log` (olay kayıtları) |
| Topluluk | `kurallar`, `bilgilendirme` (iki panel: sunucu rehberi #bilgilendirme kanalında, coin ve ekonomi rehberi ayrı kanalda; bölüm başına bir mesaj), `otorol`, `etiket` (sunucu etiketi rolü), `partner` (oto partner talebi; onaylanan ilan paylaşım kanalına **iki mesajla** düşer: düz metin ilanı — davet önizlemesi ve ekler orada görünür — ve altında **partner sayıları**yla **Sunucuya Katıl** butonunu taşıyan kart) ve `partnergorme`, `yayin` (yayın yetkisi), `boost` ve `emoji` (takviye avantajları, emoji/çıkartma ekleme) |
| Seviye ve sıralama | `seviye` (mesaj ve ses XP'si, her seviyede coin ve ana seviyede rol ödülü), `coin` (günlük ödül, seri, cüzdan ve sipariş geçmişi), `butik` (cüzdandan açılan coin harcama rafı: ek saygınlık hakkı, evlilik yüzüğü ve özel renkli roller; kendi komutu yoktur, yalnızca butonla açılır), `gorev` (günlük ve haftalık görevler, Keşif Yolu, kutu, sezon puanı ve eşikleri), `profil` (kart, rozetler ve görevler, vitrin, kapak düzenleyici, kozmetik mağazası), `siralama`, `aktif` (haftanın aktifleri), `saygi`, `vip` |
| Ses ve sunucu | `ses` (botun ses kanalında durması), `ozel-oda`, `kalici-oda` (başvuruyla açılan, sahibinin yönettiği tek ses kanalı odaları), `sesbilgi`, `cekilis`, `durum` (bot durumu), `yardim` |
| Oyun ve şans | `oyun` (Oyun Salonu: rulet, merdiven, keşif), `hirsizlik` (Arka Sokaklar: üye soyma, kasa zorlama, direniş, hapis, kefalet ve Devletin Kasası), `eglence` (`/şakalaş` sayfası ile `/öp` ve `/tokat` şaka kartları; karşılık gelirse iki taraf da coin kazanır), `evlilik` (`/evlilik`: yüzükle teklif, kabul anında yanan yüzük, yıl dönümü ödülü ve kasaya yazılan boşanma bedeli) |

Her sistem klasöründe: `config.js` (kanal/rol ID'leri ve metinler), `index.js` (komutlar ve işleyiciler), `ui.js` (gönderdiği mesajlar), `store.js` (kayıtlar).

```
src/
  start.js               Giriş: .env, veritabanı, sonra bot
  index.js               Sistemleri yükler, etkileşimleri ilgili sisteme yönlendirir
  core/                  Ortak parçalar
    ui.js                  Mesaj yardımcıları (page, alert, panel, pagerRow, tabRow...) ve otomatik düzenleme
    helpers.js             respond, replyError, yetki ve menü sahibi kontrolleri
    panel.js               Panellerin açılışta gönderilmesi
    banner.js              Panel afişleri (aşağıya bak)
    canvas.js              Seviye ve profil kartı çizimi (assets/fonts içindeki yazı tipiyle)
    db.js, config.js, logger.js
  systems/<sistem>/      Yukarıdaki sistemler
tools/preview/           Mesaj önizleme ve doğrulama aracı
docs/TASARIM.md          Görünüm kuralları
```

## Panel afişleri

Discord'a yüklenmiş görsellerin `cdn.discordapp.com` bağlantıları yaklaşık bir günde süresi dolan imzalar taşır. Bu yüzden panel gönderilirken afiş bir kez indirilip `data/banners/` altında saklanır ve mesaja kendi eki olarak konur; süresi hiç dolmaz.
Kalıcı bir afiş için görseli `assets/banners/<dosya adı>` olarak koymak yeterlidir (dosya adı, bağlantıdaki ad ile aynı olmalı); bu kopya her zaman önceliklidir.

## Doğrulama

Discord'a bağlanmadan mesajların görünümünü, her butonun bir işleyiciye bağlı olduğunu ve komutları denetleyen bir araç vardır (ayrıntı: `tools/preview/README.md`):

```
node tools/preview/check.js [sistem]    # lint, handler kapsamı, komut denetimi, görev ölçüm eşleşmesi
node tools/preview/build.js [sistem]    # tools/preview/out/index.html (tarayıcıda aç) ve <sistem>.txt
node -e "process.env.GUILD_ID='1'; require('./src/systems')"   # bot yükleniyor mu
```

## Özelleştirme

- Bot adı ve renkler: `src/core/config.js`.
- Kanal, rol ID'leri ve panel metinleri: ilgili sistemin `config.js` dosyası.
- Panel görselleri: ilgili `config.js` içindeki bağlantı ya da `assets/` ve `assets/banners/` altındaki dosyalar.
- Destek kapatma sebepleri: `src/systems/destek/config.js` içindeki `closeReasons`; yetkili alım soruları: `src/systems/basvuru/config.js`.
- Saygınlık: `src/systems/saygi/config.js` — `channel` haftanın birincisinin duyurulacağı kanal, `feed` her vermenin herkese açık izinin düştüğü kanal (bot komutları), `roleId` ödül rolü, `cooldownHours` iki verme arası bekleme. Saygınlık üç yerden verilir: `/saygi-ver`, mesaja yazılan `+rep @üye` ve puanlanan bir değerlendirmenin altındaki **Saygınlık Ver** butonu. Üçü de `saygi/index.js`'teki tek `give` kapısından geçer; kural, bekleme ve Butik hakkı orada durur. Verme zaten `feed` kanalında olduysa izi cevap mesajının kendisi taşır, ikinci mesaj atılmaz. Butonla verildiğinde yetkiliye bir de DM gider ve aynı değerlendirmeden ikinci kez verilmez (`repAt`).
- Görev rozetlerinin rol ödülleri: `src/systems/profil/config.js` içindeki `gorevRolleri`. Rol ID'leri boşsa özellik çalışmaz; doldurulunca bot açılırken tüm sunucu taranır, üye katılırken ve rozet sayfasını açtığında kendi rolleri rozet durumuna göre eşitlenir (hedef gerilerse rol geri alınır).
- Butik: `src/systems/butik/config.js` — tükenen ürünler (ek saygınlık hakkı, evlilik yüzüğü) ve `roller` listesi. Bot rol **yaratmaz**: `roller` içindeki `roleId` boş (`null`) ise o renk satışta değildir, ID'ler yazılınca raf kendini açar; dördü de boşsa renk rafı tümden kalkar ve kurallar satırı rafın kapalı olduğunu üyeye söyler. Renk bir kez alınır, kalıcıdır; üye sunucudan düşüp dönerse bot satın aldığı renkleri `GuildMemberAdd` ile geri verir.
- Kozmetik fiyatları: çerçeve ve sergi rozetleri `src/systems/profil/kozmetik.js`, temalar `themes.js`, arka plan efektleri `kapak.js` içinde.
- Evlilik: `src/systems/evlilik/config.js` — teklifin açılacağı ölçülen seviye, yanıt penceresi (`teklif.pencere`), geri çevirme ve boşanma beklemeleri, boşanma bedeli (`bosanma.price`, kasaya yazar) ve yıl dönümü ödülü (`yilDonumu {gun, odul}`). Yüzük butiğin rafından gelir ve **yalnızca kabul anında** yanar; ret, vazgeçme ve sürenin dolması yüzük kaybettirmez. `roles.evli` boşsa (`null`) evlilik yine kayıt edilir ama çift rolü verilmez — ID yazılınca kabulde iki tarafa verilir, boşanmada geri alınır ve üye düşüp dönerse `GuildMemberAdd` ile kendiliğinden döner. Bekleyen teklif kartları `bekciAralik` ile taranır, süresi dolanlar kanaldaki kartı yerinde güncelleyerek kapanır.
- Kalıcı oda: `src/systems/kalici-oda/config.js` — başvuru panelinin düşeceği bilgi kanalı, başvuruların inceleneceği kanal, açılıp kapanan odaların duyurulacağı kanal, inceleyen rol (`reviewer: null` → onay yalnızca yöneticilerde), oda sahibi rolü, odaların açılacağı kategori ile üye/ses süresi gereksinimleri. Odalar bu kategorinin içine **tek bir ses kanalı** olarak açılır: ayrı yazı kanalı ve oda alt kategorisi yoktur, sohbet ses kanalının kendi sohbetidir. Kanal herkes tarafından görünür ama herkes yalnızca bakar — @everyone'a bağlanma ve yazma kapalıdır, odaya seçilen üyelere açık. Kategorinin @everyone görünürlüğü kapalıysa odalar kimseye görünmez; bot açılışta bunu logda uyarır ve eski kayıtları bir kez düzeltir. Başvuruda üye ID olarak yazılmaz: panelden sonra gelen üye seçme menüsünden seçilir, ardından yalnızca oda adı ve amacı sorulur. `activity` bloğu odayı açık tutan şartlardır: odadakilerin sesi her hafta ölçülüp odaya yazılır, haftalık hedefin altındaysa sahibine uyarı gider, ay başında geçen ayın kayıtlarına bakılır ve şartı karşılamayan oda "şart yetersizliği" ile kapatılır (`enabled: false` denetimi durdurur). Panel kanalı boşsa panel gönderilmez, başvuru kanalı boşsa başvuru alınmaz, duyuru kanalı boşsa oda olayı yalnızca loga işlenir.
- Panel tarzı temadan gelir: `themes.js` içinde `glass: true` olan temalar buzlu cam panel, ötekiler düz opak panel çizer. Cam temalarda saydamlığı üye kartın altındaki **Görünüm** sayfasından ayarlar (`custom.glassOpacity`, 0-100); düz temada düğmeler pasif durur.
- Profil kartının tüm verisi `src/systems/profil/view.js`'ten gelir: seviye, sıralama, coin, saygınlık, sicil, takviye, ziyaret, kozmetik ve hesap yaşı tek geçişte toplanır. Kart (`card.js`) yalnızca çizer, depodan veri çekmez; kapak önizlemesi de aynı katmanı kullanır. Yeni bir sistem veri ürettiğinde profile tek eklendiği yer burasıdır. Suç dünyası, Keşif Yolu, şakalaşma, butik ve evlilik sayıları ayrıca okunmaz: `view.js` onları `rozet.js`'in bağlamından (`context`) devralır, böylece kartla rozet sayfası hiçbir zaman farklı sayı söyleyemez.
- Rozet kataloğu `src/systems/profil/rozet.js`'tedir ve **her rozet zaten tutulan bir kayıttan türer** — ayrı bir "rozet kazandı" defteri yoktur, bu yüzden eski etkinlikler de sayılır ve kayıt bozulsa bile rozetler yeniden hesaplanır. Seviye, coin, saygınlık, kozmetik, görev ve ziyaret ölçütlerinin yanına ekonominin rozetleri durur: Sokak Kurdu (başarılı girişim), Kolay Yem Değil (direniş), Kasa Bekçisi (müdahale ikramiyesi), Gezgin (keşif turu), Neşe Saçan ve Karşılığını Veren (şakalaşma), Butik Müşterisi (satın alınan renk), Evli, Yıl Dönümü ve Bir Ömür (evlilik). Evlilik bittiğinde "Evli" rozeti kayıttan düştüğü için kendiliğinden kalkar; dönüm sayacı kalıcıdır. Suç sayaçları `hirsizlik/store.js`'in ham kaydından (`rec`) okunur, `durumOf`'tan değil: puan tablosu her üye için bağlam kurar ve `durumOf` her çağrıda sicil defterini yeniden sıralar.
- Profil puanı, rütbeleri ve sunucu sırası `src/systems/profil/skor.js`'te durur: sekiz bölüm 1000 puanı toplar (aktiflik, görevler, saygınlık, rozetler, koleksiyon, giriş serisi, sosyal, sadakat), sekiz rütbe basamağı (`Misafir` → `Destan`) eşiklerle belirlenir. Kart, **Puanım** sayfası ve ilk 10 listesi aynı fonksiyondan okur; sunucu geneli tablo tek geçişte hesaplanır ve 5 dakika önbellekte kalır. Puana yeni bir kaynak eklemek sadece `PARTS` dizisine bir bölüm yazmaktır. Puan ceza/sicilden düşmez, yalnızca kazanılanları toplar.
- Görevler: `src/systems/gorev/config.js` — günlük ve haftalık görev havuzları (her gün/pazartesi tarihten çekilen üçer görev), günün demeti, Keşif Yolu'nun sıralı adımları (`YOL`), kutunun anahtar maliyeti ile hazine ağırlıkları (`KUTU`) ve sezon eşikleri (`SEZON`). Ödül miktarları burada; görevlerin neyi saydığı `olcum.js`'teki eşleşmeyle belirlenir, ayrı bir ilerleme kaydı tutulmaz. Yol kilitli ilerlediği için buraya yalnızca herkesin yapabildiği adım girer. Kutudan çıkan kozmetik doğrudan üyenin mağaza sahipliğine geçer. Havuzdaki satırlar botun bütün katmanlarına dokunur: mesaj, ses, yayın ve saygınlığın yanında **salon gezisi** (`kesifGun`/`kesifToplam`), **kurduğun pusu** (`sokakGun`, Arka Sokakların kendi gün sayacından), şaka kartı, kutu ve kozmetik. Butik ve evlilik gibi **başkasının yanıtına ya da şansa kalan** eylemler görev hedefi olarak değil, yalnızca o sayfa görüldü mü diye (aşağıdaki `IZLENEN`) sayılır.
- Keşif Yolu'nun bazı adımları (`kartini-gor`, `sokaga-cik`, `butik-gor`, `evlilik-gor`, `cekilis-katil`) hiçbir sistemde iz bırakmaz: `IZLENEN` tablosunda yazılı olan komut adı ve düğme kimliği etkileşim geçerken gözlemlenir, bir daha bakmaya gerek kalmaz. Gözlem hiçbir cevaba karışmaz ve bayrak zaten duruyorsa hiçbir şey yazmaz. **Butiğin düğmesi önekli bir ailenin parçası olduğu için `IZLENEN.buton`'da tam kimliğiyle (`butik:magaza`) durur** — önekli düğmeleri buraya eklerken yalnızca ilk halkayı yazmak gözlemi sessizce bozar. Adlar elle eşleştiği için `tools/preview/check.js` iki tarafı da denetler: havuzdaki bir `olcum` adı `OLCUMLER`'de yoksa ya da bir `goruldu:` ölçümünün `IZLENEN` karşılığı yoksa deneti hata verir, çünkü bilinmeyen ad sessizce 0 döndürüp görevi hiç ilerlemez bırakır.
- Kapak görseli varsayılan olarak **banner** gibi durur (`custom.bannerFit`): görsel kapağın tamamına yayılır, dik bir fotoğrafta hangi şeridin görüneceğini bot görselin kontrastından kendisi seçer; üyenin kaydırma düğmeleri bu kadrajın üstüne biner. İsteyen **Sığdır**'a alabilir — görselin tamamı görünür, kenarlardaki boşluk aynı görselin koyulaştırılmış hâliyle doldurulur ve kaydırma pasifleşir. Düzenleyicideki **Yerleşim** düğmesi ikisi arasında döner.
- Botun rolü, verdiği rollerin (otorol, seviye, takviye, VIP vb.) üstünde olmalıdır.
