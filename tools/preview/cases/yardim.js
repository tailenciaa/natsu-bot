// Yardım menüsü (src/systems/yardim/ui.js): sekmeler ve komut listesi gerçek sistem tanımlarından üretilir
module.exports = ({ mock, src }) => {
  const help = src('systems/yardim/ui');
  const systems = src('systems');
  const SUBCOMMAND = 1;
  const TAB_ORDER = ['hesap', 'siralama', 'partner', 'emoji'];

  const commandNames = systems.flatMap((s) => (s.commands ?? []).map((c) => c.toJSON().name));
  const guild = mock.guild({ name: 'Kazuki Sunucusu', commands: commandNames });
  const bot = mock.user({ username: 'kazuki', displayName: 'Kazuki', bot: true });

  // systems/yardim/index.js içindeki entriesByTab ile aynı mantık: yalnızca "member" listesindeki komutlar
  const byTab = new Map();
  for (const system of systems) {
    const tab = system.help?.category?.[0];
    const member = system.help?.member;
    if (!tab || !member?.length) continue;

    for (const command of (system.commands ?? []).map((c) => c.toJSON())) {
      const id = guild.commands.cache.find((c) => c.name === command.name)?.id;
      const subs = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
      const variants = subs.length
        ? subs.map((sub) => ({ path: `${command.name} ${sub.name}`, description: sub.description, options: sub.options ?? [] }))
        : [{ path: command.name, description: command.description, options: command.options ?? [] }];

      for (const variant of variants) {
        if (!member.includes(variant.path)) continue;
        const options = variant.options.map((o) => `\`${o.required ? o.name : `[${o.name}]`}\``).join(' ');
        const usage = `${id ? `</${variant.path}:${id}>` : `\`/${variant.path}\``} ${options}`.trim();
        const entries = byTab.get(tab) ?? [];
        entries.push({ description: variant.description, usage });
        byTab.set(tab, entries);
      }
    }
  }

  const labels = Object.fromEntries(systems.filter((s) => s.help?.member?.length).map((s) => s.help.category));
  const extra = [...byTab.keys()].filter((key) => !TAB_ORDER.includes(key));
  const tabs = [...TAB_ORDER, ...extra].filter((key) => byTab.get(key)?.length);

  return tabs.map((tab) => ({
    id: `kategori-${tab}`,
    title: `Yardım menüsü: ${labels[tab]}`,
    where: '/yardim komutu, herkese açık; kategori butonlarını sadece komutu kullanan gezebilir',
    visibility: 'public',
    kind: 'message',
    build: () => ({
      components: [
        help.helpMenu({
          botName: 'Kazuki',
          avatarUrl: bot.displayAvatarURL(),
          categories: Object.fromEntries(tabs.map((key) => [key, labels[key]])),
          tab,
          entries: byTab.get(tab),
        }),
      ],
      allowedMentions: { parse: [] },
    }),
  }));
};
