// Yardım menüsü: /yardim ile açılır, komutlar kategorilere ayrılmış şekilde butonlarla gezilir.
// Komut açıklamaları ve seçenekleri sistemlerin komut tanımlarından otomatik alınır; kategori ve kimlerin
// kullanabileceği her sistemin index.js'indeki "help" alanında yazılır. "help"te olmayan komut menüde görünmez.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const { botName } = require('../../core/config');
const { respond, replyError, isMenuOwner } = require('../../core/helpers');
const ui = require('./ui');

const SUBCOMMAND = 1;

const commands = [
  new SlashCommandBuilder()
    .setName('yardim')
    .setDescription('Botun komutlarını ve ne işe yaradıklarını gösterir.')
    .setContexts(InteractionContextType.Guild),
];

// Sistem listesi yardım sisteminin kendisini de içerdiği için ihtiyaç anında yüklenir
const systems = () => require('..');

// Sekme sırası: herkesin kullandıkları önce, yetkili işlemleri sonda; listede olmayan kategoriler sistem sırasıyla sona eklenir
const TAB_ORDER = ['genel', 'siralama', 'emoji', 'partner', 'cekilis', 'destek', 'yetki', 'log'];

// Aynı kategoriyi kullanan sistemler tek sekmede birleşir; ilk sekme /yardim'in açıldığı sekmedir
function categories() {
  const found = Object.fromEntries(systems().filter((s) => s.help).map((s) => s.help.category));
  const ordered = TAB_ORDER.filter((key) => found[key]).map((key) => [key, found[key]]);
  const rest = Object.entries(found).filter(([key]) => !TAB_ORDER.includes(key));
  return Object.fromEntries([...ordered, ...rest]);
}

// Kategorideki komutları üretir; komut adı tıklanabilir olur, zorunlu seçenekler düz, isteğe bağlılar [köşeli] yazılır
function entriesFor(guild, category) {
  const entries = [];

  for (const system of systems()) {
    if (system.help?.category[0] !== category) continue;

    for (const command of (system.commands ?? []).map((c) => c.toJSON())) {
      const id = guild.commands.cache.find((c) => c.name === command.name)?.id;
      const subcommands = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
      const variants = subcommands.length
        ? subcommands.map((sub) => ({ path: `${command.name} ${sub.name}`, description: sub.description, options: sub.options ?? [] }))
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

function menu(interaction, tab) {
  return ui.helpMenu({
    botName,
    avatarUrl: interaction.client.user.displayAvatarURL({ size: 256 }),
    categories: categories(),
    tab,
    entries: entriesFor(interaction.guild, tab),
  });
}

// /yardim: menü herkese açık gönderilir
async function handleCommand(interaction) {
  return respond(interaction, menu(interaction, Object.keys(categories())[0]), { ephemeral: false });
}

// Kategori butonları: yardim:<kategori>
async function handleNavigate(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Bu menüyü sadece komutu kullanan kişi gezebilir.', 'Kendi menün için /yardim yazabilirsin.');
  }
  const tab = interaction.customId.split(':')[1];
  const all = categories();
  return interaction.update({
    components: [menu(interaction, all[tab] ? tab : Object.keys(all)[0])],
    allowedMentions: { parse: [] },
  });
}

module.exports = {
  name: 'yardim',
  commands,
  help: { category: ['genel', 'Genel'], access: { yardim: 'Herkes' } },
  slash: { yardim: handleCommand },
  prefixed: [[ui.IDS.navigate, handleNavigate]],
};
