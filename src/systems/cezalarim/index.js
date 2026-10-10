// Cezalarım paneli: #cezalarım kanalındaki sabit panelden üyeler kendi aktif cezalarının süresini ve sebebini
// öğrenebilir, haksız bulduğu bir cezaya destek talebi açarak itiraz edebilir. Panel diğer sistemlerdeki gibi
// bot açılınca kendiliğinden gönderilir (core/panel.js). Sonuç kartları herkese açıktır; yalnızca hata ve
// reddetme mesajları butona basana görünür.
const { Events } = require('discord.js');
const core = require('../../core/ui');
const { respond, replyError } = require('../../core/helpers');
const { syncPanel } = require('../../core/panel');
const destek = require('../destek');
const destekStore = require('../destek/store');
const sicilStore = require('../sicil/store');
const moderation = require('../sicil/moderation');
const config = require('./config');
const ui = require('./ui');

async function sendPanel(client) {
  if (config.channel) {
    await syncPanel(client, {
      key: 'cezalarim',
      label: 'Cezalarım',
      channelId: config.channel,
      buttonId: ui.IDS.sure,
      build: ui.panel,
      image: '',
    });
  }
  if (config.jailChannel) {
    await syncPanel(client, {
      key: 'cezalarim-jail',
      label: 'Jail Bilgilendirme',
      channelId: config.jailChannel,
      buttonId: ui.IDS.sure,
      build: ui.jailPanel,
      image: '',
    });
  }
}

const activePunishmentsOf = (interaction) =>
  sicilStore.of(interaction.guildId, interaction.user.id).filter((p) => p.status === 'active');

const handleSure = (interaction) => respond(interaction, ui.sureView(activePunishmentsOf(interaction)));
const handleSebep = (interaction) => respond(interaction, ui.sebepView(activePunishmentsOf(interaction)));

// "Cezaya İtiraz Et": aktif ceza yoksa uyarır, varsa seçme menüsünü gösterir
function handleItiraz(interaction) {
  const active = activePunishmentsOf(interaction);
  return respond(interaction, active.length ? ui.itirazPicker(active) : ui.itirazNoneView());
}

// Seçme menüsü: seçilen ceza için itiraz sebebi formu açılır
function handleItirazPick(interaction) {
  const punishment = activePunishmentsOf(interaction).find((p) => p.id === interaction.values[0]);
  if (!punishment) return replyError(interaction, 'Bu ceza artık aktif değil.');
  return interaction.showModal(ui.itirazModal(punishment));
}

// Form: itiraz, o cezaya özel bir destek talebi olarak açılır; talep açılınca alt başlığa ceza bilgisini ve
// yetkiliye onay/red butonlarını gösteren bir kart da gönderilir
function handleItirazSubmit(interaction) {
  const punishmentId = interaction.customId.slice(ui.IDS.itirazForm.length + 1);
  const punishment = activePunishmentsOf(interaction).find((p) => p.id === punishmentId);
  if (!punishment) return replyError(interaction, 'Bu ceza artık aktif değil.');
  const sebep = interaction.fields.getTextInputValue(ui.IDS.itirazReason).trim();

  return destek.createTicket(interaction, ui.itirazTicketReason(punishment), async (thread) => {
    destekStore.updateTicket(thread.id, { itirazPunishmentId: punishment.id, itirazSebep: sebep });
    // Kart gönderilemese de talep açılmış olur; hata sadece kayda geçer ki üyeye "talebin açıldı" cevabı gitsin
    await thread
      .send({ components: [ui.itirazCard(punishment, sebep, null)], flags: core.CV2, allowedMentions: { parse: [] } })
      .catch((err) => console.error('[cezalarim] İtiraz kartı gönderilemedi:', err.message));
  });
}

// "İtirazı Onayla" / "İtirazı Reddet": sadece ilgili ceza türünü kaldırma yetkisi olanlar karar verebilir
async function handleItirazKarar(interaction) {
  const rest = interaction.customId.slice(ui.IDS.itirazKarar.length + 1);
  const sep = rest.lastIndexOf(':');
  const punishmentId = rest.slice(0, sep);
  const sonuc = rest.slice(sep + 1);

  const ticket = destekStore.getTicket(interaction.channelId);
  if (!ticket || ticket.itirazPunishmentId !== punishmentId) return replyError(interaction, 'Bu itiraz talebi artık mevcut değil.');
  if (ticket.itirazKarar) return replyError(interaction, 'Bu itiraz için zaten bir karar verildi.');

  const punishment = sicilStore.get(punishmentId);
  if (!punishment) return replyError(interaction, 'Bu ceza kaydı artık mevcut değil.');
  if (!moderation.canPunish(interaction.member, punishment.type)) {
    return replyError(interaction, 'Bu ceza türü hakkında karar verme yetkin yok.');
  }
  if (sonuc === 'onayla' && punishment.status !== 'active') {
    return replyError(interaction, 'Bu ceza zaten sona ermiş veya kaldırılmış.');
  }

  // Karar await'lerden önce ayrılır: aynı anda basan ikinci yetkili yukarıdaki "zaten karar verildi" kontrolüne takılır
  destekStore.updateTicket(interaction.channelId, { itirazKarar: { sonuc, by: interaction.user.id, pending: true } });
  await interaction.deferUpdate();

  if (sonuc === 'onayla') {
    // Denetim kaydı açıklaması en fazla 512 karakter olabilir
    // Haksız bulunan ceza kaldırılıp sicilden de silinir; böylece ceza puanı düşer ve puana bağlı roller güncellenir
    const result = await moderation.remove(interaction.guild, punishment, interaction.user.id, core.shorten(`İtiraz kabul edildi: ${ticket.itirazSebep}`, 500));
    if (result.error) {
      destekStore.updateTicket(interaction.channelId, { itirazKarar: null });
      return respond(interaction, core.alert(result.error, result.hint, 'danger'));
    }
  }

  destekStore.updateTicket(interaction.channelId, { itirazKarar: { sonuc, by: interaction.user.id } });
  await interaction.editReply({
    components: [ui.itirazCard(punishment, ticket.itirazSebep, { sonuc, by: interaction.user.id })],
    allowedMentions: { parse: [] },
  });
}

module.exports = {
  name: 'cezalarim',
  buttons: {
    [ui.IDS.sure]: handleSure,
    [ui.IDS.sebep]: handleSebep,
    [ui.IDS.itiraz]: handleItiraz,
  },
  prefixed: [
    [ui.IDS.itirazPick, handleItirazPick],
    [ui.IDS.itirazForm, handleItirazSubmit],
    [ui.IDS.itirazKarar, handleItirazKarar],
  ],
  events: { [Events.ClientReady]: sendPanel },
};
