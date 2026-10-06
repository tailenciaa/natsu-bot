// Ortak mesaj parçaları (src/core/ui.js): alert, notice, panelMessage, page
module.exports = ({ mock, ui }) => {
  const staff = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const msg = (container, extra = {}) => ({ components: [container], ...extra });
  const eph = { flags: ui.EPHEMERAL_CV2, allowedMentions: { parse: [] } };

  return [
    {
      id: 'alert-hata',
      title: 'Hata bildirimi (ana cümle + çözüm ipucu)',
      where: 'Herhangi bir buton ya da komut hata verince, sadece kullanana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => msg(ui.alert('Bu talep artık mevcut değil.', 'Yeni bir talep için destek panelini kullanabilirsin.', 'danger'), eph),
    },
    {
      id: 'alert-onay',
      title: 'Onay bildirimi (yeşil)',
      where: 'İşlem başarıyla tamamlanınca, sadece kullanana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => msg(ui.alert('Ekibe hatırlatma gönderildi.', 'Bir yetkili kısa süre içinde talebini üstlenecek.', 'success'), eph),
    },
    {
      id: 'alert-bekliyor',
      title: 'Uyarı bildirimi (sarı)',
      where: 'İşlem sürerken ya da bekleme gerektirince, sadece kullanana',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => msg(ui.alert('Talebin şu an oluşturuluyor.', 'Birkaç saniye bekle.', 'warning'), eph),
    },
    {
      id: 'alert-notr',
      title: 'Nötr bildirim (renksiz, ipucusuz)',
      where: 'Kısa bilgi cevabı, komutu kullanana',
      visibility: 'public',
      kind: 'message',
      build: () => msg(ui.alert(`<@${staff.id}> bu destek talebine eklendi.`), { allowedMentions: { parse: [] } }),
    },
    {
      id: 'notice-iki-bolum',
      title: 'Bildirim: iki ayrı bölüm (aralarında çizgi)',
      where: 'Birbirinden bağımsız iki bilginin tek mesajda verildiği yerler',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => msg(ui.notice(['**Ayarlar kaydedildi.**\nDeğişiklikler hemen geçerli.', '**Sonraki adım**\nPanel mesajı yenilenecek.'], 'success'), eph),
    },
    {
      id: 'panel-bannerli',
      title: 'Panel (başlık + buton yanında, banner, alt not)',
      where: 'Kalıcı paneller, ilgili kanala bot açılırken gönderilir',
      visibility: 'panel',
      kind: 'message',
      build: () => ({
        components: [
          ui.panelMessage(
            {
              title: '## Kazuki Örnek Paneli',
              description: '**Bir sorunun mu var?** Sağdaki butondan başlayabilirsin, ekibimiz en kısa sürede ilgilenir.',
              buttonLabel: 'Talep Oluştur',
              footer: 'Gereksiz kullanım yaptırım uygulanmasına neden olabilir.',
            },
            'destek:olustur',
            'banner.png',
          ),
        ],
        files: [mock.pngFile('banner.png', { width: 960, height: 320 })],
      }),
    },
    {
      id: 'panel-bannersiz',
      title: 'Panel (banner olmadan)',
      where: 'Görseli olmayan paneller',
      visibility: 'panel',
      kind: 'message',
      build: () =>
        msg(
          ui.panelMessage(
            {
              title: '## Kazuki Örnek Paneli',
              description: '**Başvurmak için** butonu kullan; sonucu sana DM ile bildireceğiz.',
              buttonLabel: 'Başvur',
              footer: 'Başvurular en geç 3 gün içinde sonuçlanır.',
            },
            'destek:olustur',
          ),
        ),
    },
    {
      id: 'page-ornek',
      title: 'Standart sayfa (başlık, alt başlık, thumbnail, bloklar)',
      where: 'Bilgi kartları, duyurular, DM ve log mesajlarının ortak düzeni',
      visibility: 'public',
      kind: 'message',
      build: () =>
        msg(
          ui.page({
            title: 'Örnek Sayfa',
            sub: 'Bu mesajın ne olduğunu anlatan bir ya da iki cümle; bloklardaki bilgileri tekrar etmeden, sayfanın amacını ve nasıl kullanılacağını açıklar.',
            thumbnail: staff.displayAvatarURL(),
            blocks: [
              `**Üye Bilgileri**\n**Üye:** <@${staff.id}>\n**Katılım:** <t:${ui.unix(mock.ago(5 * mock.DAY))}:F>\nKayıtlar her gün güncellenir.`,
              `**Konu**\n${ui.quote('Sunucuya girerken bir hata alıyorum.')}`,
            ],
          }),
          { allowedMentions: { parse: [] } },
        ),
    },
    {
      id: 'page-renkli',
      title: 'Sayfa: durum rengiyle (kırmızı, thumbnail yok)',
      where: 'Kapatıldı / reddedildi türü sonuç mesajları',
      visibility: 'public',
      kind: 'message',
      build: () =>
        msg(
          ui.page({
            title: 'Talep Kapatıldı',
            sub: 'Bu destek talebi sonlandırıldı ve alt başlık kilitlendi; yeni bir sorunun olursa destek panelinden yeniden talep oluşturabilirsin.',
            accent: ui.colors.danger,
            blocks: [`**Kapatma Bilgisi**\nBu talep <@${staff.id}> tarafından kapatıldı.`],
          }),
        ),
    },
  ];
};
