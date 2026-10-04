// Profil: /profil ile açılır, sunucu üzerindeki her şeyin tek görsel kartta göründüğü kişisel profil. Sahibi kendi
// profilinin altındaki kontrollerle (biyografi, unvan, renk, kapak görseli, tema) kartı canlı olarak özelleştirir;
// her değişiklikte kart yeniden çizilip aynı mesaj güncellenir. İleride coin/para sistemi de buraya eklenecek.
const { AttachmentBuilder, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { replyError, isMenuOwner } = require('../../core/helpers');
const seviyeStore = require('../seviye/store');
const siralamaStore = require('../siralama/store');
const { buildProfileCard } = require('./card');
const { THEMES } = require('./themes');
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
function rankOf(totals, userId) {
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const index = sorted.findIndex(([id]) => id === userId);
  return index === -1 ? null : index + 1;
}

async function viewDataOf(guild, userId) {
  const messages = siralamaStore.totals('messages', null);
  const voice = siralamaStore.totals('voice', null);
  const member = await guild.members.fetch(userId).catch(() => null);
  return {
    custom: store.get(userId),
    roleColor: member?.displayColor ?? 0,
    mesajXp: seviyeStore.xpOf('mesaj', userId),
    sesXp: seviyeStore.xpOf('ses', userId),
    mesajRank: rankOf(messages, userId),
    sesRank: rankOf(voice, userId),
    joinedAt: member?.joinedTimestamp ?? null,
    messageCount: messages.get(userId) ?? 0,
    voiceSeconds: voice.get(userId) ?? 0,
  };
}

async function buildMessage(guild, user, isSelf) {
  const view = await viewDataOf(guild, user.id);
  const buffer = await buildProfileCard(user, view);
  return {
    components: [ui.profile('profil.png', isSelf, view.custom.theme)],
    files: [new AttachmentBuilder(buffer, { name: 'profil.png' })],
    flags: core.CV2,
    allowedMentions: { parse: [] },
  };
}

// /profil [kullanici]
async function handleCommand(interaction) {
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  if (user.bot) return replyError(interaction, 'Botların profili bulunmaz.');
  await interaction.deferReply();
  return interaction.editReply(await buildMessage(interaction.guild, user, user.id === interaction.user.id));
}

// Düzenleme sonrası: kartı yeniden çizip aynı mesajı günceller
async function refresh(interaction) {
  const message = await buildMessage(interaction.guild, interaction.user, true);
  return interaction.editReply({ ...message, attachments: [] });
}

const COLOR = /^#?([0-9a-fA-F]{6})$/;

// Kapak görseli bağlantısı: https olmalı; botun kendi ağındaki adreslere (localhost, IP) istek atmasın diye bunlar reddedilir
function isImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname) && !url.hostname.startsWith('[') && !url.hostname.endsWith('.local');
  } catch {
    return false;
  }
}

// Bütün düzenleme düğmeleri, tema menüsü ve formlar profil-ayar:<eylem> ile gelir; sadece profil sahibi kullanabilir
async function handleSettings(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Sadece kendi profilini düzenleyebilirsin.', '/profil yazarak kendi profilini açabilirsin.');
  }
  const action = interaction.customId.split(':')[1];
  const current = store.get(interaction.user.id);

  switch (action) {
    case 'bio':
      return interaction.showModal(ui.bioModal(current));
    case 'renk':
      return interaction.showModal(ui.colorModal(current));
    case 'kapak':
      return interaction.showModal(ui.bannerModal(current));
    case 'sifirla':
      await interaction.deferUpdate();
      store.set(interaction.user.id, { bio: null, title: null, color: null, theme: null, banner: null });
      return refresh(interaction);
    case 'tema': {
      const theme = interaction.values[0];
      if (!THEMES[theme]) return interaction.deferUpdate();
      await interaction.deferUpdate();
      store.set(interaction.user.id, { theme });
      return refresh(interaction);
    }
    case 'bio-form':
      await interaction.deferUpdate();
      store.set(interaction.user.id, {
        bio: interaction.fields.getTextInputValue('bio').trim() || null,
        title: interaction.fields.getTextInputValue('unvan').trim() || null,
      });
      return refresh(interaction);
    case 'renk-form': {
      const value = interaction.fields.getTextInputValue('renk').trim();
      const match = COLOR.exec(value);
      if (value && !match) return replyError(interaction, 'Renk anlaşılamadı.', 'Örnek: #ff5599 ya da ff5599');
      await interaction.deferUpdate();
      store.set(interaction.user.id, { color: match ? parseInt(match[1], 16) : null });
      return refresh(interaction);
    }
    case 'kapak-form': {
      const value = interaction.fields.getTextInputValue('kapak').trim();
      if (value && !isImageUrl(value)) return replyError(interaction, 'Bağlantı anlaşılamadı.', 'Görsel bağlantısı https ile başlayan, herkese açık bir adres olmalı.');
      await interaction.deferUpdate();
      store.set(interaction.user.id, { banner: value || null });
      return refresh(interaction);
    }
    default:
      return undefined;
  }
}

module.exports = {
  name: 'profil',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { profil: 'Herkes' } },
  slash: { profil: handleCommand },
  prefixed: [[ui.IDS.prefix, handleSettings]],
};
