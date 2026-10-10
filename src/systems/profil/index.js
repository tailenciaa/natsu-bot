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
    .setDescription('Seviye, sıralama ve istatistiklerinle sunucu profilini gösterir.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Profiline bakılacak üyeyi seçer, boş bırakırsan kendi profilin gösterilir.')),
];

async function viewDataOf(guild, userId) {
  const messages = siralamaStore.totals('messages', null);
  const voice = siralamaStore.totals('voice', null);
  const member = await guild.members.fetch(userId).catch(() => null);
  return {
    custom: store.get(userId),
    roleColor: member?.displayColor ?? 0,
    mesajXp: seviyeStore.xpOf('mesaj', userId),
    sesXp: seviyeStore.xpOf('ses', userId),
    mesajRank: siralamaStore.rankIn(messages, userId),
    sesRank: siralamaStore.rankIn(voice, userId),
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
  if (user.bot) return replyError(interaction, 'Botların profili bulunmaz.', 'Bir üye seçerek tekrar dene.');
  await interaction.deferReply();
  return interaction.editReply(await buildMessage(interaction.guild, user, user.id === interaction.user.id));
}

// Düzenleme sonrası: kartı yeniden çizip aynı mesajı günceller
async function refresh(interaction) {
  const message = await buildMessage(interaction.guild, interaction.user, true);
  return interaction.editReply({ ...message, attachments: [] });
}

const COLOR = /^#?([0-9a-fA-F]{6})$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

// Kapak görseli gerçekten açılıyor mu: 5 saniyelik zaman aşımıyla içerik türü ve boyut denetlenir (yönlendirmeler izlenmez).
// Sorun varsa kullanıcıya gösterilecek ipucunu, sorun yoksa null döndürür.
async function checkImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    res.body?.cancel().catch(() => {});
    if (!res.ok) return 'Bağlantı açılamadı. Görselin **herkese açık** olduğundan emin ol.';
    if (!/^image\/(png|jpe?g|gif|webp)/i.test(res.headers.get('content-type') ?? '')) return 'Bağlantı **PNG, JPG, GIF** ya da **WebP** biçiminde bir görsele gitmeli.';
    if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return 'Görsel en fazla **8 MB** olabilir.';
    return null;
  } catch {
    return 'Bağlantı açılamadı. Adresi kontrol edip tekrar dene.';
  }
}

// Bütün düzenleme düğmeleri, tema menüsü ve formlar profil-ayar:<eylem> ile gelir; sadece profil sahibi kullanabilir
async function handleSettings(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Sadece kendi profilini düzenleyebilirsin.', '**/profil** yazarak kendi profilini açıp düzenleyebilirsin.');
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
      if (value && !match) return replyError(interaction, 'Renk kodu geçersiz.', '**Altı haneli** bir hex kod yaz, örneğin **#ff5599**.');
      const color = match ? parseInt(match[1], 16) : null;
      await interaction.deferUpdate();
      store.set(interaction.user.id, { color });
      return refresh(interaction);
    }
    case 'kapak-form': {
      const value = interaction.fields.getTextInputValue('kapak').trim();
      if (value && !isImageUrl(value)) return replyError(interaction, 'Görsel bağlantısı geçersiz.', 'Bağlantı **https** ile başlayan, herkese açık bir görsel adresi olmalı.');
      await interaction.deferUpdate();
      const problem = value ? await checkImage(value) : null;
      if (problem) return replyError(interaction, 'Kapak görseli kaydedilmedi.', problem);
      store.set(interaction.user.id, { banner: value || null });
      return refresh(interaction);
    }
    default:
      return interaction.deferUpdate();
  }
}

module.exports = {
  name: 'profil',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { profil: 'Herkes' } },
  slash: { profil: handleCommand },
  prefixed: [[ui.IDS.prefix, handleSettings]],
};
