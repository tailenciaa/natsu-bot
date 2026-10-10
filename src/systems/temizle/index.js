// Mesaj temizleme: /sil <sayı> komutunu kullanılan kanalda en son mesajlardan o sayıda siler.
// Discord toplu silmede 14 günden eski mesajları silemez ve tek seferde en fazla 100 mesaj siler.
const { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { staffPermission } = require('../../core/config');
const { respond, replyError } = require('../../core/helpers');

const commands = [
  new SlashCommandBuilder()
    .setName('sil')
    .setDescription('Bu kanalda belirttiğin sayıda mesajı siler.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(staffPermission)
    .addIntegerOption((o) =>
      o.setName('sayi').setDescription('Silinecek mesaj sayısını belirtir (1-100).').setMinValue(1).setMaxValue(100).setRequired(true),
    ),
];

async function handleSil(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    return replyError(interaction, 'Bu komut için Mesajları Yönet yetkisi gerekir.', 'Bu yetki yalnızca sohbet kanallarında geçerlidir; gerekirse bir yöneticiye ulaş.');
  }
  const { channel } = interaction;
  if (!channel?.isTextBased() || !channel.bulkDelete) return replyError(interaction, 'Bu kanalda mesaj silinemez.');
  if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
    return replyError(interaction, 'Botun bu kanalda mesaj silme yetkisi yok.', 'Botun Mesajları Yönet iznini kontrol et.');
  }

  const amount = interaction.options.getInteger('sayi', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // true: 14 günden eski mesajlar sessizce atlanır
  const deleted = await channel.bulkDelete(amount, true).catch((err) => {
    console.error('[sil] Mesajlar silinemedi:', err.message);
    return null;
  });
  if (!deleted) return replyError(interaction, 'Mesajlar silinemedi.', 'Botun kanal yetkilerini kontrol et.');
  if (deleted.size === 0) {
    return replyError(interaction, 'Silinecek mesaj bulunamadı.', '14 günden eski mesajlar silinemez.');
  }

  const skipped = amount - deleted.size;
  return respond(
    interaction,
    core.alert(
      `${deleted.size} mesaj silindi.`,
      skipped > 0 ? `Kanalda daha az mesaj vardı ya da ${skipped} mesaj 14 günden eskiydi.` : null,
      'success',
    ),
  );
}

module.exports = {
  name: 'temizle',
  commands,
  help: { category: ['yetki', 'Yetkili İşlemleri'], access: { sil: 'Mesajları Yönet yetkisi olanlar' }, },
  slash: { sil: handleSil },
};
