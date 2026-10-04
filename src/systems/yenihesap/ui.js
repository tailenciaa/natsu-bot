// Yeni/şüpheli hesap sisteminin mesajları: kısıtlı kanaldaki bilgilendirme paneli ve "ne zaman kalkacak" sonucu.
const { ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder } = require('discord.js');
const { text, divider, unix, notice } = require('../../core/ui');
const { botName, panelTitle } = require('../../core/config');
const config = require('./config');

const IDS = {
  sure: 'yenihesap:sure',
};

function panel() {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      text(
        `${panelTitle(`${botName} Hesap Doğrulama`)}\n-# Yeni açılan hesaplar güvenlik amacıyla bir süre kısıtlı kanalda bekletilir; aşağıdaki butonla kısıtlamanın ne zaman kalkacağını kendi hesabın için öğrenebilirsin.`,
      ),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          text(`**Kısıtlama Durumu**\nDiscord hesabın ${config.thresholdDays} günden yeni olduğu için şu an sadece bu kanalı görebiliyorsun.`),
        )
        .setButtonAccessory(new ButtonBuilder().setCustomId(IDS.sure).setLabel('Ne Zaman Kalkacak?').setStyle(ButtonStyle.Success)),
    )
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text('-# Hesabın yeterince eskiyince kısıtlama kendiliğinden kalkar, tüm kanallara erişebilirsin.'));
}

// "Ne Zaman Kalkacak?": hesap eşiğe ulaşana kadar kalan süre
function sureView(user, hasRestriction) {
  if (!hasRestriction) return notice('✅ Hesabın artık kısıtlı değil, tüm kanalları görebilirsin.', 'success');
  const freeAt = user.createdTimestamp + config.thresholdDays * 24 * 60 * 60 * 1000;
  return notice(`⏳ Kısıtlaman <t:${unix(freeAt)}:R> kendiliğinden kalkacak.`, 'warning');
}

module.exports = { IDS, panel, sureView };
