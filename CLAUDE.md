# Kazuki — çalışma notları

Kazuki, tek sunucuda çalışan Türkçe bir Discord yönetim botu (discord.js 14, yalnızca Components V2). Bu dosya bu depoda çalışan herkesin (insan ya da Claude) uyacağı kalıcı kuralları özetler. Ayrıntılı tasarım dili: `docs/TASARIM.md`, sistemler ve komutlar: `README.md`.

## Sahibiyle çalışma

- Yanıtlar **Türkçe**. İş bitmeden soru sorma; makul bir karar ver ve sonunda ne yaptığını söyle.
- Söylenen şeyi yap; söylenmeyen parçalar için kapsam sorusu sorma, sonraya takılabilecek şekilde tasarla.
- Kanal ve rol ID'leri koda sabit yazılır (`src/systems/<sistem>/config.js`); hiçbir akış "şu kanala mı gitsin?" diye sormaz.
- Butonla yapılabilen işe slash komutu ekleme; komut listesi minimal kalır.

## Mesaj tasarımı (özet; tamamı `docs/TASARIM.md`)

- **Embed yok**, hep Components V2. Yardımcılar `src/core/ui.js` içinde (`page`, `alert`, `notice`, `panel`, `fields`, `hint`, `pagerRow`, `tabRow`...).
- Önemli cümle ve anahtar sözcükler **kalın**, açıklamalar **normal boyutta** yazılır; küçük gri yazı (`-#`) YALNIZCA başlığın hemen altındaki açıklamada (`page`/`panel` sub), zaman damgasında, sayfa bilgisinde ve sıralama listesinin 4. sıradan sonraki satırlarında kullanılır (`node tools/preview/check.js` başka her `-#` kullanımını hata sayar). Birbirinden bağımsız bloklar arasında çizgi (`page` blokları ya da `divider()`). Aynı bilgi iki kez yazılmaz.
- **Emoji yok** (buton, menü, etiket, metin); tek istisna puan yıldızı ⭐ ve `durum` yazısı. `◀ ▶` gibi ok simgeleri yok; sayfa butonları `«` `»`.
- `page()` mesajlarının gri açıklaması (`sub`) 140–220 karakterlik gerçek bir cümledir (bütün mesajlar aynı genişlikte görünsün diye bilerek uzun).
- Mobilde de güzel: kısa tek satır başlık, boşlukla ortalama yok, geniş tablo yok. Panel butonu başlığın yanında (section aksesuarı) durur.
- Test/önizleme/log mesajları kimseyi etiketlemez (`allowedMentions: { parse: [] }`).
- Bilgi komutları (yardım, seviye, profil, sıralama, sicil) herkese açık, hata ve kişisel sonuçlar sadece kullanana görünür.

## Kod düzeni

- `src/core`: ortak parçalar (ui, helpers, panel, banner, db, config, canvas, logger). `src/systems/<sistem>`: `config.js` (ID ve metin), `index.js` (komut + işleyiciler), `ui.js` (mesajlar), `store.js` (kayıtlar).
- **Dokunulmazlar:** `customId` dizgeleri, `data` alan adları, store mantığı, komut/seçenek adları. Görünüm serbestçe değişir, bunlar değişmez.
- Etkileşime 3 saniye içinde cevap ver; modal açan butonlarda modaldan önce yavaş iş yapma. Cevap verme yollarını `core/helpers.respond` ile aç.
- Panel mesajları açılışta `core/panel.js` `syncPanel` ile gönderilir; Discord CDN afişleri `core/banner.js` ile indirilip mesaja ek yapılır (süreli bağlantılar bozulmaz). Kalıcı afiş için görseli `assets/banners/<dosya adı>` olarak koymak yeterli.

## Doğrulama (Discord'a bağlanmadan)

```
node tools/preview/check.js [sistem]    # lint, handler kapsamı, komut denetimi
node tools/preview/build.js [sistem]    # tools/preview/out/index.html ve <sistem>.txt (tarayıcıda aç)
node -e "process.env.GUILD_ID='1'; require('./src/systems')"   # bot yükleniyor mu
```

Yeni mesaj eklerken `tools/preview/cases/<sistem>.js` içine bir case ekle; `check.js` her butonun/menünün bir işleyiciye bağlı olduğunu da doğrular.

## Dağıtım

Bot Railway'de çalışır, veri MongoDB'dedir (`MONGODB_URI`); yoksa `data/db.json` kullanılır. `main`'e giden her şey canlı botu etkileyebilir; `auto-push.ps1` yedekleme betiği bu yüzden dikkatle kullanılmalıdır. Aynı token ile aynı anda hem yerelde hem Railway'de çalıştırma: her olay iki kez işlenir (çift mesaj, çift panel).
