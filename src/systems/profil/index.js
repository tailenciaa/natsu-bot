// Profil: /profil ile açılır, sunucu üzerindeki her şeyin tek görsel kartta göründüğü kişisel profil. Sahibi kendi
// profilinin altındaki kontrollerle (biyografi, unvan, renk, kapak düzenleyici, tema, vitrin) kartı canlı olarak
// özelleştirir; her değişiklikte kart yeniden çizilip aynı mesaj güncellenir. Rozetler etkinlikten türetilir,
// uzun vadeli görev rozetlerinin rol ödülü vardır (gorev.js); mağazadan alınan kozmetikler (çerçeve, tema, arka
// plan, sergi rozeti) kartın kenarına, kapağına ve rozet şeridine çizilir.
const { AttachmentBuilder, ButtonStyle, Events, InteractionContextType, SlashCommandBuilder } = require('discord.js');
const core = require('../../core/ui');
const { replyError, respond, isMenuOwner } = require('../../core/helpers');
const coinStore = require('../coin/store');
const saygiStore = require('../saygi/store');
const seviyeStore = require('../seviye/store');
const siralamaStore = require('../siralama/store');
const { buildHeaderPreview, buildProfileCard } = require('./card');
const kapak = require('./kapak');
const kozmetik = require('./kozmetik');
const gorev = require('./gorev');
const rozet = require('./rozet');
const store = require('./store');
const { THEMES } = require('./themes');
const ui = require('./ui');

const commands = [
  new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Seviye, sıralama, rozet ve istatistiklerinle sunucu profilini gösterir.')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName('kullanici').setDescription('Profiline bakılacak üyeyi seçer, boş bırakırsan kendi profilin gösterilir.')),
];

const number = (n) => Number(n).toLocaleString('tr-TR');

function duration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} sa ${minutes % 60} dk` : `${minutes} dk`;
}

// Vitrinde öne çıkarılabilen istatistikler; değeri üretmeyen (henüz kaydı olmayan) seçenek kartta boş kalır
const FEATURED = [
  { key: 'mesaj', label: 'Mesaj sıralaması', note: 'Tüm zamanların mesaj sıran', value: (v) => (v.mesajRank ? `# ${v.mesajRank}` : null) },
  { key: 'ses', label: 'Ses sıralaması', note: 'Tüm zamanların ses sıran', value: (v) => (v.sesRank ? `# ${v.sesRank}` : null) },
  { key: 'yayin', label: 'Yayın süresi', note: 'Toplam ekran paylaşımı', value: (v) => (v.streamSeconds >= 3600 ? duration(v.streamSeconds) : null) },
  { key: 'saygi', label: 'Saygınlık', note: 'Toplam aldığın saygınlık', value: (v) => (v.rep ? `${v.rep} saygınlık` : null) },
  { key: 'seri', label: 'Giriş serisi', note: 'Art arda günlük ödül', value: (v) => (v.streak ? `${v.streak} günlük seri` : null) },
  { key: 'coin', label: 'Coin bakiyesi', note: 'Harcayabileceğin coin', value: (v) => `${number(v.balance)} coin` },
];

const featuredOptions = FEATURED.map(({ key, label, note }) => ({ key, label, note }));

// Bağlantı kartında kısa yazılır: protokol ve www atılır, yol küçük tutulur
function linkLabel(url) {
  const host = String(url).replace(/^https?:\/\//, '').replace(/^www\./, '');
  return core.shorten(host.replace(/\/$/, ''), 34);
}

// Kartın çizim verisi: ölçümler, rozet bağlamı ve vitrin alanları tek yerde toplanır
async function viewDataOf(guild, userId) {
  const messages = siralamaStore.totals('messages', null);
  const voice = siralamaStore.totals('voice', null);
  const stream = siralamaStore.totals('stream', null);
  const member = await guild.members.fetch(userId).catch(() => null);
  const custom = store.get(userId);
  const visits = store.visits(userId);
  const messageCount = messages.get(userId) ?? 0;
  const voiceSeconds = voice.get(userId) ?? 0;
  const streamSeconds = stream.get(userId) ?? 0;
  const rep = saygiStore.allTotals()[userId] ?? 0;

  const stats = {
    mesajRank: siralamaStore.rankIn(messages, userId),
    sesRank: siralamaStore.rankIn(voice, userId),
    streamSeconds,
    rep,
    streak: coinStore.streak(userId),
    balance: coinStore.balance(userId),
  };
  const ctx = rozet.context({ guild, member, userId, messageCount, voiceSeconds, streamSeconds, visits: visits.count });
  // Satın alınan sergi rozetleri başa yazılır: kartta iki satır yer olduğu için kazanılan rozetlerin arasında kaybolmasınlar
  const badges = [...kozmetik.badgesOf(custom.ownedBadges), ...rozet.earned(ctx)];
  const featured = FEATURED.find((o) => o.key === custom.featured);

  return {
    custom,
    roleColor: member?.displayColor ?? 0,
    mesajXp: seviyeStore.xpOf('mesaj', userId),
    sesXp: seviyeStore.xpOf('ses', userId),
    joinedAt: member?.joinedTimestamp ?? null,
    messageCount,
    voiceSeconds,
    badges,
    featured: featured ? { label: featured.label, value: featured.value(stats) ?? 'kayıt yok' } : null,
    links: ['twitch', 'youtube', 'github', 'site'].map((key) => custom.links?.[key]).filter(Boolean).slice(0, 3).map(linkLabel),
    visits: visits.count,
    coins: stats.balance,
    frame: kozmetik.frameOf(custom.frame),
    ...stats,
  };
}

async function buildMessage(guild, user, isSelf) {
  const view = await viewDataOf(guild, user.id);
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

const SHOP_TABS = { cerceve: 'Çerçeveler', tema: 'Temalar' };

// Ürün kataloğu: { tur, key, name, note, price } — çerçevesiz hâl ücretsizdir, mağazada "Giy" olarak durur
function catalog(tur) {
  if (tur === 'tema') {
    return Object.entries(THEMES)
      .filter(([, theme]) => theme.price > 0)
      .map(([key, theme]) => ({ tur, key, name: theme.label, note: theme.description, price: theme.price }));
  }
  return kozmetik.FRAMES.map((f) => ({ tur: 'cerceve', key: f.key, name: f.label, note: f.note, price: f.price }));
}

const ownsItem = (tur, custom, key) =>
  tur === 'tema' ? (custom.ownedThemes ?? []).includes(key) : key === 'yok' || (custom.ownedFrames ?? []).includes(key);

const wornItem = (tur, custom, key) => (tur === 'tema' ? custom.theme === key : (custom.frame ?? 'yok') === key);

// Mağaza sayfasının satırları: sahiplik ve bakiye durumuna göre düğme etiketi belirlenir
function shopRows(tur, custom) {
  return catalog(tur).map((item) => {
    const owned = ownsItem(tur, custom, item.key);
    const worn = wornItem(tur, custom, item.key);
    const base = { name: item.name, note: item.note };
    if (worn) return { ...base, state: 'Kartında bu var', id: `${ui.IDS.wear}${tur}:${item.key}`, label: 'Giyili', disabled: true };
    if (item.price === 0) return { ...base, state: 'Ücretsiz', id: `${ui.IDS.wear}${tur}:${item.key}`, label: 'Giy', wearStyle: ButtonStyle.Secondary };
    if (owned) return { ...base, state: 'Sahipsin', id: `${ui.IDS.wear}${tur}:${item.key}`, label: 'Giy', wearStyle: ButtonStyle.Primary };
    return { ...base, state: `${number(item.price)} coin`, id: `${ui.IDS.buy}${tur}:${item.key}`, label: `Al · ${number(item.price)}`, wearStyle: ButtonStyle.Secondary };
  });
}

function shopMessage(interaction, tab) {
  return ui.shopPage(tab, SHOP_TABS, coinStore.balance(interaction.user.id), shopRows(tab, store.get(interaction.user.id)));
}

// Ürün satın alma: para ancak ürün gerçekten sahipliğe geçiyorsa düşürülür
async function buy(interaction, tur, key) {
  const item = catalog(tur).find((i) => i.key === key);
  if (!item) return replyError(interaction, 'Bu ürün artık mağazada yok.', 'Mağazayı yeniden açmayı dene.');

  const custom = store.get(interaction.user.id);
  if (ownsItem(tur, custom, key)) return replyError(interaction, 'Bu ürün zaten sende.', 'Kartında kullanmak için giyebilirsin.');

  const balance = coinStore.balance(interaction.user.id);
  if (balance < item.price) {
    return replyError(
      interaction,
      'Bakiyen bu ürün için yetmiyor.',
      `Fiyatı **${number(item.price)}** coin, senin bakiyen **${number(balance)}** coin. Günlük ödüller ve haftalık derecelerle artırabilirsin.`,
    );
  }

  if (!coinStore.spend(interaction.user.id, item.price)) return replyError(interaction, 'Satın alma tamamlanamadı.', 'Birkaç saniye sonra tekrar dene.');
  if (tur === 'tema') store.addTheme(interaction.user.id, key);
  else store.addFrame(interaction.user.id, key);
  // Satın alınan hemen giyilir; kart hem mağaza mesajında hem profil mesajında güncellenir
  store.set(interaction.user.id, tur === 'tema' ? { theme: key } : { frame: key });

  // Mağaza sayfası yerinde yenilenir: bakiye ve düğme durumu hemen doğru görünsün
  await interaction.update({ components: [shopMessage(interaction, tur)], allowedMentions: { parse: [] } });
  await respond(
    interaction,
    core.alert(`${item.name} satın alındı ve kartına uygulandı.`, `**${number(item.price)}** coin düşüldü, bakiyen **${number(coinStore.balance(interaction.user.id))}** coin.`, 'success'),
    { followUp: true },
  );
  return refreshLiveCard(interaction);
}

// Sahip olunan ürünü giyme (çerçevesiz hâl de bir seçenektir, ücretsiz sayılır)
async function wear(interaction, tur, key) {
  const item = catalog(tur).find((i) => i.key === key);
  if (!item) return replyError(interaction, 'Bu ürün artık mağazada yok.', 'Mağazayı yeniden açmayı dene.');
  if (!ownsItem(tur, store.get(interaction.user.id), key)) return replyError(interaction, 'Önce satın alman gerekiyor.', 'Mağaza sayfasından bakiyeni görebilirsin.');

  store.set(interaction.user.id, tur === 'tema' ? { theme: key } : { frame: key });
  await interaction.update({ components: [shopMessage(interaction, tur)], allowedMentions: { parse: [] } });
  await respond(interaction, core.alert('Kartın güncellendi.', `${item.name} görünümü seçildi; profil kartın da hemen böyle çizildi.`), { followUp: true });
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
  const [action, arg, arg2] = interaction.customId.split(':').slice(1);
  const current = store.get(interaction.user.id);

  switch (action) {
    case 'bio':
      return interaction.showModal(ui.bioModal(current));
    case 'renk':
      return interaction.showModal(ui.colorModal(current));
    case 'kapak':
      return interaction.showModal(ui.bannerModal(current));
    case 'sifirla':
      await interaction.deferUpdate();
      // Sahipli kozmetikler kalıcıdır; sıfırlama yalnızca kartın görünümünü varsayılana döndürür
      store.set(interaction.user.id, {
        bio: null,
        title: null,
        color: null,
        theme: null,
        banner: null,
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
      const ctx = rozet.context({
        guild: interaction.guild,
        member,
        userId: interaction.user.id,
        messageCount: siralamaStore.totals('messages', null).get(interaction.user.id) ?? 0,
        streamSeconds: siralamaStore.totals('stream', null).get(interaction.user.id) ?? 0,
        visits: store.visits(interaction.user.id).count,
      });
      return respond(interaction, ui.rozetPage(rozet.progress(ctx), rozet.earned(ctx).length));
    }
    case 'magaza':
      return respond(interaction, shopMessage(interaction, arg ?? 'cerceve'));
    case 'al':
      return buy(interaction, arg, arg2);
    case 'giy':
      return wear(interaction, arg, arg2);
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
      await respond(
        interaction,
        bad.length
          ? core.alert('Bağlantıların kaydedildi.', `${bad.join(', ')} için verdiğin adres **https** ile başlayan bir web adresi olmadığından kartına yazılmadı.`, 'warning')
          : core.alert('Vitrinin güncellendi.', 'Profil kartının alt şeridinde görünecek.', 'success'),
        { followUp: true },
      );
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
      return refresh(interaction);
    }
    default:
      return interaction.deferUpdate();
  }
}

module.exports = {
  name: 'profil',
  commands,
  help: { category: ['siralama', 'Sıralama'], access: { profil: 'Herkes' } },
  slash: { profil: handleCommand },
  prefixed: [[ui.IDS.prefix, handleSettings]],
};
