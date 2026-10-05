// Yayın yetkisi sisteminin paneli: butonlarla yayın yetkisi rolünü alma ve bırakma
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { divider, page } = require('../../core/ui');
const { botName } = require('../../core/config');

const IDS = {
  al: 'yayin:al',
  birak: 'yayin:birak',
};

function panel() {
  return page({
    title: `${botName} Yayın Yetkisi`,
    sub: 'Sesli kanallarda ekran paylaşımı ve canlı yayın açabilmek için aşağıdaki butona basman yeterli, yetkin anında sana verilir; istediğin zaman yine buradan bırakabilirsin.',
    blocks: [
      '**Yayın Yetkisi Nedir?**\nSesli kanallarda ekranını paylaşmanı ve oyun ya da uygulama yayını açmanı sağlar.',
      '**Yayın Kuralları**\n**Uygunsuz içerik:** +18, kan, şiddet ve rahatsız edici içerik yayınlamak yasaktır.\n' +
        '**Kişisel bilgi:** Ekranında kendi ya da başkalarının kişisel bilgilerini göstermemeye dikkat et.\n' +
        '**Kurallar:** Yayında da sunucu kuralları geçerlidir, uymayanın yetkisi alınır.',
    ],
  })
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.al).setLabel('Yayın Yetkisi Al').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(IDS.birak).setLabel('Yetkiyi Bırak').setStyle(ButtonStyle.Secondary),
      ),
    );
}

module.exports = { IDS, panel };
