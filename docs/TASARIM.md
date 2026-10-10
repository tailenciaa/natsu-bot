# Kazuki: tasarım dili ve kurallar

Kazuki, tek sunucuda çalışan, Türkçe, discord.js 14.27 ile yazılmış, **yalnızca Components V2** kullanan bir yönetim botudur.
Bu belge, botta görünen her şeyin (mesaj, panel, menü, form, DM, log, komut açıklaması) nasıl yazılıp düzenleneceğini anlatır.
Yeni bir mesaj eklerken ya da var olanı değiştirirken buna uyulur; hedef: her yerde aynı düzen, göz kirletmeyen, mobilde de güzel görünen bir bot.

## 1. Dokunulmazlar

Görünüm serbestçe değişir, şunlar değişmez (bozulursa saklanmış mesajlar ve işleyiciler çalışmaz):

- `customId` dizgeleri, önekleri ve `:` ile ayrılmış alan sırası (ör. `destek:olustur`, `sicil:<kullanıcı>:<bölüm>:<sayfa>:<yer>`).
  Yeni `customId` eklemek serbest, var olanı değiştirmek yasak.
- Veri şemaları (`data` alan adları), `store.js` mantığı, zamanlayıcılar, süreler, eşikler, XP değerleri, izin ve rol kontrolleri.
- Kanal ve rol ID'leri (her sistemin `config.js` dosyasında sabit), `syncPanel` anahtarları ve panel `buttonId`'leri.
- Slash komut, alt komut ve seçenek adları (açıklamaları serbestçe düzeltilebilir).
- `core/ui.js` içindeki `tidy` otomatik düzenleyicisi: ayırıcı çizgileri kendisi ekler, bu yüzden kodda ayrıca çizgi eklenmez.

## 2. Kalıcı tercihler

1. **Embed yok**, hep Components V2 (container, text display, section, separator, media gallery, file).
2. **Önemli cümle ve anahtar sözcükler kalın, açıklamalar normal boyutta.** Küçük gri yazı (`-#`) okunaksız olduğu için yalnızca başlığın hemen altındaki açıklamada, zaman damgasında, sayfa bilgisinde ve sıralama listesinin 4. sıradan sonraki satırlarında kullanılır; `tools/preview/check.js` başka her kullanımı hata sayar. Birbiriyle ilgisiz iki bilgi arasına çizgi, ilişkili olanlar aynı blokta.
3. **Derli toplu**: aynı bilgi iki kez yazılmaz, her yerde aynı kalıp (hata, onay, panel, log).
4. **Emoji yok** (buton, menü, etiket, metin). Tek istisna puan yıldızı ⭐; botun durum yazısındaki `❄️` kullanıcının kendi seçimidir.
   `◀ ▶` gibi emojiye dönüşen ok simgeleri de yok, sayfa butonları `«` `»`.
5. **Mobilde de güzel**: kısa tek satır başlık, boşlukla ortalama yok, geniş tablo yok. Panel butonu başlığın yanında (section aksesuarı), sekmeler buton olarak kalır.
6. Metin ile yerleşim tutarlı: yön sözcüğü ("aşağıdaki", "sağdaki") yerine butonun adı yazılır ("**Hatırlat** butonuyla...").
7. **Test, önizleme ve log mesajları kimseyi etiketlemez** (`allowedMentions: { parse: [] }`).
8. Bilgi komutları (yardım, seviye, profil, sıralama, sicil, saygı ve VIP listesi) herkese açık; hata ve kişisel sonuçlar sadece kullanana görünür.
9. Komut listesi minimal: butonla yapılabilen işin slash komutu yoktur. Kanal ve rol ID'leri koda sabit, hiçbir akış "şu kanala mı gitsin?" diye sormaz.
10. Seviye atlama duyurusu (görsel kart), profil ve seviye kartları, bot durum yazısı, kurallar ve bilgilendirme içerik metinleri onaylı tasarımlardır; yalnızca açık hata ve yazım düzeltmesi yapılır.

## 3. Mesaj anatomisi

Ortak yardımcılar `src/core/ui.js` içindedir (`page`, `alert`, `notice`, `panel`, `fields`, `hint`, `block`, `pageInfo`, `stamp`, `pagerRow`, `tabRow`...) ve `src/core/helpers.js` içindeki `respond`, `replyError`, `isStaff`, `isMenuOwner` ile birlikte kullanılır.

### Panel (kalıcı, bot açılınca kanala gönderilir)

```
[Container]
  Section: "## Başlık\n-# kısa açıklama"      [Buton (sağda)]
  (varsa) görsel
  ---
  alt not (normal yazı)
```

Başlık en çok 28, buton etiketi en çok 20 karakter. Paneller `core/panel.js` içindeki `syncPanel` ile gönderilir.

### Sayfa / bilgi kartı: `page({ title, sub, thumbnail, blocks, accent })`

```
## Başlık                                  [küçük görsel]
-# sub: mesajın ne olduğunu anlatan 140-220 karakterlik gerçek bir cümle
---
**Blok başlığı** ya da **Ana cümle.**
değer satırları
açıklama satırı (normal yazı)
---
[Butonlar]
---
-# <t:unix:F>          (sadece vaka mesajlarında: talep, başvuru, ceza, çekiliş)
```

- `sub` bilerek iki satırı dolduracak uzunluktadır: bütün mesajlar aynı genişlikte görünsün diye. Kısa tutulmaz, doldurma da yapılmaz; bloklardaki bilgiyi tekrar etmeyen gerçek bir açıklama yazılır.
- Her blok kalın bir başlık ya da ana cümleyle başlar, ardından düz değer satırları, en sonda normal yazıyla açıklama gelir; önemli sözcükler kalın yazılır. Bir blok en fazla yaklaşık 8 satırdır.
- Serbest metin (konu, sebep, yorum) `quote()` ile alıntı bloğunda, etiket-değer satırları `**Etiket:** değer` biçimindedir.

### Bildirim: `alert(mesaj, ipucu, renk)` / `notice(bölümler, renk)`

Kısa hata, onay ve uyarı. Biçim `**Ana cümle.**` + isteğe bağlı normal yazıyla ikinci satır. Hata cümlesi "ne oldu + ne yapmalı" sırasındadır.
Renk durumu söyler: yeşil tamamlandı/onaylandı, sarı bekliyor, kırmızı hata/kapandı/reddedildi, renksiz nötr bilgi.

### Menü ve sekmeli görünümler (yardım, sicil, sıralama)

`başlık → sekme butonları → içerik → sayfa bilgisi → « »`. Aktif sekme yeşil (Success), diğerleri gri; sayfa bilgisi tek satır (`Sayfa 2 / 5 · 48 kayıt`); tek sayfalık listede sayfa butonu gösterilmez.

Sekme değişimi ve aynı sayfadaki her düğme **yazıldığı mesajı günceller** (`interaction.update`), yeni mesaj atmaz; mesajda bir görsel varsa `attachments: []` ile temizlenir. Yeni mesaj yalnızca ilk açılışta ve modal gönderiminde (modal, eski mesajı güncelleyemez) atılır.

### Form, DM ve log

- **Form:** başlık en çok 45 karakter ve eylem odaklı ("Talebi Kapat"), alan açıklaması tek cümle, yer tutucu "Örn: ..." biçiminde. Boş değer ve boş yer tutucu Discord'a gönderilmez.
- **DM:** aynı `page` düzeni, kısa; sunucu adı bir kez geçer, ham ID ya da teknik ifade yok.
- **Log:** başlık olay adıdır, `**Etiket:** değer` blokları, değişiklikler `eski → yeni`; log mesajları hiç etiket atmaz.

### Butonlar

- Etiket en çok 20 karakter, Başlık Düzeni, emoji ve ok yok; eylem fiili ("Onayla", "Talebi Üstlen").
- Stil: Primary ana eylem, Success onayla/devam/aktif sekme, Danger kapat/reddet/sil, Secondary nötr, Link bağlantı.
- Kullanılmış butonun etiketi geçmiş zamana döner ve pasifleşir ("Üstlenildi").
- Bir satırda en çok 5 buton, işlem satırlarında tercihen 3; menü tek başına bir satırdır.

### Çizili kartlar (profil ve kapak önizlemesi)

- Kart node-canvas ile çizilir (embed/CV2 değil): 1000 px genişlik, kapak 300 px, gövde tema renginin karanlığında. Discord kartı sohbette ~440 px'e küçülttüğü için tüm yazı ölçeği bol tutulur (ad 44 px, biyografi 23 px, kutu başlığı 18 px).
- Panel tarzı **temaya bağlıdır**, her kart cam değildir: `themes.js`'te `glass: true` olan temalar buzlu cam panel (yumuşak dolgu + üst parlama + ince kenar), olmayanlar düz opak panel çizer. Saydamlık cam temalarda üyenin kendisinindir (`custom.glassOpacity`, 0-100, 10'luk adımlar; 0 belirgin panel, 100 neredeyse görünmez panel). Saydamlığın fark edilebilmesi için kapağın rengi gövdeye ışımayla sızar (`paintAmbient`); düz paneller bu ışımayı kapattığı için cam/düz ayrımı belli olur.
- Kapağın üstüne yalnızca kendi hapları (sıra ve coin) biner; kapak karartması en üst 130 px'te %30'dur, böylece üye görseli seçtiği tema/arka plan efektini gerçekten görür. Kapak çizimi `HEADER` yüksekliğine kırpılır, gövdeye taşmaz.
- Rozet şeridi en çok iki satır; sığmayanlar tek bir "**+N**" hapsine dönüşür. Coin ile alınan sergi rozetleri başa yazılır (ücretli olan, kazanılanların arasında kaybolmaz).
- Kapak düzenleyicide görsel %100-300 yakınlaştırılır ve kaydırma yalnızca taşan alan kadar yapılır (-1..1); görselin arkasında boşluk oluşamaz. Hareket düğmeleri her zaman durur, görsel yokken pasifleşir. Görünüm sayfasındaki saydamlık düğmeleri de aynı kuralı izler: cam olmayan temada kaybolmaz, pasifleşir.
- Arka plan efektleri (`kapak.js`) temaların kendi efektiyle aynı boyacıları kullanır; tema ve arka plan tek yerde çizilir.

## 4. Teknik sınırlar

- Bir mesajda en çok 40 bileşen (iç içe olanlar dahil) ve toplam 4000 karakter metin. Aşılırsa `tidy` düzenlemeyi bırakır; liste uzunlukları buna göre sınırlanır (ör. sicilde sayfa başına 6 kayıt).
- Etiket/seçenek sınırları: buton etiketi 80, `customId` 100, menüde 25 seçenek, modal başlığı 45, modal alan etiketi 45, modal alan açıklaması 100.
- Etkileşime 3 saniye içinde cevap verilir (ağır işten önce `deferReply` / `deferUpdate`); modal açan butonlarda modaldan önce yavaş iş yapılmaz. Cevap yolları `respond` ile açılır.
- Her `allowedMentions` bilinçlidir: yalnızca gerçekten bildirim gitmesi gerekenler etiketlenir (yeni talepte yetkili rolü, ana seviyede üye, çekiliş kazananı).

## 5. Dil

- Üyeye ve yetkiliye "sen"; "siz" yok. Ünlem en çok bir tane ve sadece kutlamada. Başlıklar noktasız, cümleler noktayla biter.
- İngilizce kelime yok ("ticket" yerine "talep"); tutarlı terimler: Talep, Yetkili, Üye, Başvuru, Mülakat, Değerlendirme, İtiraz, Ceza, Sicil, Takviye, Özel Oda, Çekiliş, Partner.
- Süre birimleri "gün", "saat", "dakika" (dar listelerde "dk"). Boş durum tek kalın cümledir ("**Henüz kayıt yok.**").

## 6. Cevap politikası

| Durum | Görünürlük |
| --- | --- |
| Hata, izin reddi, doğrulama uyarısı | Sadece kullanana |
| Kişisel işlem sonucu, yetkili işlem panelleri | Sadece kullanana |
| Bilgi komutları (yardım, seviye, profil, sıralama, sicil) | Herkese açık, gezinme sadece komutu kullanana (`isMenuOwner`) |
| Paneller, duyurular, loglar, talep mesajları | Kanalda herkese görünür |
| Test ve önizleme | Sadece kullanana, etiket yok |

## 7. Komut politikası

- Her komutun ve seçeneğin açıklaması tek cümle, fiille başlayan, noktayla biten ve en çok 100 karakterdir.
- Yardım menüsü (`help.access`) komut listesiyle birebir eşleşir; erişim metni sade yazılır ("Herkes", "Yetkililer", "Yöneticiler").

## 8. Doğrulama (Discord'a bağlanmadan)

```
node tools/preview/check.js [sistem]    # lint, handler kapsamı, komut denetimi
node tools/preview/build.js [sistem]    # tools/preview/out/index.html ve <sistem>.txt (tarayıcıda aç)
node -e "process.env.GUILD_ID='1'; require('./src/systems')"   # bot yükleniyor mu
```

Yeni mesaj eklerken `tools/preview/cases/<sistem>.js` içine bir case eklenir; `check.js` her butonun, menünün ve formun bir işleyiciye bağlı olduğunu da doğrular.

## 9. Her mesaj için kontrol listesi

1. Embed, emoji ya da ok simgesi var mı (⭐ hariç)?
2. Ana cümle ve anahtar sözcükler kalın, açıklama normal boyutta (`-#` yalnızca izin verilen yerlerde), ilgisiz bloklar çizgiyle ayrılmış mı?
3. Aynı bilgi mesajda iki kez geçiyor mu? Takip mesajı öncekini tekrar ediyor mu?
4. Başlık kısa ve tek satır mı? Buton en çok 20 karakter ve Başlık Düzeni mi?
5. Yön sözcüğü gerçekten doğru mu, buton adı metinde doğru yazılmış mı?
6. Boş durum, uzun metin, 40 bileşen / 4000 karakter ve 25 seçenek sınırı düşünülmüş mü?
7. Etiket yalnızca gerekenleri mi çağırıyor?
8. Türkçe: yazım, ek uyumu, tutarlı terim, ünlem sayısı.
9. Her etkileşimli bileşen bir işleyiciye bağlı mı (`check.js` doğrular)?
