// Tüm sistemlerin ortak kullandığı etkileşim ve yetki yardımcıları
const { PermissionFlagsBits } = require('discord.js');
const { staffCommandChannel } = require('./config');
const ui = require('./ui');

// Etkileşimin durumuna göre doğru şekilde CV2 cevap verir.
// Butonlarda deferUpdate kullanıldığı için orijinal mesajın üzerine yazmamak adına followUp yapılır.
async function respond(interaction, container, { ephemeral = true, allowedMentions = { parse: [] } } = {}) {
  if (interaction.deferred && !interaction.replied && !interaction.isMessageComponent()) {
    return interaction.editReply({ components: [container], flags: ui.CV2, allowedMentions });
  }
  const payload = { components: [container], flags: ephemeral ? ui.EPHEMERAL_CV2 : ui.CV2, allowedMentions };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

const replyError = (interaction, message, hint) => respond(interaction, ui.alert(message, hint, 'danger'));

// Yöneticiler ya da verilen rollerden (tek rol ya da liste) birine sahip olanlar
function isStaff(interaction, roleIds) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = interaction.member?.roles;
  const wanted = [].concat(roleIds ?? []).filter(Boolean);
  if (!roles || !wanted.length) return false;
  return wanted.some((id) => (Array.isArray(roles) ? roles.includes(id) : roles.cache.has(id)));
}

async function fetchTextChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

// Herkese açık gönderilen menülerin (yardım, sicil) butonlarını sadece komutu kullanan kişi kullanabilir,
// başkası basınca menü herkesin önünde değişmesin diye
function isMenuOwner(interaction) {
  const ownerId = interaction.message?.interactionMetadata?.user?.id;
  return !ownerId || ownerId === interaction.user.id;
}

// Yetkili komutları sadece yetkili komut kanalında kullanılır
const inStaffChannel = (interaction) => !staffCommandChannel || interaction.channelId === staffCommandChannel;
const staffChannelError = (interaction) =>
  replyError(interaction, `Bu komut sadece <#${staffCommandChannel}> kanalında kullanılabilir.`);

module.exports = { respond, replyError, isStaff, fetchTextChannel, isMenuOwner, inStaffChannel, staffChannelError };
