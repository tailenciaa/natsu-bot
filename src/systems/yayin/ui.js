// Yayın yetkisi sisteminin paneli: yetkinin nasıl alınıp bırakıldığı, yayın kuralları ve düğmeler
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { divider, page, text, receipt, bannerGallery } = require('../../core/ui');
const { botName } = require('../../core/config');
const kurallarConfig = require('../kurallar/config');
const seviyeConfig = require('../seviye/config');
const config = require('./config');

const IDS = {
  al: 'yayin:al',
  birak: 'yayin:birak',
};

function panel() {
  const container = page({
    title: `${botName} Yayın Yetkisi`,
    sub: 'Sesli kanallarda ekran paylaşımı ve canlı yayın açmanı sağlayan roldür. Yetkiyi paneldeki düğmelerle kendin alıp kendin bırakırsın; bir yetkiliden izin istemen gerekmez.',
  });
  if (config.banner) container.addMediaGalleryComponents(bannerGallery(config.banner));

  return container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          '### Nasıl İşler?',
          `1. **Yayın Yetkisi Al** düğmesine bas, <@&${config.role}> rolü anında sana verilir.`,
          '2. **Yetkiyi Bırak** ile rolden kendin çıkarsın, istediğin zaman geri alabilirsin.',
          `3. Ses seviyen **15** ise yayın hakkı <@&${seviyeConfig.roles.ses[15]}> rolüyle birlikte gelir.`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          '### Yayın Kuralları',
          '1. **+18, kan, şiddet** ve rahatsız edici içerik yayınlamak **yasaktır**.',
          '2. Ekranında senin ya da başkalarının **kişisel bilgileri** görünmesin.',
          `3. Yayında da <#${kurallarConfig.channel}> kuralları geçerlidir; uymayanın yetkisi geri alınır.`,
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.al).setLabel('Yayın Yetkisi Al').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(IDS.birak).setLabel('Yetkiyi Bırak').setStyle(ButtonStyle.Danger),
      ),
    );
}

// Butona basınca çıkan işlem kartı: sonuç kanalda herkese açık yazılır, bu yüzden üye 3. tekil şahısla ve
// @etiketle anılır.
function granted({ user }) {
  return receipt({
    title: 'Yayın Yetkisi Verildi',
    sub: `<@${user.id}> panelden yayın yetkisini aldı; artık sesli kanallarda **ekran paylaşımı** ve **canlı yayın** açabilir.`,
    user,
    pairs: [['Rol', `<@&${config.role}>`]],
  });
}

function released({ user }) {
  return receipt({
    title: 'Yayın Yetkisi Bırakıldı',
    sub: `<@${user.id}> yayın yetkisinden çıktı; istediği zaman panelden geri alabilir.`,
    user,
    // Yetki bırakmak bir ödül değil; primary nötr rengi çekirdekte gösterilmez, kart renksiz kalır
    accent: 'primary',
    pairs: [['Rol', `<@&${config.role}>`]],
  });
}

module.exports = { IDS, panel, granted, released };
