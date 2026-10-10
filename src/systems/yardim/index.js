// Yardım menüsü: /yardim ile açılır, komutlar tek menüden seçilen kategoriler halinde listelenir. Tek mesajda
// gezilir: /yardim kısa bir panel açar (başlık, tek açıklama, kategori menüsü) ve panelde komut listesi yoktur;
// bir kategori seçilince panelin yerini o kategorinin komut kartı alır, kartın altındaki düğme panele döndürür.
// TEK KATMAN KURALI: menü kim açarsa açsın yalnızca HERKESİN kullanabildiği komutları gösterir; o liste her sistemin
// index.js'indeki "help.member" alanıdır. Rol, izin ya da yöneticilik gerektiren hiçbir komut (sicil, ceza, yetki,
// log, emoji ekleme...) menüde durmaz — yetkili bu komutları panellerden ve yetkili kanalından öğrenir, üyenin
// işine olmayan komutu üye listesinde görmek karmaşa üretir. Yöneticiye özel seçenekler (ör. /seviye'nin "test"
// seçeneği) üye listesindeki komutun yanında da gösterilmez: bu dosyadaki HIDDEN_OPTIONS listesi onlarındır.
// "help.access" erişim denetimi ve komut denetimi için durmaya devam eder; komut açıklamaları ve seçenekleri
// komut tanımlarından otomatik alınır.
const { InteractionContextType, SlashCommandBuilder } = require('discord.js');
const { botName } = require('../../core/config');
const { respond } = require('../../core/helpers');
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

// Menüde gösterilmez: listelenen şey zaten bu komutun sonucudur
const SELF = 'yardim';

// Kategori sırası ve kategori menüsündeki kısa açıklamaları; listede olmayan kategoriler sistem sırasıyla sona
// eklenir. Bir kategoride listelenecek komut kalmıyorsa kategori hiç gösterilmez.
const CATEGORIES = [
  ['hesap', 'Profil, seviye, coin ve cüzdan komutları'],
  ['siralama', 'Sıralamalar ve saygınlık'],
  ['partner', 'Partner sunucular'],
];

// Üye listesindeki komutun yanında gösterilmeyen seçenekler: yöneticiye özel seçenekler (test/önizleme) komut
// tanımlarından otomatik alındığı için burada düşürülür.
const HIDDEN_OPTIONS = { seviye: ['test'] };

// Komutları kategorilere göre toplar; komut adı tıklanabilir olur, zorunlu seçenekler düz, isteğe bağlılar
// [köşeli] yazılır. Yalnızca sistemlerin "help.member" listelerindeki komutlar toplanır.
function entriesByTab(guild) {
  const byTab = new Map();

  for (const system of systems()) {
    const tab = system.help?.category?.[0];
    const member = system.help?.member;
    // listesi olmayan sistemin komutları (yetkili ve kurulum işlemleri) menüde hiç görünmez
    if (!tab || !member?.length) continue;

    for (const command of (system.commands ?? []).map((c) => c.toJSON())) {
      if (command.type !== 1) continue; // sağ tık (bağlam menüsü) komutları menüde listelenmez
      const id = guild.commands.cache.find((c) => c.name === command.name)?.id;
      const subcommands = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
      const variants = subcommands.length
        ? subcommands.map((sub) => ({ path: `${command.name} ${sub.name}`, description: sub.description, options: sub.options ?? [] }))
        : [{ path: command.name, description: command.description, options: command.options ?? [] }];

      for (const variant of variants) {
        if (variant.path === SELF) continue;
        // menüye yalnızca sistemin "member" listesindeki komutlar girer
        if (!member.includes(variant.path)) continue;
        const hidden = HIDDEN_OPTIONS[command.name] ?? [];
        const options = variant.options
          .filter((o) => !hidden.includes(o.name))
          .map((o) => `\`${o.required ? o.name : `[${o.name}]`}\``)
          .join(' ');
        const usage = `${id ? `</${variant.path}:${id}>` : `\`/${variant.path}\``} ${options}`.trim();
        const entries = byTab.get(tab) ?? [];
        entries.push({ description: variant.description, usage });
        byTab.set(tab, entries);
      }
    }
  }

  return byTab;
}

// Komutu olan kategoriler ve içindekiler
function tabs(guild) {
  const byTab = entriesByTab(guild);
  const labels = {};
  for (const system of systems()) {
    const [key, label] = system.help?.category ?? [];
    if (key && byTab.has(key) && !labels[key]) labels[key] = label;
  }
  const extra = [...byTab.keys()].filter((key) => !CATEGORIES.some(([k]) => k === key));
  const keys = [...CATEGORIES.map(([key]) => key), ...extra].filter((key) => byTab.get(key)?.length);
  return {
    categories: keys.map((key) => ({
      key,
      label: labels[key],
      desc: CATEGORIES.find(([k, desc]) => k === key)?.[1] ?? `${labels[key]} komutları`,
    })),
    entries: Object.fromEntries(keys.map((key) => [key, byTab.get(key)])),
  };
}

// /yardim: panel herkese açık gönderilir; içinde komut listesi yoktur, yalnızca kategori menüsü durur.
function panelMessage(interaction, all) {
  return ui.helpPanel({
    botName,
    avatarUrl: interaction.client.user.displayAvatarURL({ size: 256 }),
    categories: all.categories,
    total: Object.values(all.entries).reduce((n, list) => n + list.length, 0),
  });
}

async function handleCommand(interaction) {
  return respond(interaction, panelMessage(interaction, tabs(interaction.guild)));
}

// Menü ve düğme aynı mesajı yerinde değiştirir, yeni mesaj atılmaz: kategori seçilince panel o kategorinin kartına,
// "Yardım Menüsüne Dön" kartın yerini tekrar panele çevirir. Panel herkese açık olduğu için kategoriyi herkes
// seçebilir; herkesin gördüğü mesajı herkes değiştirebilir.
// yardim:kategori (eski mesajlarda yardim:<kategori>) ve yardim:panel.
async function handleNavigate(interaction) {
  const all = tabs(interaction.guild);
  const key = interaction.values?.[0] ?? interaction.customId.split(':')[1];
  const update = (container) => interaction.update({ components: [container], allowedMentions: { parse: [] } });
  if (key === 'panel') return update(panelMessage(interaction, all));

  const category = all.categories.find((c) => c.key === key);
  if (!category) return interaction.deferUpdate();
  return update(ui.categoryCard({ category, entries: all.entries[category.key] }));
}

module.exports = {
  name: 'yardim',
  commands,
  help: { category: ['genel', 'Genel'], access: { yardim: 'Herkes' } },
  slash: { yardim: handleCommand },
  prefixed: [[ui.IDS.navigate, handleNavigate]],
  // Önizleme (tools/preview) menü içeriğini aynı fonksiyondan üretsin diye dışarı verilir
  tabs,
};
