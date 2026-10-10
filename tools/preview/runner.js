// cases/ klasöründeki tüm dosyaları yükler, case'leri çalıştırır, yükleri normalleştirip lint eder.
// Bir case patlarsa çalıştırmanın tamamı bozulmaz: hata o case'in sonucuna yazılır.
const fs = require('node:fs');
const path = require('node:path');

// Sistemler yüklenirken GUILD_ID gerekir; gerçek bir değer şart değil
process.env.GUILD_ID = process.env.GUILD_ID || '1';

const ROOT = path.resolve(__dirname, '..', '..');
const CASES_DIR = path.join(__dirname, 'cases');
const { FLAG } = require('./common');
const mock = require('./mock');
const { lint } = require('./lint');

const fromRoot = (...parts) => require(path.join(ROOT, ...parts));
// src/core/ui yüklenince ContainerBuilder.toJSON "tidy" yamasını alır; bütün case'ler bunu görmeli
const ui = fromRoot('src', 'core', 'ui');

const toJSON = (value) => (value && typeof value.toJSON === 'function' ? value.toJSON() : value);

function flagsOf(raw) {
  if (raw === undefined || raw === null) return FLAG.CV2;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'bigint') return Number(raw);
  if (Array.isArray(raw)) return raw.reduce((n, f) => n | Number(f?.bitfield ?? f), 0);
  return Number(raw.bitfield ?? raw);
}

const isModalLike = (json) => json && typeof json === 'object' && !Array.isArray(json) && json.type === undefined && 'title' in json && 'custom_id' in json;

// Bir case'in döndürdüğü şeyi { kind, components, content, flags, files, ... } ya da { kind: 'modal', modal } yapar
function normalize(raw) {
  if (raw === undefined || raw === null) throw new Error('build() bir şey döndürmedi');

  if (Array.isArray(raw)) raw = { components: raw };
  const isBuilder = typeof raw.toJSON === 'function';
  const json = isBuilder ? raw.toJSON() : raw;

  if (isModalLike(json)) {
    return { kind: 'modal', modal: { ...json, components: (json.components ?? []).map(toJSON) } };
  }
  if (isBuilder && json && typeof json.type === 'number') {
    return { kind: 'message', components: [json], content: '', flags: FLAG.CV2, embeds: [], files: [], allowedMentions: undefined };
  }
  if (!json || typeof json !== 'object' || (!('components' in json) && !('content' in json) && !('embeds' in json))) {
    throw new Error('build() Container, ModalBuilder ya da { components, ... } döndürmeli');
  }
  const files = (json.files ?? []).map((f) => ({
    name: f.name,
    buffer: Buffer.isBuffer(f.buffer) ? f.buffer : Buffer.isBuffer(f.attachment) ? f.attachment : Buffer.from(f.buffer ?? f.attachment ?? ''),
  }));
  return {
    kind: 'message',
    components: (json.components ?? []).map(toJSON),
    content: json.content ?? '',
    flags: flagsOf(json.flags),
    embeds: (json.embeds ?? []).map(toJSON),
    files,
    allowedMentions: json.allowedMentions,
  };
}

// Dosya adından sistem adı: "_core.js" -> "core"
const systemName = (file) => file.replace(/\.js$/, '').replace(/^_/, '');

function listCaseFiles() {
  if (!fs.existsSync(CASES_DIR)) return [];
  return fs
    .readdirSync(CASES_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort((a, b) => {
      const ua = a.startsWith('_') ? 0 : 1;
      const ub = b.startsWith('_') ? 0 : 1;
      return ua - ub || a.localeCompare(b);
    });
}

const errorText = (err) => {
  const stack = String(err?.stack ?? err);
  return stack.split('\n').slice(0, 6).join('\n');
};

function crashed(base, err, rule = 'case-hata') {
  const msg = String(err?.message ?? err).split('\n')[0];
  return { ...base, norm: null, error: errorText(err), lint: { errors: [{ rule, path: '', msg }], warnings: [] } };
}

// filter: sistem adları (boş = hepsi). Dönüş: [{ name, file, cases: [...] }]
function run(filter = []) {
  const wanted = new Set(filter.map((f) => f.replace(/^_/, '')));
  const systems = [];

  for (const file of listCaseFiles()) {
    const name = systemName(file);
    if (wanted.size && !wanted.has(name)) continue;

    const system = { name, file, cases: [], loadError: null };
    systems.push(system);

    let defs;
    try {
      const modulePath = path.join(CASES_DIR, file);
      delete require.cache[require.resolve(modulePath)];
      const factory = require(modulePath);
      if (typeof factory !== 'function') throw new Error('Case dosyası ({ mock, ui }) => [...] fonksiyonu dışa vermeli');
      defs = factory({ mock, ui, src: (...p) => fromRoot('src', ...p) });
      if (!Array.isArray(defs)) throw new Error('Case dosyası bir dizi döndürmeli');
    } catch (err) {
      system.loadError = errorText(err);
      system.cases.push(crashed({ system: name, id: '_yukleme', title: `${file} yüklenemedi`, where: '-', visibility: 'panel', kind: 'message' }, err, 'dosya-hata'));
      continue;
    }

    const seen = new Set();
    for (const def of defs) {
      const base = {
        system: name,
        id: String(def?.id ?? `case-${system.cases.length + 1}`),
        title: def?.title ?? def?.id ?? '(adsız)',
        where: def?.where ?? '',
        visibility: def?.visibility ?? 'public',
        kind: def?.kind ?? 'message',
      };
      if (seen.has(base.id)) {
        system.cases.push(crashed(base, new Error(`Aynı dosyada tekrar eden case id: ${base.id}`), 'case-id-tekrar'));
        continue;
      }
      seen.add(base.id);
      try {
        if (typeof def?.build !== 'function') throw new Error('build fonksiyonu yok');
        const norm = normalize(def.build());
        system.cases.push({ ...base, kind: norm.kind, norm, error: null, lint: lint(norm) });
      } catch (err) {
        system.cases.push(crashed(base, err));
      }
    }
  }
  return systems;
}

module.exports = { run, normalize, listCaseFiles, systemName, ROOT, ui, mock, fromRoot };
