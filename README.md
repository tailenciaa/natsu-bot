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
| `/sicil [kullanici]` | Üyenin sicilini gösterir | Herkes kendisininkini, yetkililer herkesinkini |
| `/seviye [kullanici]` | Mesaj ve ses seviyesini kartla gösterir | Herkes |
| `/profil [kullanici]` | Geniş profil panosu: kapakta kimlik, **profil puanı bandı** (puan, rütbe, bir üst rütbe hedefi, sunucu sırası ve puanın geldiği sekiz bölüm), sekiz sayılık şerit (mesaj/ses seviyesi, mesaj, ses süresi, yayın, ziyaret, sicil, sunucuda geçen süre), rozetler, biyografi ve vitrin. Altındaki butonlarla biyografi, renk, kapak, panel görünümü, tema, mağaza ve **Puanım** sayfası açılır | Herkes |
| `/gunluk` | Günlük coin ödülünü toplar, art arda günlerle seri bonusu büyür; kazanç kartı kanala düşer | Herkes |
| `/bakiye` | Coin cüzdanı: bakiye, kazanç, harcanan, seri ve mağazadan alınanlar (butonlarla mağaza ve siparişler açılır, **Görevler** görev panelini açar) | Herkes |
| `/gorev` | İlerleme panosu: beş sekmede günlük görevler ve günün demeti, haftalık görevler, Keşif Yolu (botun sistemlerini gezdiren on iki adım), anahtarla açılan kutu ve ayın sezon eşikleri | Herkes |
| `/siralama` | Mesaj ve ses sıralaması (dönem, rol ve tür filtreli) | Herkes |
| `/saygi-ver kullanici` | Bir üyeye +1 saygınlık verir (günde bir kez, mesaja `+rep @üye` yazarak da verilir) | Herkes |
| `/saygi-siralama` | Tüm zamanların saygınlık tablosu | Herkes |
| `/vip-siralama` | VIP üyeleri VIP olma sırasına göre listeler | Herkes |
| `/vip-ver kullanici` | Bir üyeye VIP rolünü verir | Yöneticiler |
| `/guvenilir-partnerler` | Güvenilir partner sunucuların listesi | Herkes |
| `/partner-musaitlik` | Teklif atamaları için partner müsaitliğini ayarlar | Partner yetkilileri |
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
| `/kalici-oda odam` | Kendi kalıcı odasının panelini açar: ismi, kişi limiti, üye ekleme-çıkarma ve sahiplik devri | Odası olan üyeler |
| `/kalici-oda liste`, `kapat`, `devret` | Kalıcı odaları ve bekleyen başvuruları listeler, oda kapatır, sahibi ayrılmış odayı bir üyeye devreder (başvuru panelden yapılır: önce üye seçme menüsü, sonra form; ID yazılmaz. Yalnızca yöneticiler onaylar) | Yöneticiler |
| `/log kur` | Log kurulum menüsünü açar | Yöneticiler |

Ceza komutları (`/uyari`, `/mute`, `/unmute`, `/jail`, `/unjail`, `/ban`, `/unban`, `/ceza-kaldir`, `/ceza-sil`) ve `/yetki-ver` ile `/yetki-al` sadece yetkili komut kanalında çalışır.

## Sistemler

Her sistem `src/systems` altında kendi klasöründe durur ve birbirine karışmaz:

| Grup | Sistemler |
| --- | --- |
| Destek ve yetkili | `destek` (talep alt başlıkları), `degerlendirme` (memnuniyet puanı ve itiraz), `basvuru` (yetkili alımı), `oryantasyon` (onaylanan başvuranın son aşaması), `yetki` (elle yetki verme) |
| Moderasyon | `sicil` (üye sicili ve hızlı ceza komutları), `cezalarim` (üyenin kendi cezaları ve itirazı), `temizle`, `yenihesap` (yeni hesap kısıtlaması), `log` (olay kayıtları) |
| Topluluk | `kurallar`, `bilgilendirme`, `otorol`, `etiket` (sunucu etiketi rolü), `partner` ve `partnergorme`, `yayin` (yayın yetkisi), `boost` ve `emoji` (takviye avantajları, emoji/çıkartma ekleme) |
| Seviye ve sıralama | `seviye` (mesaj ve ses XP'si, her seviyede coin ve ana seviyede rol ödülü), `coin` (günlük ödül, seri, cüzdan ve sipariş geçmişi), `gorev` (günlük ve haftalık görevler, Keşif Yolu, kutu, sezon puanı ve eşikleri), `profil` (kart, rozetler ve görevler, vitrin, kapak düzenleyici, kozmetik mağazası), `siralama`, `aktif` (haftanın aktifleri), `saygi`, `vip` |
| Ses ve sunucu | `ses` (botun ses kanalında durması), `ozel-oda`, `kalici-oda` (başvuruyla açılan, sahibinin yönettiği tek ses kanalı odaları), `sesbilgi`, `cekilis`, `durum` (bot durumu), `yardim` |
| Oyun ve şans | `oyun` (Oyun Salonu: rulet, merdiven, keşif), `hirsizlik` (Arka Sokaklar: üye soyma, kasa zorlama, direniş, hapis, kefalet ve Devletin Kasası), `eglence` (`/öp` ve `/tokat` şaka kartları; karşılık gelirse iki taraf da coin kazanır) |

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
node tools/preview/check.js [sistem]    # lint, handler kapsamı, komut denetimi
node tools/preview/build.js [sistem]    # tools/preview/out/index.html (tarayıcıda aç) ve <sistem>.txt
node -e "process.env.GUILD_ID='1'; require('./src/systems')"   # bot yükleniyor mu
```

## Özelleştirme

- Bot adı ve renkler: `src/core/config.js`.
- Kanal, rol ID'leri ve panel metinleri: ilgili sistemin `config.js` dosyası.
- Panel görselleri: ilgili `config.js` içindeki bağlantı ya da `assets/` ve `assets/banners/` altındaki dosyalar.
- Destek kapatma sebepleri: `src/systems/destek/config.js` içindeki `closeReasons`; yetkili alım soruları: `src/systems/basvuru/config.js`.
- Görev rozetlerinin rol ödülleri: `src/systems/profil/config.js` içindeki `gorevRolleri`. Rol ID'leri boşsa özellik çalışmaz; doldurulunca bot açılırken tüm sunucu taranır, üye katılırken ve rozet sayfasını açtığında kendi rolleri rozet durumuna göre eşitlenir (hedef gerilerse rol geri alınır).
- Kozmetik fiyatları: çerçeve ve sergi rozetleri `src/systems/profil/kozmetik.js`, temalar `themes.js`, arka plan efektleri `kapak.js` içinde.
- Kalıcı oda: `src/systems/kalici-oda/config.js` — başvuru panelinin düşeceği bilgi kanalı, başvuruların inceleneceği kanal, açılıp kapanan odaların duyurulacağı kanal, inceleyen rol (`reviewer: null` → onay yalnızca yöneticilerde), oda sahibi rolü, odaların açılacağı kategori ile üye/ses süresi gereksinimleri. Odalar bu kategorinin içine **tek bir ses kanalı** olarak açılır: ayrı yazı kanalı ve oda alt kategorisi yoktur, sohbet ses kanalının kendi sohbetidir. Kanal herkes tarafından görünür ama herkes yalnızca bakar — @everyone'a bağlanma ve yazma kapalıdır, odaya seçilen üyelere açık. Kategorinin @everyone görünürlüğü kapalıysa odalar kimseye görünmez; bot açılışta bunu logda uyarır ve eski kayıtları bir kez düzeltir. Başvuruda üye ID olarak yazılmaz: panelden sonra gelen üye seçme menüsünden seçilir, ardından yalnızca oda adı ve amacı sorulur. `activity` bloğu odayı açık tutan şartlardır: odadakilerin sesi her hafta ölçülüp odaya yazılır, haftalık hedefin altındaysa sahibine uyarı gider, ay başında geçen ayın kayıtlarına bakılır ve şartı karşılamayan oda "şart yetersizliği" ile kapatılır (`enabled: false` denetimi durdurur). Panel kanalı boşsa panel gönderilmez, başvuru kanalı boşsa başvuru alınmaz, duyuru kanalı boşsa oda olayı yalnızca loga işlenir.
- Panel tarzı temadan gelir: `themes.js` içinde `glass: true` olan temalar buzlu cam panel, ötekiler düz opak panel çizer. Cam temalarda saydamlığı üye kartın altındaki **Görünüm** sayfasından ayarlar (`custom.glassOpacity`, 0-100); düz temada düğmeler pasif durur.
- Profil kartının tüm verisi `src/systems/profil/view.js`'ten gelir: seviye, sıralama, coin, saygınlık, sicil, takviye, ziyaret, kozmetik ve hesap yaşı tek geçişte toplanır. Kart (`card.js`) yalnızca çizer, depodan veri çekmez; kapak önizlemesi de aynı katmanı kullanır. Yeni bir sistem veri ürettiğinde profile tek eklendiği yer burasıdır.
- Profil puanı, rütbeleri ve sunucu sırası `src/systems/profil/skor.js`'te durur: sekiz bölüm 1000 puanı toplar (aktiflik, görevler, saygınlık, rozetler, koleksiyon, giriş serisi, sosyal, sadakat), sekiz rütbe basamağı (`Misafir` → `Destan`) eşiklerle belirlenir. Kart, **Puanım** sayfası ve ilk 10 listesi aynı fonksiyondan okur; sunucu geneli tablo tek geçişte hesaplanır ve 5 dakika önbellekte kalır. Puana yeni bir kaynak eklemek sadece `PARTS` dizisine bir bölüm yazmaktır. Puan ceza/sicilden düşmez, yalnızca kazanılanları toplar.
- Görevler: `src/systems/gorev/config.js` — günlük ve haftalık görev havuzları (her gün/pazartesi tarihten çekilen üçer görev), günün demeti, Keşif Yolu'nun on iki adımı, kutunun anahtar maliyeti ile hazine ağırlıkları (`KUTU`) ve sezon eşikleri (`SEZON`). Ödül miktarları burada; görevlerin neyi saydığı `olcum.js`'teki eşleşmeyle belirlenir, ayrı bir ilerleme kaydı tutulmaz. Kutudan çıkan kozmetik doğrudan üyenin mağaza sahipliğine geçer.
- Kapak görseli varsayılan olarak **banner** gibi durur (`custom.bannerFit`): görsel kapağın tamamına yayılır, dik bir fotoğrafta hangi şeridin görüneceğini bot görselin kontrastından kendisi seçer; üyenin kaydırma düğmeleri bu kadrajın üstüne biner. İsteyen **Sığdır**'a alabilir — görselin tamamı görünür, kenarlardaki boşluk aynı görselin koyulaştırılmış hâliyle doldurulur ve kaydırma pasifleşir. Düzenleyicideki **Yerleşim** düğmesi ikisi arasında döner.
- Botun rolü, verdiği rollerin (otorol, seviye, takviye, VIP vb.) üstünde olmalıdır.
