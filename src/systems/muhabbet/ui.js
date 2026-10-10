// Muhabbet odası sisteminin mesajları: sıra paneli, sıraya girme ve eşleşme kartları, odanın kendi yazı
// kanalındaki kontrol paneli, oda kapandığında üyelere giden bildirim ve yetkilinin gördüğü oda listesi.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, pad, panel, page, rows, chip, pills, quote, stamp, divider, text, unix } = require('../../core/ui');
const config = require('./config');

const IDS = {
  start: 'muhabbet-baslat', // paneldeki sıraya girme butonu
  leave: 'muhabbet-ayril', // paneldeki sıradan çıkma butonu
  end: 'muhabbet-bitir', // odanın yazı kanalındaki panelde
};

const MIN = 60 * 1000;

const pair = (room) => room.users.map((id) => `<@${id}>`).join(' ve ');
const roomNo = (room) => chip(`#${pad(room.no)}`);
const minutes = (ms) => `${Math.max(1, Math.round(ms / MIN))} dakika`;
const waited = (joinedAt) => `${Math.max(0, Math.round((Date.now() - joinedAt) / MIN))} dk`;
const channelPair = (room) => `<#${room.voiceChannelId}> · <#${room.textChannelId}>`;

// Sıra paneli: nasıl çalıştığı, kurallar ve bekleme süreleri yazılır; iki buton da hep görünürdür
function queuePanel() {
  const container = panel({
    title: 'Muhabbet Odası',
    sub: 'Tanıdığın ya da tanımadığın bir üyeyle baş başa konuşmak için sıraya gir; sırada iki kişi olunca ikiniz için özel bir ses ve yazı odası açılır, muhabbet bitince oda kapanır.',
  });

  const waitings = rows([
    ['Sırada Bekleme Süresi', chip(`${config.queueTimeoutMinutes} dakika`)],
    ['Yeniden Sıraya Giriş', chip(`${config.requeueCooldownSeconds} saniye`)],
    ['Boş Oda Kapanması', chip(`${config.idleCloseMinutes} dakika sonra`)],
    ['En Uzun Oda Süresi', chip(`${config.maxRoomMinutes} dakika`)],
  ]);

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          '**Nasıl Çalışır**',
          '1. **Muhabbet Başlat** butonuyla sıraya gir.',
          '2. Sırada iki kişi olunca ikiniz için özel bir oda açılır, sana DM üzerinden haber verilir.',
          '3. Ses kanalına gir; odanın yazı kanalı ikinizin konuşması için açık durur.',
          '4. Muhabbet bittiğinde **Muhabbeti Bitir** butonuna bas.',
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Kurallar**\n${config.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Beklemeler**\n${waitings}`))
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.start).setLabel('Muhabbet Başlat').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(IDS.leave).setLabel('Sıradan Ayrıl').setStyle(ButtonStyle.Secondary),
      ),
    );
  return container;
}

// Sıraya giren üyeye (ve eşleşmeyen durumda kalanlara) giden, sadece kullanana görünür kart
function queuedCard(position, waiting) {
  return page({
    title: 'Sıraya Girdin',
    sub: 'Sırada iki kişi olunca eşleşme kendiliğinden yapılır; odanın kanalları açılır ve sana DM olarak iletilir. Sıradan çıkmak için paneldeki butonu kullanabilirsin.',
    accent: colors.primary,
    blocks: [
      rows([
        ['Sıran', chip(`${position}.`)],
        ['Sırada Bekleyen', chip(`${waiting} kişi`)],
        ['Eşleşme Sırası', chip('en eski iki üye')],
      ]),
      'Bu paneli tekrar kullanırsan sıradaki yerini yeniden öğrenirsin, sırada kaldığın süre uzamaz.',
      stamp(),
    ],
  });
}

// Eşleşen iki üyeye giden kart: odanın kanalları ve ne yapılacağı
function matchedCard(room) {
  return page({
    title: 'Muhabbet Eşleşti',
    sub: 'Sırada seni bekleyen bir üye vardı; ikiniz için özel bir ses ve yazı odası açıldı. Kanallar yalnızca ikinize görünür, sunucudaki diğer üyeler bu odaları görmez.',
    accent: colors.success,
    blocks: [
      rows([
        ['Oda', roomNo(room)],
        ['Muhabbetin', pair(room)],
        ['Ses Kanalı', `<#${room.voiceChannelId}>`],
        ['Yazı Kanalı', `<#${room.textChannelId}>`],
      ]),
      'Ses kanalına girdiğinde muhabbet başlamış olur. Oda bittiğinde yazı kanalındaki panelinden **Muhabbeti Bitir** butonunu kullan.',
      stamp(),
    ],
  });
}

// Odanın yazı kanalındaki panel: iki üye de kullanabilir, oda burada kapanır
function roomPanel(room) {
  const container = page({
    title: 'Muhabbet Odası',
    sub: 'Bu oda iki kişinin muhabbeti için açıldı; kanallar yalnızca odadaki üyeleri gösterir. Muhabbet bittiğinde bu panelden odayı kapatabilirsin, ses kanalında kimse kalmadığında oda kendiliğinden kapanır.',
    blocks: [
      rows([
        ['Oda', roomNo(room)],
        ['Üyeler', pair(room)],
        ['Kişi Limiti', chip(`${config.userLimit} kişi`)],
        ['Kanallar', channelPair(room)],
        ['Açılış', `<t:${unix(room.createdAt)}:F>`],
      ]),
      `**Konu**\n${quote(room.topic)}`,
    ],
  });
  container
    .addSeparatorComponents(divider())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(IDS.end).setLabel('Muhabbeti Bitir').setStyle(ButtonStyle.Danger)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(stamp(room.createdAt)));
  return container;
}

// Oda kapanınca her iki üyeye giden kısa bildirim
function endedCard(room, reason) {
  return panel({
    title: 'Muhabbetin Bitti',
    sub: 'Aşağıdaki oda kapatıldı ve kanalları silindi; yeni bir muhabbet için sıra panelinden tekrar sıraya girebilirsin.',
    blocks: [
      rows([
        ['Oda', roomNo(room)],
        ['Muhabbetin', pair(room)],
        ['Süre', chip(minutes(Date.now() - room.createdAt))],
        ['Sebep', reason],
      ]),
    ],
  });
}

// Yetkilinin /muhabbet liste kartı: açık odalar ve sırada bekleyenler
function roomList(rooms, queue) {
  const sorted = [...rooms].sort((a, b) => a.no - b.no);
  const roomBlocks = sorted.length
    ? sorted.map((room) =>
        [
          `**${roomNo(room)}**`,
          pair(room),
          `${channelPair(room)}\n${pills([['Süre', waited(room.createdAt) * 1 || 1], ['Konu', room.topic]])}`,
        ].join('\n'),
      )
    : ['-# Henüz açık muhabbet odası yok.'];

  const queueBlock = queue.length
    ? [
        `**Sırada Bekleyen** ${chip(`${queue.length} kişi`)} ${pills([['En Fazla', `${config.maxQueue} kişi`]])}`,
        ...queue.slice(0, 20).map((entry, i) => `${i + 1}. <@${entry.userId}> · ${chip(`${waited(entry.joinedAt)} dk`)} bekliyor`),
        queue.length > 20 ? `-# Ve ${queue.length - 20} kişi daha sırada.` : null,
      ].join('\n')
    : `**Sırada Bekleyen** ${chip('0 kişi')}\n-# Sırada bekleyen üye yok.`;

  return page({
    title: 'Muhabbet Odaları',
    sub: 'Şu an muhabbet eden odalar, kanalları ve sırada bekleyen üyeler burada durur; bir odayı kapatmak ya da sırayı tamamen boşaltmak için aynı komuttaki diğer adımları kullanabilirsin.',
    blocks: [...roomBlocks, divider ? null : null, queueBlock],
  }).addTextDisplayComponents(text(stamp()));
}

module.exports = { IDS, queuePanel, queuedCard, matchedCard, roomPanel, endedCard, roomList };
