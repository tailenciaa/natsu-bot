// Yardım menüsü (src/systems/yardim/ui.js): kategori ve komut listesi gerçek sistem tanımlarından üretilir.
// İçerik toplama doğrudan yardim/index.js'in "tabs" fonksiyonundan alınır, böylece önizleme ile canlı aynı listedir.
// Menü log paneli gibi iki mesajdır: açılışta yalnızca kategori menülü panel, seçimde ayrı kategori kartı.
module.exports = ({ mock, src }) => {
  const help = src('systems/yardim/ui');
  const { tabs } = src('systems/yardim');
  const systems = src('systems');

  const commandNames = systems.flatMap((s) => (s.commands ?? []).map((c) => c.toJSON().name));
  const guild = mock.guild({ name: 'Kazuki Sunucusu', commands: commandNames });
  const bot = mock.user({ username: 'kazuki', displayName: 'Kazuki', bot: true });

  // Tek katman: menü kim açarsa açsın yalnızca herkesin kullanabildiği komutları listeler
  const all = tabs(guild);
  const total = Object.values(all.entries).reduce((n, list) => n + list.length, 0);

  return [
    {
      id: 'acilis',
      title: 'Yardım paneli: açılış (yalnızca kategori menüsü)',
      where: '/yardim komutu, herkese açık',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          help.helpPanel({
            botName: 'Kazuki',
            avatarUrl: bot.displayAvatarURL(),
            categories: all.categories,
            total,
          }),
        ],
        allowedMentions: { parse: [] },
      }),
    },
    ...all.categories.map((category) => ({
      id: `kategori-${category.key}`,
      title: `Yardım kartı: ${category.label}`,
      where: '/yardim panelinden kategori seçilince gelen ayrı mesaj, herkese açık',
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [help.categoryCard({ category, entries: all.entries[category.key] })],
        allowedMentions: { parse: [] },
      }),
    })),
  ];
};
