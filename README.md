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

Butonla yapılabilen işler için komut yoktur. Komutlar şunlardır (hepsi `/yardim` menüsünde de görünür):

| Komut | Açıklama | Kimler |
| --- | --- | --- |
| `/yardim` | Komutları kategorilere göre gösterir | Herkes |
| `/sicil [kullanici]` | Üyenin sicilini gösterir | Herkes kendisininkini, yetkililer herkesinkini |
| `/seviye [kullanici]` | Mesaj ve ses seviyesini kartla gösterir | Herkes |
| `/profil [kullanici]` | Seviye, sıralama ve istatistiklerle profil kartı (altındaki butonlarla özelleştirilir) | Herkes |
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
| `/uyari`, `/mute`, `/unmute`, `/jail`, `/unjail`, `/ban`, `/unban` | Hızlı ceza komutları (sicile işlenir) | İlgili ceza yetkisi olanlar |
| `/ceza-kaldir`, `/ceza-sil` | Cezayı numarasıyla kaldırır ya da sicilden siler | Yetkisi olanlar |
| `/sil sayi` | Kanalda belirtilen sayıda mesajı siler | Mesajları Yönet yetkisi olanlar |
| `/cekilis baslat`, `bitir`, `yeniden-cek`, `iptal`, `liste` | Çekilişleri yönetir | Yöneticiler |
| `/log kur` | Log kurulum menüsünü açar | Yöneticiler |

Yetkili komutları sadece yetkili komut kanalında çalışır.

## Sistemler

Her sistem `src/systems` altında kendi klasöründe durur ve birbirine karışmaz:

| Grup | Sistemler |
| --- | --- |
| Destek ve yetkili | `destek` (talep alt başlıkları), `degerlendirme` (memnuniyet puanı ve itiraz), `basvuru` (yetkili alımı), `oryantasyon` (onaylanan başvuranın son aşaması), `yetki` (elle yetki verme) |
| Moderasyon | `sicil` (üye sicili ve hızlı ceza komutları), `cezalarim` (üyenin kendi cezaları ve itirazı), `temizle`, `yenihesap` (yeni hesap kısıtlaması), `log` (olay kayıtları) |
| Topluluk | `kurallar`, `bilgilendirme`, `otorol`, `etiket` (sunucu etiketi rolü), `partner` ve `partnergorme`, `yayin` (yayın yetkisi), `boost` ve `emoji` (takviye avantajları, emoji/çıkartma ekleme) |
| Seviye ve sıralama | `seviye` (mesaj ve ses XP'si, rol ödülleri), `profil`, `siralama`, `aktif` (haftanın aktifleri), `saygi`, `vip` |
| Ses ve sunucu | `ses` (botun ses kanalında durması), `ozel-oda`, `sesbilgi`, `cekilis`, `durum` (bot durumu), `yardim` |

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
- Botun rolü, verdiği rollerin (otorol, seviye, takviye, VIP vb.) üstünde olmalıdır.
