// Emoji kopyalama: başka sunuculardaki emojileri bu sunucuya ekler.
//   /emoji-ekle emoji:<emoji, ID ya da bağlantı> [isim]: emojinin kendisi (<:isim:id>), ID'si, Discord emoji bağlantısı
//     ya da herhangi bir resim bağlantısı verilebilir; boşlukla ayırarak birden fazla eklenebilir.
//   /cikartma-ekle dosya isim etiket: yüklenen bir görsel dosyasını çıkartma olarak ekler.
//   Mesaja sağ tık > Uygulamalar > "Emojileri Sunucuya Ekle": mesajdaki ve tepkilerdeki emojiler önizlemeyle listelenir,
//     menüden seçilenler eklenir. Sonuç da eklenemeyenlerin uyarısı da kanalda herkese açık yazılır.
// "Emoji ve Çıkartmaları Yönet" izni olanlar sınırsız kullanabilir; botun da bu izne sahip olması gerekir.
// Sunucuyu takviye eden (boost) üyeler, izinleri olmasa da /emoji-ekle ve /cikartma-ekle ile belirli sayıda
// emoji/çıkartma ekleyebilir (boost/config.js'teki perks; hak üye başına sayılır). Bulk seçim menüsü (sağ tık) sadece yetkililer içindir.
const {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError } = require('../../core/helpers');
const boostConfig = require('../boost/config');
const boostStore = require('../boost/store');
const ui = require('./ui');

const MENU_NAME = 'Emojileri Sunucuya Ekle';
const MAX_ITEMS = 25; // /emoji-ekle ile bir seferde eklenebilecek en fazla emoji
const PERMISSION = PermissionFlagsBits.ManageGuildExpressions;

const commands = [
  new SlashCommandBuilder()
    .setName('emoji-ekle')
    .setDescription('Başka sunucudaki bir emojiyi ID, bağlantı ya da emojinin kendisiyle bu sunucuya ekler.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o.setName('emoji').setDescription('Eklenecek emojiyi, ID\'sini ya da bağlantısını yazar, birden fazlası boşlukla ayrılır.').setRequired(true),
    )
    .addStringOption((o) => o.setName('isim').setDescription('Emojiye sunucuda verilecek adı belirler, tek emoji eklerken kullanılır.').setMaxLength(32)),
  new SlashCommandBuilder()
    .setName('cikartma-ekle')
    .setDescription('Bir görsel dosyasını çıkartma olarak bu sunucuya ekler.')
    .setContexts(InteractionContextType.Guild)
    .addAttachmentOption((o) => o.setName('dosya').setDescription('PNG, APNG ya da GIF dosyasını yükler, en fazla 512 KB olabilir.').setRequired(true))
    .addStringOption((o) => o.setName('isim').setDescription('Çıkartmaya verilecek adı belirler, 2-30 karakter olmalı.').setRequired(true).setMinLength(2).setMaxLength(30))
    .addStringOption((o) => o.setName('etiket').setDescription('Çıkartmayı anlatan bir duygu ya da kelime yazar, örneğin gülüyor.').setRequired(true).setMinLength(2).setMaxLength(20)),
  new ContextMenuCommandBuilder()
    .setName(MENU_NAME)
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PERMISSION)
    .setContexts(InteractionContextType.Guild),
];

const CUSTOM_EMOJI = /<(a?):(\w{2,32}):(\d{17,20})>/g;
const EMOJI_URL = /^https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/emojis\/(\d{17,20})\.(\w+)(\?.*)?$/i;
const IMAGE_URL = /^https?:\/\/\S+$/i;

const emojiUrl = (e) => `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}`;

// Emoji adı: harf, rakam ve alt çizgi, 2-32 karakter
function cleanName(name, fallback) {
  const clean = (name ?? '').replace(/[^\w]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
  return clean.length >= 2 ? clean : fallback;
}

// Girdideki emojileri çözer: [{ id?, name?, animated?, url?, input }]; anlaşılmayanlar invalid olarak döner
function parseInput(input) {
  const items = [];
  const invalid = [];
  const rest = input.replace(CUSTOM_EMOJI, (_, a, name, id) => {
    items.push({ id, name, animated: Boolean(a), input: `:${name}:` });
    return ' ';
  });
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    const cdn = token.match(EMOJI_URL);
    if (cdn) items.push({ id: cdn[1], animated: cdn[2].toLowerCase() === 'gif' || /animated=true/i.test(cdn[3] ?? ''), input: token });
    else if (/^\d{17,20}$/.test(token)) items.push({ id: token, input: token });
    else if (IMAGE_URL.test(token)) items.push({ url: token, name: token.split('/').pop().split(/[.?]/)[0], input: token });
    else invalid.push({ name: token.slice(0, 40), reason: 'Emoji, ID ya da bağlantı olarak anlaşılamadı.' });
  }
  return { items, invalid };
}

// Sadece ID'si bilinen emojinin hareketli olup olmadığını Discord'dan öğrenir
async function isAnimated(id) {
  const res = await fetch(`https://cdn.discordapp.com/emojis/${id}.gif?size=16`, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
  return Boolean(res?.ok);
}

function failureReason(err) {
  if (err.code === 30008) return 'Sunucunun emoji sınırı dolu.';
  if (err.code === 50013) return 'Botun emoji ekleme yetkisi yok.';
  if (/size|256|large/i.test(err.message)) return 'Dosya çok büyük, emoji en fazla 256 KB olabilir.';
  if (/image|fetch|404|resolve|invalid/i.test(err.message)) return 'Emoji bulunamadı ya da resmine ulaşılamadı.';
  return 'Eklenemedi.';
}

// Emojileri ekler; eklenenleri ve eklenemeyenleri döner
async function addEmojis(interaction, items, customName) {
  const { guild } = interaction;
  const added = [];
  const failed = [];
  for (const item of items) {
    if (item.id && guild.emojis.cache.has(item.id)) {
      failed.push({ name: item.input, reason: 'Bu emoji zaten sunucuda.' });
      continue;
    }
    if (item.id && item.animated === undefined) item.animated = await isAnimated(item.id);
    const name = cleanName(customName ?? item.name, `emoji_${(item.id ?? Date.now().toString()).slice(-6)}`);
    const emoji = await guild.emojis
      .create({ attachment: item.url ?? emojiUrl(item), name, reason: `Emoji ekleyen: ${interaction.user.username}` })
      .catch((err) => {
        failed.push({ name: item.input, reason: failureReason(err) });
        return null;
      });
    if (emoji) added.push(emoji);
  }
  return { added, failed };
}

// Kullanan ve bot emoji/çıkartma ekleyebiliyor mu; sorun varsa hata yanıtı döner (sağ tık menüsü/seçim: sadece yetkili)
function permissionError(interaction) {
  if (!interaction.memberPermissions?.has(PERMISSION)) {
    return replyError(interaction, 'Emoji eklemek için "Emoji ve Çıkartmaları Yönet" iznin olmalı.');
  }
  if (!interaction.guild.members.me.permissions.has(PERMISSION)) {
    return replyError(interaction, 'Botun "Emoji ve Çıkartmaları Yönet" izni yok.', 'Botun rolüne bu izni vermen gerekiyor.');
  }
  return null;
}

const isBooster = (interaction) => Boolean(interaction.member?.premiumSince);

// /emoji-ekle ve /cikartma-ekle: yönetici izni olanlar sınırsız, sunucuyu takviye edenler takviye başına bir kez
// kullanabilir. unlimited: true ise hak düşülmez, false ise başarılı eklemeden sonra hak düşülmeli.
function access(interaction, kind) {
  if (interaction.memberPermissions?.has(PERMISSION)) return { unlimited: true };
  if (isBooster(interaction) && boostStore.used(interaction.user.id, kind) < boostConfig.perks[kind]) return { unlimited: false };
  return null;
}

function accessError(interaction, kind, label) {
  if (isBooster(interaction)) {
    return replyError(interaction, `${label} ekleme takviye hakkını zaten kullanmışsın.`, `Takviye edenler ${boostConfig.perks[kind]} kez ekleyebilir.`);
  }
  return replyError(
    interaction,
    `${label} eklemek için "Emoji ve Çıkartmaları Yönet" iznin olmalı ya da sunucuyu takviye ediyor olman gerekir.`,
  );
}

// Emoji ekleme motoru: hem /emoji-ekle komutu hem de booster panelindeki form bunu kullanır
async function runEmojiAdd(interaction, emojiInput, customNameInput) {
  const perm = access(interaction, 'emoji');
  if (!perm) return accessError(interaction, 'emoji', 'Emoji');
  if (!interaction.guild.members.me.permissions.has(PERMISSION)) {
    return replyError(interaction, 'Botun "Emoji ve Çıkartmaları Yönet" izni yok.', 'Botun rolüne bu izni vermen gerekiyor.');
  }

  const { items, invalid } = parseInput(emojiInput);
  if (!items.length) return replyError(interaction, 'Eklenecek emoji bulunamadı.', 'Emojinin kendisini, ID\'sini ya da bağlantısını yazmalısın.');
  if (items.length > MAX_ITEMS) return replyError(interaction, `Bir seferde en fazla ${MAX_ITEMS} emoji ekleyebilirsin.`, 'Emojileri iki parçaya bölüp tekrar dene.');
  if (!perm.unlimited && items.length > 1) {
    return replyError(interaction, 'Takviye hakkınla bir seferde sadece bir emoji ekleyebilirsin.', 'Tek bir emoji yazıp tekrar dene.');
  }
  // Rastgele resim bağlantıları sadece emoji yönetme iznine sahip yetkililer içindir; takviye edenler Discord emojileri ekler
  if (!perm.unlimited && items.some((item) => item.url)) {
    return replyError(interaction, 'Takviye hakkınla sadece Discord emojileri eklenebilir.', 'Emojinin kendisini, ID\'sini ya da Discord emoji bağlantısını yaz.');
  }
  const customName = items.length === 1 ? customNameInput : null;

  await interaction.deferReply({ flags: core.CV2 });
  const { added, failed } = await addEmojis(interaction, items, customName);
  if (!perm.unlimited && added.length) boostStore.use(interaction.user.id, 'emoji');
  return respond(interaction, ui.result(added, [...failed, ...invalid]));
}

// /emoji-ekle emoji [isim]
const handleCommand = (interaction) => runEmojiAdd(interaction, interaction.options.getString('emoji', true), interaction.options.getString('isim'));

function stickerFailureReason(err) {
  if (err.code === 30039) return 'Sunucunun çıkartma sınırı dolu.';
  if (err.code === 50013) return 'Botun çıkartma ekleme yetkisi yok.';
  if (/size|512|large/i.test(err.message)) return 'Dosya çok büyük, çıkartma en fazla 512 KB olabilir.';
  return 'Eklenemedi.';
}

// /cikartma-ekle dosya isim etiket
async function handleStickerCommand(interaction) {
  const perm = access(interaction, 'sticker');
  if (!perm) return accessError(interaction, 'sticker', 'Çıkartma');
  if (!interaction.guild.members.me.permissions.has(PERMISSION)) {
    return replyError(interaction, 'Botun "Emoji ve Çıkartmaları Yönet" izni yok.', 'Botun rolüne bu izni vermen gerekiyor.');
  }

  const file = interaction.options.getAttachment('dosya', true);
  if (!/^image\/(png|gif)/.test(file.contentType ?? '')) return replyError(interaction, 'Sadece PNG, APNG ya da GIF dosyaları kabul edilir.', 'Başka türde bir dosyayı bu türlerden birine çevirip tekrar dene.');
  if (file.size > 512 * 1024) return replyError(interaction, 'Dosya çok büyük, çıkartma en fazla 512 KB olabilir.', 'Dosyayı küçültüp tekrar dene.');

  const name = interaction.options.getString('isim', true).trim();
  const tags = interaction.options.getString('etiket', true).trim();

  await interaction.deferReply({ flags: core.CV2 });
  const sticker = await interaction.guild.stickers
    .create({ file: file.url, name, tags, reason: `Çıkartma ekleyen: ${interaction.user.username}` })
    .catch((err) => {
      console.error('[emoji] Çıkartma eklenemedi:', err.message);
      return { error: stickerFailureReason(err) };
    });
  if (sticker.error) return respond(interaction, core.alert('Çıkartma eklenemedi.', sticker.error, 'danger'));

  if (!perm.unlimited) boostStore.use(interaction.user.id, 'sticker');
  return respond(interaction, core.alert('Çıkartma eklendi.', `\`${sticker.name}\` adıyla sunucuya eklendi.`, 'success'));
}

// Sağ tık > "Emojileri Sunucuya Ekle": mesajdaki ve tepkilerdeki emojileri listeler
async function handleMessageMenu(interaction) {
  const denied = permissionError(interaction);
  if (denied) return denied;

  const message = interaction.targetMessage;
  const found = new Map();
  for (const [, a, name, id] of message.content.matchAll(CUSTOM_EMOJI)) found.set(id, { id, name, animated: Boolean(a) });
  for (const reaction of message.reactions.cache.values()) {
    const { id, name, animated } = reaction.emoji;
    if (id) found.set(id, { id, name: name ?? 'emoji', animated: Boolean(animated) });
  }
  const emojis = [...found.values()].filter((e) => !interaction.guild.emojis.cache.has(e.id));

  if (!emojis.length) {
    return replyError(
      interaction,
      found.size ? 'Bu mesajdaki emojilerin hepsi zaten sunucuda.' : 'Bu mesajda eklenebilecek özel emoji yok.',
      found.size ? undefined : 'Sadece sunuculara ait özel emojiler eklenebilir, Discord\'un kendi emojileri eklenemez.',
    );
  }
  return respond(interaction, ui.pickPanel(emojis));
}

// Seçim menüsü: seçilen emojileri ekler, panel sonuca döner
async function handlePick(interaction) {
  const denied = permissionError(interaction);
  if (denied) return denied;
  const items = interaction.values.map((value) => {
    const [animated, name, id] = value.split(':');
    return { id, name, animated: animated === '1', input: `:${name}:` };
  });
  await interaction.deferUpdate();
  const { added, failed } = await addEmojis(interaction, items);
  return interaction.editReply({ components: [ui.result(added, failed)], allowedMentions: { parse: [] } });
}

module.exports = {
  name: 'emoji',
  runEmojiAdd,
  commands,
  help: {
    category: ['emoji', 'Emoji'],
    // Üye yardım menüsünde listelenmez: her iki komut da "Emoji ve Çıkartmaları Yönet" izni ister
    access: {
      'emoji-ekle':
        `Emoji yönetme izni olanlar; takviye edenler ${boostConfig.perks.emoji} emoji ekleyebilir. Bir mesaja sağ tık > Uygulamalar > ${MENU_NAME} ile de eklenir (sadece yetkililer).`,
      'cikartma-ekle': `Emoji yönetme izni olanlar; takviye edenler ${boostConfig.perks.sticker} çıkartma ekleyebilir.`,
    },
    need: {
      'emoji-ekle': '"Emoji ve Çıkartmaları Yönet" izni ya da takviye',
      'cikartma-ekle': '"Emoji ve Çıkartmaları Yönet" izni ya da takviye',
    },
  },
  slash: { 'emoji-ekle': handleCommand, 'cikartma-ekle': handleStickerCommand, [MENU_NAME]: handleMessageMenu },
  prefixed: [[ui.IDS.pick, handlePick]],
};
