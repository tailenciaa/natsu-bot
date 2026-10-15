// TEMP dumân testi: partner değerlendirme DM'i YALNIZCA bir yetkili paylaşım kanalına metni elle attığında
// gitmeli; oto onay ve partner yenileme paylaşımlarında üyeye puanlama sorulmamalı.
// Çalıştır: node TEMP-partner-rating.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const dbPath = path.join(ROOT, 'data', 'db.json');
const md5 = () => crypto.createHash('md5').update(fs.readFileSync(dbPath)).digest('hex');
const before = md5();

const { Collection } = require('discord.js');
const { guildId } = require(path.join(ROOT, 'src', 'core', 'config'));
const config = require(path.join(ROOT, 'src', 'systems', 'partner', 'config'));
const store = require(path.join(ROOT, 'src', 'systems', 'partner', 'store'));
const ratings = require(path.join(ROOT, 'src', 'systems', 'degerlendirme'));

const CONTACT = '900000000000000001'; // karşı sunucunun partner yetkilisi (puanlaması istenen kişi)
const PASTER = '900000000000000002'; // paylaşım kanalına metni elle atan bizim yetkilimiz
const TRUSTED_ID = `${guildId}-3`;
const SERVER_ID = '123456789012345678';
const AD = 'Anime ve sohbet sunucumuza bekleriz! discord.gg/ornek';

let entry = {
  id: TRUSTED_ID,
  guildId,
  sourceRequestId: `${guildId}-19`,
  serverId: SERVER_ID,
  serverName: 'Partner Sunucusu',
  content: AD,
  contactIds: [CONTACT],
  addedBy: PASTER,
  addedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
};
let offer = { trustedId: TRUSTED_ID, guildId, contactId: CONTACT, startedBy: PASTER, createdAt: Date.now() };
const manuel = {
  id: `${guildId}-19`,
  number: 19,
  guildId,
  requesterId: PASTER,
  serverId: SERVER_ID,
  serverName: 'Partner Sunucusu',
  text: AD,
  status: 'approved',
  source: 'manuel',
  createdAt: Date.now(),
  decidedAt: Date.now(),
};

const ratingCalls = [];
ratings.requestForPartner = async (client, request, staffId, userId) => {
  ratingCalls.push({ staffId, userId: userId ?? request.requesterId, record: `#${request.number}` });
  return { id: 'rating' };
};

const patch = (target) => (id, value) => {
  if (id === target.id) Object.assign(target, value);
  return target;
};
store.getRequest = (id) => (id === manuel.id ? manuel : null);
store.updateRequest = patch(manuel);
store.createRequest = () => {};
store.getTrusted = (id) => (id === TRUSTED_ID ? entry : null);
store.updateTrusted = (id, value) => {
  if (id === TRUSTED_ID) entry = { ...entry, ...value };
  return entry;
};
store.addTrusted = (value) => value;
store.nextTrustedNumber = () => 3;
store.nextRequestNumber = () => 20;
store.trustedBySource = () => null;
store.isBanned = () => false;
store.isServerBanned = () => null;
store.hasAcceptedTerms = (id) => id === CONTACT;
store.getRenewalOffer = (id) => (id === TRUSTED_ID ? offer : null);
store.deleteRenewalOffer = () => {
  offer = null;
};
store.partnerStats = () => ({});
store.trustedOf = () => [entry];
store.requestsOfGuild = () => [manuel];
store.postedRequests = () => [];
store.trustedPanelMessageId = () => null;

let msgN = 0;
const sentMessages = [];
const channel = (id) => ({
  id,
  guildId,
  isTextBased: () => true,
  send: async (payload) => {
    const message = { id: `m${++msgN}`, delete: async () => {} };
    sentMessages.push({ channelId: id, payload });
    return message;
  },
  messages: { edit: async () => ({}), fetch: async () => null, delete: async () => true },
  permissionOverwrites: { edit: async () => {} },
});
const guild = {
  id: guildId,
  name: 'Kazuki Anime & Public',
  channels: { fetch: async (id) => (id ? channel(id) : null) },
  members: { cache: new Collection(), fetch: async () => null },
  invites: { fetch: async () => new Collection() },
};
const dms = [];
const client = {
  guilds: { cache: new Collection([[guildId, guild]]) },
  fetchInvite: async () => ({ guild: { id: SERVER_ID, name: 'Partner Sunucusu' } }),
  users: {
    fetch: async (id) =>
      id === CONTACT
        ? {
            id,
            username: 'partner-yetkilisi',
            send: async (payload) => {
              dms.push({ to: id, payload });
              return { id: `dm${++msgN}` };
            },
          }
        : { id, username: 'yetkili', send: async (payload) => (dms.push({ to: id, payload }), { id: `dm${++msgN}` }) },
  },
};

const partner = require(path.join(ROOT, 'src', 'systems', 'partner', 'index'));
const ui = require(path.join(ROOT, 'src', 'systems', 'partner', 'ui'));
const handlerOf = (prefix) => partner.prefixed.find(([id]) => id === prefix)[1];

const updates = [];
const dmInteraction = (customId, extra = {}) => ({
  customId,
  user: { id: CONTACT, username: 'partner-yetkilisi' },
  client,
  guildId: null,
  isCommand: () => false,
  isMessageComponent: () => false,
  update: async (payload) => updates.push(payload),
  editReply: async (payload) => updates.push(payload),
  deferUpdate: async () => {},
  ...extra,
});

(async () => {
  // A) Partner yenileme: karşı yetkili DM'de onaylar -> metin otomatik paylaşılır, puanlama DM'i GİTMEMELİ
  await handlerOf(ui.IDS.renewalApprove)(dmInteraction(`${ui.IDS.renewalApprove}:${TRUSTED_ID}`));
  const afterRenewal = {
    paylasildi: sentMessages.some((m) => m.channelId === config.channels.posts),
    degerlendirme: ratingCalls.length,
  };

  // B) Bir yetkili paylaşım kanalına metni elle attı ve kayıt güvenilir listeye eklendi -> puanlama GİTMELİ
  offer = null;
  const trustedAdd = dmInteraction(`${ui.IDS.modal}:guven:${manuel.id}:m1`, {
    memberPermissions: { has: () => true },
    guildId,
    fields: { getSelectedUsers: () => new Set([{ id: CONTACT, bot: false }]) },
    deferred: true,
    ephemeral: true,
    replied: false,
  });
  await handlerOf(ui.IDS.modal)(trustedAdd);
  const afterManuel = {
    degerlendirme: ratingCalls.length,
    kimPuanlanacak: ratingCalls.map((c) => ({ puanlanan: c.staffId, sorulan: c.userId })),
  };

  const result = {
    A_yenileme: afterRenewal,
    B_ellePaylasim: afterManuel,
    dbDegisti: md5() !== before,
  };
  console.log(JSON.stringify(result, null, 2));
  const ok =
    afterRenewal.paylasildi &&
    afterRenewal.degerlendirme === 0 &&
    afterManuel.degerlendirme === 1 &&
    afterManuel.kimPuanlanacak[0].puanlanan === PASTER &&
    afterManuel.kimPuanlanacak[0].sorulan === CONTACT &&
    !result.dbDegisti;
  console.log(ok ? 'TEST GEÇTİ' : 'TEST BAŞARISIZ');
})().catch((err) => {
  console.error('TEST HATASI:', err);
  process.exitCode = 1;
});
