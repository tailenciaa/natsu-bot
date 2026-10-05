// Bilgilendirme paneli ayarları ve metni. Metni ya da bir bölümü değiştirip botu yeniden başlatınca panel kendiliğinden
// yenilenir. Her bölüm ayrı bir mesaj olarak gönderilir (bir mesaj en fazla 4000 karakter olabilir), kanal ve rol
// etiketleri <#kanalID> / <@&rolID> şeklinde yazılır, Discord bunları ada çevirir.

module.exports = {
  // Panelin gönderileceği kanal (#bilgilendirme)
  channel: '1538533822940061706',

  // İlk mesajın üstünde gösterilen görsel (doğrudan URL)
  banner: 'https://cdn.discordapp.com/attachments/1538539811697332385/1555880947730223155/bilgilendirmekazuki.jpg?backend=b2&ex=6ac3740c&is=6ac2228c&hm=7e59ef0269e9f8fd2524f65fd9a4bd5d9e0096af1b76fcb6417c574b7ee928c9&',

  // Bölümler. Her biri ayrı bir mesaj olur. blocks içinde:
  //   heading: kalın alt başlık, text: açıklama, items: madde listesi (plain: true ise madde işareti konmaz),
  //   note: altta küçük yazılan not. Bloklar arasına çizgi konur.
  sections: [
    {
      "title": "Kazuki Hakkında",
      "blocks": [
        {
          "text": "**Kazuki Anime & Public**, **16 Ağustos 2026** tarihinde <@218726563091447819> ve <@237986534681346048> tarafından kurulmuş, herkese açık bir Türkçe topluluk sunucusudur."
        },
        {
          "heading": "Neden kuruldu?",
          "text": "İnsanların bir arada eğlenebileceği, yeni arkadaşlıklar ve dostluklar edinebileceği, oyun oynayıp sohbet edebileceği, **toksiklikten uzak** bir ortam oluşturmak için."
        },
        {
          "heading": "Burada neler var?",
          "text": "Anime sohbetinin yanında genel sohbet, oyun odaları ve takımlar, etkinlikler, sesli kanallar, kendi özel odan, çekilişler ve seviye sistemi var. Hiç anime izlemediysen de rahat edersin."
        },
        {
          "heading": "Hedefimiz",
          "items": [
            "Herkesin kendini güvende hissettiği, **kavgasız ve toksiksiz** bir ortam",
            "Sorun yaşayan kişinin hızlıca çözüm bulabildiği bir **destek ekibi**",
            "Aktif üyenin görüldüğü ve **ödüllendirildiği** bir topluluk"
          ]
        },
        {
          "text": "**Davet linki:** https://discord.gg/kazuki"
        }
      ],
      "sub": "Sunucumuzun kim tarafından, ne zaman, neden ve hangi amaçla kurulduğunu; burada seni neler beklediğini ve neleri hedeflediğimizi kısaca öğrenebilirsin."
    },
    {
      "title": "Anime ve Manga Nedir?",
      "sub": "Anime ya da manga ilk kez karşına çıkıyorsa merak etme; bu kelimelerin ne anlama geldiğini ve burada anime izlemeden de nasıl eğlenebileceğini anlatıyoruz.",
      "blocks": [
        {
          "heading": "Anime",
          "text": "Japonya'da üretilen, çizimle yapılmış dizi ve filmlerdir. Aksiyon, komedi, romantizm, korku, spor, günlük yaşam gibi her tarzdan anime var."
        },
        {
          "heading": "Manga",
          "text": "Animelerin çoğunun çıkış noktası olan Japon çizgi romanlarıdır, sağdan sola okunur."
        },
        {
          "heading": "Spoiler",
          "text": "Bir animenin ya da mangasının sürprizini izlememiş birine söylemektir. Bu yüzden spoilerlar **etiketlenmeden paylaşılamaz**."
        },
        {
          "heading": "Anime izlemiyorum, ne yapacağım?",
          "text": "Merak etme, <#1538536247138590801> kanalında sohbet edebilir, oyun kanallarına ve sesli odalara katılabilirsin. \"Ne izleyeyim\" diye sorarsan üyeler öneri verir."
        }
      ]
    },
    {
      "title": "Yeni Katıldıysan",
      "sub": "Sunucuya yeni katıldıysan ne yapman gerektiğini adım adım anlatıyoruz; kuralları okuyup sohbete katılman ve gerekirse destek alman çok kısa sürüyor.",
      "blocks": [
        {
          "items": [
            "`1.` <#1538533642832318517> kanalındaki kuralları oku ve **Okudum, Kabul Ediyorum** butonuna bas.",
            "`2.` <@&1544051409199042631> rolün girer girmez **otomatik** verilir, onay beklemene gerek yok. <#1538536247138590801> kanalında sohbete katılabilirsin.",
            "`3.` Takıldığın bir yer olursa <#1538535372588326973> kanalından **Talep Oluştur** ile destek talebi aç. Yetkililere özelden yazma."
          ],
          "plain": true
        },
        {
          "heading": "Botumuz Kazuki",
          "text": "Destek, ceza, seviye ve özel oda gibi sistemlerin hepsini o yönetir. Komutları görmek için <#1538536351119446127> kanalında `/yardim` yaz."
        }
      ]
    },
    {
      "title": "Yönetim ve Yetkili Rolleri",
      "blocks": [
        {
          "heading": "Yönetim",
          "items": [
            "<@&1538519594501931109>: Sunucunun asıl kurucu rolüdür, alınamaz. En üst düzey yöneticidir, son kararı verir.",
            "<@&1538519682552692856>: Üst yöneticidir, kurucularla birlikte en geniş yetkilere sahiptir.",
            "<@&1538946630370332692>: Kıdemli yöneticidir, yönetim kadrosuna liderlik eder."
          ]
        },
        {
          "heading": "Yönetim Ekibi - <@&1555890044768624662>",
          "items": [
            "<@&1554237337993486377>: Yöneticidir, sunucunun işleyişinden ve yetkililerden sorumludur.",
            "<@&1554237339100774490>: Asistan yöneticidir, yönetime destek olur.",
            "<@&1554237339671208077>: Üst moderatördür, moderasyonda daha büyük sorumluluk üstlenir.",
            "<@&1554237340321448038>: Moderatördür, düzeni sağlar ve üyeleri yönlendirir."
          ]
        },
        {
          "heading": "Üst Yetkililer",
          "items": [
            "<@&1554237341768482816>: Üst yetkilidir, yetkili ekibine yol gösterir.",
            "<@&1554237342296969216>: Deneyimli yetkilidir, düzenin sürdürülmesinde görev alır.",
            "<@&1554237786809307206>: Yetkilidir, sunucu düzeninde aktif rol oynar.",
            "<@&1554237342917726249>: Yetkilidir, destek ve sohbet düzeninde görev alır."
          ]
        },
        {
          "heading": "Yetkili Ekibi - <@&1555890043992940614>",
          "items": [
            "<@&1554237347631997029>: Orta seviye yetkilidir, sohbet ve ses düzenini takip eder.",
            "<@&1554237348282245161>: Yeni yetkilidir, ekibe yeni katılmıştır.",
            "<@&1554237348940873758>: Deneme yetkilidir, adaylık sürecini tamamlar."
          ]
        },
        {
          "heading": "Görev Rolleri",
          "items": [
            "<@&1544337671340433569> <@&1553133497781325954>: Destek taleplerini üstlenir ve sorunları çözer.",
            "<@&1554237787421548704> <@&1554239996645613638>: Ticket (destek) talepleriyle ilgilenir.",
            "<@&1554239999619375274> <@&1554239998214152222>: Sesli kanalların düzenini sağlar.",
            "<@&1554239997559705720> <@&1554240000177078322>: Sohbet kanallarının düzenini sağlar.",
            "<@&1554240000529539083> <@&1554239995412488304>: Etkinlikleri planlar ve yönetir.",
            "<@&1554237785416794202> <@&1554239996058411068>: Partnerlik tekliflerini yönetir.",
            "<@&1554240783929049168> <@&1554240783769669663>: Yeni yetkililere oryantasyon verir.",
            "<@&1553398951816863844> <@&1554240783580667954>: Yetkili alım başvurularını inceler.",
            "<@&1554237780736090112>: Yetkili ekibini denetler.",
            "<@&1555890045599223868>: Yeni gelen üyeleri karşılar."
          ]
        }
      ],
      "sub": "Sunucuyu yöneten ve düzeni sağlayan ekibin kimlerden oluştuğunu, hangi rolün ne işe yaradığını ve hangi görevlerin kimler tarafından üstlenildiğini buradan öğrenebilirsin."
    },
    {
      "title": "Diğer Roller",
      "blocks": [
        {
          "heading": "Genel",
          "items": [
            "<@&1544051409199042631>: Sunucuya giren herkese otomatik verilir.",
            "<@&1538948140852318490>: Sunucuyu takviye ederek bizi destekleyenlere verilir.",
            "<@&1554240782162989117>: Özel üyelere yetkililer tarafından verilir.",
            "<@&1554403288424644738>: Kazuki sunucu etiketini profilinde taşıyanlara verilir.",
            "<@&1555327703882928168>: Partner kanallarını görmeni sağlar."
          ]
        },
        {
          "heading": "Ödül Rolleri",
          "items": [
            "<@&1555890043250282496>: 5v5 gibi etkinliklerde birinci olanlara verilir.",
            "<@&1554240783924858930>: Doğum günü olan üyelere verilir.",
            "<@&1554240785644396704>: Haftada en çok seste kalan üyeye verilir.",
            "<@&1555890043560792094>: Haftada en çok yazan üyeye verilir.",
            "<@&1554240786034594042>: Haftada en çok yayın açan üyeye verilir.",
            "<@&1556348584365133844>: Haftada en çok saygınlık kazanan üyeye verilir."
          ]
        },
        {
          "heading": "Seçilebilen Roller",
          "items": [
            "<@&1555890045066543154> <@&1555890045175595128> <@&1555890045280583760>: Çekiliş, etkinlik ve sohbet bildirimlerini almak için.",
            "<@&1555890042658889760> <@&1555890042772394044> <@&1555890043032182804> <@&1555890043221049355> <@&1555890043237826630> <@&1555890043501944922> <@&1555890045746151474>: Oynadığın oyunu belirtir, oyun arkadaşı bulmanı kolaylaştırır.",
            "<@&1555890038238093354> <@&1555890038808510464> <@&1555890039135666227>: Cinsiyet rolleridir."
          ]
        },
        {
          "heading": "Ceza Rolleri",
          "items": [
            "<@&1555281318324207647>: Jail cezası alanlara verilir, sadece jail kanalını görürsün.",
            "<@&1556274144042164234>: Hesabı 7 günden yeni olanlara güvenlik için verilir, süre dolunca kalkar."
          ]
        },
        {
          "note": "Haftalık roller her pazartesi yenilenir, yeni birinci rolü bir öncekinden alır."
        }
      ],
      "sub": "Üyelere verilen genel, ödül, bildirim ve ceza rollerinin neler olduğunu, her rolün nasıl kazanıldığını ve ne işe yaradığını buradan görebilirsin."
    },
    {
      "title": "Seviye Sistemi",
      "blocks": [
        {
          "text": "Sohbet ederek ve sesli kanallarda vakit geçirerek seviye atlarsın. Mesaj ve ses seviyen **ayrı ayrı** birikir, her **5 seviyede bir** yeni rol kazanırsın (5'ten 100'e)."
        },
        {
          "heading": "Nasıl kazanılır?",
          "items": [
            "**Mesaj:** Her mesaj **15-25 XP** verir, spam olmasın diye **60 saniyede bir** sayılır.",
            "**Ses:** Sesli kanalda geçen her **dakika 6 XP** verir.",
            "Seviye atladığında <#1538534603902554182> kanalında duyurulur."
          ]
        },
        {
          "heading": "Komutlar",
          "items": [
            "`/seviye`: Mesaj ve ses seviyeni gösterir.",
            "`/profil`: Seviyen, sıralaman ve profil kartın.",
            "`/siralama`: Sunucunun mesaj ve ses sıralaması.",
            "`/saygi-ver`: Bir üyeye +1 saygınlık verirsin (24 saatte bir).",
            "`/saygi-siralama`: Tüm zamanların saygınlık tablosu."
          ]
        },
        {
          "heading": "Haftanın aktifleri",
          "text": "Her pazartesi geçen haftanın **ses, yazı ve yayın** şampiyonları <#1538538279627132999>, en saygın üye <#1538538325521080391> kanalında ilan edilir ve rollerini alır."
        }
      ],
      "sub": "Mesaj yazarak ve sesli kanallarda vakit geçirerek nasıl seviye atladığını, hangi komutların olduğunu ve haftalık ödüllerin nasıl kazanıldığını anlatıyoruz."
    },
    {
      "title": "Metin Seviye Rolleri",
      "sub": "Sohbet ederek seviye atladıkça kazanacağın Metin Seviyesi rolleri ve bu rollerin sana sağladığı ayrıcalıkların tam listesi aşağıda yer alıyor.",
      "blocks": [
        {
          "items": [
            "<@&1556402675904544798>: Diğer üyelerden ayrı bir renk ve simgeyle görünürsün.",
            "<@&1556402675673862286>: Sunucudaki takma adını değiştirebilirsin.",
            "<@&1556402675975983206>: Harici emoji ve çıkartma kullanabilirsin.",
            "<@&1556402676072194160>: Mesajlara tepki ekleyebilirsin.",
            "<@&1556402676282036244>: Sohbette bağlantı (link) gönderebilirsin.",
            "<@&1556402676265390160>: Sohbette medya ve dosya gönderebilirsin.",
            "<@&1556402676793876680>: Sohbette sesli mesaj ve GIF gönderebilirsin.",
            "<@&1556402676835557416>: Anket oluşturabilirsin.",
            "<@&1556402677087473837>: Sunucuya 1 emoji ekletme hakkı kazanırsın (destek talebiyle).",
            "<@&1556402677133611050>: Sunucuya 1 çıkartma ekletme hakkı kazanırsın (destek talebiyle).",
            "<@&1556402677779398840>: Çekiliş ve etkinliklerde önceliklisin.",
            "<@&1556402678328725696>: Kendine özel bir alt başlık (thread) açabilirsin.",
            "<@&1556402678769262732>: Metin seviyesinin zirvesi, sunucunun en aktif yazanlarından birisin."
          ]
        },
        {
          "text": "**Aradaki seviyelerde** (35, 45, 55, 65, 75, 85, 95) sadece rolünü kazanırsın.\nSeviye rolleri kendinden önceki rollerin haklarını da içerir. Ödüllerini <#1538535372588326973> kanalından talep açarak isteyebilirsin."
        }
      ]
    },
    {
      "title": "Ses Seviye Rolleri",
      "sub": "Sesli kanallarda vakit geçirdikçe kazanacağın Ses Seviyesi rolleri ve bu rollerin sana sağladığı ayrıcalıkların tam listesi aşağıda yer alıyor.",
      "blocks": [
        {
          "items": [
            "<@&1556402677863424104>: Sesli kanallarda diğer üyelerden ayrı renkte görünürsün.",
            "<@&1556402678597156945>: Ses panelini (soundboard) kullanabilirsin.",
            "<@&1556402678081265754>: Sesli kanallarda yayın açıp ekran paylaşabilirsin.",
            "<@&1556402678299631767>: Etkinliklerde oyun başkanı olma şansı kazanırsın.",
            "<@&1556402677917683753>: Sesli kanallarda harici ses efektlerini kullanabilirsin.",
            "<@&1556403484922871939>: Günün sorusu ve sohbet bildirimi konularını seçebilirsin.",
            "<@&1556403485358956544>: Kazuki toplantılarına misafir olarak katılabilirsin.",
            "<@&1556403485593960578>: Özel odanda ekstra yönetim hakları kazanırsın.",
            "<@&1556403485539438754>: Sunucuya 1 ses efekti ekletme hakkı kazanırsın (destek talebiyle).",
            "<@&1556403485912731718>: Çekiliş ve etkinliklerde önceliklisin.",
            "<@&1556403485769994370>: Kendine özel bir rol açtırabilirsin (destek talebiyle).",
            "<@&1556403486499938325>: Ses yetkilisi adaylığı için değerlendirilirsin.",
            "<@&1556403486713974805>: Ses seviyesinin zirvesi, sunucunun en aktif seslilerinden birisin."
          ]
        },
        {
          "text": "**Aradaki seviyelerde** (35, 45, 55, 65, 75, 85, 95) sadece rolünü kazanırsın.\nSeviye rolleri kendinden önceki rollerin haklarını da içerir. Ödüllerini <#1538535372588326973> kanalından talep açarak isteyebilirsin."
        }
      ]
    },
    {
      "title": "Booster Ayrıcalıkları",
      "sub": "Sunucuyu takviye (boost) ederek bize destek olan üyelerin kazandığı ayrıcalıkları, bunları nasıl kullanabileceklerini ve sunucu etiketinin ne işe yaradığını anlatıyoruz.",
      "blocks": [
        {
          "heading": "Ayrıcalıklar",
          "items": [
            "Çekiliş ve etkinliklerde **önceliklisin**",
            "Özel rolünle diğer üyelerden **üstte, ayrı grupta** görünürsün",
            "**Kendine özel rol** oluşturursun (adı, rengi ve emojisi senin)",
            "Sunucuya **kendi emojini ve çıkartmanı** eklersin",
            "Sunucudaki **takma adını** değiştirirsin",
            "Dosya ve bağlantı gönderirsin",
            "Başka sunucuların emoji ve çıkartmalarını kullanırsın",
            "Sesli kanallarda ses panelini kullanırsın"
          ]
        },
        {
          "heading": "Nasıl kullanılır?",
          "text": "<#1538534459836473366> kanalındaki **Booster İşlemleri** panelinden butonlarla yaparsın. Takviye edenlere <#1538534176276619264> kanalında teşekkür edilir. Takviyen bitince isim ve rol avantajları geri alınır."
        },
        {
          "heading": "Sunucu etiketi",
          "text": "Kazuki etiketini profilinde gösterirsen <@&1554403288424644738> rolünü alırsın ve <#1538944779298275368> kanalında teşekkür edilir."
        }
      ]
    },
    {
      "title": "Sesli Kanallar ve Özel Oda",
      "blocks": [
        {
          "heading": "Özel oda",
          "text": "<#1538940395663130674> kanalına girince sana ait **🔊 adın** isminde bir oda açılır ve oraya taşınırsın. Oda boşalınca kendiliğinden silinir."
        },
        {
          "heading": "Oda sahibi olarak yapabileceklerin",
          "items": [
            "Odayı **kilitleyip açabilir**, **gizleyip gösterebilirsin**",
            "**İsmini** ve **kişi limitini** değiştirebilirsin",
            "İstemediğin birini **atabilir** ya da **yasaklayabilirsin**",
            "Odanın **sahipliğini** başkasına devredebilirsin"
          ]
        },
        {
          "heading": "Daha fazla bilgi",
          "items": [
            "<#1538940282895208518>: Özel oda rehberi",
            "<#1538941087195074702>: Kalıcı odalar",
            "<#1538940522469662721>: Sesli kanallar hakkında bilgi",
            "<#1538940642892324864>: Yayın izni"
          ]
        },
        {
          "note": "Sesli kanallarda da sunucu kuralları geçerlidir."
        }
      ],
      "sub": "Kendi özel sesli odanı nasıl açabileceğini, oda sahibi olarak neler yapabileceğini ve sesli kanallarla ilgili daha fazla bilgiyi nereden bulabileceğini öğrenebilirsin."
    },
    {
      "title": "Destek ve Ceza Sistemi",
      "blocks": [
        {
          "heading": "Sorunun varsa",
          "text": "<#1538535372588326973> kanalından **Talep Oluştur** butonuna bas. Senin için özel bir alt başlık açılır ve <@&1544337671340433569> ekibinden biri talebi üstlenir. Talep kapanınca yetkiliyi **1-5 yıldız** ile değerlendirirsin."
        },
        {
          "heading": "Ceza düzeni",
          "text": "Cezalar botun komutlarıyla verilir ve **siciline işlenir**:\n`Uyarı → Susturma / Jail → Yasaklama`"
        },
        {
          "heading": "Ceza puanları",
          "items": [
            "**Uyarı:** 5 puan",
            "**Susturma:** 10 puan",
            "**Jail:** 20 puan",
            "**Yasaklama:** 30 puan"
          ],
          "note": "Puanlar sicilinde birikir, tekrarlanan ihlallerde ceza ağırlaşır."
        },
        {
          "heading": "Jail nedir?",
          "text": "Rollerin geçici olarak alınır, sadece jail kanalını görürsün. Süre bitince geri verilir. Cezanın ne zaman biteceğini <#1538535566172229672> kanalındaki panelden görebilirsin."
        }
      ],
      "sub": "Bir sorunla karşılaştığında destek talebini nasıl açacağını, cezaların nasıl işlediğini, ceza puanlarının nasıl hesaplandığını ve jail'in ne anlama geldiğini anlatıyoruz."
    },
    {
      "title": "Partnerlik",
      "blocks": [
        {
          "heading": "Nasıl partner olunur?",
          "items": [
            "`1.` <#1538943458864005150> kanalında şartları oku.",
            "`2.` <#1538536775956566117> kanalına gel ve mesajına **partner** ya da **dm** yaz, bot sana otomatik teklif sunar.",
            "`3.` Teklif <@&1554237785416794202> yetkililerine düşer, onaylanırsa tanıtım metnin <#1538943593665007696> kanalında paylaşılır."
          ],
          "plain": true
        },
        {
          "heading": "Partner kanalları",
          "items": [
            "<#1538943369089126553>: Butona basıp <@&1555327703882928168> rolünü alırsın",
            "<#1555293036026658957>: Güvenilir partnerler",
            "<#1538943785344704562>: Dost partnerler"
          ]
        }
      ],
      "sub": "Sunucunla partner olmak istiyorsan izlemen gereken adımları, partner teklifinin nasıl onaylandığını ve partner kanallarına nasıl erişebileceğini buradan öğrenebilirsin."
    },
    {
      "title": "Kanallar",
      "sub": "Sunucudaki önemli kanalların hangi kategoride yer aldığını ve her birinin ne işe yaradığını kısaca özetledik; bir kanalı bulamazsan buraya bakabilirsin.",
      "blocks": [
        {
          "heading": "Başlangıç",
          "items": [
            "<#1538533642832318517>: Sunucu kuralları",
            "<#1538533720590516274>: Resmi duyurular",
            "<#1538533822940061706>: Sunucu hakkında bilgi (burası)",
            "<#1538533903130828851>: Güncel çekilişler",
            "<#1538535372588326973>: Destek talebi",
            "<#1538535566172229672>: Cezaların ve bitiş süreleri"
          ]
        },
        {
          "heading": "Sohbet",
          "items": [
            "<#1538536247138590801>: Genel sohbet",
            "<#1538536351119446127>: Bot komutları",
            "<#1538536448674766878>: Medya, link ve edit paylaşımı",
            "<#1538536951395913759>: Çizimlerini paylaşabileceğin kanal",
            "<#1538537038792630293>: Evcil hayvan paylaşımları",
            "<#1538536775956566117>: Partner sohbeti"
          ]
        },
        {
          "heading": "Oyun",
          "items": [
            "<#1538541309634285678>: Oyun kuralları",
            "<#1538541416387448944>: 5v5 etkinlik bilgilendirmesi",
            "<#1538542760506822656>: Oyun arkadaşı ara",
            "<#1538542814680453281>: Lobiler",
            "<#1538542919084941333>: Oyun klipleri",
            "<#1538543035346849913>: Oyun tartışmaları",
            "<#1538537529035202642> <#1538537611554201650>: OwO ve Mudae botları"
          ]
        },
        {
          "heading": "Etkinlik",
          "items": [
            "<#1538540261737758850>: Etkinlik kuralları",
            "<#1538538532958638160>: Etkinlik bilgilendirmesi",
            "<#1538538618468040714>: Etkinlik duyuruları",
            "<#1538538736189571133>: Etkinlik sohbeti",
            "<#1538540051028381696>: Etkinlik önerileri"
          ]
        },
        {
          "heading": "Topluluk ve ödüller",
          "items": [
            "<#1538534603902554182>: Seviye atlayanlar",
            "<#1538538279627132999>: Haftanın aktifleri",
            "<#1538538325521080391>: Haftanın en saygın üyesi",
            "<#1538944779298275368>: Sunucu etiketi takanlar",
            "<#1538534176276619264>: Takviye edenlere teşekkür",
            "<#1538534459836473366>: Booster işlemleri"
          ]
        }
      ]
    },
    {
      "title": "Yetkili Olmak İstersen",
      "blocks": [
        {
          "text": "<#1538544076910104636> kanalındaki **Başvur** butonuna bas ve formu doldur: adın ve yaşın, günlük aktifliğin, deneyimin ve neden katılmak istediğin sorulur."
        },
        {
          "heading": "Süreç",
          "items": [
            "`1.` Başvurun <@&1553398951816863844> ekibi tarafından incelenir, sonuç sana **DM** ile iletilir.",
            "`2.` Uygun bulunursan bir ses kanalında **görüşmeye** çağrılırsın.",
            "`3.` Görüşme olumluysa **oryantasyon** yapılır: kurallar, ceza sistemi, komutlar ve yetkili davranışı anlatılır.",
            "`4.` Görev alanını seçersin: **Sorun Çözücü, Sohbet Moderasyonu, Ses Moderasyonu, Karşılama, Etkinlik, İçerik & Tasarım.**"
          ],
          "plain": true
        },
        {
          "note": "Reddedilirsen 7 gün sonra tekrar başvurabilirsin."
        }
      ],
      "sub": "Yetkili ekibine katılmak istiyorsan başvurunun nasıl yapıldığını, görüşme ve oryantasyon sürecinin nasıl işlediğini ve hangi görev alanlarını seçebileceğini anlatıyoruz."
    },
    {
      "title": "Sık Sorulan Sorular",
      "blocks": [
        {
          "heading": "Neden sadece bir kanalı görüyorum?",
          "text": "Hesabın **7 günden yeniyse** güvenlik için kısıtlanırsın (<#1538944428063068181>), süre dolunca rol kendiliğinden kalkar. Jail'deysen ceza süren bitene kadar sadece <#1538944385041956924> görünür."
        },
        {
          "heading": "Yetkili bana haksız ceza verdiyse?",
          "text": "<#1538535372588326973> kanalından talep açıp durumu anlat. Yetkililere özelden ya da sohbette sorun çıkarma."
        },
        {
          "heading": "Yetki isteyebilir miyim?",
          "text": "Hayır, yetki istemek yasak. Ekibe katılmak için yetkili alım başvurusu yap."
        },
        {
          "heading": "Sunucuda yapılanlar kayıt altında mı?",
          "text": "Evet. Silinen ve düzenlenen mesajlar, ses kanalı hareketleri, giriş-çıkışlar ve yetkili işlemleri yönetim ekibi tarafından log olarak tutulur. Bu, kural ihlallerinde adil karar verilebilmesi içindir."
        }
      ],
      "sub": "Yeni gelen üyelerin en çok merak ettiği soruları ve cevaplarını burada topladık; aklına takılan bir şey olursa önce buraya göz atmanı öneririz."
    },
    {
      "title": "Yönetim Ekibinden Bir Mesaj",
      "blocks": [
        {
          "text": "Şu an bu mesajı okuyan sen, sunucuyu sevdiysen ve kaynaşmak istiyorsan sohbete sadece **\"merhaba\"** yazman yeterli. Seni rahatlatmak ve yönlendirmek bizim görevimiz. Bu sunucu kimsenin değil, üyelerin."
        },
        {
          "note": "Bir sorun yaşarsan hiçbir zorluk çekmeden <#1538535372588326973> kanalıyla bize ulaşabilirsin. Ekibe katılmak istersen <#1538544076910104636> kanalından başvurabilirsin. İyi eğlenceler!"
        }
      ],
      "sub": "Yönetim ekibi olarak seni sunucumuzda görmekten mutluluk duyuyoruz; yaşayabileceğin her türlü durumda sana nasıl yardımcı olabileceğimizi anlatıyoruz."
    }
  ],
};
