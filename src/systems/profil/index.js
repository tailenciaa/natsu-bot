// Profil: /profil ile açılır, sunucu üzerindeki her şeyin tek görsel kartta göründüğü kişisel profil (Discord'un
// kendi profili gibi düşün). Şu an seviye ve sıralama var; ileride coin/para sistemi de buraya eklenecek. Sahibi
// kendi profilinde "Profili Düzenle" ile biyografi ve profil rengini özelleştirebilir (kart o renkte çizilir).
const { AttachmentBuilder, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { replyError, isMenuOwner } = require('../../core/helpers');
const seviyeStore = require('../seviye/store');
const siralamaStore = require('../siralama/store');
const { buildProfileCard } = require('./card');
const store = require('./store');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Sunucu profilini gösterir: seviye, sıralama ve daha fazlası.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Profili görüntülenecek kullanıcı (boş bırakırsan kendi profilin)')),
];

// Kullanıcının genel sıralamadaki yeri (siralama sistemindeki tüm zamanlar toplamına göre)
function rankOf(kind, userId) {
  const sorted = [...siralamaStore.totals(kind, null).entries()].sort((a, b) => b[1] - a[1]);
  const index = sorted.findIndex(([id]) => id === userId);
  return index === -1 ? null : index + 1;
}

function viewDataOf(userId) {
  return {
    custom: store.get(userId),
    mesajXp: seviyeStore.xpOf('mesaj', userId),
    sesXp: seviyeStore.xpOf('ses', userId),
    mesajRank: rankOf('messages', userId),
    sesRank: rankOf('voice', userId),
  };
}

async function buildMessage(user, isSelf) {
  const buffer = await buildProfileCard(user, viewDataOf(user.id));
  return {
    components: [ui.profile('profil.png', isSelf)],
    files: [new AttachmentBuilder(buffer, { name: 'profil.png' })],
    flags: core.CV2,
    allowedMentions: { parse: [] },
  };
}

// /profil [kullanici]
async function handleCommand(interaction) {
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  if (user.bot) return replyError(interaction, 'Botların profili bulunmaz.');
  return interaction.reply(await buildMessage(user, user.id === interaction.user.id));
}

// "Profili Düzenle": profil herkese açık olsa da sadece komutu kullanan (profil sahibi) basabilir
async function handleEditButton(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Sadece kendi profilini düzenleyebilirsin.', '/profil yazarak kendi profilini açabilirsin.');
  }
  return interaction.showModal(ui.editModal(store.get(interaction.user.id)));
}

// Form: kaydeder ve profil kartını yeniden çizip mesajı günceller
async function handleEditSubmit(interaction) {
  const bio = interaction.fields.getTextInputValue('bio').trim() || null;
  const colorInput = interaction.fields.getTextInputValue('renk').trim();
  let color = null;
  if (colorInput) {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(colorInput);
    if (!match) return replyError(interaction, 'Renk anlaşılamadı.', 'Örnek: #ff5599 ya da ff5599');
    color = parseInt(match[1], 16);
  }
  store.set(interaction.user.id, { bio, color });

  const message = await buildMessage(interaction.user, true);
  return interaction.update({ ...message, attachments: [] });
}

module.exports = {
  name: 'profil',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { profil: 'Herkes' } },
  slash: { profil: handleCommand },
  buttons: { [ui.IDS.edit]: handleEditButton },
  modals: { [ui.IDS.form]: handleEditSubmit },
};
