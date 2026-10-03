# Kazuki

**Kazuki**, sunucunun tüm sistemlerini tek bir çatı altında toplayan yönetim botu. Components V2 ile yazılmıştır, hiçbir mesajda embed kullanılmaz.
Bot tek bir sunucuda çalışır; kanal ve rol ID'leri koda sabit yazılır, hiçbir kurulum komutu kanal ya da rol sormaz.

## Kurulum

1. [Discord Developer Portal](https://discord.com/developers/applications) → uygulama → **Bot**:
   - **Reset Token** ile tokeni al.
   - **SERVER MEMBERS INTENT** ve **MESSAGE CONTENT INTENT** seçeneklerini aç.
2. Botu sunucuya ekle (`CLIENT_ID` yerine uygulamanın ID'sini yaz):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=8`
3. `.env` dosyasına tokeni ve sunucu ID'sini yaz:
   ```
   TOKEN=tokenin_buraya
   GUILD_ID=sunucu_id
   ```
4. Botu başlat:
   ```
   npm install
   npm start
   ```

Bot açılınca komutları sunucuya yükler, **destek** ve **yetkili alım** panellerini ayarlı kanallara kendisi gönderir.
Panel metni ya da görseli değişmediyse panele dokunulmaz; değiştiyse eski panel silinip yenisi gönderilir.

## Komutlar

Butonla yapılabilen işler için komut yoktur. Sadece şunlar kalmıştır:

| Komut | Açıklama | Kimler |
| --- | --- | --- |
| `/destek ekle kullanici` | Bulunduğun destek talebine kullanıcı ekler | Yetkililer |
| `/destek cikar kullanici` | Bulunduğun destek talebinden kullanıcı çıkarır | Yetkililer |
| `/yetki-ver kullanici` | Panelden seviye ve yetki seçerek elle yetki verir | Yöneticiler |
| `/sicil [kullanici]` | Sicili gösterir | Herkes kendi sicilini, yetkililer herkesinkini |
| `/yardim` | Botun komutlarını kategorilere ayrılmış bir menüde gösterir | Herkes |

## Dosya Düzeni

Her sistem `src/systems` altında kendi klasöründe, birbirine karışmadan durur:

```
src/
  index.js               Botun girişi: sistemleri yükler, etkileşimleri ilgili sisteme yönlendirir
  core/                  Tüm sistemlerin ortak parçaları
    config.js              Bot adı, sunucu ID'si, renkler
    db.js                  Veri dosyası (data/db.json)
    helpers.js             Ortak etkileşim ve yetki yardımcıları
    panel.js               Panellerin açılışta otomatik gönderilmesi
    ui.js                  Ortak mesaj parçaları
    logger.js              Konsol çıktısını bot.log dosyasına da yazar
  systems/
    destek/              Destek talepleri (ticket)
    degerlendirme/       Yetkili değerlendirme (memnuniyet)
    basvuru/             Yetkili alımı
    yetki/               Elle yetki verme
    otorol/              Sunucuya katılana otomatik rol
    sicil/               Üye sicili
    ses/                 Botun ses kanalında durması
    durum/               Botun durumu (İzliyor: sunucu adı · Seste 12 kişi)
    yardim/              Yardım menüsü
```

Her sistem klasöründe:
- `config.js`: o sistemin kanal ve rol ID'leri, metinleri
- `index.js`: komutları ve butonlara/formlara ne olacağı
- `ui.js`: gönderdiği mesajlar
- `store.js`: kayıtları (`data/db.json` içinde)

## Destek Sistemi

İki kanal kullanır (`src/systems/destek/config.js`):
- **#destek-talebi:** panel burada, talepler bu kanalın altında özel alt başlık olarak açılır
- **#destek-talepleri:** yetkililere giden yeni talep ve hatırlatma mesajları

1. Kullanıcı panelde **Talep Oluştur**'a basar, açılan formda sorununu yazar.
2. #destek-talebi kanalının altında `konu-kullaniciadi-0007` adında **özel alt başlık** açılır. Ayrı kanal açılmaz.
   Alt başlığı başta sadece talep sahibi görür, üyeye "yetkili bekleniyor" mesajı gösterilir.
3. #destek-talepleri kanalına yetkili rolü etiketlenerek **Talebi Üstlen** butonlu bir mesaj gider.
   Butona ilk basan yetkili talebi alır ve alt başlığa eklenir. Kimse kendi açtığı talebi üstlenemez.
4. Yetkili bağlanana kadar üye **Hatırlat** butonuyla talep kanalına bir kez hatırlatma gönderebilir.
5. **Talebi Kapat** → sebep formu ("Sorun çözüldü mü?" + isteğe bağlı not) → talep sahibine DM'den kısa bir
   "talebin kapatıldı" bilgisi ve yetkiliyi değerlendirme butonları gider.
   Alt başlık silinmez: yönetici olmayan herkes çıkarılır, alt başlık kilitlenip arşivlenir.
   Kapanan talepleri sadece "Alt Başlıkları Yönet" yetkisi olanlar **Alt Başlıklar** listesinden görebilir.

Her kullanıcının aynı anda sadece bir açık talebi olabilir.
İstenirse `config.js` içindeki `channels.log` ayarlanarak açılış/kapanış logları ve konuşma kaydı (.txt) bir kanala gönderilebilir (şu an kapalı).

## Yetkili Değerlendirme (Memnuniyet)

1. Talep kapanınca üyeye giden DM'de 1-5 arası puan butonları olur. Talebi üstlenen yetkili değerlendirilir;
   kimse üstlenmediyse talebi kapatan yetkili değerlendirilir. Üye kendi talebini üstlenemez.
2. Üye puana basar, açılan formda isteğe bağlı yorum yazar. Değerlendirme yetkilinin siciline işlenir.
3. Değerlendirme kanalına puan, yorum, yetkili ve değerlendiren kişiyle bir mesaj gider.
4. Değerlendirilen yetkili, haksız bulduğu değerlendirmeye o mesajdaki **İtiraz Et** butonuyla,
   sebebini yazarak şikayet kanalından itiraz edebilir. Her değerlendirmeye bir kez itiraz edilebilir.
5. Şikayet mesajında lider rolü etiketlenir. Liderler (ve yöneticiler):
   - **Onayla:** değerlendirme yetkilinin sicilinden kaldırılır, değerlendirme mesajı "Değerlendirme Kaldırıldı" haline gelir
   - **Reddet:** değerlendirme puanda kalır
   - **Görüşmeye Çağır:** itiraz eden yetkiliye DM'den görüşme çağrısı gider

   Sonuç itiraz eden yetkiliye DM ile iletilir ve değerlendirme mesajındaki butonda görünür.

## Yetkili Alımı

1. Yetkili alım kanalındaki panelde **Başvur**'a basılır, form doldurulur (sorular `src/systems/basvuru/config.js` içinde).
2. Başvuru, başvurular kanalına inceleyen rol etiketlenerek düşer: başvuranın bilgileri, önceki başvuruları ve cevapları.
3. İnceleyen rol (ve yöneticiler):
   - **Onayla:** isteğe bağlı not yazılır, ayarlandıysa rol otomatik verilir, görüşme ses kanallarının kilidi açılır
   - **Reddet:** sebep yazılır, açık olan ses kanalı erişimi kapatılır
   - **Görüşmeye Çağır:** görüşme ses kanallarının kilidi açılır, başvurana DM'den görüşme çağrısı gider
4. Sonuç (not ya da sebeple) başvurana DM ile gider, başvuru sicile işlenir.

### Görüşme Ses Kanalları

Yetkili Alım 1, 2 ve 3 ses kanalları normalde herkese kapalıdır (`src/systems/basvuru/config.js` içindeki `voiceChannels`).
Başvuran görüşmeye çağrılınca ya da onaylanınca kanalların kilidi sadece ona açılır. DM'de:
- Butona basan yetkili bu kanallardan birindeyse: "**@yetkili mülakat için seni şu an #kanal kanalında bekliyor!**" + **Kanala Katıl** butonu
- Değilse: "**Mülakat için aşağıdaki ses kanallarından birine katılabilirsin.**" + üç kanalın butonu

Erişim 24 saat sonra (`voiceAccessHours`) kendiliğinden kapanır; başvuru reddedilirse hemen kapanır.

Bekleyen başvurusu olan tekrar başvuramaz; reddedilen kişi `reapplyCooldownDays` gün sonra tekrar başvurabilir.

## Oto Rol

Sunucuya katılan herkese **Üye** rolü otomatik verilir (`src/systems/otorol/config.js`, botlara verilmez).
Botun rolü verilecek rolün üstünde olmalı.

## Ses Kanalı

Bot, `src/systems/ses/config.js` içindeki ses kanalında mikrofonu ve kulaklığı kapalı şekilde sürekli durur.
Kanaldan atılırsa, taşınırsa ya da bağlantısı koparsa birkaç saniye içinde kendiliğinden geri döner.

## Bot Durumu

Bot, Discord'un **İzliyor** durumunu kullanır (`src/systems/durum/config.js` içinden Oynuyor / Dinliyor yapılabilir).
Başta sunucunun adı yazar, 30 saniyede bir güncellenir:
1. Seste biri varsa: **❄️ Kazuki ‵ Anime & Public・Seste 12 kişi** (botlar sayılmaz)
2. Seste kimse yoksa: **❄️ Kazuki ‵ Anime & Public・18 aktif üye**
3. Aktif üye sayısı alınamazsa `phrases` listesindeki yazılar sırayla gösterilir

## Sicil

`/sicil` her üyenin sicilini bölüm bölüm, sayfa sayfa gösterir:
- **Genel:** hesap/katılma tarihi, açtığı talep ve başvuru sayısı; yetkililerde üstlendiği talep sayısı ve ortalama puanı
- **Destek Talepleri:** açtığı talepler, durumları ve üstlenen yetkili
- **Başvurular:** yetkili başvuruları ve sonuçları
- **Değerlendirmeler:** yetkililerin aldığı puanlar ve yorumlar (sadece yetkililerde ve değerlendirme almış kişilerde)

## Özelleştirme

- Bot adı ve renkler: `src/core/config.js`
- Kanal, rol ID'leri ve panel metinleri: ilgili sistemin `config.js` dosyası
- Panel görseli: `assets/banner.png` (dosyayı değiştirip botu yeniden başlatınca paneller yenilenir)
- Kapatma sebepleri: `src/systems/destek/config.js` içindeki `closeReasons`
- Talepler, talep geçmişi, değerlendirmeler, başvurular ve sayaçlar `data/db.json` dosyasında tutulur.
