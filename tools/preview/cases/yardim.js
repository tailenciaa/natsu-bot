// Yardım menüsü (src/systems/yardim/ui.js): kategori ve komut listesi gerçek sistem tanımlarından üretilir.
// İçerik toplama doğrudan yardim/index.js'in "tabs" fonksiyonundan alınır, böylece önizleme ile canlı aynı listedir.
module.exports = ({ mock, src }) => {
  const help = src('systems/yardim/ui');
  const { tabs } = src('systems/yardim');
  const systems = src('systems');

  const commandNames = systems.flatMap((s) => (s.commands ?? []).map((c) => c.toJSON().name));
  const guild = mock.guild({ name: 'Kazuki Sunucusu', commands: commandNames });
  const bot = mock.user({ username: 'kazuki', displayName: 'Kazuki', bot: true });

  // İki katman: üye yalnızca kendi komutlarını, yetkili tüm kategorileri görür; menü her ikisinde de herkese açıktır
  const views = [
    { staff: false, who: 'üye', where: '/yardim komutu, herkese açık; kategoriyi herkes değiştirebilir' },
    { staff: true, who: 'yetkili', where: '/yardim komutu, herkese açık; yetkilide yetkili komutları da listelenir' },
  ];

  return views.flatMap(({ staff, who, where }) => {
    const all = tabs(guild, staff);
    const total = Object.values(all.entries).reduce((n, list) => n + list.length, 0);
    return all.categories.map((category) => ({
      id: `kategori-${who}-${category.key}`,
      title: `Yardım menüsü (${who}): ${category.label}`,
      where,
      visibility: 'public',
      kind: 'message',
      build: () => ({
        components: [
          help.helpMenu({
            botName: 'Kazuki',
            avatarUrl: bot.displayAvatarURL(),
            categories: all.categories,
            tab: category.key,
            entries: all.entries[category.key],
            total,
          }),
        ],
        allowedMentions: { parse: [] },
      }),
    }));
  });
};
