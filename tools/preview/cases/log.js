// Log sistemi (src/systems/log/ui.js): log girdi kutuları, detay cevabı, kategori seçim paneli ve /log kurulum menüsü
module.exports = ({ mock, src }) => {
  const d = src('systems/log/ui');
  const categories = src('systems/log/categories');
  // Panellerde Discord CDN afişi üretimde yerel eke döner (core/banner.js + core/panel.js syncPanel);
  // önizleme de aynı kapıdan geçsin ki attachment:// adı ile gönderilen dosya hep birbirini tutsun.
  const bannerFiles = (container) =>
    src('core/banner').attachmentsFor([...JSON.stringify(container.toJSON()).matchAll(/attachment:\/\/([^"]+)/g)].map((m) => m[1]));

  const guild = mock.guild({ name: 'Kazuki Sunucusu' });
  const uye = mock.user({ username: 'mehmet', displayName: 'Mehmet' });
  const yetkili = mock.user({ username: 'ayse', displayName: 'Ayşe' });
  const kanal = mock.channel({ guild, name: 'genel-sohbet' });
  const altKanal = mock.thread({ guild, name: '📝・mesaj-logları' });
  const anaKanal = mock.channel({ guild, name: 'log' });
  const panelKanal = mock.channel({ guild, name: 'log-paneli' });
  const noMentions = { allowedMentions: { parse: [] } };

  const mesajKategorisi = categories.find((c) => c.key === 'mesaj');
  const silinen = d.entry('danger', 'Mesaj Silindi', [
    `**Kullanıcı:** <@${uye.id}>`,
    `**Kanal:** <#${kanal.id}>`,
    '**İçerik:**\n> yarın buluşuyor muyuz?',
    '**Ekler:** ekran-goruntusu.png',
    `**Silen:** <@${yetkili.id}>`,
  ]);

  return [
    {
      id: 'girdi-mesaj-silindi',
      title: 'Log girdisi: mesaj silindi',
      where: 'Ana log kanalının alt başlığı, olay oldukça otomatik yazılır',
      visibility: 'log',
      kind: 'message',
      build: () => ({ components: [silinen], ...noMentions }),
    },
    {
      id: 'girdi-uye-katildi',
      title: 'Log girdisi: üye katıldı',
      where: 'Giriş / çıkış alt başlığı',
      visibility: 'log',
      kind: 'message',
      build: () => ({
        components: [
          d.entry('success', 'Üye Katıldı', [
            `**Kullanıcı:** <@${uye.id}> (${uye.username})`,
            `**Hesap oluşturma:** <t:${Math.floor(uye.createdTimestamp / 1000)}:R> (yeni hesap)`,
            `**Üye sayısı:** ${guild.memberCount}`,
            '**Davet:** ayse oluşturduğu davetle geldi',
          ]),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'girdi-komut',
      title: 'Log girdisi: komut kullanıldı',
      where: 'Bot alt başlığı, içerik satırı olmayan girdi',
      visibility: 'log',
      kind: 'message',
      build: () => ({
        components: [
          d.entry('primary', 'Komut Kullanıldı', [
            `**Kullanıcı:** <@${uye.id}>`,
            `**Kanal:** <#${kanal.id}>`,
            '**Komut:** `/gorev`',
          ]),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'detay',
      title: 'Log detayı: detaylı bilgi',
      where: 'Log girdisindeki Detaylı Bilgi butonuna basınca sadece basana görünür',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [d.detail(silinen.logMeta, mesajKategorisi.label)], ...noMentions }),
    },
    {
      id: 'panel',
      title: 'Log paneli',
      where: '#log-paneli kanalına gönderilen kalıcı kategori menüsü',
      visibility: 'panel',
      kind: 'message',
      build: () => {
        const container = d.panel();
        return { components: [container], files: bannerFiles(container), ...noMentions };
      },
    },
    {
      id: 'alt-baslik-linki',
      title: 'Log paneli: kategori seçildi',
      where: 'Kalıcı panelde kategori seçince sadece seçene görünen cevap, alt başlığa götürür',
      visibility: 'ephemeral',
      kind: 'message',
      build: () => ({ components: [d.jumpLink(mesajKategorisi, altKanal)], ...noMentions }),
    },
    {
      id: 'kurulum',
      title: '/log kurulum menüsü: her şey kurulu',
      where: '/log komutunun cevabı, yöneticiler kullanır',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          d.setupView({
            mainId: anaKanal.id,
            panelId: panelKanal.id,
            rows: categories.map((category) => ({ category, thread: altKanal })),
            panelUrl: `https://discord.com/channels/${guild.id}/${panelKanal.id}/1539000000000000002`,
            note: '**Panel**, log paneli kanalına gönderildi.',
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'kurulum-eksik',
      title: '/log kurulum menüsü: eksikler var',
      where: '/log komutunun cevabı, ilk açılışta',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          d.setupView({
            mainId: anaKanal.id,
            panelId: panelKanal.id,
            rows: categories.map((category, index) => ({ category, thread: index < 2 ? altKanal : null })),
            panelUrl: null,
          }),
        ],
        ...noMentions,
      }),
    },
    {
      id: 'sifirla-onayi',
      title: '/log: sıfırlama onayı',
      where: 'Hepsini Sıfırla butonuna basınca aynı mesaj onay ister',
      visibility: 'public',
      kind: 'message',
      build: () => ({ components: [d.resetConfirm()], ...noMentions }),
    },
  ];
};
