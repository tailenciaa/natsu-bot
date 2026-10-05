// Oryantasyon sistemi ayarları ve adım metinleri. ID ya da metin değiştirince botu yeniden başlatmak yeterli.
// Metinlerde {aday} başvuranı, {yetkili} oryantasyonu veren yetkiliyi etiketler.
//
// Adımlar buradaki sırayla gösterilir. "type" özel adımları belirtir:
//   areas    : başvuranın görev alanı seçtiği adım, seçim yapılmadan geçilemez
//   areaInfo : seçilen alanların "info" metinlerinin gösterildiği adım
//   final    : özet, seviye seçimi ve "Yetki Ver" butonu, her zaman en sonda olmalı
// skippable: true olan adımlarda "Biliyor, Atla" butonu çıkar; başvuran konuyu biliyorsa vakit kaybedilmez.
// Bir mesajdaki toplam yazı 4000 karakteri geçemez, adım metinlerini buna göre kısa tut.
const { staffCommandChannel } = require('../../core/config');

module.exports = {
  // Son adımdaki seviye menüsünde seçili gelen seviye (yetki/config.js içindeki seviyelerden)
  defaultLevelId: '1',

  // Oryantasyon sürerken başvuran ya da yetkili görüşme kanallarından ayrılırsa
  presence: {
    // Bağlantı kopması gibi kısa ayrılıklar sayılmaz: bu kadar saniye içinde dönen ayrılmış sayılmaz
    confirmSeconds: 15,
    // Başvuran ayrılınca bu kadar dakika içinde dönmezse oryantasyon iptal edilir
    applicantGraceMinutes: 5,
    // Başvuran bu kadar kez ayrılırsa oryantasyon hemen iptal edilir ve başvuru cezası alır
    maxApplicantLeaves: 3,
    // Başvuru cezası: kaç gün yeniden başvuru yapamaz
    penaltyDays: 7,
    // Yetkili ayrılınca bu kadar dakika içinde dönmezse başvurular kanalına "yetkili bekleniyor" mesajı gider,
    // başka bir yetkili oryantasyonu devralabilir
    staffGraceMinutes: 3,
  },

  // Başvuranın seçebileceği görev alanları. Yetki verilirken seçilen alanın rolü de verilir.
  // roleName rolün sunucudaki adıdır (bot açılınca bulunup bağlanır); roleId ise sabit ID. Lider ve yönetici rolleri buraya konmaz.
  areas: [
    {
      id: 'destek',
      label: 'Ticket',
      description: 'Destek taleplerini üstlenir ve üyelerin sorunlarını çözer.',
      roleName: 'Ticket Yetkilisi',
      info:
        'Talep kanalına düşen **Yeni Destek Talebi** mesajındaki **Talebi Üstlen** ile talebi alırsın.\n' +
        'Üyeye kısa sürede dönüş yap, kibar ve anlaşılır ol; teknik terimlerle boğma.\n' +
        'Çözemediğin bir konuda talebi bekletme, üst yetkiliye danış.\n' +
        'Sorun bitince **Talebi Kapat** ile doğru sebebi seçerek kapat.\n' +
        'Talep kapanınca üye sana puan verir ve siciline işlenir; haksız bulduğun puana itiraz edebilirsin.',
    },
    {
      id: 'sorun',
      label: 'Sorun Çözücü',
      description: 'Sorun çözme kanallarında üyelerin sorunlarına bakar.',
      roleName: 'Sorun Çözücü',
      info:
        'Sorun çözme ses kanallarında üyelerin sorunlarını dinle ve çözmeye çalış.\n' +
        'Üyeyle sakin ve anlayışlı konuş; çözemediğin konuyu bekletmeden Sorun Çözücü Lideri\'ne ilet.\n' +
        'Görüşme sonunda üye seni puanlayabilir, puanlar siciline işlenir.',
    },
    {
      id: 'oryantasyon',
      label: 'Oryantasyon',
      description: 'Yeni yetkililere oryantasyon verir ve işleyişi anlatır.',
      roleName: 'Oryantasyon Yetkilisi',
      info:
        'Onaylanan yeni yetkililere oryantasyon panelinden adım adım kuralları, davranışları ve komutları anlat.\n' +
        'Konuyu anlatmadan adımı geçme, başvuranın sorularını sabırla cevapla.\n' +
        'Oryantasyon bitince başvuran seni puanlayabilir, puanlar siciline işlenir.',
    },
    {
      id: 'sohbet',
      label: 'Sohbet Moderasyonu',
      description: 'Yazılı kanalları takip eder, kural ihlallerine müdahale eder.',
      roleName: 'Sohbet Sorumlusu',
      info:
        'Sohbet kanallarını düzenli takip et; spam, küfür, reklam ve rahatsız edici içeriği sil.\n' +
        'Hafif ihlalde önce uyar, tekrar ederse zaman aşımı uygula.\n' +
        'Tartışma büyüyorsa taraf tutmadan konuyu kapat, gerekirse kişileri ayrı ayrı uyar.\n' +
        'Ceza vermeden önce mutlaka ekran görüntüsü al.',
    },
    {
      id: 'ses',
      label: 'Ses Moderasyonu',
      description: 'Ses kanallarını gezer, sesli sohbetteki düzeni sağlar.',
      roleName: 'Ses Yetkilisi',
      info:
        'Ses kanallarını ara ara gez; mikrofon spamı, bağırma ve ses efekti kötüye kullanımını takip et.\n' +
        'Rahatsızlık veren üyeyi önce uyar, devam ederse sustur ya da kanaldan çıkar.\n' +
        'Sesli ihlallerde mümkünse kayıt ya da tanık bilgisi al.\n' +
        'Özel odalara izinsiz girme, sadece şikayet varsa müdahale et.',
    },
    {
      id: 'etkinlik',
      label: 'Etkinlik',
      description: 'Anime izleme partileri, oyun geceleri ve çekilişler düzenler.',
      roleName: 'Etkinlik Yetkilisi',
      info:
        'Anime izleme partileri, oyun geceleri, quizler ve çekilişler planla.\n' +
        'Etkinliği önceden duyur, saatini ve kurallarını net yaz.\n' +
        'Etkinlik sırasında düzeni sağla, sonunda katılımcılara teşekkür et.\n' +
        'Ödüllü etkinliklerde kazananı adil ve şeffaf şekilde belirle.',
    },
    {
      id: 'partner',
      label: 'Partner',
      description: 'Partner sunucularla iletişim kurar, ortaklıkları yürütür.',
      roleName: 'Partner Yetkilisi',
      info:
        'Partner taleplerini partner kanalından ve botun oto partner sisteminden takip et.\n' +
        'Gelen teklifleri onaylamadan önce karşı sunucunun düzenini, üye sayısını ve içeriğini kontrol et.\n' +
        'Güvenilir partner listesini güncel tut; sorun çıkaran partnerleri üst yetkiliye bildir.\n' +
        'Partner metinlerinde sunucumuzun kurallarına uymayan içerik varsa onaylama.',
    },
    {
      id: 'kayit',
      label: 'Karşılama',
      description: 'Yeni gelen üyeleri karşılar, sunucuya ısınmalarını sağlar.',
      roleId: '1555890045599223868',
      info:
        'Sunucuya yeni katılanları sıcak bir dille karşıla, kanalları ve kuralları kısaca tanıt.\n' +
        'Sahte ya da yeni açılmış şüpheli hesapları üst yetkiliye bildir.\n' +
        'Yeni üyelerin sorularını sabırla cevapla; ilk izlenim sunucunun yüzüdür.',
    },
  ],

  steps: [
    {
      id: 'giris',
      title: 'Oryantasyona Hoş Geldin',
      nextLabel: 'Başla',
      body:
        '**{aday}, başvurun onaylandı ve ekibe katılmana tek adım kaldı!**\n' +
        'Bu oryantasyonda {yetkili} sana adım adım yetkililiği anlatacak:\n' +
        'Sunucu kuralları ve nasıl uygulandığı\n' +
        'Bir yetkilinin nasıl davranması gerektiği\n' +
        'Ceza sistemi ve komutlar\n' +
        'Botun yetkili sistemleri\n' +
        'Görev alanını seçmen ve alanının detayları\n' +
        '-# Bildiğin bir konu olursa söyle, o adım atlanabilir. Aklına takılan her şeyi sormaktan çekinme.',
    },
    {
      id: 'kurallar',
      title: 'Sunucu Kuralları',
      skippable: true,
      body:
        'Yetkili olarak kuralları hem uygulayacak hem de herkesten önce sen uyacaksın.\n' +
        '**Temel kurallar**\n' +
        '**Saygısızlık:** Küfür, hakaret, aşağılama ve kışkırtma yasak.\n' +
        '**Ayrımcılık:** Irk, din, cinsiyet ve cinsel yönelim üzerinden ayrımcılık kesinlikle yasak.\n' +
        '**Spam:** Spam, flood, gereksiz etiket ve büyük harfle yazma yasak.\n' +
        '**Reklam:** Sunucu, sosyal medya ya da DM üzerinden reklam yasak.\n' +
        '**+18 içerik:** +18, kan ve vahşet içeren ya da rahatsız edici içerik yasak.\n' +
        '**Kişisel bilgi:** İsim, adres, fotoğraf gibi kişisel bilgi paylaşmak yasak.\n' +
        '**Spoiler:** Anime spoilerları sadece ilgili kanalda ve spoiler etiketiyle paylaşılır.\n' +
        '**Uygularken**\n' +
        'Kuralların tam metni kurallar kanalında, oradaki her maddeyi bilmen gerekiyor.\n' +
        'Kuralda açıkça yazmayan durumlarda sağduyunu kullan ve üst yetkiliye danış.',
    },
    {
      id: 'davranis',
      title: 'Bir Yetkili Nasıl Davranmalı',
      skippable: true,
      body:
        '**Tarafsız ol:** Arkadaşın da olsa kural herkese aynı uygulanır.\n' +
        '**Sakin kal:** Üyeyle tartışmaya girme; gerginleşirsen konuyu başka bir yetkiliye devret.\n' +
        '**Önce uyar:** Hafif ihlallerde önce uyarı, tekrar ederse ceza.\n' +
        '**Kanıt al:** Ceza vermeden önce ekran görüntüsü al, gerektiğinde açıklayabilmelisin.\n' +
        '**Gizlilik:** Yetkili kanallarında konuşulanlar, şikayetler ve kişisel bilgiler dışarı taşınmaz.\n' +
        '**Yetkini kötüye kullanma:** Kişisel sorunlar için ceza vermek, izinsiz rol vermek ya da almak yasak.\n' +
        '**Hiyerarşiye uy:** Başka bir yetkilinin verdiği cezayı kendi başına kaldırma, önce onunla konuş.\n' +
        '**Aktif ol:** Bir süre ortada olamayacaksan üst yetkiliye haber ver.\n' +
        '**Örnek ol:** Sohbette üslubun sunucunun yüzüdür; kurallara en çok senin uyman beklenir.',
    },
    {
      id: 'ceza',
      title: 'Ceza Sistemi ve Komutlar',
      skippable: true,
      body:
        '**Ceza basamakları** (ihlalin ağırlığına göre)\n' +
        '1. Uyarı\n' +
        '2. Susturma: Discord zaman aşımı, en fazla 28 gün\n' +
        '3. Jail: roller alınır, jail rolü verilir\n' +
        '4. Yasaklama: ağır ya da sürekli tekrarlanan ihlaller\n' +
        '**Nasıl uygulanır**\n' +
        'Discord\'un kendi "Zaman Aşımı"/"At"/"Yasakla" menüleri değil, **botun kendi komutları** kullanılır: `/uyari`, `/mute`, `/jail`, `/ban`.\n' +
        'Kaldırma: `/unmute`, `/unjail`, `/unban` ya da numarayla `/ceza-kaldir`; yanlış verilen ceza `/ceza-sil` ile sicilden silinir.\n' +
        'Bir kullanıcının sicilini ve aktif cezalarını `/sicil` ile görebilirsin, cezayı da oradaki **Ceza Ver** butonuyla verebilirsin.\n' +
        `Bu komutlar sadece <#${staffCommandChannel}> kanalında çalışır.\n` +
        '**Dikkat**\n' +
        'Her cezada sebebi açık yaz; "kural ihlali" gibi belirsiz sebepler yazma.\n' +
        'Jail ve yasaklamadan önce mümkünse üst yetkiliye danış.\n' +
        'Seviyenin izin vermediği cezayı başka yoldan uygulamaya çalışma.\n' +
        'Kendi verdiğin cezanın itirazına sen bakmazsın.',
    },
    {
      id: 'sistemler',
      title: 'Botun Yetkili Sistemleri',
      skippable: true,
      body:
        '**Destek Talepleri**\n' +
        'Üye panelden talep açınca talep kanalına bildirim düşer; **Talebi Üstlen** ile talep senin olur.\n' +
        'İş bitince **Talebi Kapat** ile sebep seçerek kapatırsın.\n' +
        '**Değerlendirme**\n' +
        'Talep kapanınca üye sana 1-5 yıldız verir, değerlendirme kanalına düşer ve siciline işlenir.\n' +
        '**Yorum Ekle** ile değerlendirmeye yanıt verebilir, haksız bulursan **İtiraz Et** ile liderlere iletebilirsin.\n' +
        '**Sicil**\n' +
        '`/sicil` ile kendi puanını, taleplerini ve geçmişini görebilirsin.\n' +
        '**Yardım**\n' +
        '`/yardim` ile botun tüm komutlarını ve kimlerin kullanabileceğini görebilirsin.',
    },
    {
      id: 'alan',
      title: 'Görev Alanı Seçimi',
      type: 'areas',
      body:
        '**{aday}, ekipte hangi alanlarda görev almak istediğini aşağıdaki menüden seç.**\n' +
        'Birden fazla alan seçebilirsin. Seçtiğin alanlar bir sonraki adımda {yetkili} tarafından anlatılacak ' +
        've yetki verilirken bu alanların rolleri de verilecek.',
    },
    {
      id: 'alan-bilgi',
      title: 'Seçilen Alanların Detayları',
      type: 'areaInfo',
      skippable: true,
      body: '{yetkili}, seçilen alanlarda neler yapılacağını anlatacak:',
    },
    {
      id: 'son',
      title: 'Oryantasyon Tamamlanıyor',
      type: 'final',
      body:
        '**Tüm konular tamamlandı, {aday} ekibe katılmaya hazır!**\n' +
        'Başlayacağı yetkiyi ve verilecek rolleri aşağıdan kontrol edebilirsin.',
    },
  ],
};
