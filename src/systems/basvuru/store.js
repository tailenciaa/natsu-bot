// Yetkili başvurularının kaydı: applications, sunucu-numara ID'si ile
const { data, save, guildData } = require('../../core/db');

module.exports = {
  nextApplicationNumber(guildId) {
    const settings = (guildData(guildId).application ??= {});
    settings.counter = (settings.counter ?? 0) + 1;
    save();
    return settings.counter;
  },

  getApplication(id) {
    return data.applications[id] ?? null;
  },

  setApplication(id, application) {
    data.applications[id] = application;
    save();
    return application;
  },

  // Başvurular kanalına gönderilemeyen başvuruyu kayıttan kaldırır (kullanıcı yeniden başvurabilsin)
  removeApplication(id) {
    if (!data.applications[id]) return false;
    delete data.applications[id];
    save();
    return true;
  },

  updateApplication(id, patch) {
    if (!data.applications[id]) return null;
    Object.assign(data.applications[id], patch);
    save();
    return data.applications[id];
  },

  // Görüşme ses kanallarına erişimi açık olan başvurular
  withVoiceAccess() {
    return Object.values(data.applications).filter((a) => a.voiceAccessUntil);
  },

  // Görüşmeye çağrılmış, henüz karar verilmemiş başvurular
  inMeeting() {
    return Object.values(data.applications).filter((a) => a.status === 'pending' && a.meetingBy);
  },

  // Onaylanmış, oryantasyonu bekleyen ya da süren başvurular
  inOrientation() {
    return Object.values(data.applications).filter(
      (a) => a.status === 'approved' && ['waiting', 'active'].includes(a.orientation?.status),
    );
  },

  // Kullanıcının bu sunucudaki tüm başvuruları, en yeni önce
  applicationsOf(guildId, userId) {
    return Object.values(data.applications)
      .filter((a) => a.guildId === guildId && a.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
};
