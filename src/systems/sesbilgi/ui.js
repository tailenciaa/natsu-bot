// Sesli bilgi paneli: sesli kanallar, özel oda, ses seviyesi ve rolleri, yayın, haftanın aktifleri ve sesli kanal kuralları
const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { divider, page, text } = require('../../core/ui');
const { botName } = require('../../core/config');
const seviye = require('../seviye/config');
const config = require('./config');

const TITLE = `${botName} Sesli Kanallar`;

function blocks() {
  const c = config.channels;
  const perks = Object.entries(config.perks)
    .map(([level, perk]) => `<@&${seviye.roles.ses[level]}> - ${perk}`)
    .join('\n');
  return [
    '**Sesli Kanallar**\n' +
      `Sesli Kanallar kategorisindeki odalara istediğin zaman girebilirsin. Sana ait bir oda için <#${c.createRoom}> kanalına gir, odanı nasıl yöneteceğin <#${c.roomGuide}> kanalında anlatılıyor. Kalıcı odalar için <#${c.permanentRooms}> kanalına bakabilirsin.`,
    '**Ses Seviyesi**\n' +
      'Sesli kanalda geçen her dakika 6 XP kazandırır ve mesaj seviyenden ayrı birikir. Her 5 seviyede yeni bir ses rolü kazanırsın, seviyeni `/seviye` ve `/siralama` ile görebilirsin.',
    `**Ses Rolleri**\n${perks}`,
    '**Yayın**\n' +
      `Ekran paylaşımı ve canlı yayın için <#${c.stream}> kanalından yayın yetkisini alabilirsin, 15. seviye ses rolü de yayın hakkı verir.`,
    '**Haftanın Ses Aktifleri**\n' +
      `Her pazartesi geçen haftanın en çok seste kalan üyesi <#${c.weekly}> kanalında ilan edilir ve <@&${config.roles.weeklyVoice}> rolünü alır.`,
    '**Sesli Kanal Kuralları**\n' +
      'Troll dahil rahatsızlık veren her davranış ve küfür yasaktır.\n' +
      'Bas açıp bağırmak, mikrofonla ortamı domine etmek yasaktır.\n' +
      'Müzik botlarını ve ses panelini troll amaçlı kullanmak yasaktır.\n' +
      'Özel odalarda kuralları çiğneyen isimler kullanmak ve sürekli gir-çık yapmak yasaktır.\n' +
      'Yayında gösterdiğin her şeyde de bu kurallar geçerlidir.\n' +
      `-# Sorun yaşarsan <#${c.support}> kanalından destek talebi açabilir ya da <@&${config.roles.voiceStaff}> ekibine ulaşabilirsin.`,
  ];
}

function panel() {
  const container = page({
    title: TITLE,
    sub: 'Sesli kanalların nasıl kullanıldığını, ses seviyesinin ve rollerinin neler kazandırdığını, yayın açmayı ve sesli kanallardaki kuralları bu kanalda öğrenebilirsin, takıldığın yerde yetkililere ulaşabilirsin.',
  });
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  for (const block of blocks()) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container;
}

module.exports = { TITLE, panel, blocks };
