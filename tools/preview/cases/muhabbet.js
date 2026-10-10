// Muhabbet odası sistemi (src/systems/muhabbet/ui.js)
module.exports = ({ mock, src }) => {
  const k = src('systems/muhabbet/ui');

  const mehmet = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const ayse = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const fatma = mock.user({ username: 'fatma', displayName: 'Fatma' });
  const can = mock.user({ username: 'can', displayName: 'Can' });
  const derya = mock.user({ username: 'derya', displayName: 'Derya' });

  const guild = mock.guild({ id: '1' });
  const voice = mock.channel({ name: 'muhabbet-0001', type: 'voice', guild });
  const yazi = mock.channel({ name: 'muhabbet-0001', type: 'text', guild });
  const voice2 = mock.channel({ name: 'muhabbet-0002', type: 'voice', guild });
  const yazi2 = mock.channel({ name: 'muhabbet-0002', type: 'text', guild });

  const room = (o = {}) => ({
    id: '1-0001',
    no: 1,
    guildId: '1',
    users: [mehmet.id, ayse.id],
    voiceChannelId: voice.id,
    textChannelId: yazi.id,
    panelMessageId: mock.id(),
    emptySince: null,
    createdAt: mock.ago(12 * mock.MIN),
    ...o,
  });

  const second = room({
    id: '1-0002',
    no: 2,
    users: [fatma.id, can.id],
    voiceChannelId: voice2.id,
    textChannelId: yazi2.id,
    createdAt: mock.ago(2 * mock.MIN),
  });

  const entry = (user, minutes) => ({ guildId: '1', userId: user.id, joinedAt: mock.ago(minutes * mock.MIN) });
  const queue = [entry(derya, 7), entry(can, 4), entry(fatma, 2), entry(ayse, 1)];

  const noMentions = { allowedMentions: { parse: [] } };
  const message = (container) => ({ components: [container], ...noMentions });

  return [
    { id: 'panel', title: 'Sıra paneli: nasıl çalışır ve beklemeler', where: 'Muhabbet bilgi kanalı', visibility: 'panel', kind: 'message', build: () => message(k.queuePanel()) },

    { id: 'sira', title: 'Sıraya girme kartı: yeni giren', where: 'Sıra panelindeki Muhabbet Başlat butonu', visibility: 'public', kind: 'message', build: () => message(k.queuedCard(3, 7)) },
    { id: 'sira-cikis', title: 'Sıradan çıkma onayı', where: 'Sıradan Ayrıl butonu', visibility: 'public', kind: 'message', build: () => message(k.leftQueue({ user: mehmet })) },
    { id: 'sira-tekrar', title: 'Sıraya girme kartı: sırada beklerken tekrar basıldı', where: 'Sıra panelindeki Muhabbet Başlat butonu', visibility: 'public', kind: 'message', build: () => message(k.queuedCard(2, 6, true)) },

    { id: 'eslesme', title: 'Eşleşen üyeye giden kart: oda açıldı', where: 'Doğrudan mesaj', visibility: 'public', kind: 'message', build: () => message(k.matchedCard(room())) },
    { id: 'oda-paneli', title: 'Odanın kendi paneli: bitir butonu', where: "Odanın yazı kanalı", visibility: 'public', kind: 'message', build: () => message(k.roomPanel(room())) },

    {
      id: 'bitti',
      title: 'Oda kapandı bildirimi: üye bitirdi',
      where: 'Doğrudan mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () => message(k.endedCard(room(), `${mehmet.displayName} muhabbeti bitirdi.`)),
    },
    {
      id: 'bitti-bos',
      title: 'Oda kapandı bildirimi: ses kanalında kimse kalmadı',
      where: 'Doğrudan mesaj',
      visibility: 'dm',
      kind: 'message',
      build: () => message(k.endedCard(second, 'Ses kanalında 5 dakikadır kimse kalmadı.')),
    },

    { id: 'liste', title: '/muhabbet liste: iki açık oda ve sıra', where: 'Yetkili komut kanalı', visibility: 'public', kind: 'message', build: () => message(k.roomList([room(), second], queue)) },
    { id: 'liste-bos', title: '/muhabbet liste: oda yok, sıra boş', where: 'Yetkili komut kanalı', visibility: 'public', kind: 'message', build: () => message(k.roomList([], [])) },
  ];
};
