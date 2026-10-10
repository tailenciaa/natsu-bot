// Sunucu takviyesi (boost): biri takviye başlattığında DM ile teşekkür eder, teşekkür kanalına kısa bir bildirim
// düşer. "Booster İşlemleri" paneli (#panelChannel) sadece takviye edenler için: takma ad değiştirme ve kendi
// renginde/emojinde özel rol oluşturma/düzenleme (emoji ve çıkartma /emoji-ekle ve /cikartma-ekle ile eklenir).
// Takma ad ve rol takviye sürdüğü sürece geçerli; takviye bitince (GuildMemberUpdate) ya da üye sunucudan ayrılınca
// otomatik geri alınır.
const { Events } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { respond, replyError, fetchTextChannel } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const emoji = require('../emoji');
const config = require('./config');
const store = require('./store');
const ui = require('./ui');

const isBooster = (interaction) => Boolean(interaction.member?.premiumSince);
const notBooster = (interaction) => respond(interaction, ui.notBoosterView(), { ephemeral: true });
const errorCode = (err) => err?.code ?? err?.rawError?.code;

// Takviye bitince (ya da üye ayrılınca) verilen özel rol silinir; kayıt sadece işlem başarılıysa temizlenir
async function revokeRole(guild, userId) {
  const roleId = store.getRole(userId);
  if (!roleId) return;
  const role = await guild.roles.fetch(roleId).catch((err) => (errorCode(err) === 10011 ? null : undefined));
  if (role === undefined) return console.error('[boost] Özel rol getirilemedi, kayıt korundu.');
  if (role) {
    const deleted = await role.delete('Takviye sona erdi, özel rol kaldırıldı').then(() => true, (err) => {
      console.error('[boost] Özel rol silinemedi, kayıt korundu:', err.message);
      return false;
    });
    if (!deleted) return;
  }
  store.clearRole(userId);
}

// premiumSince önce boştu şimdi doluysa takviye yeni başlamış, tam tersiyse yeni bitmiş demektir
async function handleMemberUpdate(oldMember, newMember) {
  if (newMember.guild.id !== guildId) return;
  // Önbellekte olmayan (partial) eski üyede takviye bilgisi bilinmez, yanlışlıkla "yeni takviye" sayılmasın
  if (oldMember.partial) return;
  const started = !oldMember.premiumSince && newMember.premiumSince;
  const ended = oldMember.premiumSince && !newMember.premiumSince;
  if (!started && !ended) return;

  if (started) {
    await newMember.user
      .send({ components: [ui.thanksDm(newMember.guild.name, config.panelChannel, config.perks)], flags: core.CV2 })
      .catch(() => {});
    const channel = await fetchTextChannel(newMember.guild, config.channel);
    await channel
      ?.send({ components: [ui.channelThanks(newMember.user)], flags: core.CV2, allowedMentions: { users: [newMember.id] } })
      .catch(() => {});
    return;
  }

  // Takviye bitti: değiştirilen takma ad, hazır renk rolü ve verilen özel rol geri alınır
  if (store.hasSavedNick(newMember.id)) {
    const restored = await newMember.setNickname(store.getSavedNick(newMember.id), 'Takviye sona erdi, takma ad eski haline döndü').then(() => true, (err) => {
      console.error('[boost] Takma ad geri alınamadı, kayıt korundu:', err.message);
      return false;
    });
    if (restored) store.clearNick(newMember.id);
  }
  const colorIds = newMember.roles.cache.filter((r) => config.colorRoles.some((c) => c.roleId === r.id)).map((r) => r.id);
  if (colorIds.length) await newMember.roles.remove(colorIds, 'Takviye sona erdi, renk rolü kaldırıldı').catch((err) => console.error('[boost] Renk rolü alınamadı:', err.message));
  const iconIds = newMember.roles.cache.filter((r) => config.iconRoles.some((c) => c.roleId === r.id)).map((r) => r.id);
  if (iconIds.length) await newMember.roles.remove(iconIds, 'Takviye sona erdi, simge rolü kaldırıldı').catch((err) => console.error('[boost] Simge rolü alınamadı:', err.message));
  await revokeRole(newMember.guild, newMember.id);
}

// Takviye eden üye sunucudan ayrılırsa özel rolü (ve kayıtları) temizlenir; takma ad zaten kendiliğinden gider
async function handleMemberRemove(member) {
  if (member.guild.id !== guildId) return;
  await revokeRole(member.guild, member.id);
  store.clearNick(member.id);
}

function sendPanel(client) {
  if (!config.panelChannel) return;
  return syncPanel(client, {
    key: 'boost-panel',
    label: 'Booster İşlemleri',
    channelId: config.panelChannel,
    buttonId: ui.IDS.nick,
    build: () => ui.panel(client.guilds.cache.get(guildId)),
    image: '',
  });
}

// ── Emoji Ekle: eski panellerdeki buton; emoji sistemindeki motoru form üzerinden çağırır ──

const handleEmojiButton = (interaction) => (isBooster(interaction) ? interaction.showModal(ui.emojiModal()) : notBooster(interaction));

const handleEmojiForm = (interaction) =>
  emoji.runEmojiAdd(
    interaction,
    interaction.fields.getTextInputValue(ui.IDS.emojiField).trim(),
    interaction.fields.getTextInputValue(ui.IDS.nameField).trim() || null,
  );

// ── Çıkartma Ekle: eski panellerdeki buton; dosya yüklemesi modalla yapılamadığı için komuta yönlendirir ─

const handleStickerButton = (interaction) => respond(interaction, isBooster(interaction) ? ui.stickerInfoView() : ui.notBoosterView(), { ephemeral: true });

// ── Takma Ad ──────────────────────────────────────────────────────────────────────

const handleNickButton = (interaction) => (isBooster(interaction) ? interaction.showModal(ui.nickModal(interaction.member.nickname)) : notBooster(interaction));

async function handleNickForm(interaction) {
  if (!isBooster(interaction)) return notBooster(interaction);
  const member = interaction.member;
  if (!member.manageable) return replyError(interaction, 'Takma adını değiştiremiyorum.', 'Botun rolü senin rolünden üstte olmalı.');
  const newNick = interaction.fields.getTextInputValue(ui.IDS.nickField).trim();
  if (!newNick) return replyError(interaction, 'Takma ad boş olamaz.', 'Bir ad yazıp tekrar dene.');

  await interaction.deferReply({ flags: core.CV2 });
  const previousNick = member.nickname ?? null;
  const ok = await member
    .setNickname(newNick, 'Booster işlemleri: takma ad değişikliği')
    .then(() => true)
    .catch((err) => {
      console.error('[boost] Takma ad değiştirilemedi:', err.message);
      return false;
    });
  if (!ok) return respond(interaction, core.alert('Takma ad değiştirilemedi.', 'Botun rolü senin rolünden üstte olmalı.', 'danger'), { ephemeral: true });
  // Eski takma ad değişiklik başarılı olduktan sonra saklanır; sonraki değişikliklerde üzerine yazılmaz
  if (!store.hasSavedNick(member.id)) store.saveNick(member.id, previousNick);
  return respond(interaction, core.alert(`Takma adın \`${newNick.replace(/`/g, "'")}\` olarak değiştirildi.`, 'Takviyen bitince eski adına döner.', 'success'));
}

// ── Özel Rol ─────────────────────────────────────────────────────────────────

// Rol simgesi (unicode emoji) sunucuda takviye seviyesi 2 ister
const hasRoleIcons = (guild) => guild.features.includes('ROLE_ICONS');

async function handleRoleButton(interaction) {
  if (!isBooster(interaction)) return notBooster(interaction);
  const roleId = store.getRole(interaction.user.id);
  const existing = roleId ? await interaction.guild.roles.fetch(roleId).catch(() => null) : null;
  return interaction.showModal(ui.roleModal(existing, { icons: hasRoleIcons(interaction.guild) }));
}

// "#ff5599" / "ff5599" -> sayı, anlaşılmazsa null
const parseColor = (input) => {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return match ? parseInt(match[1], 16) : null;
};

// Boşsa null, tek emoji (ten rengi, bayrak, birleşik emojiler dahil) ise kendisi, anlaşılmazsa undefined döner
const parseRoleEmoji = (input) => {
  const value = input.trim();
  if (!value) return null;
  const graphemes = [...new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(value)];
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(value) ? value : undefined;
};

// Discord hata kodundan kullanıcıya gösterilecek ipucu
function roleErrorHint(err) {
  const code = errorCode(err);
  if (code === 50013) return 'Botun "Rolleri Yönet" izni ve rol sırası yeterli olmalı.';
  if (code === 50035) return 'Rol adı ya da rengi geçersiz, farklı bir değer dene.';
  return 'Birkaç dakika sonra tekrar dene.';
}

async function handleRoleForm(interaction) {
  if (!isBooster(interaction)) return notBooster(interaction);
  const { guild } = interaction;
  const icons = hasRoleIcons(guild);

  const name = interaction.fields.getTextInputValue(ui.IDS.roleNameField).trim();
  if (!name) return replyError(interaction, 'Rol adı boş olamaz.', 'Bir ad yazıp tekrar dene.');
  const color = parseColor(interaction.fields.getTextInputValue(ui.IDS.roleColorField));
  if (color === null) return replyError(interaction, 'Renk kodu geçersiz.', 'Altı haneli bir hex kod yaz, örneğin #ff5599.');
  const unicodeEmoji = icons ? parseRoleEmoji(interaction.fields.getTextInputValue(ui.IDS.roleEmojiField)) : undefined;
  if (unicodeEmoji === undefined && icons && interaction.fields.getTextInputValue(ui.IDS.roleEmojiField).trim()) {
    return replyError(interaction, 'Emoji anlaşılamadı.', 'Tek bir emoji yazmalısın, bu alanı boş da bırakabilirsin.');
  }

  await interaction.deferReply({ flags: core.CV2 });
  const existingId = store.getRole(interaction.user.id);
  let role = existingId ? await guild.roles.fetch(existingId).catch(() => null) : null;

  try {
    if (role) {
      await role.edit({ name, color, ...(icons ? { unicodeEmoji } : {}), hoist: true }, 'Booster işlemleri: özel rol güncellendi');
      // Rol üyeden alınmış olabilir; düzenleme sessizce başarılı görünüp rol eksik kalmasın
      if (!interaction.member.roles.cache.has(role.id)) await interaction.member.roles.add(role, 'Booster işlemleri: özel rol geri verildi');
    } else {
      role = await guild.roles.create({
        name,
        color,
        ...(icons ? { unicodeEmoji } : {}),
        permissions: [],
        mentionable: false,
        // Booster'ların diğer üyelerden üstte, ayrı bir grupta görünmesi için
        hoist: true,
        reason: `Booster özel rolü: ${interaction.user.username}`,
      });
      // Kayıt hemen yazılır; üyeye verilemezse rol silinip kayıt temizlenir (sahipsiz rol kalmasın)
      store.setRole(interaction.user.id, role.id);
      try {
        await interaction.member.roles.add(role, 'Booster işlemleri: özel rol verildi');
      } catch (err) {
        await role.delete('Özel rol üyeye verilemedi').catch(() => {});
        store.clearRole(interaction.user.id);
        throw err;
      }
    }
  } catch (err) {
    console.error('[boost] Özel rol oluşturulamadı/güncellenemedi:', err.message);
    return respond(interaction, core.alert('Rol oluşturulamadı ya da güncellenemedi.', roleErrorHint(err), 'danger'), { ephemeral: true });
  }

  return respond(interaction, core.alert(`Rolün \`${role.name.replace(/`/g, "'")}\` olarak ayarlandı.`, 'Takviyen bitince rol geri alınır.', 'success'));
}

// ── Renk Rolü: hazır (gradyan) rollerden birini tek seçimli seçme menüsü ──────

async function handleColorRole(interaction) {
  if (!isBooster(interaction)) return notBooster(interaction);
  const roleId = interaction.values[0];
  const allIds = config.colorRoles.map((c) => c.roleId);
  if (!allIds.includes(roleId)) return replyError(interaction, 'Bu renk rolü artık geçerli değil.', 'Güncel panelden başka bir renk seçebilirsin.');

  await interaction.deferReply({ flags: core.CV2 });
  // Önce yeni rol verilir; başarılıysa eskileri alınır (hata olursa üyenin rengi kaybolmaz)
  const ok = await interaction.member.roles
    .add(roleId, 'Booster işlemleri: renk rolü seçildi')
    .then(() => true)
    .catch((err) => {
      console.error('[boost] Renk rolü verilemedi:', err.message);
      return false;
    });
  if (!ok) return respond(interaction, core.alert('Renk rolü verilemedi.', 'Botun rolü bu rolden üstte olmalı.', 'danger'), { ephemeral: true });

  const stale = interaction.member.roles.cache.filter((r) => allIds.includes(r.id) && r.id !== roleId).map((r) => r.id);
  if (stale.length) await interaction.member.roles.remove(stale, 'Booster işlemleri: renk rolü değişti').catch((err) => console.error('[boost] Eski renk rolü alınamadı:', err.message));
  return respond(interaction, core.alert('Renk rolün ayarlandı.', undefined, 'success'));
}

// ── Simge Rolü: hazır rollerden birini tek seçimli seçme menüsü (renk rolüyle aynı mantık) ────

async function handleIconRole(interaction) {
  if (!isBooster(interaction)) return notBooster(interaction);
  const roleId = interaction.values[0];
  const allIds = config.iconRoles.map((c) => c.roleId);
  if (!allIds.includes(roleId)) return replyError(interaction, 'Bu simge rolü artık geçerli değil.', 'Güncel panelden başka bir simge seçebilirsin.');

  await interaction.deferReply({ flags: core.CV2 });
  const ok = await interaction.member.roles
    .add(roleId, 'Booster işlemleri: simge rolü seçildi')
    .then(() => true)
    .catch((err) => {
      console.error('[boost] Simge rolü verilemedi:', err.message);
      return false;
    });
  if (!ok) return respond(interaction, core.alert('Simge rolü verilemedi.', 'Botun rolü bu rolden üstte olmalı.', 'danger'), { ephemeral: true });

  const stale = interaction.member.roles.cache.filter((r) => allIds.includes(r.id) && r.id !== roleId).map((r) => r.id);
  if (stale.length) await interaction.member.roles.remove(stale, 'Booster işlemleri: simge rolü değişti').catch((err) => console.error('[boost] Eski simge rolü alınamadı:', err.message));
  return respond(interaction, core.alert('Simge rolün ayarlandı.', undefined, 'success'));
}

module.exports = {
  name: 'boost',
  buttons: {
    [ui.IDS.emoji]: handleEmojiButton,
    [ui.IDS.sticker]: handleStickerButton,
    [ui.IDS.nick]: handleNickButton,
    [ui.IDS.role]: handleRoleButton,
  },
  modals: {
    [ui.IDS.emojiForm]: handleEmojiForm,
    [ui.IDS.nickForm]: handleNickForm,
    [ui.IDS.roleForm]: handleRoleForm,
  },
  prefixed: [
    [ui.IDS.colorRole, handleColorRole],
    [ui.IDS.iconRole, handleIconRole],
  ],
  events: {
    [Events.ClientReady]: sendPanel,
    [Events.GuildMemberUpdate]: handleMemberUpdate,
    [Events.GuildMemberRemove]: handleMemberRemove,
  },
};
