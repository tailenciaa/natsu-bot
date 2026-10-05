// Yayın yetkisi sisteminin paneli: yetkinin ne olduğu, nasıl alınıp bırakılacağı, yayın kuralları ve butonlar
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { divider, page, text } = require('../../core/ui');
const { botName } = require('../../core/config');
const config = require('./config');

const IDS = {
  al: 'yayin:al',
  birak: 'yayin:birak',
};

const BLOCKS = [
  '**Yayın yetkisi nedir?**\n' +
    '**Ekran paylaşımı:** Sesli kanallarda ekranını diğer üyelerle paylaşabilirsin.\n' +
    '**Canlı yayın:** Oyun ya da uygulama yayını açıp izleyicilerle birlikte vakit geçirebilirsin.\n' +
    '**Kimler alabilir:** Sunucudaki herkes aşağıdaki butonla alabilir.',
  '**Nasıl kullanırım?**\n' +
    '**Alma:** Yayın Yetkisi Al butonuna basman yeterli, rolün anında verilir.\n' +
    '**Yayın açma:** Sesli kanala girdikten sonra Discord\'daki Ekran Paylaş seçeneğiyle yayını başlatırsın.\n' +
    '**Bırakma:** Yetkiyi istemezsen Yetkiyi Bırak butonuyla geri verebilirsin.',
  '**Yayın kuralları**\n' +
    '**Uygunsuz içerik:** +18, kan, şiddet ve rahatsız edici içerik yayınlamak yasaktır.\n' +
    '**Kişisel bilgi:** Ekranında kendi ya da başkalarının kişisel bilgilerini göstermemeye dikkat et.\n' +
    '**Sunucu kuralları:** Yayında da sunucu kuralları geçerlidir.\n' +
    '**Yetki alma:** Kurallara uymayanın yetkisi yetkililer tarafından alınır.',
];

function panel() {
  const container = page({
    title: `${botName} Yayın Yetkisi`,
    sub: 'Sesli kanallarda ekran paylaşımı ve canlı yayın açabilmek için ihtiyacın olan yetkiyi buradan alabilir, ne işe yaradığını ve yayın kurallarını aşağıda okuyabilirsin; istediğin zaman yine buradan bırakabilirsin.',
  });
  if (config.banner) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  for (const block of BLOCKS) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.al).setLabel('Yayın Yetkisi Al').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(IDS.birak).setLabel('Yetkiyi Bırak').setStyle(ButtonStyle.Secondary),
      ),
    );
}

module.exports = { IDS, panel };
