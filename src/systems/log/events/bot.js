// Bot logları: botun slash ve sağ tık (uygulama) komutlarının kullanımı.
const { guildId } = require('../../../core/config');
const engine = require('../engine');
const ui = require('../ui');

async function handleInteraction(interaction) {
  if (interaction.guildId !== guildId) return;
  if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

  const command = interaction.isChatInputCommand() ? interaction.toString() : `/${interaction.commandName}`;
  await engine.send(
    interaction.client,
    'bot',
    ui.entry('primary', 'Komut Kullanıldı', [
      `**Kullanıcı:** <@${interaction.user.id}>`,
      `**Kanal:** <#${interaction.channelId}>`,
      `**Komut:** \`${command.slice(0, 500)}\``,
    ]),
  );
}

module.exports = { handleInteraction };
