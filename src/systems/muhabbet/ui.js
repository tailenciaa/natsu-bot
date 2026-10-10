// Muhabbet odası sisteminin mesajları: sıra paneli, sıraya girme ve eşleşme kartları, odanın kendi yazı
// kanalındaki kontrol paneli, oda kapandığında üyelere giden bildirim ve yetkilinin gördüğü oda listesi.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { colors, pad, panel, page, receipt, rows, chip, pills, stamp, divider, text, unix } = require('../../core/ui');
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
const waited = (ms) => `${Math.max(0, Math.round((Date.now() - ms) / MIN))} dakika`;
const channelPair = (room) => `<#${room.voiceChannelId}> · <#${room.textChannelId}>`;
// Saniye cinsinden beklemeleri kartta okunur hale çevirir: 180 -> 3 dakika
const waitLabel = (seconds) => chip(seconds >= 60 ? `${Math.round(seconds / 60)} dakika` : `${seconds} saniye`);

// Sıra paneli: nasıl çalıştığı, kurallar ve bekleme süreleri yazılır; iki buton da hep görünürdür
function queuePanel() {
  const container = panel({
    title: 'Muhabbet Odası',
    sub: 'Tanıdığın ya da tanımadığın bir üyeyle baş başa konuşmak için sıraya gir; sırada iki kişi olunca ikiniz için özel bir ses ve yazı odası açılır, muhabbet bitince oda kapanır.',
  });

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        [
          '**Nasıl Çalışır**',
          '1. **Muhabbet Başlat** butonuyla sıraya gir.',
          '2. Sırada iki kişi olunca eşleşme kendiliğinden yapılır, odanın kanalları açılır ve sana DM olarak iletilir.',
          '3. Ses kanalına gir; yazı kanalı ikinizin konuşması için açık durur.',
          '4. Muhabbet bittiğinde **Muhabbeti Bitir** butonuna bas.',
        ].join('\n'),
      ),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Kurallar**\n${config.rules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(
      text(
        `**Beklemeler**\n${rows([
          ['Sırada Bekleme Süresi', chip(`${config.queueTimeoutMinutes} dakika`)],
          ['Yeniden Sıraya Giriş', waitLabel(config.requeueCooldownSeconds)],
          ['Boş Oda Kapanması', chip(`${config.idleCloseMinutes} dakika sonra`)],
          ['En Uzun Oda Süresi', chip(`${config.maxRoomMinutes} dakika`)],
        ])}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(IDS.start).setLabel('Muhabbet Başlat').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(IDS.leave).setLabel('Sıradan Ayrıl').setStyle(ButtonStyle.Secondary),
      ),
    );
  return container;
}

// Sıraya girme kartı: kart kanala düşer, üye 3. tekil şahısla ve @etiketle anılır.
// again: üye zaten sıradayken tekrar bastığında başlık ve açıklama buna göre değişir
function queuedCard({ user, position, waiting, again }) {
  return receipt({
    title: again ? 'Sırada Bekliyor' : 'Muhabbet Sırasına Girdi',
    sub: again
      ? `<@${user.id}> zaten sırada; butona tekrar bastığı için sırasını yeniden gördü, beklediği süre baştan başlamadı.`
      : `<@${user.id}> muhabbet sırasına girdi. Sırada iki kişi olunca eşleşme kendiliğinden yapılır, odanın kanalları açılır ve DM üzerinden iletilir.`,
    user,
    accent: 'primary',
    pairs: [
      ['Sırası', chip(`${position}.`)],
      ['Sırada Bekleyen', chip(`${waiting} kişi`)],
      ['Sıra İşleyişi', chip('en eski iki üye eşleşir')],
    ],
    note: again
      ? 'Sıradan çıkmak için paneldeki **Sıradan Ayrıl** düğmesini kullanabilir.'
      : 'Eşleşme sıra bekleme süresi dolmadan olursa oda açılır; süresi dolarsa sıra düşer ve üyeye DM yazılır.',
  });
}

// Sıradan çıkma kartı: sıra üyenin kendi işlemi ama sonuç kanalda herkese açık görünür
function leftQueue({ user }) {
  return receipt({
    title: 'Sıradan Çıktı',
    sub: `<@${user.id}> muhabbet sırasından çıkarıldı; istediği zaman paneldeki **Muhabbet Başlat** düğmesiyle yeniden sıraya girebilir.`,
    user,
    accent: 'primary',
  });
}

// Eşleşen üyelere giden kart: kanala düşer, üyeler 3. tekil şahısla anılır; kanalların kendisi yalnızca ikisine görünür
function matchedCard(room) {
  return page({
    title: 'Muhabbet Eşleşti',
    sub: `${pair(room)} eşleşti; ikisi için özel bir ses ve yazı odası açıldı. Kanallar yalnızca odadaki üyeler tarafından görülür.`,
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

// Odanın yazı kanalındaki panel: iki üye de kullanabilir, oda buradan kapanır
function roomPanel(room) {
  const container = page({
    title: 'Muhabbet Odası',
    sub: 'Bu oda iki kişinin muhabbeti için açıldı ve kanallar yalnızca odadaki üyeleri gösterir. Muhabbet bittiğinde odayı buradan kapatırsın; ses kanalında kimse kalmadığında oda kendiliğinden kapanır.',
    blocks: [
      rows([
        ['Oda', roomNo(room)],
        ['Üyeler', pair(room)],
        ['Kişi Limiti', chip(`${config.userLimit} kişi`)],
        ['Kanallar', channelPair(room)],
      ]),
      'Kapattığında iki kanal silinir, yazışmalar da kanallarla birlikte kalkar.',
      stamp(room.createdAt),
    ],
  });
  return container.addActionRowComponents(
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(IDS.end).setLabel('Muhabbeti Bitir').setStyle(ButtonStyle.Danger)),
  );
}

// Oda kapanınca her iki üyeye giden bildirim: hangi oda olduğu, ne kadar sürdüğü ve neden kapandığı yazar
function endedCard(room, reason) {
  return page({
    title: 'Muhabbetin Bitti',
    sub: 'Muhabbet odan kapatıldı ve iki kanalı silindi; yazışmalar odayla birlikte kalktı. Yeni bir muhabbet için sıra panelinden tekrar sıraya girebilirsin.',
    accent: colors.success,
    blocks: [
      rows([
        ['Oda', roomNo(room)],
        ['Muhabbetin', pair(room)],
        ['Süre', chip(minutes(Date.now() - room.createdAt))],
        ['Kapanma Sebebi', reason],
        ['Tekrar Sıraya Giriş', `<t:${unix(Date.now() + config.requeueCooldownSeconds * 1000)}:R>`],
      ]),
    ],
  });
}

// Yetkilinin /muhabbet liste kartı: açık odalar, kanalları ve sırada bekleyenlerin sırası
function roomList(rooms, queue) {
  const sorted = [...rooms].sort((a, b) => a.no - b.no).slice(0, 15);
  const roomBlock = sorted.length
    ? [
        ...sorted.map((room) =>
          [
            `**#${pad(room.no)}** ${pills([['Süre', waited(room.createdAt)], ['Limit', `${config.userLimit} kişi`]])}`,
            pair(room),
            channelPair(room),
          ].join('\n'),
        ),
        rooms.length > 15 ? `Ve ${rooms.length - 15} oda daha açık.` : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : '-# Henüz açık muhabbet odası yok.';

  const queueLines = queue.slice(0, 20).map((entry, i) => `${i + 1}. <@${entry.userId}> · ${chip(waited(entry.joinedAt))} bekliyor`);
  const queueBlock = queue.length
    ? [
        `**Sırada Bekleyen** ${chip(`${queue.length} / ${config.maxQueue} kişi`)}`,
        ...queueLines,
        queue.length > 20 ? `Ve ${queue.length - 20} kişi daha sırada bekliyor.` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : `**Sırada Bekleyen** ${chip(`0 / ${config.maxQueue} kişi`)}\n-# Sırada bekleyen üye yok.`;

  return page({
    title: 'Muhabbet Odaları',
    sub: 'Şu an muhabbet eden odalar, kanalları ve sırada bekleyen üyeler burada durur; bir odayı kapatmak ya da sırayı boşaltmak için aynı komuttaki diğer adımları kullanabilirsin.',
    blocks: [roomBlock, queueBlock, stamp()],
  });
}

module.exports = { IDS, queuePanel, queuedCard, leftQueue, matchedCard, roomPanel, endedCard, roomList };
