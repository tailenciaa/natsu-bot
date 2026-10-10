// Yardım menüsü: /yardim ile açılır, komutlar tek menüden seçilen kategoriler halinde listelenir. Menü herkese açık
// gönderilir ve kategoriyi seçen herkes paneli YERİNDE yeniden çizer (komutlar asla menünün altına ayrı bir mesaj
// olarak atılmaz). İçeriği iki katmanlıdır: üye yalnızca kendi kullanabildiği komutları görür, o yüzden her sistem
// menüye girecek komutları index.js'indeki "help.member" listesiyle söyler. KURAL: "help.member" listesine sadece
// HERKESİN kullanabildiği komutlar yazılır — rol, izin ya da yöneticilik gerektiren hiçbir komut (sicil, ceza,
// yetki, log, emoji ekleme...) üye listesinde durmaz. Yetkili komutlarının görünmesi gereken izni
// (core/config.js staffPermission) ya da yöneticiliği olan üye menüyü açtığında yetkili ve kurulum komutları da
// listelenir. Görünen her komutun yanında, herkesin kullanamadığı
// komutlarda ne gerektiği "help.need" ile yazılır. Komut açıklamaları ve seçenekleri komut tanımlarından
// otomatik alınır. "access" alanı erişim denetimi ve komut denetimi için durmaya devam eder.
const { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { botName, staffPermission } = require('../../core/config');
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
  ['emoji', 'Emoji ve çıkartma ekleme'],
  ['yetki', 'Ceza, yetki ve başvuru işlemleri'],
  ['destek', 'Talep üstlenme ve kapatma'],
  ['oda', 'Kalıcı oda başvurusu, muhabbet sırası ve oda yönetimi'],
  ['cekilis', 'Çekiliş başlatma ve sonuçlandırma'],
  ['log', 'Log kanallarının kurulumu'],
];

// Yetkili katmanı: yetkili komutlarının Discord'da görünmesi için gereken izne ya da yöneticiliğe sahip olanlar
const staffAudience = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(staffPermission);

// Kategorilere göre komutları toplar; komut adı tıklanabilir olur, zorunlu seçenekler düz,
// isteğe bağlılar [köşeli] yazılır. staff: false yalnızca üye komutlarını, true tüm komutları toplar.
function entriesByTab(guild, staff) {
  const byTab = new Map();

  for (const system of systems()) {
    const tab = system.help?.category?.[0];
    const member = system.help?.member;
    // üyeler için: listesi olmayan sistemin komutları (yetkili ve kurulum işlemleri) menüde hiç görünmez
    if (!tab || (!staff && !member?.length)) continue;

    for (const command of (system.commands ?? []).map((c) => c.toJSON())) {
      if (command.type !== 1) continue; // sağ tık (bağlam menüsü) komutları menüde listelenmez
      const id = guild.commands.cache.find((c) => c.name === command.name)?.id;
      const subcommands = (command.options ?? []).filter((o) => o.type === SUBCOMMAND);
      const variants = subcommands.length
        ? subcommands.map((sub) => ({ path: `${command.name} ${sub.name}`, description: sub.description, options: sub.options ?? [] }))
        : [{ path: command.name, description: command.description, options: command.options ?? [] }];

      for (const variant of variants) {
        if (variant.path === SELF) continue;
        // üye menüsüne yalnızca sistemin "member" listesindeki komutlar girer
        if (!staff && !member?.includes(variant.path)) continue;
        const options = variant.options.map((o) => `\`${o.required ? o.name : `[${o.name}]`}\``).join(' ');
        const usage = `${id ? `</${variant.path}:${id}>` : `\`/${variant.path}\``} ${options}`.trim();
        const entries = byTab.get(tab) ?? [];
        entries.push({ description: variant.description, usage, need: system.help.need?.[variant.path] });
        byTab.set(tab, entries);
      }
    }
  }

  return byTab;
}

// Komutu olan kategoriler ve içindekiler; ilk kategori /yardim'in açıldığı kategoridir
function tabs(guild, staff) {
  const byTab = entriesByTab(guild, staff);
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

function menu(interaction, tab) {
  const staff = staffAudience(interaction);
  const all = tabs(interaction.guild, staff);
  const key = all.categories.some((category) => category.key === tab) ? tab : all.categories[0]?.key;
  return ui.helpMenu({
    botName,
    avatarUrl: interaction.client.user.displayAvatarURL({ size: 256 }),
    categories: all.categories,
    tab: key,
    entries: all.entries[key] ?? [],
    total: Object.values(all.entries).reduce((n, list) => n + list.length, 0),
  });
}

// /yardim: menü herkese açık gönderilir; içinde kimin kullanabildiği yazılmayan komutlar herkes içindir,
// gerisinin yanında ne gerektiği ("Gerekli: …") durur. Yetkili menüyü açtığında yetkili komutları da listelenir.
async function handleCommand(interaction) {
  return respond(interaction, menu(interaction), { ephemeral: false });
}

// Kategori menüsü: yardim:<kategori>. Menü herkese açık olduğu için kategoriyi herkes değiştirebilir; liste her
// basışta o kişiyi gözeten katmanla yeniden çizilir. Panel YERİNDE güncellenir: seçilen kategorinin komutları aynı
// panelin içinde çizilir, asla ayrı bir mesaj olarak atılmaz. Güncelleme tutmazsa (mesaj çoktan silinmiş, bağlantı
// kısa süreli kopmuş) hata bildirimi de gönderilmez — panel olduğu gibi kalır, kişi tekrar dener.
async function handleNavigate(interaction) {
  try {
    return await interaction.update({
      components: [menu(interaction, interaction.values?.[0] ?? interaction.customId.split(':')[1])],
      allowedMentions: { parse: [] },
    });
  } catch (err) {
    console.error('[yardim] panel yerinde güncellenemedi:', err.message);
  }
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
