// TEMP dumân testi: partner yenileme DM kartları muhatabın KENDİ sunucusunu başlık yapmasın,
// bizim sunucumuzun adını ve teklif eden yetkilimizi göstersin. Çalıştır: node TEMP-partner-renewal.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname;
const dbPath = path.join(ROOT, 'data', 'db.json');
const md5 = () => crypto.createHash('md5').update(fs.readFileSync(dbPath)).digest('hex');
const before = md5();

const { Collection } = require('discord.js');
const { guildId } = require(path.join(ROOT, 'src', 'core', 'config'));
const store = require(path.join(ROOT, 'src', 'systems', 'partner', 'store'));

const CONTACT = '900000000000000001'; // karşı sunucunun yetkilisi (DM'i alan adam)
const OUR_STAFF = '900000000000000002'; // teklifi başlatan bizim yetkilimiz
const TRUSTED_ID = `${guildId}-3`;
const OUR_GUILD_NAME = 'Kazuki Anime & Public';
const PARTNER_GUILD_NAME = 'Musa`nin Sunucusu';
const AD_TEXT = 'Anime ve sohbet sunucumuza bekleriz! discord.gg/ornek';

let entry = {
  id: TRUSTED_ID,
  guildId,
  sourceRequestId: `${guildId}-7`,
  serverId: '123456789012345678',
  serverName: PARTNER_GUILD_NAME,
  content: AD_TEXT,
  contactIds: [CONTACT],
  addedBy: OUR_STAFF,
  addedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
};
let offer = null;

store.getTrusted = (id) => (id === TRUSTED_ID ? entry : null);
store.updateTrusted = (id, patch) => {
  if (id === TRUSTED_ID) entry = { ...entry, ...patch };
  return entry;
};
store.getRenewalOffer = (id) => (id === TRUSTED_ID ? offer : null);
store.setRenewalOffer = (id, value) => {
  offer = value;
};
store.deleteRenewalOffer = () => {
  offer = null;
};
store.isBanned = () => false;

const partner = require(path.join(ROOT, 'src', 'systems', 'partner', 'index'));
const ui = require(path.join(ROOT, 'src', 'systems', 'partner', 'ui'));
const handlerOf = (prefix) => partner.prefixed.find(([id]) => id === prefix)[1];

const guild = {
  id: guildId,
  name: OUR_GUILD_NAME,
  members: { cache: new Collection(), fetch: async () => null },
  channels: new Collection(),
};
const sent = [];
const client = {
  guilds: { cache: new Collection([[guildId, guild]]) },
  users: {
    fetch: async (id) =>
      id === CONTACT
        ? { id, send: async (payload) => { sent.push({ to: 'contact', payload }); return { id: 'msg-1' }; } }
        : { id, username: 'ayse' },
  },
};

const updates = [];
const dmInteraction = (customId, extra = {}) => ({
  customId,
  user: { id: CONTACT, username: 'musa' },
  client,
  guildId: null,
  isCommand: () => false,
  update: async (payload) => updates.push(payload),
  ...extra,
});

const results = {};

(async () => {
  // 1) Yetkili "Partner Yenile" menüsünden muhatabı seçer -> ilk teklif DM'i
  const assign = handlerOf(ui.IDS.renewalAssign);
  const staffInteraction = {
    customId: `${ui.IDS.renewalAssign}:${TRUSTED_ID}`,
    values: [CONTACT],
    user: { id: OUR_STAFF },
    memberPermissions: { has: () => true },
    client,
    guildId,
    deferUpdate: async () => {},
    editReply: async (payload) => updates.push(payload),
  };
  await assign(staffInteraction);
  offer = offer ?? { trustedId: TRUSTED_ID, guildId, contactId: CONTACT, startedBy: OUR_STAFF, createdAt: Date.now() };
  const teklifDm = JSON.stringify(sent.at(-1)?.payload ?? {});

  // 2) Karşı yetkili "Kabul Ediyorum" der -> karar kartı
  await handlerOf(ui.IDS.renewalAssignedAccept)(dmInteraction(`${ui.IDS.renewalAssignedAccept}:${TRUSTED_ID}`));
  const kabul = JSON.stringify(updates.at(-1) ?? {});

  // 3) Metni günceller -> kart aynı bilgilerle yeniden çizilir
  await handlerOf(ui.IDS.renewalEditSubmit)(
    dmInteraction(`${ui.IDS.renewalEditModal}:${TRUSTED_ID}`, { fields: { getTextInputValue: () => 'Yeni metnimiz! discord.gg/ornek' } }),
  );
  const guncel = JSON.stringify(updates.at(-1) ?? {});

  const kart = (json) => {
    const headTitle = json.match(/## ([^\\]+)/)?.[1] ?? '?';
    return {
      baslik: headTitle,
      bizimSunucu: json.includes(OUR_GUILD_NAME),
      onunSunucusuEtiketli: json.includes('Senin Sunucun'),
      teklifEden: json.includes(OUR_STAFF),
      butonlar: [...json.matchAll(/"label":"([^"]+)"/g)].map((m) => m[1]),
    };
  };

  results.teklifDm = kart(teklifDm);
  results.kabulKarti = kart(kabul);
  results.guncelKart = kart(guncel);
  results.baslikKendiSunucusuDegil = !results.kabulKarti.baslik.includes(PARTNER_GUILD_NAME);
  results.kabulSonrasiKatilButonuYok = !results.kabulKarti.butonlar.includes('Sunucuya Katıl');
  results.dbDegisti = md5() !== before;
  console.log(JSON.stringify(results, null, 2));
  const ok =
    results.kabulKarti.bizimSunucu &&
    results.kabulKarti.onunSunucusuEtiketli &&
    results.kabulKarti.teklifEden &&
    results.baslikKendiSunucusuDegil &&
    results.kabulSonrasiKatilButonuYok &&
    results.teklifDm.bizimSunucu &&
    results.guncelKart.bizimSunucu &&
    !results.dbDegisti;
  console.log(ok ? 'TEST GEÇTİ' : 'TEST BAŞARISIZ');
})().catch((err) => {
  console.error('TEST HATASI:', err);
  process.exitCode = 1;
});
