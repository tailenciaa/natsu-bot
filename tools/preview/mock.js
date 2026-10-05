// Sahte Discord nesneleri: UI fonksiyonlarının çağırdığı üyeleri taşır, internet gerektirmez.
// Avatar, simge ve banner adresleri sahte https adresidir (placeholder.js), çizimde data URI SVG olur; dosyalar canvas PNG'dir.
const { ChannelType, Collection } = require('discord.js');

// ── Kimlikler ve kayıt defteri (etiketlerin adlarını göstermek için) ─────────
let seq = 1000000000000000000n;
const snowflake = () => String((seq += 7919n));

const registry = { users: new Map(), roles: new Map(), channels: new Map(), guilds: new Map() };
const lookup = {
  user: (id) => registry.users.get(String(id)),
  role: (id) => registry.roles.get(String(id)),
  channel: (id) => registry.channels.get(String(id)),
};

// ── Zaman ────────────────────────────────────────────────────────────────────
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms) => Date.now() - ms;

// ── Görsel yer tutucular (placeholder.js): sahte https adresi, çizimde data URI SVG'ye çevrilir ──
const ph = require('./placeholder');
const { hue, avatar, icon, banner } = ph;
const placeholder = ph.dataUri;

// Canvas ile gerçek PNG tamponu (attachment:// dosyaları için); canvas yüklenemezse 1x1 PNG
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
function png({ width = 640, height = 360, label = 'Görsel', color } = {}) {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color ?? `hsl(${hue(label)}, 40%, 32%)`;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = `${Math.round(Math.min(width, height) * 0.12)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width / 2, height / 2);
    return canvas.toBuffer('image/png');
  } catch {
    return TINY_PNG;
  }
}
const file = (name, content = '') => ({ name, buffer: Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8') });
const pngFile = (name, opts = {}) => ({ name, buffer: png({ label: name, ...opts }) });

const collection = (entries = []) => new Collection(entries);

// ── Gevşek (Proxy) nesne: bilinmeyen özelliklerde patlamak yerine makul varsayılan döner ──
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const NESTED = /^(cache|members|channels|roles|guilds|users|emojis|stickers|commands|threads|messages|permissions|options|fields|voice|client|guild|channel|user|member|author|message|parent|owner|me|presence|resolved|data)$/;

function guess(prop, owner) {
  if (/^(is|has|can|should|was)[A-Z]/.test(prop)) return () => false;
  if (/(avatar|icon|banner|image|thumbnail).*url$/i.test(prop)) return () => avatar(owner || prop);
  if (/url$/i.test(prop)) return 'https://discord.com/channels/1/2/3';
  if (/Timestamp$/.test(prop)) return Date.now();
  if (/(At|Date)$/.test(prop)) return new Date();
  if (/^(id|.+Id)$/.test(prop)) return snowflake();
  if (/^(name|username|displayName|globalName|nickname|label|title|tag|topic|content)$/.test(prop)) return 'ornek';
  if (/^(size|length|count|position|rawPosition|bitrate|userLimit|rateLimitPerUser|ping)$|Count$/.test(prop)) return 0;
  if (NESTED.test(prop)) return makeProxy({}, prop);
  return callable(prop);
}

function handler(base, name) {
  const cache = new Map();
  return {
    get(target, prop, receiver) {
      if (hasOwn(base, prop)) return Reflect.get(base, prop, receiver);
      if (typeof prop === 'symbol') {
        if (prop === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : `[mock:${name}]`);
        if (prop === Symbol.iterator) return function* empty() {};
        return undefined;
      }
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      if (prop === 'toString') return () => `[mock:${name}]`;
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toJSON') return () => null;
      if (prop === 'constructor') return Object;
      if (prop === 'inspect' || prop === 'nodeType') return undefined;
      if (!cache.has(prop)) cache.set(prop, guess(prop, name));
      return cache.get(prop);
    },
    set(target, prop, value) {
      base[prop] = value;
      return true;
    },
  };
}

const makeProxy = (base, name) => new Proxy(base, handler(base, name));
function callable(name) {
  return new Proxy(function mockFn() {}, { ...handler({}, name), apply: () => callable(`${name}()`) });
}
const loose = (base = {}, name = 'mock') => makeProxy(base, name);

// ── Fabrikalar ───────────────────────────────────────────────────────────────

function user(id, o = {}) {
  if (id && typeof id === 'object') {
    o = id;
    id = undefined;
  }
  id = String(id ?? snowflake());
  const username = o.username ?? `uye${id.slice(-4)}`;
  const displayName = o.displayName ?? o.globalName ?? username;
  const avatarUrl = o.avatar ?? avatar(id, displayName);
  const u = {
    id,
    username,
    displayName,
    globalName: displayName,
    discriminator: '0',
    tag: username,
    bot: Boolean(o.bot),
    system: false,
    createdTimestamp: o.createdTimestamp ?? ago(400 * DAY),
    displayAvatarURL: () => avatarUrl,
    avatarURL: () => avatarUrl,
    defaultAvatarURL: avatarUrl,
    bannerURL: () => null,
    toString: () => `<@${id}>`,
    send: async () => message({ author: u }),
    fetch: async () => u,
  };
  registry.users.set(id, { name: displayName, username, bot: u.bot });
  return u;
}

function role(o = {}) {
  const id = String(o.id ?? snowflake());
  const color = typeof o.color === 'string' ? parseInt(o.color.replace('#', ''), 16) : (o.color ?? 0);
  const r = {
    id,
    name: o.name ?? `Rol ${id.slice(-4)}`,
    color,
    hexColor: `#${color.toString(16).padStart(6, '0')}`,
    position: o.position ?? 1,
    hoist: Boolean(o.hoist),
    mentionable: o.mentionable ?? true,
    managed: false,
    unicodeEmoji: null,
    members: collection(),
    createdTimestamp: ago(300 * DAY),
    toString: () => `<@&${id}>`,
  };
  registry.roles.set(id, { name: r.name, color });
  return r;
}

const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement,
  thread: ChannelType.PublicThread,
  'private-thread': ChannelType.PrivateThread,
  forum: ChannelType.GuildForum,
};

function channel(o = {}) {
  const id = String(o.id ?? snowflake());
  const type = typeof o.type === 'string' ? (CHANNEL_TYPES[o.type] ?? ChannelType.GuildText) : (o.type ?? ChannelType.GuildText);
  const guildId = o.guildId ?? o.guild?.id ?? '1';
  const isThread = type === ChannelType.PublicThread || type === ChannelType.PrivateThread || type === ChannelType.AnnouncementThread;
  const c = {
    id,
    name: o.name ?? `kanal-${id.slice(-4)}`,
    type,
    guild: o.guild ?? null,
    guildId,
    parentId: o.parentId ?? null,
    topic: o.topic ?? null,
    url: `https://discord.com/channels/${guildId}/${id}`,
    createdTimestamp: ago(200 * DAY),
    members: collection(),
    messages: { cache: collection(), fetch: async () => collection(), edit: async () => message() },
    isTextBased: () => type !== ChannelType.GuildCategory && type !== ChannelType.GuildForum,
    isThread: () => isThread,
    isVoiceBased: () => type === ChannelType.GuildVoice,
    send: async (payload) => message({ channel: c, ...(payload ?? {}) }),
    toString: () => `<#${id}>`,
  };
  if (isThread) {
    Object.assign(c, {
      ownerId: o.ownerId ?? null,
      locked: Boolean(o.locked),
      archived: Boolean(o.archived),
      members: { cache: collection(), fetch: async () => collection(), add: async () => {}, remove: async () => {} },
    });
  } else {
    c.threads = { create: async (opts) => channel({ ...opts, type: 'private-thread', guild: o.guild }) };
  }
  registry.channels.set(id, { name: c.name, type });
  return c;
}

function member(u, o = {}) {
  u = u ?? user();
  const roles = collection(
    (o.roles ?? []).map((r) => {
      const obj = typeof r === 'object' ? r : role({ id: r });
      return [obj.id, obj];
    }),
  );
  return {
    id: u.id,
    user: u,
    guild: o.guild ?? null,
    nickname: o.nickname ?? null,
    displayName: o.nickname ?? u.displayName,
    joinedTimestamp: o.joinedTimestamp ?? ago(90 * DAY),
    premiumSinceTimestamp: o.boosting ? ago(30 * DAY) : null,
    roles: { cache: roles, highest: roles.first() ?? role({ name: '@everyone' }), color: roles.first() ?? null, add: async () => {}, remove: async () => {} },
    voice: { channel: null, channelId: null },
    permissions: { has: () => Boolean(o.admin) },
    communicationDisabledUntilTimestamp: null,
    manageable: true,
    bannable: true,
    kickable: true,
    displayAvatarURL: () => u.displayAvatarURL(),
    toString: () => `<@${u.id}>`,
  };
}

function guild(o = {}) {
  const id = String(o.id ?? snowflake());
  const iconUrl =
    o.icon === false || o.icon === null
      ? null
      : typeof o.icon === 'string' && /^(https?:|data:)/.test(o.icon)
        ? o.icon
        : icon(o.name ?? id, o.name ?? 'K');
  const g = {
    id,
    name: o.name ?? 'Kazuki Sunucusu',
    icon: iconUrl ? 'iconhash' : null,
    ownerId: o.ownerId ?? null,
    memberCount: o.memberCount ?? 1234,
    premiumTier: o.premiumTier ?? 2,
    premiumSubscriptionCount: o.premiumSubscriptionCount ?? 14,
    afkChannelId: null,
    createdTimestamp: ago(600 * DAY),
    iconURL: () => iconUrl,
    bannerURL: () => null,
    toString: () => g.name,
    channels: { cache: collection(), fetch: async (cid) => g.channels.cache.get(cid) ?? (cid ? channel({ id: cid, guild: g }) : g.channels.cache) },
    roles: { cache: collection(), everyone: role({ id, name: '@everyone' }), fetch: async (rid) => g.roles.cache.get(rid) ?? null },
    members: { cache: collection(), me: null, fetch: async (uid) => g.members.cache.get(uid) ?? null },
    commands: { cache: collection(), fetch: async () => g.commands.cache },
    voiceStates: { cache: collection() },
    emojis: { cache: collection() },
  };
  // o.commands: yardım menüsünde </komut:id> görünmesi için komut adları
  for (const [i, name] of (o.commands ?? []).entries()) {
    const cid = `98000000000000${String(i).padStart(4, '0')}`;
    g.commands.cache.set(cid, { id: cid, name });
  }
  registry.guilds.set(id, g);
  return g;
}
// Sunucuya nesne eklemek için kısayollar
guild.addChannel = (g, o) => {
  const c = channel({ ...o, guild: g });
  g.channels.cache.set(c.id, c);
  return c;
};
guild.addRole = (g, o) => {
  const r = role(o);
  g.roles.cache.set(r.id, r);
  return r;
};
guild.addMember = (g, u, o) => {
  const m = member(u, { ...o, guild: g });
  g.members.cache.set(m.id, m);
  return m;
};

function message(o = {}) {
  const id = String(o.id ?? snowflake());
  const author = o.author ?? user();
  const ch = o.channel ?? channel({ guild: o.guild });
  const guildId = o.guild?.id ?? ch.guildId ?? '1';
  const m = {
    id,
    content: o.content ?? '',
    author,
    member: o.member ?? null,
    channel: ch,
    channelId: ch.id,
    guild: o.guild ?? ch.guild ?? null,
    guildId,
    url: `https://discord.com/channels/${guildId}/${ch.id}/${id}`,
    createdTimestamp: o.createdTimestamp ?? Date.now(),
    components: o.components ?? [],
    embeds: [],
    attachments: collection(),
    reference: o.reference ?? null,
    interactionMetadata: o.interactionMetadata ?? { user: author },
    pinned: false,
    edit: async () => m,
    delete: async () => m,
    reply: async (payload) => message({ channel: ch, ...(payload ?? {}) }),
    toString: () => `<message ${id}>`,
  };
  return m;
}

// Destek talebi kaydı (destek/store şeması)
function ticket(o = {}) {
  const threadId = String(o.threadId ?? snowflake());
  return {
    guildId: '1',
    threadId,
    ownerId: snowflake(),
    staffRoleId: snowflake(),
    claimChannelId: snowflake(),
    number: 8,
    reason: 'Sunucuya girerken bir hata alıyorum, yardımcı olabilir misiniz?',
    createdAt: ago(25 * MIN),
    notified: false,
    greeted: false,
    claimedBy: null,
    closedBy: null,
    closeReason: null,
    panelMessageId: snowflake(),
    claimMessages: { main: snowflake(), reminder: null },
    ...o,
  };
}
const thread = (o = {}) => channel({ type: 'private-thread', name: 'talep-0008', ...o });

// Etkileşim: gevşek Proxy, sık kullanılan alanlar dolu
function interaction(o = {}) {
  const g = o.guild ?? guild();
  const u = o.user ?? user();
  const ch = o.channel ?? channel({ guild: g });
  const client = o.client ?? loose({ user: user({ username: 'kazuki', displayName: 'Kazuki', bot: true }), guilds: { cache: collection([[g.id, g]]) } }, 'client');
  return loose(
    {
      user: u,
      member: o.member ?? member(u, { guild: g }),
      guild: g,
      guildId: g.id,
      channel: ch,
      channelId: ch.id,
      client,
      customId: o.customId ?? '',
      commandName: o.commandName ?? '',
      message: o.message ?? message({ channel: ch, guild: g, author: client.user }),
      values: o.values ?? [],
      memberPermissions: { has: () => Boolean(o.admin) },
      replied: false,
      deferred: false,
      reply: async () => {},
      update: async () => {},
      deferReply: async () => {},
      deferUpdate: async () => {},
      editReply: async () => {},
      followUp: async () => {},
      showModal: async () => {},
    },
    'interaction',
  );
}

module.exports = {
  snowflake,
  id: snowflake,
  registry,
  lookup,
  MIN,
  HOUR,
  DAY,
  ago,
  placeholder,
  avatar,
  icon,
  banner,
  png,
  file,
  pngFile,
  collection,
  loose,
  user,
  member,
  guild,
  channel,
  role,
  message,
  ticket,
  thread,
  interaction,
};
