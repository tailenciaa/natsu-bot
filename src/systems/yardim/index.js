// Yardım menüsü: /yardim ile açılır, komutlar kategorilere ayrılmış şekilde butonlarla gezilir.
// Menü sunucudaki üyelere bottaki komutları göstermek için var; o yüzden yalnızca herkesin kullanabildiği komutlar
// listelenir. Her sistem menüye girecek komutları index.js'indeki "help.member" listesiyle söyler; listesi olmayan
// sistemin komutları (yetkili ve kurulum işlemleri) menüde hiç görünmez. Komut açıklamaları ve seçenekleri komut
// tanımlarından otomatik alınır. "access" alanı erişim denetimi ve komut denetimi için durmaya devam eder.
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

// Sekme sırası; listede olmayan kategoriler sistem sırasıyla sona eklenir. Bir sekmede listelenecek komut
// kalmıyorsa sekme hiç gösterilmez, bu yüzden yetkili işlemleri için sekme tanımlamaya gerek yok.
const TAB_ORDER = ['hesap', 'siralama', 'partner', 'emoji'];

// Kategorilere göre üye komutlarını toplar; komut adı tıklanabilir olur, zorunlu seçenekler düz,
// isteğe bağlılar [köşeli] yazılır
function entriesByTab(guild) {
  const byTab = new Map();

  for (const system of systems()) {
    const tab = system.help?.category?.[0];
    const member = system.help?.member;
    if (!tab || !member?.length) continue;

    for (const command of (system.commands ?? []).map((c) => c.toJSON())) {
      const id = guild.commands.cache.find((c) => c.name === command.name)?.id;
      const subcommands = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
      const variants = subcommands.length
        ? subcommands.map((sub) => ({ path: `${command.name} ${sub.name}`, description: sub.description, options: sub.options ?? [] }))
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

  return byTab;
}

// Komutu olan sekmeler ve adları; ilk sekme /yardim'in açıldığı sekmedir
function tabs(guild) {
  const byTab = entriesByTab(guild);
  const labels = Object.fromEntries(systems().filter((s) => s.help?.member?.length).map((s) => s.help.category));
  const extra = [...byTab.keys()].filter((key) => !TAB_ORDER.includes(key));
  const keys = [...TAB_ORDER, ...extra].filter((key) => byTab.get(key)?.length);
  return {
    categories: Object.fromEntries(keys.map((key) => [key, labels[key]])),
    entries: Object.fromEntries(keys.map((key) => [key, byTab.get(key)])),
  };
}

function menu(interaction, tab) {
  const all = tabs(interaction.guild);
  const key = all.categories[tab] ? tab : Object.keys(all.categories)[0];
  return ui.helpMenu({
    botName,
    avatarUrl: interaction.client.user.displayAvatarURL({ size: 256 }),
    categories: all.categories,
    tab: key,
    entries: all.entries[key] ?? [],
  });
}

// /yardim: menü herkese açık gönderilir
async function handleCommand(interaction) {
  return respond(interaction, menu(interaction), { ephemeral: false });
}

// Kategori butonları: yardim:<kategori>
async function handleNavigate(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Bu menüyü sadece komutu kullanan kişi gezebilir.', 'Kendi menün için /yardim yazabilirsin.');
  }
  return interaction.update({
    components: [menu(interaction, interaction.customId.split(':')[1])],
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
