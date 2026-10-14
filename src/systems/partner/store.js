// Partner taleplerinin (oto ya da elle yapılan, hepsi kayıt altına alınır) ve güvenilir partner listesinin kaydı
const { data, save, guildData } = require('../../core/db');
const { weekKey } = require('../aktif/week');

// Dönem sayıları İstanbul takvimine göre: gün 00:00'da, hafta pazartesi, ay ayın birinde sıfırlanır
const dayKey = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const monthKey = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' });

const TERMS_WAIT = 24 * 60 * 60 * 1000; // şartları kabul etmesi beklenen talebin geçerlilik süresi

data.partnerRequests ??= {};
data.trustedPartners ??= {};
data.partnerTermsAccepted ??= {}; // kullanıcı ID'si -> ilk kabul zamanı (bir kez kabul edince tekrar sorulmaz)
data.partnerStaffStatus ??= {}; // yetkili ID'si -> 'aktif' | 'mesgul'
data.partnerRenewalOffers ??= {}; // güvenilir kayıt ID'si -> sürmekte olan "Teklifte Bulun" süreci
data.partnerBans ??= {}; // kullanıcı ID'si -> { by, at } (partner sisteminden yasaklananlar)
data.bannedServers ??= {}; // sunucu ID'si -> { reason, by, at } (yasaklı sunucular)

// Eski kayıtlarda tek bir contactId (string) tutuluyordu, artık contactIds (dizi); mevcut veriyi bir kere taşır
{
  let migrated = false;
  for (const entry of Object.values(data.trustedPartners)) {
    if (!entry.contactIds) {
      entry.contactIds = entry.contactId ? [entry.contactId] : [];
      delete entry.contactId;
      migrated = true;
    }
  }
  if (migrated) save();
}

module.exports = {
  nextRequestNumber(guildId) {
    const guild = guildData(guildId);
    guild.partnerCounter = (guild.partnerCounter ?? 0) + 1;
    save();
    return guild.partnerCounter;
  },

  createRequest(request) {
    data.partnerRequests[request.id] = request;
    save();
    return request;
  },

  getRequest(id) {
    return data.partnerRequests[id] ?? null;
  },

  updateRequest(id, patch) {
    if (!data.partnerRequests[id]) return null;
    Object.assign(data.partnerRequests[id], patch);
    save();
    return data.partnerRequests[id];
  },

  deleteRequest(id) {
    if (!data.partnerRequests[id]) return false;
    delete data.partnerRequests[id];
    save();
    return true;
  },

  // Kullanıcının sonuçlanmamış (şartları bekleyen ya da incelemedeki) talebi var mı. Şartlar 24 saat içinde kabul
  // edilmezse (DM kapalı, mesaj silinmiş) talep bekleyen sayılmaz, kullanıcı yeniden başvurabilir.
  pendingOf(guildId, userId) {
    const now = Date.now();
    return (
      Object.values(data.partnerRequests).find(
        (r) =>
          r.guildId === guildId &&
          r.requesterId === userId &&
          (r.status === 'pending' || (r.status === 'awaiting_terms' && now - r.createdAt < TERMS_WAIT)),
      ) ?? null
    );
  },

  // Bir sunucu ID'sine ait tüm talepler (yasaklama sırasında bekleyenleri bulmak için)
  requestsOfServer(serverId) {
    return Object.values(data.partnerRequests)
      .filter((r) => r.serverId === serverId)
      .sort((a, b) => a.createdAt - b.createdAt);
  },

  requestsOfGuild(guildId) {
    return Object.values(data.partnerRequests).filter((r) => r.guildId === guildId);
  },

  // Paylaşım kanalındaki ilan ya da kart mesajının ait olduğu kayıt
  requestByMessage(messageId) {
    return Object.values(data.partnerRequests).find((r) => r.adId === messageId || r.postId === messageId) ?? null;
  },

  // Paylaşım kanalında hâlâ mesajı duran kayıtlar
  postedRequests(guildId) {
    return Object.values(data.partnerRequests).filter((r) => r.guildId === guildId && r.status !== 'silindi' && (r.adId || r.postId));
  },

  nextTrustedNumber(guildId) {
    const guild = guildData(guildId);
    guild.trustedCounter = (guild.trustedCounter ?? 0) + 1;
    save();
    return guild.trustedCounter;
  },

  addTrusted(entry) {
    data.trustedPartners[entry.id] = entry;
    save();
    return entry;
  },

  getTrusted(id) {
    return data.trustedPartners[id] ?? null;
  },

  updateTrusted(id, patch) {
    if (!data.trustedPartners[id]) return null;
    Object.assign(data.trustedPartners[id], patch);
    save();
    return data.trustedPartners[id];
  },

  removeTrusted(id) {
    if (!data.trustedPartners[id]) return false;
    delete data.trustedPartners[id];
    save();
    return true;
  },

  trustedOf(guildId) {
    return Object.values(data.trustedPartners)
      .filter((p) => p.guildId === guildId)
      .sort((a, b) => b.addedAt - a.addedAt);
  },

  trustedBySource(guildId, requestId) {
    return (
      Object.values(data.trustedPartners).find((p) => p.guildId === guildId && p.sourceRequestId === requestId) ?? null
    );
  },

  // Güvenilir partnerler listesi panelinin mesaj ID'si: liste her değiştiğinde aynı mesaj düzenlenir
  trustedPanelMessageId(guildId) {
    return guildData(guildId).trustedPanelMessageId ?? null;
  },

  setTrustedPanelMessageId(guildId, messageId) {
    guildData(guildId).trustedPanelMessageId = messageId;
    save();
  },

  // Bir kullanıcı partner şartlarını bir kez kabul ettiyse (ilk talebinde ya da bir yenilemede) tekrar sorulmaz
  hasAcceptedTerms(userId) {
    return Boolean(data.partnerTermsAccepted[userId]);
  },

  markTermsAccepted(userId) {
    data.partnerTermsAccepted[userId] ??= Date.now();
    save();
  },

  staffStatus(userId) {
    return data.partnerStaffStatus[userId] ?? 'aktif';
  },

  setStaffStatus(userId, status) {
    data.partnerStaffStatus[userId] = status;
    save();
  },

  // "Teklifte Bulun" ile başlayan, bir yetkiliye atanmış sürmekte olan yenileme süreci
  setRenewalOffer(trustedId, offer) {
    data.partnerRenewalOffers[trustedId] = offer;
    save();
    return offer;
  },

  getRenewalOffer(trustedId) {
    return data.partnerRenewalOffers[trustedId] ?? null;
  },

  deleteRenewalOffer(trustedId) {
    if (!data.partnerRenewalOffers[trustedId]) return false;
    delete data.partnerRenewalOffers[trustedId];
    save();
    return true;
  },

  banUser(userId, by) {
    data.partnerBans[userId] = { by, at: Date.now() };
    save();
  },

  isBanned(userId) {
    return Boolean(data.partnerBans[userId]);
  },

  unbanUser(userId) {
    if (!data.partnerBans[userId]) return false;
    delete data.partnerBans[userId];
    save();
    return true;
  },

  banServer(serverId, reason, by) {
    data.bannedServers[serverId] = { reason, by, at: Date.now() };
    save();
  },

  isServerBanned(serverId) {
    return data.bannedServers[serverId] ?? null;
  },

  getBannedServers() {
    return Object.entries(data.bannedServers).map(([serverId, info]) => ({
      serverId,
      ...info,
    }));
  },

  unbanServer(serverId) {
    if (!data.bannedServers[serverId]) return false;
    delete data.bannedServers[serverId];
    save();
    return true;
  },

  // Partner istatistikleri: paylaşım kartının altındaki bugün / bu hafta / bu ay sayıları. Bir talebin sonucu
  // decidedAt ile (yoksa createdAt ile) sayılır; silinen gönderiler sayılmaz. current: kartı çizilen kayıt —
  // teklif akışında paylaşım kayıttan önce yapılır, o yüzden henüz store'da olmayan kayıt listeye elle eklenir.
  partnerStats(guildId, current = null) {
    const now = Date.now();
    const requests = Object.values(data.partnerRequests).filter((r) => r.guildId === guildId);
    if (current?.guildId === guildId && !requests.some((r) => r.id === current.id)) requests.push(current);
    const approved = requests
      .filter((r) => r.status === 'approved')
      .sort((a, b) => (a.decidedAt ?? a.createdAt) - (b.decidedAt ?? b.createdAt));
    const decided = (r) => r.decidedAt ?? r.createdAt;
    const period = (keyOf, key) => ({
      onay: approved.filter((r) => keyOf(decided(r)) === key).length,
      talep: requests.filter((r) => r.status !== 'silindi' && keyOf(r.createdAt) === key).length,
      ret: requests.filter((r) => r.status === 'rejected' && keyOf(decided(r)) === key).length,
    });

    return {
      gun: period(dayKey, dayKey(now)),
      hafta: period(weekKey, weekKey(now)),
      ay: period(monthKey, monthKey(now)),
      toplam: approved.length,
      guvenilir: Object.values(data.trustedPartners).filter((p) => p.guildId === guildId).length,
      yasakli: Object.keys(data.partnerBans).length,
      // Bu kayıt onaylanmış partnerler arasında kaçıncı; silinmiş/bulunamazsa null
      sira: current ? approved.findIndex((r) => r.id === current.id) + 1 || null : null,
    };
  },
};
