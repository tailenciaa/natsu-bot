// Sesli bilgi paneli: odalar, ses seviyesi ve rollerin kazandırdıkları, yayın, haftanın aktifleri ve sesli kanal kuralları
const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { divider, page, text, chip } = require('../../core/ui');
const { botName } = require('../../core/config');
const config = require('./config');

const TITLE = `${botName} Sesli Kanallar`;

// Rol listesi: Discord'da 13 rolün etiketini yan yana yazmak pembe bir duvar oluşturuyor ve okunmuyor.
// Rolün kendisi üye listesinde zaten göründüğü için satırda yalnızca gereken seviye rozeti ve kazandırdığı yazılır.
const perkLine = (level) => `${chip(level)} · ${config.perks[level]}`;

function blocks() {
  const c = config.channels;
  const levels = Object.keys(config.perks).map(Number);
  const early = levels.filter((level) => level <= 25);
  const late = levels.filter((level) => level > 25);
  return [
    [
      '### Odalar',
      'Sesli Kanallar kategorisindeki odalara istediğin zaman girebilirsin.',
      `**Kendi odan:** <#${c.createRoom}> kanalına gir, sana ait bir oda açılır.`,
      `**Oda rehberi:** <#${c.roomGuide}> odanı yönetmeyi ve üye eklemeyi anlatır.`,
      `**Kalıcı odalar:** <#${c.permanentRooms}> başvuruyla açılan, sürekli duran odalardır.`,
    ].join('\n'),
    [
      '### Ses Seviyesi',
      'Sesli kanalda vakit geçirdikçe seviye atlarsın ve bu seviye mesaj seviyenden **ayrı birikir**.',
      '**Seviyeni gör:** `/seviye` ya da `/profil`',
    ].join('\n'),
    ['### Ses Rolleri', 'Her **5 seviyede** bir ses rolü kazanırsın; rollerin adı **N Ses Seviyesi**dir ve sayı o seviyeyi gösterir.', ...early.map(perkLine)].join('\n'),
    ['### İleri Seviye Rolleri', ...late.map(perkLine)].join('\n'),
    [
      '### Yayın',
      `Ekran paylaşımı ve canlı yayın için <#${c.stream}> kanalından **yayın yetkisi** alabilirsin.`,
      '**15. seviye** ses rolü de yayın hakkı verir.',
    ].join('\n'),
    [
      '### Haftanın Ses Aktifleri',
      `Her pazartesi geçen haftanın **en çok seste kalan üyesi** <#${c.weekly}> kanalında ilan edilir ve <@&${config.roles.weeklyVoice}> rolünü alır.`,
    ].join('\n'),
    [
      '### Sesli Kanal Kuralları',
      '1. **Troll** dahil rahatsızlık veren her davranış ve **küfür** yasaktır.',
      '2. **Bas açıp bağırmak** ve mikrofonla ortamı domine etmek yasaktır.',
      '3. Müzik botlarını ve ses panelini **troll amaçlı** kullanmak yasaktır.',
      '4. Özel odalarda **kuralları çiğneyen isimler** kullanmak ve **sürekli gir-çık** yapmak yasaktır.',
      '5. Yayında gösterdiğin her şeyde de **bu kurallar geçerlidir**.',
    ].join('\n'),
    [
      '### Sorun Yaşarsan',
      `<#${c.support}> kanalından destek talebi açabilir ya da <@&${config.roles.voiceStaff}> ekibine ulaşabilirsin.`,
    ].join('\n'),
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
