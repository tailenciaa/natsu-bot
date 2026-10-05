// Sesli bilgi paneli: sesli kanallar, özel oda, ses seviyesi ve rolleri, yayın, haftanın aktifleri ve sesli kanal kuralları
const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { divider, page, text } = require('../../core/ui');
const { botName } = require('../../core/config');
const seviye = require('../seviye/config');
const config = require('./config');

const TITLE = `${botName} Sesli Kanallar`;

function blocks() {
  const c = config.channels;
  // Ses rolleri iki blokta: ilk yarısı (5-25) ve sonrası (30-100)
  const perkLines = Object.entries(config.perks).map(([level, perk]) => ({ level: Number(level), line: `<@&${seviye.roles.ses[level]}>: ${perk}` }));
  const early = perkLines.filter((p) => p.level <= 25).map((p) => p.line).join('\n');
  const late = perkLines.filter((p) => p.level > 25).map((p) => p.line).join('\n');
  return [
    '**Sesli Kanallar**\n' +
      `Sesli Kanallar kategorisindeki odalara istediğin zaman girebilirsin. Sana ait bir oda için <#${c.createRoom}> kanalına gir, odanı nasıl yöneteceğin <#${c.roomGuide}> kanalında anlatılıyor. Kalıcı odalar için <#${c.permanentRooms}> kanalına bakabilirsin.`,
    '**Ses Seviyesi**\n' +
      `Sesli kanalda geçen her dakika ${seviye.voice.xpPerMinute} XP kazandırır ve mesaj seviyenden ayrı birikir. Her 5 seviyede yeni bir ses rolü kazanırsın, seviyeni \`/seviye\` ya da \`/profil\` ile görebilirsin.`,
    `**Ses Rolleri**\n${early}`,
    `**Üst Seviye Ses Rolleri**\n${late}\n-# Aradaki seviyelerde (35, 45, 55...) sadece rolünü kazanırsın.`,
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
    sub: 'Sesli kanalların nasıl kullanıldığını, ses seviyesinin ve rollerinin neler kazandırdığını, yayın açmayı ve sesli kanallardaki kuralları bu kanalda öğrenebilirsin.',
  });
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.banner)));
  for (const block of blocks()) container.addSeparatorComponents(divider()).addTextDisplayComponents(text(block));
  return container;
}

module.exports = { TITLE, panel };
