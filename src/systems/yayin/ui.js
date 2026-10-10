// Yayın yetkisi sisteminin paneli: yetkinin ne olduğu, nasıl alınıp bırakılacağı, yayın kuralları ve butonlar
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { divider, page, text, receipt, bannerGallery } = require('../../core/ui');
const { botName } = require('../../core/config');
const config = require('./config');

const IDS = {
  al: 'yayin:al',
  birak: 'yayin:birak',
};

const RULES =
  '**Yayın Kuralları**\n' +
  '**+18, kan, şiddet** ve rahatsız edici içerik yayınlamak yasaktır.\n' +
  'Ekranında kendi ya da başkalarının **kişisel bilgilerini** göstermemeye dikkat et.\n' +
  'Yayında da **sunucu kuralları** geçerlidir, uymayanın yetkisi alınır.';

function panel() {
  const container = page({
    title: `${botName} Yayın Yetkisi`,
    sub: 'Sesli kanallarda ekran paylaşımı ve canlı yayın açmak için **Yayın Yetkisi Al** butonuna bas, istediğin zaman **Yetkiyi Bırak** ile geri bırak. Yayında uyman gereken kurallar da bu mesajda yer alıyor.',
  });
  if (config.banner) container.addMediaGalleryComponents(bannerGallery(config.banner));
  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(RULES))
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.al).setLabel('Yayın Yetkisi Al').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(IDS.birak).setLabel('Yetkiyi Bırak').setStyle(ButtonStyle.Secondary),
      ),
    );
}

// Butona basınca çıkan işlem kartı: sonuç kanalda herkese açık yazılır, bu yüzden üye 3. tekil şahısla ve
// @etiketle anılır.
function granted({ user }) {
  return receipt({
    title: 'Yayın Yetkisi Verildi',
    sub: `<@${user.id}> panelden **Yetki Al** düğmesiyle yayın yetkisini aldı. Bu yetkiyle sesli kanallarda **ekran paylaşımı** ve **canlı yayın** açabilir.`,
    user,
    pairs: [['Rol', `<@&${config.role}>`]],
  });
}

function released({ user }) {
  return receipt({
    title: 'Yayın Yetkisi Bırakıldı',
    sub: `<@${user.id}> yayın yetkisinden çıktı; istediği zaman panelden yeniden alabilir. Yayında **sunucu kuralları** geçerlidir.`,
    user,
    pairs: [['Rol', `<@&${config.role}>`]],
  });
}

module.exports = { IDS, panel, granted, released };
