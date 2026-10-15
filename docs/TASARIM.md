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
- `core/ui.js` içindeki `tidy` otomatik düzenleyicisi: ayırıcı çizgileri kendisi ekler, bu yüzden kodda ayrıca çizgi eklenmez. `tidy` yalnızca buton/menü satırlarının **üstüne** çizgi koyar; bir menü satırının hemen altına gelen başlık ya da metin bloğu varsa o çizgi arayüz kodunda elle eklenir (bkz. `kalici-oda/ui.js` `memberMenus`). Ard arda gelen iki kontrol satırı arasına çizgi konmaz — bu buton ızgaraları için istenen davranıştır; birbiryle ilgisi olmayan bir kontrol grubu çizgi istiyorsa kendi `###` başlığını ve elle çizgisini alır (bkz. `kalici-oda/ui.js` `roomPanel` içindeki `### Oda Ayarı`).

## 2. Kalıcı tercihler

1. **Embed yok**, hep Components V2 (container, text display, section, separator, media gallery, file).
2. **Önemli cümle ve anahtar sözcükler kalın, açıklamalar normal boyutta.** Küçük gri yazı (`-#`) okunaksız olduğu için yalnızca başlığın hemen altındaki açıklamada, zaman damgasında, sayfa bilgisinde ve sıralama listesinin 4. sıradan sonraki satırlarında kullanılır; `tools/preview/check.js` başka her kullanımı hata sayar. Birbiriyle ilgisiz iki bilgi arasına çizgi, ilişkili olanlar aynı blokta.
3. **Derli toplu**: aynı bilgi iki kez yazılmaz, her yerde aynı kalıp (hata, onay, panel, log).
4. **Emoji yok** (buton, menü, etiket, metin). Tek istisna puan yıldızı ⭐; botun durum yazısındaki `❄️` kullanıcının kendi seçimidir.
   `◀ ▶` gibi emojiye dönüşen ok simgeleri de yok, sayfa butonları `«` `»`.
5. **Mobilde de güzel**: kısa tek satır başlık, boşlukla ortalama yok, geniş tablo yok. Panel butonu başlığın yanında (section aksesuarı), sekmeler buton olarak kalır.
6. Metin ile yerleşim tutarlı: yön sözcüğü ("aşağıdaki", "sağdaki") yerine butonun adı yazılır ("**Hatırlat** butonuyla...").
7. **Test, önizleme ve log mesajları kimseyi etiketlemez** (`allowedMentions: { parse: [] }`).
8. Bilgi komutları (yardım, seviye, profil, sıralama ve saygınlık listesi) ve komutla açılan sayfalar herkese açık ve kalıcıdır; hata ile kalıcı panel buton/menü cevapları sadece kullanana görünür (§6).
9. Komut listesi minimal: butonla yapılabilen işin slash komutu yoktur. Kanal ve rol ID'leri koda sabit, hiçbir akış "şu kanala mı gitsin?" diye sormaz.
10. Seviye atlama duyurusu (görsel kart), profil ve seviye kartları, bot durum yazısı, kurallar ve bilgilendirme içerik metinleri onaylı tasarımlardır; yalnızca açık hata ve yazım düzeltmesi yapılır. Tek istisna: bilgilendirmedeki **Botumuz Kazuki** bloğu botun kendi üstlenimini anlatır, yeni bir sistem eklendiğinde oradaki komut listesi de güncellenir.
11. **Coin harcamak para basmaz.** Alımlar `coinStore.spend` ile düşülür ve `recordPurchase` ile üyenin sipariş defterine yazılır; `earned` asla büyümez. Ödeme sırası teslimata göre kurulur: rol gibi dışarıda gerçekleşen bir teslimatta **önce rol verilir**, verilemezse para hiç alınmaz (para düşürülemezse verilen rol geri alınır); elde biriken tükenen üründe ise kazanım yerelde olduğu için önce para düşer. Kanala düşen alım kartı üyenin **bakiyesini yazmaz** — elde duran hak/yüzük adedi ve satın alınan rol yeter.
12. **Bot rol yaratmaz.** Sunucuda hazır bulunması gereken bir ödül (butik rengi, görev rolü, oda sahibi) sistemin `config.js` dosyasına ID olarak yazılır; `null` bırakılmışsa özellik kapalıdır ve rafı hiç çizilmez, kural metni rafın kapalı olduğunu üyeye söyler. Üye sunucudan düşüp dönerse satın aldığı roller `GuildMemberAdd` ile geri verilir — sayfa açılışında senkron yapılmaz, üç saniyelik etkileşim süresine sığmaz.
13. **Evlilik para basmaz; tek coin üretimi yıl dönümü ödülüdür.** Yüzük butiğin tükenen ürünüdür ve **yalnızca kabul anında** yanar: ret, vazgeçme ve sürenin dolması yüzük kaybettirmez, çünkü cevap vermemiş olan üye cezalandırılmaz. Boşanma bedeli `coinStore.spend` + `hirsizlik.kasaEkle` ile Devletin Kasasına yazılır, yani kazancı büyütmeyen gerçek bir transferdir. Yıl dönümü ödülü çiftin **ikisine de** ayrı ayrı verilir ve tek seferlik sayılır. Evli rolü (`roles.evli`) boşsa evlilik yine kayıt edilir; rol görünür bir ekcedir, bağın kendisi değil.
14. **Şans katmanı günde `coin/config.js winCap` kadar coin basar, masalar hiç basmaz.** Keşif ganimeti, şakalaşma karşılığı ve kasa soygunu tek sayaça (`coinStore.addWin`) yazılır; tavan dolduysa ödeme kırpılır, üye boşuna oynamış olur. Rulet ve Merdiven coin üretmez, üyenin kendi bakiyesi el değiştirir ve masanın uzun vadeli payı %5–7'dir (rulet beklentisi 0,933; Merdivende çarpan × hayatta kalma ≈ 0,94) — sayılar `oyun/config.js` başında tek tek gerekçelidir. Suç dünyası da ÜRETMEZ, parayı taşır: üye soymak transferdir, kasa yalnızca ceza ve kefalet gelirleriyle dolar, kasadan çıkan tek ödeme müdahale ikramiyesidir. Tavana arka kapı bırakmamak için kasa soygunu da winCap'e sayılır.

## 3. Mesaj anatomisi

Ortak yardımcılar `src/core/ui.js` içindedir (`page`, `receipt`, `alert`, `notice`, `panel`, `fields`, `rows`, `field`, `chip`, `pills`, `hint`, `block`, `pageInfo`, `stamp`, `pagerRow`, `tabRow`...) ve `src/core/helpers.js` içindeki `respond`, `replyError`, `isStaff`, `isMenuOwner` ile birlikte kullanılır.

### Panel (kalıcı, bot açılınca kanala gönderilir)

```
[Container]
  Section: "## Başlık\n-# kısa açıklama"      [Buton (sağda)]
  (varsa) görsel
  ---
  alt not (normal yazı)
```

Başlık en çok 28, buton etiketi en çok 20 karakter. Paneller `core/panel.js` içindeki `syncPanel` ile gönderilir.

Bölüm başına bir mesaj gönderen tek çok mesajlı panel `src/systems/bilgilendirme`dir: `config.panels` listesindeki her panelin kendi `key`, `channel`, `title`, `intro` ve `sections`ı vardır, mesaj ID'leri `data.panels[key]` altında tutulur. Yeni bir bilgi kanalı açılırken ayrı sistem yazılmaz, listeye yeni bir panel eklenir; ekonomi rehberi bu şekilde ikinci panel olarak durur.

### Sayfa / bilgi kartı: `page({ title, sub, thumbnail, blocks, accent })`

```
## Başlık                                  [küçük görsel]
-# sub: mesajın ne olduğunu anlatan 140-220 karakterlik gerçek bir cümle
---
### Bölüm Başlığı
**Etiket:** değer satırları
açıklama satırı (normal yazı)
---
[Butonlar]
---
-# <t:unix:F>          (sadece vaka mesajlarında: talep, başvuru, ceza, çekiliş)
```

- **Başlık hiyerarşisi üç kademedir:** `##` mesajın kendi başlığı, `###` mesajın içindeki bölümler, `**kalın**` satır içi etiketler. Kart içindeki her bağımsız bölüm `### Bölüm Başlığı` ile başlar (en çok 28 karakter, Başlık Düzeni, noktasız; soru işareti olur). Böylece bölüm başlıkları satır içi kalın `**Etiket:**` etiketlerinden ve mesaj başlığından görsel olarak ayrılır, kartın hiyerarşisi tek bakışta okunur. Menülerin hemen üstündeki açıklama da aynı biçimdedir: `### Üye Ekle` başlığı, altında normal yazıyla tek cümlelik açıklama; o cümle büyük harfle başlar ve nokta ile biter. Bir menü satırının altına yeni bir başlık geliyorsa çizgi elle eklenir (`tidy` yalnızca menülerin üstüne çizgi koyar, altındakini koymaz). Yalnızca kartın ana başlığını taşıyan bloklar (tek cümlelik özetler, teşekkür ve uyarı cümleleri) kalın ana cümleyle başlayabilir. Bir **listeleme öğesinin kendi adı** (ceza satırı, mağaza ürünü, sıra özeti) ve yanında buton taşıyan satırın başlığı kalın kalır; bunlar bölüm başlığı değildir.

- `sub` bilerek iki satırı dolduracak uzunluktadır: bütün mesajlar aynı genişlikte görünsün diye. Kısa tutulmaz, doldurma da yapılmaz; bloklardaki bilgiyi tekrar etmeyen gerçek bir açıklama yazılır.
- Her blok `### Bölüm Başlığı` ya da kalın ana cümleyle başlar, ardından düz değer satırları, en sonda normal yazıyla açıklama gelir; önemli sözcükler kalın yazılır. Bir blok en fazla yaklaşık 8 satırdır.
- Serbest metin (konu, sebep, yorum) `quote()` ile alıntı bloğunda, etiket-değer satırları `**Etiket:** değer` biçimindedir.
- **Rol etiketi çoklu listede kullanılmaz:** uzun bir ayrıcalık listesinde her satırı renkli rol etiketiyle (`<@&...>`) başlatmak tek bakışta okunmayan bir renk duvarı oluşturur. Rolün adı üye listesinde zaten görünür; listenin kendi satırında gereken değer `chip` olarak yazılır (`5` · açıklama) ve rolün adlandırması bölümün açıklama cümlesinde bir kez söylenir (ör. `sesbilgi/ui.js` ses rolleri). Tekil atıflarda (ödül alan üye, rol veren işlem) rol etiketi yine doğru seçimdir.

### Etiket-değer satırları: `rows`, `chip`, `pills`

```
**Başvuru:** `#0012`                      → kısa ve taranacak değer kod rozetinde
**Durum:** `Yetkili Bekliyor` · <t:...:R>  → rozet + yanında normal yazı
**Kilit:** `Açık` · **Görünürlük:** `Gizli` → aynı satırda birden çok durum: pills
```

- `rows([['Etiket', değer], ...])`, `fields`/`field` ile aynı çıktıyı verir; farkı çiftleri koşulla beslemeye izin vermesidir (`app.onHold && ['Beklemeye Alan', <@...>]`). Kartlardaki bilgi satırlarında `fields` yerine bu kullanılır.
- `chip(değer)`: numara, süre, sayı, durum ve seçim gibi **kısa** değerler rozette durur (`#0012`, `3 gün`, `Müsait`, `12/25`, `5/8`). Cümleler, üye/kanal etiketleri (`<@id>`, `<#id>`) ve rol listeleri rozete girmez; düz yazı kalır.
- `pills([['Etiket', değer], ...])`: aynı satırda duran birkaç durum tek satırda `Etiket: değer` kapsülleri olarak yazılır.
- Boş değer rozette küçük harfle verilir (`yok`, `sınırsız`, `bilinmiyor`); durum etiketleri Başlık Düzeni'ndedir (`Yetkili Bekliyor`, `Ekibe Katıldı`).
- Kart başlığı bloğu zaten anlatıyorsa (**Talep Bilgileri** gibi) blok başlığı yinelenmez; başlığın ayrı bir grup bilgisi topladığı kartlarda (sicil detayı, itiraz kartı) başlık yerinde kalır.

### İşlem kartı: `receipt({ title, sub, pairs, note, user, accent, at })`

Bir üyenin tamamladığı işlemin (ödül, harcama, saygınlık verme, kart ayarı, başvuru) bildirimi. `page`in tek amaçlı
küçüğüdür: başlık, altında tek cümlelik özet, çizgiyle ayrılmış `rows` satırları, en altta zaman damgası; butonu yoktur.

```
## Günlük Ödül Toplandı                     [üyenin avatarı]
<@üye> **/gunluk** ile günlük ödülünü topladı. ...
---
**Kazanç:** `127 coin`
**Seri:** `5. gün`
**Yeni Bakiye:** `167 coin`
---
-# <t:unix:F>
```

- `user` verilirse başlığın sağında üyenin avatarı durur.
- **Görünürlük:** kazanç ve harcama kartları **herkese açık** gönderilir (`respond(..., { ephemeral: false })`, `<@üye>`
  `allowedMentions.users` içinde tutulur) ki üye kazandığını göstersin; kalıcı bir panelin butonundan çıkan cevaplar,
  kart ayarı ve hata/ret uyarıları **sadece kullanana** kalır (tam liste §6'da). Hata ve reddetmeler `alert` olarak
  kişiye özel kalır, kart haline getirilmez.
- Herkese açık kart 3. tekil şahısla yazılır (`<@üye> ... topladı`), kişiye özel kart üyeye hitap eder (`... topladın`)
  ve @etiket içermez.
- Sayılar `chip` içinde durur; başlık cümlesinde geçen ürün adı satırlarda yinelenmez.

### Bildirim: `alert(mesaj, ipucu, renk)` / `notice(bölümler, renk)`

Kısa hata, onay ve uyarı. Biçim `**Ana cümle.**` + isteğe bağlı normal yazıyla ikinci satır. Hata cümlesi "ne oldu + ne yapmalı" sırasındadır.
Renk durumu söyler: yeşil tamamlandı/onaylandı, sarı bekliyor, kırmızı hata/kapandı/reddedildi, renksiz nötr bilgi.

### Menü ve sekmeli görünümler (yardım, sicil, sıralama)

`başlık → sekme butonları → içerik → sayfa bilgisi → « »`. Aktif sekme yeşil (Success), diğerleri gri; sayfa bilgisi tek satır (`Sayfa 2 / 5 · 48 kayıt`); tek sayfalık listede sayfa butonu gösterilmez. Sekme satırının kendisi yalnızca sekmeleri taşır; **dönüş ve gezinme düğmeleri listenin altında, çizgiyle ayrılmış kendi satırında** durur.

Sekme değişimi ve aynı sayfadaki her düğme **yazıldığı mesajı günceller** (`interaction.update`), yeni mesaj atmaz; mesajda bir görsel varsa `attachments: []` ile temizlenir. Yeni mesaj yalnızca ilk açılışta ve modal gönderiminde (modal, eski mesajı güncelleyemez) atılır.

`/siralama` liste türlerinin tek girişidir: mesaj, ses, yayın, saygınlık, coin ve VIP aynı tür menüsünden seçilir, hiçbiri için ayrı komut açılmaz (VIP listesi de bir dönem `/siralama` türüdür). Dönem yalnızca gün gün biriken türlerde anlamlıdır; saygınlık, coin ve VIP seçildiğinde Genel/Haftalık/Özel Süre düğmeleri **kalkmaz, pasifleşir** ve başlığın altındaki satır o türün neyi saydığını ile neden tek dönem olduğunu söyler.

Yetkiliye özel bir liste komut istemiyorsa kapı mevcut komutun kendisidir: **/kalici-oda** odası olan yöneticide panelin altındaki **Odaları Yönet** düğmesiyle aynı listeyi açar, odası olmayan yöneticide komut listeyi doğrudan çizer. Düğmenin açtığı liste sadece basana görünür (kalıcı panel mesajı), komutun doğrudan açtığı sayfa kalıcı ve herkese açıktır; odanın kartı üye menüsü ve düğmelerden yönetilir — hiçbir adımda numara ya da ID yazılmaz. Liste seçimi ve oda kartındaki işlemler mesajı yerinde yeniden çizer; kartın altındaki **Oda Listesi** düğmesi listeye döner, kapatma ise modal sonrası gizli bir işlem fişiyle biter. Kalıcı bilgi panelinde yönetici düğmesi bırakılmaz: herkese açık sabit panel, yetki isteyen bir kontrolü taşımaz.

Kanalda bekleyen bir **çağrı kartının** (evlilik teklifi) yanıtı da geldiği yerde kapanır: Kabul, Ret ve süre dolumu teklif kartını sonuç kartıyla **yerinden değiştirir**, kanalda ikinci mesaj açılmaz. Çağrıdan vazgeçme kişinin kendi sayfasından yapılır ve o sırada hem sayfa hem kanalda duran teklif kartı güncellenir; kartın mesaj ID'si bu yüzden teklifin kaydında taşınır. Süresi dolan çağrıları bekçi kapatır: tarama açılışta `await` ile bekletilir, böylece kurulmadan önce bitmesi gereken kartlar biter ve bir hata olursa olay dağıtıcısının yakalama kapısına düşer.

Bir panelin düğmesi **yeni bir mesaj** açtığında (profil kartının mağaza, rozet ve vitrin sayfaları) o sayfanın **Geri** düğmesi olmak zorundadır; Geri sayfa mesajını kaldırır (`interaction.message.delete()`) ve kişi açtığı panele döner. Geri düğmesi görünür kontrollerin içinde durur — sekme sayfasındaysa listenin altındaki kendi satırında.

Cüzdan (`/bakiye`) bundan ayrıdır ve **tek mesajda gezilir**: Mağaza ve Siparişlerim cüzdan kartının yerini alır, asla yeni mesaj atmaz. Mağazanın alt gezinme satırı nereden açıldığına göre belirlenir: cüzdandan açılan sayfada **Cüzdana Dön** cüzdan kartını yeniden yazar ve yanına **Siparişlerim** eklenir, profil kartından açılan sayfada tek başına Geri mesajı kaldırır. Kaynak, mağazanın sekme, al ve giy düğmelerinin customId sonunda taşınır (`profil-ayar:magaza:tema:cuzdan`), böylece yerinde yenilenen sayfada yön kaybolmaz. Cüzdandaki **Görevler** düğmesi bundan istisnadır: görev paneli kendi beş sekmesini taşıdığı için cüzdanın yerini almaz, ayrı ve kanalda kalıcı bir mesaj olarak açılır (`coin-gorev` → `gorev/index.js`'in dışa açtığı `panelFor`). Bir sistemin paneli başka bir sistemden açılırken o panelin çizim fonksiyonu dışa açılır, ikinci bir panel asla yazılmaz.

Sayısal özetlerde her satıra bir `**Etiket:** \`kutu\`` yığını kurulmaz: kartın asıl sayısı kendi satırında kalın verilir (`**Mevcut Bakiye:** \`187 coin\``), ikincil sayılar `pills` ile tek satırda toplanır (`` `Kazanç: 42.000 coin` · `Harcanan: 23.600 coin` ``).

Görev paneli (`/gorev`) beş sekmeli, tek mesajda gezilen ilerleme panosudur ve düzeni başka bir yerde yoktur: **her görev kendi bölümünde** durur (kalın ad, tek cümle tarif, altında ilerleme ve ödül `çip`leri) ve **Al düğmesi o bölümün aksesuarıdır** — düğmeler listenin altında toplanmaz, üye hangi satırın ödülünü aldığını satırın kendisinden okur. Düğme üç hâlli olduğu için okunur: hedef dolmadıysa pasif ve etiketi ilerlemenin kendisi ("`25 dk / 30 dk`"), hazırsa yeşil "Al", alınmışsa pasif "Alındı". Kazanç geri bildirimi **başlığın hemen altında**, yeşil vurgulu tek satırdır; listenin sonuna bırakılmaz, çünkü üyenin az önce dokunduğu şey oradadır. Cüzdan şeridi (`Bakiye` + `Anahtar`) her sekmenin aynı yerinde durur ki ödülün nereye gittiği hiç kaybolmasın.

Görevlerde **ilerleme sayılmaz, okunur**: mesaj ve ses sayısı sıralamadan, verilen saygınlık saygi kaydından, günlük ödül ve sipariş coin kaydından, kozmetik sahipliği profil kaydından gelir (`gorev/olcum.js`). Depolanan tek şey ödülün alınmış olması, anahtar sayacı ve sezon puanıdır. Dönüşler zamanlayıcı beklemez: günlük ve haftalık takımlar o günün/pazartesinin anahtarından deterministik çekilir, anahtar değiştiği an herkes yeni takımı görür. Böylece görevler açılmadan önceki etkinlikler de sayılır, bir sayaç bozulsa bile ilerleme yeniden hesaplanır ve bu sistem başka bir sistemin verisine yazmaz.

### Form, DM ve log

- **Form:** başlık en çok 45 karakter ve eylem odaklı ("Talebi Kapat"), alan açıklaması tek cümle, yer tutucu "Örn: ..." biçiminde. Boş değer ve boş yer tutucu Discord'a gönderilmez.
- **DM:** aynı `page` düzeni, kısa; sunucu adı bir kez geçer, ham ID ya da teknik ifade yok.
- **Log:** başlık olay adıdır, `**Etiket:** değer` blokları, değişiklikler `eski → yeni`; log mesajları hiç etiket atmaz.

### Butonlar

- Etiket en çok 20 karakter, Başlık Düzeni, emoji ve ok yok; eylem fiili ("Onayla", "Talebi Üstlen").
- Stil: Primary ana eylem, Success onayla/devam/aktif sekme, Danger kapat/reddet/sil, Secondary nötr, Link bağlantı.
- **Aynı iş, aynı renk:** bir butonun rengi etiketinden değil işlevinden gelir ve o etiket botta nerede geçiyorsa orada da aynı renkotur. Al/Onayla/Kabul Et/Üstlen/Bir cezayı ya da yasağı kaldır → Success. Kapat/Sil/Çıkar/Reddet/İptal/Sıfırla/Bırak/Kilitle → Danger. Akışın ana çağrısı (Başvuru Yap, Formu Aç, Talep Oluştur, Çekiliş Başlat, Selam Ver, İtiraz Et, Görüşmeye Çağır) → Primary. Gezinme, geri, detay, öğrenme ve satır içi düzenleme düğmeleri (Geri, Cüzdana Dön, Mağaza, Rozetler, Detay, İsmi Değiştir, Limiti Ayarla, Süreyi Öğren, Hatırlat, « ») → Secondary. Sekme satırında seçili olan Success, ötekiler gri. Sonucu anlatan pasif etiketler kendi durum renginde kalır (Onaylandı Success, Reddedildi Danger); zaten pasifleşen butonun rengi görünmediği için tartışma konusu değildir.
- Kullanılmış butonun etiketi geçmiş zamana döner ve pasifleşir ("Üstlenildi").
- Bir satırda en çok 5 buton, işlem satırlarında tercihen 3; menü tek başına bir satırdır.
- **Üyenin tek işi kartın en görünür kontrolüdür.** Topluluğa açık bir kartta üyenin yapması gereken şey (partner sunucusuna girmek, kanala katılmak, başvuruyu açmak) içeriğin hemen altında, kendi satırında durur; yetkilinin yönetim butonları **### Yetkili İşlemleri** başlığının altına itilir ve başlığın altındaki tek cümle butonların kimin için olduğunu söyler.
- **Components V2 kartlarında bağlantı önizlemesi açılmaz**, bu yüzden metnin içine gömülü bir davet linki üye için görünmez kalır. Link, kart çizilirken metinden okunup **link butonuna** çevrilir ve kopyalanabilir hâliyle (`discord.gg/...` kutusu) ayrı bir satırda da yazılır; link yoksa buton doğmaz ve başlığın altındaki açıklama üyeye davetin verilmediğini söyler (ör. `partner/ui.js` → `inviteUrl`; paylaşım, inceleme ve güvenilir partner detay kartları).

### Çizili kartlar (profil ve kapak önizlemesi)

- Kart node-canvas ile çizilir (embed/CV2 değil): **1800 px genişlik**, 60 px kenar boşluğu, kapak 380 px, kapak önizlemesi 1800×380. Discord sohbetteki görseli yüksekliğinden kıptığı için geniş tuval kartı sohbette daha geniş alan kaplar; yazı ölçeği yüksekliğe göre ayarlıdır (ad 56 px, biyografi 27 px, bölüm başlığı 16-18 px), bu yüzden genişlemek yazıları küçültmez. Kartın yüksekliği içeriğe göre çizimden önce ölçülür: rozet satırı yokken 928 px, bir satır rozetle 990 px, iki satır rozetle 1044 px.
- Kart **beş banttır** ve bilinçli olarak az bantlıdır: kapağın içindeki kimlik bloğu → **profil puanı bandı** → kutusuz sayı şeridi → rozet şeridi → biyografi ve vitrin yan yana. Ayrı bir "isim bandı" yoktur; kimlik kapağın içine taşındı, böylece aynı içerik daha az dikey alana sığdı ve kart sohbette belirgin biçimde büyüdü. Eski düzen on dört cam panel çiziyordu (iki seviye kutusu + 12 kutucuk), panel sıkışıklığı okunabilirliği bozduğu için gövde iki panele indirildi: puan bandı tek gösterişli panel, altındaki sayı şeridi kutu çizilmeden sadece ince vurgu rengi ayraçlarla diziliyor.
- Şeridin sütun sayısı **üyeye göre değişir**: yedi sabit sütuna (mesaj/ses seviyesi, mesaj, ses süresi, ziyaret, sicil, sunucuda) yayın, soygun, keşif ve şakalaşma yalnızca o sistemde kayıt varsa eklenir. Kart botun hangi köşesinin kullanıldığını gösteren bir vitrin olduğu için boş sayaç çizilmez; hiç ekran paylaşmamış üyede "-" sütunu yer kaplamaz. Sütunlar çoğalınca daralan etiket **önce puntoyla küçülür** (16 → 12), en son kırpılır; on bir sütunluk şeritte "MESAJ SEVİYESİ" okunur kalır.
- **Puan bandı** kartın hedefidir: solda büyük puan (`86 px`) + "/ 1000", altında rütbe ve "bir üst rütbe için X puan" ile dolan çubuk; sağda 4×2 hücrede puanın geldiği bölümler. **Sunucu sırası hücre değil, başlık satırıdır** ("PROFİL PUANI · 12. sıra / 340 üye"): sekiz bölümün hücresi 4×2 ızgarayı doldurduğu için sıra, puanın hemen üstünde küçük yazıyla verilir. Kart, `profil/ui.js`'teki **Puanım** sayfası ve ilk 10 listesi üçünün kaynağı `profil/skor.js`tir (`scoreOf` ve tek geçişle hesaplanan, 5 dk önbellekli `board`); hiçbir yerde iki farklı puan görünebilir değildir. Puan **yalnızca kazanılanları toplar, ceza/sicilden düşmez** — kart herkese açık bir vitrin olduğu için üye olmadığı bir şey uğruna halka açık cezalandırılmaz.
- Kartın okuduğu **tek veri kaynağı `profil/view.js`**tir (`profileView(guild, userId)`): seviye, sıralama, coin, saygınlık, sicil, takviye, ziyaret, kozmetik ve hesap yaşı tek geçişte toplanır. `card.js` yalnızca biçimlendirip çizer, hiçbir mağazadan ya da depodan doğrudan veri çekmez; kapak önizlemesi de aynı katmanın `headerView`'ını kullanır. Böylece kartla paneller hiçbir zaman farklı sayıyı göstermez ve yeni bir sistem veri ürettiğinde profil onu yalnızca `view.js` üzerinden okuyarak büyütür.
- Yeni ekonominin sayıları (soygun, direniş, keşif, şakalaşma, butik renkleri, evlilik) `view.js`'te **ayrıca okunmaz**; oradaki `rozet.context()` bağlamından devralınır. Kart, rozet sayfası ve profil puanı aynı ölçümü aynı kaynaktan aldığı için üçünün sayısı hiçbir durumda ayrışamaz. Kapağın sağ üstündeki haplar sırasıyla mesaj sırası, ses sırası, coin ve **evliyse eşle geçen gün**dür ("Eş: Ayşe · 40 gün"); evlilik bitince hap da "Evli" rozeti de kayıttan düştüğü için kendiliğinden kalkar, üyenin hiçbir şeyi silmesine gerek kalmaz.
- Gövde zemini **opak bir gradyan**dır: kapağın altından tema renginin kararanıyla (`bgTop`, temanın `to`'su) başlar, kartın altında neredeyse siyaha iner (`bgBottom`, temanın `from`'u). Kapağın alt kenarının **kendi ortalaması** alınır (`avgTone`): koyulaştırılıp tema rengine yaklaştırılan bu ton, kapağın son 70 px'indeki kararmanın hedefi ve gövdenin ilk rengidir (`seam`). Üye parlak ya da koyu ne koyarsa koysun, kapak ile zemin aynı renkte buluşur; arada çizgi ya da bant oluşmaz. Kapağın rengi gövdeye alfa ile **boyunmaz**: ışıma (`paintAmbient`) birleşim çizgisinde sıfır alfa ile açılır, gövdenin içinde güçlenir ve alta doğru söner; parlamaların üst ucu o çizgiye değmez, tek köşeye toplanmaz.
- Panel tarzı **temaya bağlıdır**, her kart cam değildir: `themes.js`'te `glass: true` olan temalar buzlu cam panel (yumuşak dolgu + üst parlama + ince kenar), olmayanlar düz opak panel çizer. Düz panellerin zemini de gövdenin ilk tonundan (`bgTop`) türer; böylece gradyanlı zeminde kutular kaybolmaz. Saydamlık cam temalarda üyenin kendisinindir (`custom.glassOpacity`, 0-100, 10'luk adımlar; 0 belirgin panel, 100 neredeyse görünmez panel).
- Kapak görseli **gerçekten görünür**: üstten karartma yok, tek karartma sol alt köşeden yayılan ışınsal kimlik kararmasıdır (`drawHeroScrim`). Gücü, altındaki bölgenin ölçülen parlaklığı belirler (parlak fotoğrafta koyulaşır, koyu fotoğrafta inceltir) ve 0.78'i geçmez; dikdörtgen bant çizilmediği için kenar çizgisi oluşmaz. Sağ üstteki sıra/coin hapları kendi koyu dolgularını taşıdığı için ek karartma istemez.
- Kapağın yerleşimi ikilidir (`custom.bannerFit`: `banner` (varsayılan) | `sigdir`). **Banner** görseli kapağın tamamına yayar: kapak her zaman baştan başa fotoğraftır, dik bir telefon fotoğrafı da dahil. Alanı dolduracak ölçek kırpma gerektirdiğinde hangi şeridin görüneceğini `focusPan` görselin kendisinden ölçer — görsel küçük bir ölçeğe indirilip her aday şeridin parlaklık **varyansı** hesaplanır, en hareketli (özneyi taşıyan) şerit seçilir; eşit skorlarda kadrajın ortasına yakın şerit yeğlenir. Üyenin kaydırma düğmeleri bu otomatik kadrajın **üstüne biner**, sıfır bırakıldığında çerçeveyi bot seçer. **Sığdır** görselin tamamını gösterirken kenarlarda kalan yeri aynı fotoğrafın koyulaştırılmış hâliyle doldurur ve ortadaki net dilimin kenarlarını bu fona doğru karartır; kaydırma/işlem kapalıdır.
- Rozet şeridi en çok iki satır; sığmayanlar tek bir "**+N**" hapsine dönüşür. Coin ile alınan sergi rozetleri başa yazılır (ücretli olan, kazanılanların arasında kaybolmaz).
- Kapak düzenleyicide görsel %100-300 yakınlaştırılır ve kaydırma yalnızca taşan alan kadar yapılır (-1..1); görselin arkasında boşluk oluşamaz. Hareket düğmeleri her zaman durur, görsel yokken ya da sığdırmada pasifleşir. Görünüm sayfasındaki saydamlık düğmeleri de aynı kuralı izler: cam olmayan temada kaybolmaz, pasifleşir.
- Arka plan efektleri (`kapak.js`) temaların kendi efektiyle aynı boyacıları kullanır; tema ve arka plan tek yerde çizilir.
- **Seviye atlama kartı** (`seviye/levelup-card.js`) iki sabit kutudur: soldaki seviye kutusu her kartta 330 px, sağdaki ödül kutusu kalan genişliktir ve **her zaman çizilir**. Rol sadece ana seviyelerde verildiği için kutu boş kalınca seviye kutusu tüm satıra yayılıyor ve kart bozuk duruyordu; şimdi rolsüz seviyelerde ödül kutusunun başlığı **SEVİYE ÖDÜLÜ**, ana seviyede **KAZANILAN ROL** olur ve altında her seviyenin coin ödülü (`coin/config.js` → `awards.levelUp`) altın renkli `+N coin` satırıyla yazılır. Coin tonu tema renginden bağımsızdır (`COIN_COLOR`), böylece coin her yerde aynı görünür.

## 4. Teknik sınırlar

- Bir mesajda en çok 40 bileşen (iç içe olanlar dahil) ve toplam 4000 karakter metin. Aşılırsa `tidy` düzenlemeyi bırakır; liste uzunlukları buna göre sınırlanır (ör. sicilde sayfa başına 6 kayıt).
- Bir menünün üstündeki her başlık bloğu üç bileşen yer (çizgi + metin + satır + menü = 4). Sınırdayken çizgilerini yitirmemek için kontrol paneli başına nefes alanı bırakılır: aynı işi gören menüler tek `###` başlığı altında yan yana dizilir, aralarında çizgi olmaz, ayırıcı olarak menünün kendi placeholderı yeter (ör. `ozel-oda/ui.js` panelinde At/Yasakla/Devret üç menüsü tek **Üye İşlemleri** başlığındadır). Liste içerikleri bileşen sayısını büyütmez: üyeler tek metin bloğunun içinde, en çok 12 ad + "+N kişi daha" olarak gösterilir.
- Etiket/seçenek sınırları: buton etiketi 80, `customId` 100, menüde 25 seçenek, modal başlığı 45, modal alan etiketi 45, modal alan açıklaması 100.
- Etkileşime 3 saniye içinde cevap verilir (ağır işten önce `deferReply` / `deferUpdate`); modal açan butonlarda modaldan önce yavaş iş yapılmaz. Cevap yolları `respond` ile açılır.
- Her `allowedMentions` bilinçlidir: yalnızca gerçekten bildirim gitmesi gerekenler etiketlenir (yeni talepte yetkili rolü, ana seviyede üye, çekiliş kazananı).

## 5. Dil

- Üyeye ve yetkiliye "sen"; "siz" yok. Ünlem en çok bir tane ve sadece kutlamada. Başlıklar noktasız, cümleler noktayla biter.
- Kanala düşen işlem kartlarında üye "sen" diye değil, `<@etiket>` ile 3. tekil şahıs olarak anılır ("`<@id>` ürünü aldı" gibi); gizli hata mesajları doğrudan hitap eder.
- İngilizce kelime yok ("ticket" yerine "talep"); tutarlı terimler: Talep, Yetkili, Üye, Başvuru, Mülakat, Değerlendirme, İtiraz, Ceza, Sicil, Takviye, Özel Oda, Çekiliş, Partner.
- Süre birimleri "gün", "saat", "dakika" (dar listelerde "dk"). Boş durum tek kalın cümledir ("**Henüz kayıt yok.**").

## 6. Cevap politikası

**Kural: görünürlüğü iki test belirler; ikisi de içeriğe değil, mesajın kanalda ne yapacağına bakılır.**

1. **Birikme testi → GİZLİ.** Cevap, kanalda **kalıcı duran bir panelin** butonundan ya da menüsünden çıkıyorsa ve o kontrole her üye dokunabiliyorsa sadece basana görünür. Kalıcı gönderilirse aynı kart alt alta birikir ve panel yukarı kaybolur: `cezalarim` panelinin süre/sebep/itiraz kartları, `yenihesap` kısıt kartı, yayın/etiket/partner görme rolü onayları, çekilişe katılım cevabı, destek ve kalıcı oda başvurusu cevabı, log panelinin kategori bağlantısı ve log detayı, oryantasyon devir seçicisi. Aynı gerekçeyle tek satırlık hata, ret, doğrulama, test/önizleme ve onay uyarıları da gizlidir.
2. **Sayfa/kayıt testi → KALICI ve HERKESE AÇIK.** Cevap komutla açılan bir **sayfa** ya da çok adımlı bir akışsa, ya da topluluğa düşen bir **kayıtsa** kanalda kalır: profil kartı ile rozet, vitrin, mağaza, kapak, görünüm ve **Puanım** sayfaları, `/bakiye` cüzdanı, `/gorev` paneli, `/seviye`, `/siralama`, `/kalici-oda` oda paneli, `/yardim`, listeler ve tablolar, satın alma/giyme/`/gunluk`/kutu açılışı/çekiliş sonucu/seviye atlama/haftalık duyuru kartları. Bunlar yenilemede kaybolmamalıdır; "üyenin kendi durumu" tek başına gizleme sebebi değildir.

İki testi birden geçiren mesaj **açıktır**. Kalıcı panel ayrımı sayfa ayrımını yenilmez: panelde kurcalamanın çıktısı geçicidir, üyenin kendi açtığı sayfayı ise yeniden görebilmesi gerekir. Sayfaların kendi düğmeleri mümkün olduğunca `interaction.update` ile aynı mesajı yerinde yeniler, böylece açık olsalar bile mesaj birikmez. Tek istisna `/sicil`dir: yetkili komut kanalı dışında kişiye özel kalır, çünkü ceza kaydı herkesin önüne yazılmaz.

`respond` varsayılan olarak açık verir; gizlilik `{ ephemeral: true }` ile **elle** istenir ve akış slash komutuyaysa bayrak defer anında da gizli verilir. Kuralın ilk hali ("her cevap açıktır") panel cevaplarını kanala döktü ve paneli kaybedecek kadar kalabalık üretti; ikinci hali ("üyenin kendi durumu gizlidir") komutla açılan sayfaları da gizledi ve üye sayfasını yenileyince kaybetti. Ekim 2026'da iki testli son hâline geldi.

| Durum | Görünürlük |
| --- | --- |
| İşlem sonucu ve onay kartları (satın alma, giyme, saygı, VIP, seviye/çekiliş duyuruları, `/gunluk`, **kutu açılışı**, **evlilik teklifi ve sonucu**, boşanma, yıl dönümü) | Herkese açık `receipt` kartı; üye `<@etiket>` ile anılır, metin 3. tekil şahıs. Teklifin yerini alan sonuç kartı aynı mesajı günceller, kanal dolmaz |
| Liste ve sıralama tabloları, paneller, duyurular, loglar, talep/ortaklık inceleme kartları, yetkili işlem kanallarındaki kartlar | Kanalda herkese görünür |
| **Sayfalar:** `/profil` kartı ve rozet/vitrin/mağaza/kapak/görünüm/**Puanım** sayfaları, `/bakiye` cüzdanı ve **Butik** rafı, `/evlilik durum` ve `liste`, `/gorev` paneli, `/seviye`, `/siralama`, `/kalici-oda` oda paneli ve odasız yöneticide açtığı oda listesi, `/yardim` | Kalıcı ve herkese açık; sekmeler ve düzenleme düğmeleri `update` ile aynı mesajı yerinde yeniler |
| **Kalıcı panel cevapları:** `cezalarim` süre/sebep/itiraz kartları, `yenihesap` kısıt kartı, `sicil` ceza detayı, yayın/etiket/partner görme rolü onayları, çekilişe katılım, destek ve kalıcı oda başvurusu cevabı, log paneli bağlantısı ve detayı, oryantasyon devir seçicisi | Sadece basana (`{ ephemeral: true }`) — kalıcı olsalar panelin altı dolar ve panel kaybolur |
| Hata, izin reddi, doğrulama uyarısı | Sadece kullanana (`replyError`) |
| `/sicil` yetkili komut kanalı dışında (üye kendi sicilini bakıyor) | Sadece kullanana; ceza kaydı kanalda görünmez |
| Yetkili oda yönetimi: oda panelindeki **Odaları Yönet** düğmesinin açtığı liste, oda kartı, devir ve kapatma sonucu | Sadece basana — yönetici aracı kanalı doldurmaz. Komutun odasız yöneticide doğrudan açtığı oda listesi ise **/kalici-oda** sayfasıdır: kalıcı ve açık |
| Çekilişin bitir/iptal **onay penceresi** | Sadece kullanana; onay sonrası sonuç kartı kanala düşer |
| Özel oda kontrol paneli düğme ve menüleri | `update` ile panelin kendisi yeniden çizilir, yeni mesaj atmaz |
| Modallar (formlar) | Formun kendisi Discord gereği sadece açana görünür. **Formu gönderince çıkan cevap ayrı bir mesajdır** ve birikme testine tabidir: panel kanalından açılan formun cevabı gizlidir (`destek` red ve kapatma kartları), yoksa her red panelin altına bir mesaj ekler |

- Görünürlük **defer anında kilitlenir**: `deferReply({ flags: core.CV2 })` ile açılan bir akışın sonundaki `{ ephemeral: true }` cevap Discord tarafından gizli yapılamaz; o uyarı kanalda görünür. Akışın yarısı gizli yarısı açık kalamaz; bu yüzden gizli bir akış baştan `core.EPHEMERAL_CV2` ile ertelenir, açık akış baştan açık.
- Tam tersi de geçerli: `deferReply({ flags: core.EPHEMERAL_CV2 })` ile açılan akışın **her** cevabı `{ ephemeral: true }` taşımak zorunda; bayraklar uyuşmazsa Discord son düzenlemeyi reddeder. Buton/menü cevapları `followUp` ile gittiği için görünürlükleri defer'den bağımsızdır.
- Herkese açık kartlarda "sen" dili kullanılmaz: kartı okuyan kişi işlemi yapan değildir. Kart `receipt` ise `user` alanı avatarı taşır, `<@id>` etiketi başlık cümlesinde geçer. Gizli kart doğrudan "sen" diye hitap eder.
- **Kayıt kanalı:** bazı topluluk kayıtları, işlem hangi kanalda (ya da DM'de) yapılmış olursa olsun tek bir sabit kanala yazılır. Her saygınlık vermesi `saygi/config.js`'teki `feed` kanalına (bot komutları) düşer; böylece DM'den verilen saygınlığın da herkese açık bir izi kalır ve sohbet kanalları makbuzla dolmaz. Verme zaten o kanaldaysa cevap mesajının kendisi o izi taşır, ikinci mesaj atılmaz. Vermenin kuralı tek kapıdadır (`saygi/index.js` içindeki `give`): `/saygi-ver`, `+rep` ve puanlama DM'inin saygınlık butonu aynı kapıdan geçer, butonun bir kez kullanılması değerlendirme kaydındaki `repAt` ile tutulur.

## 7. Komut politikası

- Her komutun ve seçeneğin açıklaması tek cümle, fiille başlayan, noktayla biten ve en çok 100 karakterdir.
- Yardım menüsü **tek katmanlıdır**: `/yardim` kim açarsa açsın yalnızca sistemin `help.member` listesindeki, yani HERKESİN kullanabildiği komutları listeler. Rol, izin ya da yöneticilik isteyen bir komut (`/sicil`, ceza, yetki, `/log`, emoji/çıkartma ekleme...) menüde hiç yer almaz — yetkili o komutları panellerden ve yetkili kanalından öğrenir, üyenin işine olmayan komutu üye listesi karmaşa üretir. `help.category` kategoriyi belirler, `help.access` erişimi belgeleyen kayıttır ve arayüzde gösterilmez; sağ tık (bağlam menüsü) komutları menüde listelenmez.
- **Test ve önizleme komutu yoktur.** Bir kartın ya da duyurunun nasıl görüneceği `tools/preview` içindeki case'lerde çizilir; botun içine "örnek gönder" seçeneği konmaz. Ölçümü olan sistemler (`aktif`, `saygi`, `etiket`) kendi komutlarını hiç açmaz: olay olur, sonuç haftalık duyuru kartında ve `/siralama`'da görünür.
- **Tek seçenekli komut alt komut taşımaz.** Bir komutun tek bir işi kaldıysa alt komut kalkar, isim komutun kendisi olur (`/kalici-oda`, `/log`). Yetkilinin oda listesi, devir ve kapatma gibi işlemleri de panel düğmesinden açılır; üyeye ya da yetkiliye numara/ID yazdırılmaz, seçim menüsü ve düğme akışı kullanılır.
- Komut denetimi kuralı: `help.access` kaydı "Herkes" ile başlamayan bir komut `help.member` listesinde yer alırsa `yardim-uye-erisim` hatası verilir.
- Yardım menüsü **tek mesajda gezilir**: `/yardim` kısa bir panel açar (başlık, tek cümlelik yönlendirme, kategori menüsü) ve o panelde **komut listesi yoktur**. Kategori seçmek yeni mesaj atmaz — panelin yerini o kategorinin komut kartı alır (`interaction.update`), kartın altındaki **Yardım Menüsüne Dön** panele döndürür. Panel ve kart **herkese açıktır**, kategoriyi herkes seçip değiştirebilir.
- Kategori kartının başlığı kategorinin adıdır, altındaki gri açıklamada komutların adına tıklayarak kullanılabileceği söylenir; o kategorinin bütün komutları, tıpkı bir log girdisinin bilgi bloğu gibi, **tek bir blokta** toplanır.
- **Butonla açılan sayfa komut almaz.** `butik` gibi bir raf, cüzdan kartındaki bir düğmeyle açılır ve o kartın yerini alır; `commands`, `help` ve `slash` hiç dışa açılmaz (`yayin`, `durum`, `otorol` da aynı kalıbı izler). Böyle sistemler tek bir customId öneki taşır (`butik:`) ve `prefixed` üzerinden yönlendirilir: önek eşleşmesi sunucu kontrolünden ve tam ID buton tablosundan önce çalıştığı için kapının buton tablosunda kaydı olmaz, kaydı olursa da gölgelenmiş olur.

## 8. Doğrulama (Discord'a bağlanmadan)

```
node tools/preview/check.js [sistem]    # lint, handler kapsamı, komut denetimi
node tools/preview/build.js [sistem]    # tools/preview/out/index.html ve <sistem>.txt (tarayıcıda aç)
node -e "process.env.GUILD_ID='1'; require('./src/systems')"   # bot yükleniyor mu
```

Yeni mesaj eklerken `tools/preview/cases/<sistem>.js` içine bir case eklenir; `check.js` her butonun, menünün ve formun bir işleyiciye bağlı olduğunu da doğrular.

## 9. Her mesaj için kontrol listesi

1. Embed, emoji ya da ok simgesi var mı (⭐ hariç)?
2. Mesaj başlığı `##`, bölüm başlıkları `###`, satır etiketleri `**kalın**` kademelerinde mi? Ana cümle ve anahtar sözcükler kalın, açıklama normal boyutta (`-#` yalnızca izin verilen yerlerde), ilgisiz bloklar çizgiyle ayrılmış mı?
3. Bilgi satırları `rows` ile mi kuruluyor ve kısa değerler (numara, süre, durum, sayı) `chip` içinde mi?
4. İşlem bildirimi `receipt` kartıyla mı çiziliyor; görünürlük §6'nın iki testinden geçti mi (kalıcı panelin buton cevabı → gizli, komutla açılan sayfa ve topluluk kaydı → kalıcı ve açık)?
5. Aynı bilgi mesajda iki kez geçiyor mu? Takip mesajı öncekini tekrar ediyor mu?
6. Başlık kısa ve tek satır mı? Buton en çok 20 karakter ve Başlık Düzeni mi?
7. Yön sözcüğü gerçekten doğru mu, buton adı metinde doğru yazılmış mı?
8. Boş durum, uzun metin, 40 bileşen / 4000 karakter ve 25 seçenek sınırı düşünülmüş mü?
9. Etiket yalnızca gerekenleri mi çağırıyor?
10. Türkçe: yazım, ek uyumu, tutarlı terim, ünlem sayısı.
11. Her etkileşimli bileşen bir işleyiciye bağlı mı (`check.js` doğrular)?
