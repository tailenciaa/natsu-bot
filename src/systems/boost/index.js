// Sunucu takviyesi (boost): biri takviye başlattığında DM ile teşekkür eder, teşekkür kanalına kısa bir bildirim
// düşer. "Booster İşlemleri" paneli (#panelChannel) sadece takviye edenler için: emoji ekleme (/emoji-ekle ile
// aynı motor), çıkartma ekleme (dosya gerektirdiği için sadece /cikartma-ekle'ye yönlendirir), isim değiştirme ve
// kendi renginde/emojinde özel rol oluşturma/düzenleme. İsim ve rol takviye sürdüğü sürece geçerli; takviye
// bitince (GuildMemberUpdate) otomatik geri alınır.
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

// premiumSince önce boştu şimdi doluysa takviye yeni başlamış, tam tersiyse yeni bitmiş demektir
async function handleMemberUpdate(oldMember, newMember) {
  if (newMember.guild.id !== guildId) return;
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

  // Takviye bitti: değiştirilen takma ad ve verilen özel rol geri alınır
  if (store.hasSavedNick(newMember.id)) {
    await newMember.setNickname(store.getSavedNick(newMember.id), 'Takviye sona erdi, isim eski haline döndü').catch(() => {});
    store.clearNick(newMember.id);
  }
  const roleId = store.getRole(newMember.id);
  if (roleId) {
    const role = await newMember.guild.roles.fetch(roleId).catch(() => null);
    await role?.delete('Takviye sona erdi, özel rol kaldırıldı').catch(() => {});
    store.clearRole(newMember.id);
  }
}

function sendPanel(client) {
  if (!config.panelChannel) return;
  return syncPanel(client, {
    key: 'boost-panel',
    label: 'Booster İşlemleri',
    channelId: config.panelChannel,
    buttonId: ui.IDS.emoji,
    build: () => ui.panel(client.guilds.cache.get(guildId)),
    image: '',
  });
}

// ── Emoji Ekle: emoji sistemindeki motoru form üzerinden çağırır ──────────────

const handleEmojiButton = (interaction) => (isBooster(interaction) ? interaction.showModal(ui.emojiModal()) : respond(interaction, ui.notBoosterView()));

const handleEmojiForm = (interaction) =>
  emoji.runEmojiAdd(
    interaction,
    interaction.fields.getTextInputValue(ui.IDS.emojiField).trim(),
    interaction.fields.getTextInputValue(ui.IDS.nameField).trim() || null,
  );

// ── Çıkartma Ekle: dosya yüklemesi modalla yapılamadığı için komuta yönlendirir ─

const handleStickerButton = (interaction) => respond(interaction, isBooster(interaction) ? ui.stickerInfoView() : ui.notBoosterView());

// ── İsim Değiştir ──────────────────────────────────────────────────────────────

const handleNickButton = (interaction) =>
  isBooster(interaction) ? interaction.showModal(ui.nickModal(interaction.member.nickname)) : respond(interaction, ui.notBoosterView());

async function handleNickForm(interaction) {
  if (!isBooster(interaction)) return replyError(interaction, 'Bu işlem sadece takviye eden üyeler içindir.');
  const member = interaction.member;
  if (!member.manageable) return replyError(interaction, 'Botun rolü senin takma adını değiştirmeye yetmiyor.');
  const newNick = interaction.fields.getTextInputValue(ui.IDS.nickField).trim();

  await interaction.deferReply({ flags: core.EPHEMERAL });
  if (!store.hasSavedNick(member.id)) store.saveNick(member.id, member.nickname ?? null);
  const ok = await member
    .setNickname(newNick, 'Booster işlemleri: isim değişikliği')
    .then(() => true)
    .catch((err) => {
      console.error('[boost] Takma ad değiştirilemedi:', err.message);
      return false;
    });
  if (!ok) return respond(interaction, core.alert('Takma ad değiştirilemedi.', 'Botun rolü senin rolünden üstte olmalı.', 'danger'));
  return respond(interaction, core.alert(`Takma adın **${newNick}** olarak değiştirildi.`, 'Takviyen bitince eski adına döner.', 'success'));
}

// ── Özel Rol ─────────────────────────────────────────────────────────────────

async function handleRoleButton(interaction) {
  if (!isBooster(interaction)) return respond(interaction, ui.notBoosterView());
  const roleId = store.getRole(interaction.user.id);
  const existing = roleId ? await interaction.guild.roles.fetch(roleId).catch(() => null) : null;
  return interaction.showModal(ui.roleModal(existing));
}

// "#ff5599" / "ff5599" -> sayı, anlaşılmazsa null
const parseColor = (input) => {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return match ? parseInt(match[1], 16) : null;
};

// Boşsa null, tek emoji ise kendisi, anlaşılmazsa undefined döner
const parseRoleEmoji = (input) => {
  const value = input.trim();
  if (!value) return null;
  return /^\p{Extended_Pictographic}️?$/u.test(value) ? value : undefined;
};

async function handleRoleForm(interaction) {
  if (!isBooster(interaction)) return replyError(interaction, 'Bu işlem sadece takviye eden üyeler içindir.');

  const name = interaction.fields.getTextInputValue(ui.IDS.roleNameField).trim();
  const color = parseColor(interaction.fields.getTextInputValue(ui.IDS.roleColorField));
  if (color === null) return replyError(interaction, 'Renk anlaşılamadı.', 'Örnek: #ff5599 ya da ff5599');
  const unicodeEmoji = parseRoleEmoji(interaction.fields.getTextInputValue(ui.IDS.roleEmojiField));
  if (unicodeEmoji === undefined) {
    return replyError(interaction, 'Emoji anlaşılamadı.', 'Tek bir emoji yazmalısın, bu alanı boş da bırakabilirsin.');
  }

  await interaction.deferReply({ flags: core.EPHEMERAL });
  const { guild } = interaction;
  const existingId = store.getRole(interaction.user.id);
  let role = existingId ? await guild.roles.fetch(existingId).catch(() => null) : null;

  try {
    if (role) {
      await role.edit({ name, color, unicodeEmoji, hoist: true }, 'Booster işlemleri: özel rol güncellendi');
    } else {
      role = await guild.roles.create({
        name,
        color,
        unicodeEmoji,
        permissions: [],
        mentionable: false,
        // Booster'ların diğer üyelerden üstte, ayrı bir grupta görünmesi için
        hoist: true,
        reason: `Booster özel rolü: ${interaction.user.username}`,
      });
      await interaction.member.roles.add(role, 'Booster işlemleri: özel rol verildi');
      store.setRole(interaction.user.id, role.id);
    }
  } catch (err) {
    console.error('[boost] Özel rol oluşturulamadı/güncellenemedi:', err.message);
    return respond(interaction, core.alert('Rol oluşturulamadı/güncellenemedi.', 'Botun "Rolleri Yönet" izni ve rol sırası yeterli olmalı.', 'danger'));
  }

  return respond(interaction, core.alert(`Rolün **${role.name}** olarak ayarlandı.`, 'Takviyen bitince rol geri alınır.', 'success'));
}

// ── Renk Rolü: hazır (gradyan) rollerden birini tek seçimli seçme menüsü ──────

async function handleColorRole(interaction) {
  if (!isBooster(interaction)) return replyError(interaction, 'Bu işlem sadece takviye eden üyeler içindir.');
  const roleId = interaction.values[0];
  if (roleId === ui.NO_COLOR_ROLE) return respond(interaction, core.alert('Renk rolleri henüz hazır değil.', 'Çok yakında buradan seçebileceksin.', 'primary'));
  const allIds = config.colorRoles.map((c) => c.roleId);

  const toRemove = interaction.member.roles.cache.filter((r) => allIds.includes(r.id) && r.id !== roleId);
  for (const r of toRemove.values()) await interaction.member.roles.remove(r, 'Booster işlemleri: renk rolü değişti').catch(() => {});

  const ok = await interaction.member.roles
    .add(roleId, 'Booster işlemleri: renk rolü seçildi')
    .then(() => true)
    .catch((err) => {
      console.error('[boost] Renk rolü verilemedi:', err.message);
      return false;
    });
  return respond(
    interaction,
    ok ? core.alert('Renk rolün ayarlandı.', undefined, 'success') : core.alert('Renk rolü verilemedi.', 'Botun rolü bu rolden üstte olmalı.', 'danger'),
  );
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
  prefixed: [[ui.IDS.colorRole, handleColorRole]],
  events: {
    [Events.ClientReady]: sendPanel,
    [Events.GuildMemberUpdate]: handleMemberUpdate,
  },
};
