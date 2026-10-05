// Ses logları: ses kanalına giriş/çıkış/taşınma, kendi/sunucu susturması ve sağırlaştırması, yayın ve kamera.
const { AuditLogEvent } = require('discord.js');
const audit = require('../audit');
const engine = require('../engine');
const ui = require('../ui');

// oldValue/newValue true ise "açıldı" yazdırır, false ise "kapandı"; değişmediyse null (satır eklenmez)
function flagChange(label, oldValue, newValue) {
  if (oldValue === newValue) return null;
  return `**${label}:** ${newValue ? 'açıldı' : 'kapandı'}`;
}

async function handleVoiceStateUpdate(oldState, newState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.id === newState.client.user.id) return; // botun kendi ses durumu loglanmaz

  if (oldState.channelId !== newState.channelId) {
    if (!oldState.channelId) {
      await engine.send(
        newState.client,
        'ses',
        ui.entry('success', 'Ses Kanalına Girdi', [`**Kullanıcı:** <@${member.id}>`, `**Kanal:** <#${newState.channelId}>`]),
      );
    } else if (!newState.channelId) {
      await engine.send(
        newState.client,
        'ses',
        ui.entry('danger', 'Ses Kanalından Çıktı', [`**Kullanıcı:** <@${member.id}>`, `**Kanal:** <#${oldState.channelId}>`]),
      );
    } else {
      await engine.send(
        newState.client,
        'ses',
        ui.entry('warning', 'Ses Kanalı Değiştirdi', [
          `**Kullanıcı:** <@${member.id}>`,
          `**Önceki:** <#${oldState.channelId}>`,
          `**Yeni:** <#${newState.channelId}>`,
        ]),
      );
    }
  }

  // Durum değişiklikleri sadece aynı kanalda kalarak olanlar için loglanır: girişte/çıkışta/taşınmada zaten kendi logu var
  if (!oldState.channelId || !newState.channelId || oldState.channelId !== newState.channelId) return;

  const changes = [
    flagChange('Kendi mikrofonu', !oldState.selfMute, !newState.selfMute),
    flagChange('Kendi kulaklığı', !oldState.selfDeaf, !newState.selfDeaf),
    flagChange('Sunucu susturması', oldState.serverMute, newState.serverMute),
    flagChange('Sunucu sağırlaştırması', oldState.serverDeaf, newState.serverDeaf),
    flagChange('Canlı yayın', oldState.streaming, newState.streaming),
    flagChange('Kamera', oldState.selfVideo, newState.selfVideo),
  ].filter(Boolean);

  const serverSide = oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf;

  if (changes.length) {
    await engine.send(
      newState.client,
      'ses',
      ui.entry('primary', 'Ses Durumu Değişti', [
        `**Kullanıcı:** <@${member.id}>`,
        `**Kanal:** <#${newState.channelId}>`,
        ...changes,
        serverSide ? await audit.by(newState.guild, AuditLogEvent.MemberUpdate, member.id) : null,
      ]),
    );
  }
}

module.exports = { handleVoiceStateUpdate };
