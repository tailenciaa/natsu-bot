// Önizleme araçlarının ortak yardımcıları: bileşen türleri, gezinme, sayım
const T = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  USER_SELECT: 5,
  ROLE_SELECT: 6,
  MENTIONABLE_SELECT: 7,
  CHANNEL_SELECT: 8,
  SECTION: 9,
  TEXT_DISPLAY: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  FILE: 13,
  SEPARATOR: 14,
  CONTAINER: 17,
  LABEL: 18,
  FILE_UPLOAD: 19,
};

const TYPE_NAMES = {
  1: 'ActionRow',
  2: 'Button',
  3: 'StringSelect',
  4: 'TextInput',
  5: 'UserSelect',
  6: 'RoleSelect',
  7: 'MentionableSelect',
  8: 'ChannelSelect',
  9: 'Section',
  10: 'TextDisplay',
  11: 'Thumbnail',
  12: 'MediaGallery',
  13: 'File',
  14: 'Separator',
  17: 'Container',
  18: 'Label',
  19: 'FileUpload',
};

const SELECT_TYPES = new Set([3, 5, 6, 7, 8]);
const BUTTON_STYLES = { 1: 'Primary', 2: 'Secondary', 3: 'Success', 4: 'Danger', 5: 'Link', 6: 'Premium' };
const FLAG = { EPHEMERAL: 1 << 6, SUPPRESS_NOTIFICATIONS: 1 << 12, CV2: 1 << 15 };

const typeName = (c) => TYPE_NAMES[c?.type] ?? `Tip${c?.type}`;

// Tek bileşeni ve altındakileri gezer: visit(bileşen, yol, ebeveyn)
function walkNode(c, path, parent, visit) {
  if (!c || typeof c !== 'object') return;
  visit(c, path, parent);
  if (Array.isArray(c.components)) c.components.forEach((k, i) => walkNode(k, `${path}.components[${i}]`, c, visit));
  if (c.accessory) walkNode(c.accessory, `${path}.accessory`, c, visit);
  if (c.component) walkNode(c.component, `${path}.component`, c, visit);
}
const walk = (list, visit, base = 'components') => (list ?? []).forEach((c, i) => walkNode(c, `${base}[${i}]`, null, visit));

// Discord'un saydığı gibi: iç içe tüm bileşenler (aksesuar ve etiket içindeki bileşen dahil)
function count(list) {
  let n = 0;
  walk(list, () => n++);
  return n;
}

// Bir yükteki (mesaj ya da modal) kök bileşen listesi
const rootsOf = (norm) => (norm.kind === 'modal' ? norm.modal.components ?? [] : norm.components ?? []);

// Etkileşimli bileşenler: link olmayan butonlar, menüler (modal içindekiler dahil değil, modal kendi custom_id'siyle yönlenir)
function interactives(norm) {
  const out = [];
  walk(rootsOf(norm), (c, path) => {
    if (c.type === T.BUTTON && c.style !== 5) out.push({ id: c.custom_id, kind: 'button', type: c.type, path, comp: c });
    else if (SELECT_TYPES.has(c.type)) out.push({ id: c.custom_id, kind: 'select', type: c.type, path, comp: c });
  });
  return out;
}

const fmtSize = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain', mp4: 'video/mp4' };
const mimeOf = (name) => MIME[String(name).split('.').pop().toLowerCase()] ?? 'application/octet-stream';

// Dosya listesinden attachment:// adına karşılık gelen dosyayı bulur
function findFile(files, url) {
  const m = /^attachment:\/\/(.+)$/.exec(url ?? '');
  if (!m) return null;
  const name = decodeURIComponent(m[1]);
  return (files ?? []).find((f) => f.name === name) ?? null;
}

// Markdown işaretleri olmadan kısa özet satırı
const oneLine = (value, max = 70) => {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
};

module.exports = {
  T,
  TYPE_NAMES,
  SELECT_TYPES,
  BUTTON_STYLES,
  FLAG,
  typeName,
  walk,
  walkNode,
  count,
  rootsOf,
  interactives,
  fmtSize,
  mimeOf,
  findFile,
  oneLine,
};
