// Profil: /profil ile açılır, sunucu üzerindeki her şeyin tek görsel kartta göründüğü kişisel profil. Sahibi kendi
// profilinin altındaki kontrollerle (biyografi, unvan, renk, kapak düzenleyici, panel görünümü, tema, vitrin) kartı
// canlı olarak özelleştirir; her değişiklikte kart yeniden çizilip aynı mesaj güncellenir. Rozetler etkinlikten
// türetilir, uzun vadeli görev rozetlerinin rol ödülü vardır (gorev.js); mağazadan alınan kozmetikler (çerçeve, tema,
// arka plan, sergi rozeti) kartın kenarına, kapağına ve rozet şeridine çizilir.
const { AttachmentBuilder, ButtonStyle, Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { guildId } = require('../../core/config');
const { replyError, respond, isMenuOwner } = require('../../core/helpers');
const coinStore = require('../coin/store');
const { buildHeaderPreview, buildProfileCard, OPACITY_DEFAULT, OPACITY_STEP } = require('./card');
const kapak = require('./kapak');
const kozmetik = require('./kozmetik');
const gorev = require('./gorev');
const rozet = require('./rozet');
const store = require('./store');
const { FEATURED, featuredOptions, profileView, headerView } = require('./view');
const { THEMES, resolveTheme } = require('./themes');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Seviye, sıralama, rozet ve istatistiklerinle sunucu profilini gösterir.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Profiline bakılacak üyeyi seçer, boş bırakırsan kendi profilin gösterilir.')),
];

const number = (n) => Number(n).toLocaleString('tr-TR');

async function buildMessage(guild, user, isSelf) {
  const view = await profileView(guild, user.id);
  const buffer = await buildProfileCard(user, view);
  return {
    components: [ui.profile('profil.png', isSelf, view.custom.theme)],
    files: [new AttachmentBuilder(buffer, { name: 'profil.png' })],
    flags: core.CV2,
    allowedMentions: { parse: [] },
  };
}

// /profil [kullanici]: başkasının kartı açıldığında ziyaret sayacı işler (kendi kartı sayılmaz)
async function handleCommand(interaction) {
  const user = interaction.options.getUser('kullanici') ?? interaction.user;
  if (user.bot) return replyError(interaction, 'Botların profili bulunmaz.', 'Bir üye seçerek tekrar dene.');
  await interaction.deferReply();
  const isSelf = user.id === interaction.user.id;
  if (!isSelf) store.addVisit(user.id, interaction.user.id);

  const message = await buildMessage(interaction.guild, user, isSelf);
  const sent = await interaction.editReply(message);
  // Kozmetik değişince herkese açık kart yerinde yenilensin diye kartın mesajı hatırlanır
  if (isSelf && sent?.id) store.set(user.id, { card: { channelId: sent.channelId, messageId: sent.id } });
}

// Düzenleme sonrası: kartı yeniden çizip aynı mesajı günceller
async function refresh(interaction) {
  const message = await buildMessage(interaction.guild, interaction.user, true);
  const sent = await interaction.editReply({ ...message, attachments: [] });
  if (sent?.id) store.set(interaction.user.id, { card: { channelId: sent.channelId, messageId: sent.id } });
}

// Satın alma ve giyme herkese açık kartı da ilgilendirir: kayıtlı kart mesajı varsa o da yenilenir
async function refreshLiveCard(interaction) {
  const ref = store.get(interaction.user.id).card;
  if (!ref) return;
  try {
    const channel = await interaction.guild.channels.fetch(ref.channelId).catch(() => null);
    const message = await channel?.messages.fetch(ref.messageId).catch(() => null);
    if (message) await message.edit(await buildMessage(interaction.guild, interaction.user, true));
  } catch (err) {
    console.error('[profil] Kart mesajı yenilenemedi:', err.message);
  }
}

const COLOR = /^#?([0-9a-fA-F]{6})$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// ── Kapak düzenleyici ────────────────────────────────────────────────────────
// GİZLİ İSTİSNA: kapak ve görünüm düzenleyicileri kişiye özel kalır. Büyütme/kaydırma adımları üyenin kendi
// ayarıdır ve her dokunuşta aynı mesajı yeniden çizer; kanala açılsa herkesin önünde bir düzenleme oturumu açılır.

// Yalnızca kapağı çizmek için gerekenler: tema/renk seçimi ve üyenin rol rengi (pahalı ölçümler toplanmaz)
async function headerViewOf(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  return { custom: store.get(userId), roleColor: member?.displayColor ?? 0 };
}

// Sınırlar card.js'teki okuma ile aynı: görsel en fazla 3 kat büyütülür, kaydırma taşan alanla ölçülür
const ZOOM_STEP = 0.1;
const PAN_STEP = 0.1;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round2 = (value) => Math.round(value * 100) / 100;
const kapakValues = (custom) => ({
  zoom: clamp(Number(custom.bannerZoom) || 1, 1, 3),
  x: clamp(Number(custom.bannerX) || 0, -1, 1),
  y: clamp(Number(custom.bannerY) || 0, -1, 1),
});

async function kapakPageMessage(interaction) {
  const custom = store.get(interaction.user.id);
  const { zoom } = kapakValues(custom);
  const view = await headerViewOf(interaction.guild, interaction.user.id);
  const buffer = await buildHeaderPreview(view, `%${Math.round(zoom * 100)}`);
  return {
    components: [ui.kapakPage('kapak.png', custom)],
    files: [new AttachmentBuilder(buffer, { name: 'kapak.png' })],
    allowedMentions: { parse: [] },
  };
}

async function openKapak(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL_CV2 });
  return interaction.editReply(await kapakPageMessage(interaction));
}

// Düğmeden gelen eylem: değer güncellenir, hem düzenleyici hem herkese açık kart yeniden çizilir
async function kapakAction(interaction, neylem) {
  const custom = store.get(interaction.user.id);
  if (neylem === 'gorsel') return interaction.showModal(ui.bannerModal(custom));

  const { zoom, x, y } = kapakValues(custom);
  const patch = { bannerZoom: zoom, bannerX: x, bannerY: y };
  if (neylem === 'buyut') patch.bannerZoom = round2(clamp(zoom + ZOOM_STEP, 1, 3));
  else if (neylem === 'kucult') patch.bannerZoom = round2(clamp(zoom - ZOOM_STEP, 1, 3));
  else if (neylem === 'saga') patch.bannerX = round2(clamp(x + PAN_STEP, -1, 1));
  else if (neylem === 'sola') patch.bannerX = round2(clamp(x - PAN_STEP, -1, 1));
  else if (neylem === 'asagi') patch.bannerY = round2(clamp(y + PAN_STEP, -1, 1));
  else if (neylem === 'yukari') patch.bannerY = round2(clamp(y - PAN_STEP, -1, 1));
  else if (neylem === 'sifirla') Object.assign(patch, { bannerZoom: 1, bannerX: 0, bannerY: 0 });
  else if (neylem === 'kaldir') Object.assign(patch, { banner: null, bannerZoom: 1, bannerX: 0, bannerY: 0 });

  store.set(interaction.user.id, patch);
  await interaction.update({ ...(await kapakPageMessage(interaction)), attachments: [], flags: core.EPHEMERAL_CV2 });
  return refreshLiveCard(interaction);
}

// ── Kart görünümü ─────────────────────────────────────────────────────────────

// Panelin düz ya da buzlu cam çizilmesi temaya bağlıdır (themes.js); saydamlık ise üyenin kendi ayarıdır.
const opacityOf = (custom) => clamp(Number(custom.glassOpacity ?? OPACITY_DEFAULT), 0, 100);

// Sayfa kartın tamamını çizdiği için ölçümler toplanır; açılırken ve her ayar değişiminde yeniden çizilir
async function gorunumMessage(interaction) {
  const view = await viewDataOf(interaction.guild, interaction.user.id);
  const theme = resolveTheme(view.custom, view.roleColor);
  const buffer = await buildProfileCard(interaction.user, view);
  return {
    components: [
      ui.gorunumPage('profil.png', {
        themeLabel: theme.label ?? 'Seçtiğin renk',
        glass: Boolean(theme.glass),
        opacity: opacityOf(view.custom),
      }),
    ],
    files: [new AttachmentBuilder(buffer, { name: 'profil.png' })],
    allowedMentions: { parse: [] },
  };
}

async function openGorunum(interaction) {
  await interaction.deferReply({ flags: core.EPHEMERAL_CV2 });
  return interaction.editReply(await gorunumMessage(interaction));
}

// Saydamlık adımı: panel koyulaşır ya da şeffaflaşır; hem düzenleme sayfası hem herkese açık kart yenilenir
async function gorunumAction(interaction, neylem) {
  const current = opacityOf(store.get(interaction.user.id));
  const next = neylem === 'azalt' ? current - OPACITY_STEP : neylem === 'artir' ? current + OPACITY_STEP : OPACITY_DEFAULT;
  store.set(interaction.user.id, { glassOpacity: clamp(Math.round(next), 0, 100) });
  await interaction.update({ ...(await gorunumMessage(interaction)), attachments: [], flags: core.EPHEMERAL_CV2 });
  return refreshLiveCard(interaction);
}

// Kapak görseli bağlantısı: https olmalı; botun kendi ağındaki adreslere (localhost, IP) istek atmasın diye bunlar reddedilir
function isImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return url.hostname.includes('.') && !/^[\d.]+$/.test(url.hostname) && !url.hostname.startsWith('[') && !url.hostname.endsWith('.local');
  } catch {
    return false;
  }
}

// Vitrin bağlantıları: bot bu adreslere hiçbir istek atmaz, kartta yalnızca metin olarak görünür
const isLink = isImageUrl;

// Kapak görseli gerçekten açılıyor mu: 5 saniyelik zaman aşımıyla içerik türü ve boyut denetlenir (yönlendirmeler izlenmez).
// Sorun varsa kullanıcıya gösterilecek ipucunu, sorun yoksa null döndürür.
async function checkImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    res.body?.cancel().catch(() => {});
    if (!res.ok) return 'Bağlantı açılamadı. Görselin **herkese açık** olduğundan emin ol.';
    if (!/^image\/(png|jpe?g|gif|webp)/i.test(res.headers.get('content-type') ?? '')) return 'Bağlantı **PNG, JPG, GIF** ya da **WebP** biçiminde bir görsele gitmeli.';
    if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return 'Görsel en fazla **8 MB** olabilir.';
    return null;
  } catch {
    return 'Bağlantı açılamadı. Adresi kontrol edip tekrar dene.';
  }
}

// ── Mağaza ────────────────────────────────────────────────────────────────────

const SHOP_TABS = { cerceve: 'Çerçeveler', tema: 'Temalar', kapak: 'Arka Planlar', rozet: 'Rozetler' };

// Ürün türleri tek yerde tanımlıdır: sahiplik listesi (field), kartta hangi alanla giyildiği (wear), giyilmemişken
// kabul edilen varsayılanı (def) ve ücretsiz sayılan anahtar (free). `wear: null` olan türde giyme adımı yoktur:
// satın alınan sergi rozeti kartta kendiliğinden görünür. Ücretsiz temalar mağazada değil tema menüsünde durur.
const SHOP = {
  cerceve: {
    field: 'ownedFrames',
    wear: 'frame',
    def: 'yok',
    free: (key) => key === 'yok',
    items: () => kozmetik.FRAMES.map((f) => ({ key: f.key, name: f.label, note: f.note, price: f.price })),
  },
  tema: {
    field: 'ownedThemes',
    wear: 'theme',
    def: null,
    free: () => false,
    items: () =>
      Object.entries(THEMES)
        .filter(([, theme]) => theme.price > 0)
        .map(([key, theme]) => ({ key, name: theme.label, note: theme.description, price: theme.price })),
  },
  kapak: {
    field: 'ownedCovers',
    wear: 'cover',
    def: 'yok',
    free: (key) => key === 'yok',
    items: () => kapak.COVERS.map((c) => ({ key: c.key, name: c.label, note: c.note, price: c.price })),
  },
  rozet: {
    field: 'ownedBadges',
    wear: null,
    def: null,
    free: () => false,
    items: () => kozmetik.SHOP_BADGES.map((b) => ({ key: b.key, name: b.label, note: b.note, price: b.price })),
  },
};

const catalog = (tur) => (SHOP[tur]?.items() ?? []).map((item) => ({ ...item, tur }));

const ownsItem = (tur, custom, key) => {
  const shop = SHOP[tur];
  return Boolean(shop) && (shop.free(key) || (custom[shop.field] ?? []).includes(key));
};

const wornItem = (tur, custom, key) => {
  const shop = SHOP[tur];
  return Boolean(shop?.wear) && (custom[shop.wear] ?? shop.def) === key;
};

// Mağaza sayfasının satırları: sahiplik ve bakiye durumuna göre düğme etiketi belirlenir. kaynak, ürün düğmesinin
// sonuna eklenir ki satın alma/giyme sonrası yenilenen sayfada geri düğmesi aynı yere dönsün.
function shopRows(tur, custom, kaynak = null) {
  const shop = SHOP[tur];
  const suffix = kaynak ? `:${kaynak}` : '';
  const wearId = (key) => `${ui.IDS.wear}${tur}:${key}${suffix}`;
  const buyId = (key) => `${ui.IDS.buy}${tur}:${key}${suffix}`;
  const priceTag = (price) => `${number(price)} coin`;
  return catalog(tur).map((item) => {
    const base = { name: item.name, note: item.note };
    const owned = ownsItem(tur, custom, item.key);
    if (wornItem(tur, custom, item.key)) return { ...base, state: 'Kartında bu var', id: wearId(item.key), label: 'Giyili', disabled: true };
    // Giyilmesi gerekmeyen ürünler satın alınır alınmaz kartta görünür
    if (!shop.wear) {
      return owned
        ? { ...base, state: 'Kartında görünüyor', id: wearId(item.key), label: 'Sahipsin', disabled: true }
        : { ...base, state: priceTag(item.price), id: buyId(item.key), label: `Al · ${number(item.price)}`, wearStyle: ButtonStyle.Secondary };
    }
    if (item.price === 0) return { ...base, state: 'Ücretsiz', id: wearId(item.key), label: 'Giy', wearStyle: ButtonStyle.Secondary };
    if (owned) return { ...base, state: 'Sahipsin', id: wearId(item.key), label: 'Giy', wearStyle: ButtonStyle.Primary };
    return { ...base, state: priceTag(item.price), id: buyId(item.key), label: `Al · ${number(item.price)}`, wearStyle: ButtonStyle.Secondary };
  });
}

function shopMessage(interaction, tab, kaynak) {
  const tur = SHOP[tab] ? tab : 'cerceve';
  return ui.shopPage(tur, SHOP_TABS, coinStore.balance(interaction.user.id), shopRows(tur, store.get(interaction.user.id), kaynak), kaynak);
}

// Ürün satın alma: para ancak ürün gerçekten sahipliğe geçiyorsa düşürülür
async function buy(interaction, tur, key, kaynak) {
  const shop = SHOP[tur];
  const item = catalog(tur).find((i) => i.key === key);
  if (!shop || !item) return replyError(interaction, 'Bu ürün artık mağazada yok.', 'Mağazayı yeniden açmayı dene.');

  const custom = store.get(interaction.user.id);
  if (ownsItem(tur, custom, key)) return replyError(interaction, 'Bu ürün zaten sende.', shop.wear ? 'Kartında kullanmak için giyebilirsin.' : 'Kartında zaten görünüyor.');

  const balance = coinStore.balance(interaction.user.id);
  if (balance < item.price) {
    return replyError(
      interaction,
      'Bakiyen bu ürün için yetmiyor.',
      `Fiyatı **${number(item.price)}** coin, senin bakiyen **${number(balance)}** coin. Günlük ödüller ve haftalık derecelerle artırabilirsin.`,
    );
  }

  if (!coinStore.spend(interaction.user.id, item.price)) return replyError(interaction, 'Satın alma tamamlanamadı.', 'Birkaç saniye sonra tekrar dene.');
  store.addOwned(interaction.user.id, shop.field, key);
  // Satın alınan hemen giyilir; kart hem mağaza mesajında hem profil mesajında güncellenir
  if (shop.wear) store.set(interaction.user.id, { [shop.wear]: key });
  // Harcama sipariş olarak kaydedilir: üye /bakiye üzerinden parasının nereye gittiğini görebilsin
  coinStore.recordPurchase(interaction.user.id, { tur, key, name: item.name, price: item.price });

  // Kapağında kendi görseli olan üye satın aldığı arka planı kartta göremez: nedenini hemen söyle
  const uyarı = shop.wear === 'cover' && custom.banner ? 'Kartında kendi görseli durduğu için alınan arka plan şimdilik görünmez; kapak düzenleyiciden görsel kaldırılabilir.' : null;

  // Mağaza sayfası yerinde yenilenir: bakiye ve düğme durumu hemen doğru görünsün
  await interaction.update({ components: [shopMessage(interaction, tur, kaynak)], allowedMentions: { parse: [] } });
  await respond(
    interaction,
    ui.purchase({
      user: interaction.user,
      tur,
      name: item.name,
      price: item.price,
      balance: coinStore.balance(interaction.user.id),
      worn: Boolean(shop.wear),
      note: uyarı,
    }),
    { followUp: true, allowedMentions: { users: [interaction.user.id] } },
  );
  return refreshLiveCard(interaction);
}

// Sahip olunan ürünü giyme (çerçevesiz hâl ve "Temadan" kapak ücretsiz bir seçenektir; rozetlerin giyme adımı yoktur)
async function wear(interaction, tur, key, kaynak) {
  const shop = SHOP[tur];
  const item = catalog(tur).find((i) => i.key === key);
  if (!shop || !item) return replyError(interaction, 'Bu ürün artık mağazada yok.', 'Mağazayı yeniden açmayı dene.');
  if (!shop.wear) return replyError(interaction, 'Bu ürünü giymen gerekmiyor.', 'Satın aldığın rozetler kartında kendiliğinden görünür.');
  if (!ownsItem(tur, store.get(interaction.user.id), key)) return replyError(interaction, 'Önce satın alman gerekiyor.', 'Mağaza sayfasından bakiyeni görebilirsin.');

  store.set(interaction.user.id, { [shop.wear]: key });
  await interaction.update({ components: [shopMessage(interaction, tur, kaynak)], allowedMentions: { parse: [] } });
  await respond(interaction, ui.equip({ user: interaction.user, tur, name: item.name }), { followUp: true });
  return refreshLiveCard(interaction);
}

// ── Vitrin ────────────────────────────────────────────────────────────────────

async function vitrinMessage(interaction) {
  const userId = interaction.user.id;
  const custom = store.get(userId);
  const visits = store.visits(userId);
  const recent = visits.recent.slice(0, 3).map((r) => r.by);
  const names = await Promise.all(recent.map(async (id) => (await interaction.guild.members.fetch(id).catch(() => null))?.displayName ?? null));
  const who = names.filter(Boolean).join(', ');
  return ui.vitrinPage(custom, custom.featured, featuredOptions, `**Profil ziyaretleri:** ${number(visits.count)}${who ? ` · son görenler: ${who}` : ''}`);
}

// Vitrin formundaki bağlantılar: geçersiz olan kaydedilmez, boş alan temizleme sayılır
function cleanLinks(fields) {
  const links = {};
  const bad = [];
  for (const key of ['twitch', 'youtube', 'github', 'site']) {
    const value = (fields[key] ?? '').trim();
    if (!value) {
      links[key] = null;
      continue;
    }
    if (!isLink(value)) {
      bad.push(key);
      links[key] = null;
      continue;
    }
    links[key] = value;
  }
  return { links, bad };
}

// ── İşleyici ──────────────────────────────────────────────────────────────────

// Bütün düzenleme düğmeleri, menüler ve formlar profil-ayar:<eylem> ile gelir; sadece profil sahibi kullanabilir
async function handleSettings(interaction) {
  if (!isMenuOwner(interaction)) {
    return replyError(interaction, 'Sadece kendi profilini düzenleyebilirsin.', '**/profil** yazarak kendi profilini açıp düzenleyebilirsin.');
  }
  const [action, arg, arg2, arg3] = interaction.customId.split(':').slice(1);
  const current = store.get(interaction.user.id);

  switch (action) {
    case 'bio':
      return interaction.showModal(ui.bioModal(current));
    case 'renk':
      return interaction.showModal(ui.colorModal(current));
    case 'kapak':
      return openKapak(interaction);
    case 'kapak-btn':
      return kapakAction(interaction, arg);
    case 'gorunum':
      return openGorunum(interaction);
    case 'gorunum-btn':
      return gorunumAction(interaction, arg);
    case 'sifirla':
      await interaction.deferUpdate();
      // Sahipli kozmetikler kalıcıdır; sıfırlama yalnızca kartın görünümünü varsayılana döndürür
      store.set(interaction.user.id, {
        bio: null,
        title: null,
        color: null,
        theme: null,
        banner: null,
        bannerZoom: 1,
        bannerX: 0,
        bannerY: 0,
        glassOpacity: null,
        cover: 'yok',
        pronoun: null,
        links: {},
        featured: null,
        frame: 'yok',
      });
      return refresh(interaction);
    case 'tema': {
      const theme = interaction.values[0];
      if (!THEMES[theme]) return interaction.deferUpdate();
      if (THEMES[theme].price > 0 && !ownsItem('tema', current, theme)) {
        return replyError(
          interaction,
          'Bu tema ücretli.',
          `**${THEMES[theme].label}** teması mağazada **${number(THEMES[theme].price)}** coin. Mağaza sekmesinden satın alıp kullanabilirsin.`,
        );
      }
      await interaction.deferUpdate();
      store.set(interaction.user.id, { theme });
      return refresh(interaction);
    }
    case 'vitrin':
      return respond(interaction, await vitrinMessage(interaction));
    // Mağaza, rozet ve vitrin kartın üstüne ayrı mesaj olarak açılır: geri düğmesi o mesajı kaldırır,
    // profil kartı ve düzenleme düğmeleri olduğu gibi kalır
    case 'geri':
      return interaction.message.delete().catch((err) => console.error('[profil] Sayfa kapatılamadı:', err.message));
    case 'vitrin-baglanti':
      return interaction.showModal(ui.vitrinModal({ pronoun: current.pronoun, links: current.links }));
    case 'one-cikan': {
      const key = interaction.values[0];
      if (!FEATURED.some((o) => o.key === key)) return interaction.deferUpdate();
      store.set(interaction.user.id, { featured: key });
      // Üye fetch'i uzayabilir: önce yanıt alınıp vitrin mesajı sonra yazılır
      await interaction.deferUpdate();
      await interaction.editReply({ components: [await vitrinMessage(interaction)], allowedMentions: { parse: [] } });
      return refreshLiveCard(interaction);
    }
    case 'rozetler': {
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const m = rozet.measures();
      // Sayfa açılırken görev rolleri de eşitlenir: hedef yeni aşıldıysa rol beklemeden verilsin
      if (member) await gorev.syncMember(member, m).catch((err) => console.error('[profil] Görev rolleri sayfa açılışında eşitlenemedi:', err.message));
      const ctx = rozet.contextOfMember(interaction.guild, member, interaction.user.id, m);
      return respond(interaction, ui.rozetPage(rozet.progress(ctx), rozet.earned(ctx).length));
    }
    case 'magaza': {
      const page = shopMessage(interaction, arg ?? 'cerceve', arg2);
      // Sekme değişimi ve cüzdandan açılış (düğme sekme taşıdığı için) yazıldığı mesajı yerinde yeniler;
      // profil kartındaki düğme sekme taşımadığı için mağaza ilk açılışta kanalda herkese açık ayrı mesaj olur
      return arg
        ? interaction.update({ components: [page], attachments: [], allowedMentions: { parse: [] } })
        : respond(interaction, page);
    }
    case 'al':
      return buy(interaction, arg, arg2, arg3);
    case 'giy':
      return wear(interaction, arg, arg2, arg3);
    case 'bio-form':
      await interaction.deferUpdate();
      store.set(interaction.user.id, {
        bio: interaction.fields.getTextInputValue('bio').trim() || null,
        title: interaction.fields.getTextInputValue('unvan').trim() || null,
      });
      return refresh(interaction);
    case 'vitrin-form': {
      const pronoun = interaction.fields.getTextInputValue('zamir').trim() || null;
      const { links, bad } = cleanLinks({
        twitch: interaction.fields.getTextInputValue('twitch'),
        youtube: interaction.fields.getTextInputValue('youtube'),
        github: interaction.fields.getTextInputValue('github'),
        site: interaction.fields.getTextInputValue('site'),
      });
      store.set(interaction.user.id, { pronoun, links });
      await interaction.deferUpdate();
      await respond(interaction, ui.vitrinSaved({ user: interaction.user, bad }), { followUp: true });
      return refreshLiveCard(interaction);
    }
    case 'renk-form': {
      const value = interaction.fields.getTextInputValue('renk').trim();
      const match = COLOR.exec(value);
      if (value && !match) return replyError(interaction, 'Renk kodu geçersiz.', '**Altı haneli** bir hex kod yaz, örneğin **#ff5599**.');
      const color = match ? parseInt(match[1], 16) : null;
      await interaction.deferUpdate();
      store.set(interaction.user.id, { color });
      return refresh(interaction);
    }
    case 'kapak-form': {
      const value = interaction.fields.getTextInputValue('kapak').trim();
      if (value && !isImageUrl(value)) return replyError(interaction, 'Görsel bağlantısı geçersiz.', 'Bağlantı **https** ile başlayan, herkese açık bir görsel adresi olmalı.');
      await interaction.deferUpdate();
      const problem = value ? await checkImage(value) : null;
      if (problem) return replyError(interaction, 'Kapak görseli kaydedilmedi.', problem);
      store.set(interaction.user.id, { banner: value || null });
      // Modal gönderimi eski mesajı güncelleyemez: düzenleyici yeni bir kişiye özel mesaj olarak, kaydedilen görselle açılır
      await interaction.followUp({ ...(await kapakPageMessage(interaction)), flags: core.EPHEMERAL_CV2 });
      return refreshLiveCard(interaction);
    }
    default:
      return interaction.deferUpdate();
  }
}

// Görev rozetlerinin rol ödülleri: bot açılırken bütün sunucu bir kez taranır, üye katıldığında sadece o üye eşitlenir
async function sweepMissionRoles(client) {
  if (!gorev.ROLE_KEYS.length) return;
  const guild = client.guilds.cache.get(guildId);
  if (guild) await gorev.syncAll(guild);
}

module.exports = {
  name: 'profil',
  commands,
  help: { category: ['hesap', 'Profil'], member: ['profil'], access: { profil: 'Herkes' } },
  slash: { profil: handleCommand },
  prefixed: [[ui.IDS.prefix, handleSettings]],
  events: {
    [Events.ClientReady]: sweepMissionRoles,
    [Events.GuildMemberAdd]: (member) => (member.guild.id === guildId ? gorev.syncMember(member) : null),
  },
};
