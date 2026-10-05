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
    .map(([level, perk]) => `<@&${seviye.roles.ses[level]}>: ${perk}`)
    .join('\n');
  return [
    '**Sesli kanallar**\n' +
      '**Genel odalar:** Sesli Kanallar kategorisindeki odalara istediğin zaman girip sohbet edebilirsin.\n' +
      `**Özel oda:** <#${c.createRoom}> kanalına girince sana ait bir oda açılır, nasıl yönetileceği <#${c.roomGuide}> kanalında anlatılıyor.\n` +
      `**Kalıcı odalar:** <#${c.permanentRooms}> kanalından kalıcı odalar hakkında bilgi alabilirsin.`,
    '**Ses seviyesi**\n' +
      '**XP:** Sesli kanalda geçen her dakika 6 XP kazandırır, mesaj seviyenden ayrı birikir.\n' +
      '**Roller:** Her 5 seviyede yeni bir ses rolü kazanırsın.\n' +
      '**Komutlar:** `/seviye`, `/profil` ve `/siralama` ile seviyeni ve sıralamanı görürsün.',
    `**Ses rolleri ve ayrıcalıkları**\n${perks}`,
    '**Yayın ve ekran paylaşımı**\n' +
      `**Yayın yetkisi:** <#${c.stream}> kanalındaki butonla yayın yetkisini alabilirsin.\n` +
      '**Ses seviyesi:** 15. seviye ses rolü de yayın açma hakkı verir.',
    '**Haftanın ses aktifleri**\n' +
      `Her pazartesi geçen haftanın en çok seste kalan üyesi <#${c.weekly}> kanalında ilan edilir ve <@&${config.roles.weeklyVoice}> rolünü alır.`,
    '**Sesli kanal kuralları**\n' +
      '**Rahatsızlık:** Troll dahil rahatsızlık veren her davranış yasaktır.\n' +
      '**Küfür:** Sesli kanallarda da küfür yasaktır.\n' +
      '**Bas ve bağırma:** Bas açıp bağırmak, mikrofonla ortamı domine etmek yasaktır.\n' +
      '**Ses paneli:** Müzik botlarını ve ses panelini troll amaçlı kullanmak yasaktır.\n' +
      '**Özel odalar:** Kuralları çiğneyen isimler kullanmak ve sürekli gir-çık yapmak yasaktır.\n' +
      '**Yayın:** Yayında gösterdiğin her şeyde de bu kurallar geçerlidir.',
    '**Sorun yaşarsan**\n' +
      `Sesli kanalda rahatsız edildiysen <#${config.channels.support}> kanalından destek talebi açabilir ya da <@&${config.roles.voiceStaff}> ekibine ulaşabilirsin.\n` +
      `-# Kuralların tam metni <#${config.channels.rules}> kanalında.`,
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
