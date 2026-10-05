// Yardım menüsü (src/systems/yardim/ui.js): kategoriler ve komut listesi gerçek sistem tanımlarından üretilir
module.exports = ({ mock, src }) => {
  const help = src('systems/yardim/ui');
  const systems = src('systems');
  const SUBCOMMAND = 1;

  const categories = Object.fromEntries(systems.filter((s) => s.help).map((s) => s.help.category));
  const commandNames = systems.flatMap((s) => (s.commands ?? []).map((c) => c.toJSON().name));
  const guild = mock.guild({ name: 'Kazuki Sunucusu', commands: commandNames });
  const bot = mock.user({ username: 'kazuki', displayName: 'Kazuki', bot: true });

  // systems/yardim/index.js içindeki entriesFor ile aynı mantık
  function entriesFor(category) {
    const entries = [];
    for (const system of systems) {
      if (system.help?.category[0] !== category) continue;
      for (const command of (system.commands ?? []).map((c) => c.toJSON())) {
        const id = guild.commands.cache.find((c) => c.name === command.name)?.id;
        const subs = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
        const variants = subs.length
          ? subs.map((sub) => ({ path: `${command.name} ${sub.name}`, description: sub.description, options: sub.options ?? [] }))
          : [{ path: command.name, description: command.description, options: command.options ?? [] }];
        for (const variant of variants) {
          const access = system.help.access[variant.path];
          if (!access) continue;
          const name = id ? `</${variant.path}:${id}>` : `\`/${variant.path}\``;
          const options = variant.options.map((o) => `\`${o.required ? o.name : `[${o.name}]`}\``).join(' ');
          entries.push({ description: variant.description, usage: `${name} ${options}`.trim(), access });
        }
      }
    }
    return entries;
  }

  return Object.keys(categories).map((tab) => ({
    id: `kategori-${tab}`,
    title: `Yardım menüsü: ${categories[tab]}`,
    where: '/yardim komutu, herkese açık; kategori butonlarını sadece komutu kullanan gezebilir',
    visibility: 'public',
    kind: 'message',
    build: () => ({
      components: [help.helpMenu({ botName: 'Kazuki', avatarUrl: bot.displayAvatarURL(), categories, tab, entries: entriesFor(tab) })],
      allowedMentions: { parse: [] },
    }),
  }));
};
