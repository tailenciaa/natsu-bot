// Bot logları: botun slash ve sağ tık (uygulama) komutlarının kullanımı.
const { guildId } = require('../../../core/config');
const engine = require('../engine');
const ui = require('../ui');

async function handleInteraction(interaction) {
  if (interaction.guildId !== guildId) return;
  if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

  const command = interaction.isChatInputCommand() ? interaction.toString() : `/${interaction.commandName}`;
  const short = command.length > 240 ? `${command.slice(0, 240)}…` : command; // uzun seçenek listeleri kartı basar
  await engine.send(
    interaction.client,
    'bot',
    ui.entry('primary', 'Komut Kullanıldı', [
      `**Kullanıcı:** <@${interaction.user.id}>`,
      `**Kanal:** <#${interaction.channelId}>`,
      `**Komut:** \`${short}\``,
    ], [
      `**Kullanıcı:** <@${interaction.user.id}>`,
      `**Kullanıldığı zaman:** <t:${Math.floor(Date.now() / 1000)}:D> <t:${Math.floor(Date.now() / 1000)}:T>`,
      `**Kanal:** <#${interaction.channelId}>`,
      `**Komut (tamamı):**\n\`\`\`text\n${command.slice(0, 1500)}\n\`\`\``,
    ]),
  );
}

module.exports = { handleInteraction };
