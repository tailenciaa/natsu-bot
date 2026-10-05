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
  '**Yayın Kuralları**\n' +
    '+18, kan, şiddet ve rahatsız edici içerik yayınlamak yasaktır.\n' +
    'Ekranında kendi ya da başkalarının kişisel bilgilerini göstermemeye dikkat et.\n' +
    'Yayında da sunucu kuralları geçerlidir, uymayanın yetkisi alınır.',
];

function panel() {
  const container = page({
    title: `${botName} Yayın Yetkisi`,
    sub: 'Sesli kanallarda ekran paylaşımı ve canlı yayın açabilmek için ihtiyacın olan yetkiyi aşağıdaki butonla alabilir, istediğin zaman yine buradan bırakabilirsin; yayın yaparken uyman gereken kurallar da aşağıda yer alıyor.',
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
