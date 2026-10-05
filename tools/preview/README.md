# Mesaj önizleme ve doğrulama aracı

Discord'a bağlanmadan botun Components V2 mesajlarını çizer, lint eder ve handler/komut eşlemelerini doğrular.
Sadece geliştirme içindir; `src` altına hiçbir şey yazmaz. Çıktılar `tools/preview/out/` altına gider (git'e girmez).

## Çalıştırma (repo kökünden)

- `node tools/preview/build.js [sistem ...]` : `out/index.html` (tek dosya, tarayıcıda aç) ve `out/<sistem>.txt` üretir.
  Sayfada sol gezinti, lint rozetleri, masaüstü 520px / mobil 360px anahtarı ve "metin dökümü" bulunur.
- `node tools/preview/check.js [sistem ...] [--verbose]` : lint, handler kapsamı, komut denetimi ve özet tablo.
  Hata varsa çıkış kodu 1 olur; `--verbose` uyarıları da yazar.

## Dosyalar

`mock.js` sahte Discord nesneleri (`mock.loose({...})` bilinmeyen alanlara varsayılan döner), `markdown.js` + `render.js` HTML,
`text.js` terminal dökümü, `lint.js` kurallar, `config.js` (ALLOW_EMOJI, kısaltmalar, yön sözcükleri), `runner.js` case yükleyici.

## Case ekleme

`cases/<sistem>.js` oluştur (`_` ile başlayan dosyalar önce yüklenir). Dosya bir fonksiyon dışa verir:

```js
module.exports = ({ mock, ui, src }) => [
  {
    id: 'panel',                 // dosya içinde benzersiz
    title: 'Destek paneli',
    where: 'Destek kanalı, bot açılırken',
    visibility: 'public',        // public | ephemeral | dm | log | panel
    kind: 'message',             // message | modal
    build: () => ({ components: [src('systems/destek/ui').panel()] }),
  },
];
```

- `build()` bir Container, bir ModalBuilder ya da `{ components, content?, flags?, files?: [{ name, buffer }], allowedMentions? }` döndürür.
  `flags` yoksa IsComponentsV2 varsayılır. `src('systems/x/ui')` ile gerçek ui fonksiyonlarını çağır.
- Avatar/simge için `mock.user().displayAvatarURL()`, `mock.guild().iconURL()`; ek dosya için `mock.pngFile('banner.png')`.
- Bir case patlarsa tüm çalıştırma bozulmaz; hata kırmızı kutuda gösterilir ve hata olarak sayılır.
- Gerçek custom_id'leri kullan: `check.js` her etkileşimli custom_id'nin src/index.js'teki route() ile bir handler'a bağlandığını doğrular.
