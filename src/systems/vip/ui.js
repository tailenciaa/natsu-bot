// VIP mesajları: verme onayı ve VIP listesi (olma sırasına göre)
const { ContainerBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const { text, divider } = require('../../core/ui');

const PODIUM = ['# ', '## ', '### '];

// Verme onayı
function given(giverId, targetId, roleId) {
  return text(`**<@${giverId}>, <@${targetId}> kullanıcısına VIP verdi!** 👑\n-# <@${targetId}> artık <@&${roleId}> rolüne sahip.`);
}

// ranking: [{ userId }] VIP olma sırasına göre (en eski ilk)
function table(guild, ranking, roleId) {
  const headerText = text(`## ${guild.name} VIP Listesi\n-# <@&${roleId}> rolündeki üyeler, VIP olma sırasına göre`);
  const icon = guild.iconURL({ size: 256 });
  const container = new ContainerBuilder();
  if (icon) {
    container.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(headerText).setThumbnailAccessory(new ThumbnailBuilder().setURL(icon)),
    );
  } else {
    container.addTextDisplayComponents(headerText);
  }

  container.addSeparatorComponents(divider());
  const lines = ranking.length
    ? ranking.map(({ userId }, i) => `${i < 3 ? PODIUM[i] : '-# '}${i + 1}. <@${userId}>`)
    : ['-# Henüz VIP üye yok.'];
  container.addTextDisplayComponents(text(lines.join('\n')));

  return container;
}

module.exports = { given, table };
