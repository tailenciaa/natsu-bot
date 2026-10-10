// node tools/preview/check.js [sistem ...] [--verbose]
// (a) tüm case'leri çalıştırıp lint eder, (b) etkileşimli custom_id'lerin bir handler'a bağlandığını doğrular
// (src/index.js route() mantığı), (c) slash komutlarını ve yardım eşlemesini denetler, (d) özet tablo basar.
// Çıkış kodu: hata varsa 1.
const { run, fromRoot } = require('./runner');
const { interactives } = require('./common');

const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose');
const filter = argv.filter((a) => !a.startsWith('--'));

const systems = fromRoot('src', 'systems');

// ── (a) case lint ────────────────────────────────────────────────────────────
const results = run(filter);
const findings = []; // { section, system, level, where, rule, path, msg }
const add = (section, system, level, where, rule, path, msg) => findings.push({ section, system, level, where, rule, path, msg });

for (const sys of results) {
  for (const c of sys.cases) {
    const where = `${sys.name}/${c.id}`;
    for (const f of c.lint.errors) add('lint', sys.name, 'HATA', where, f.rule, f.path, f.msg);
    for (const f of c.lint.warnings) add('lint', sys.name, 'UYARI', where, f.rule, f.path, f.msg);
  }
}

// ── (b) handler kapsamı: src/index.js route() mantığının birebir kopyası ─────
const prefixed = systems.flatMap((s) => (s.prefixed ?? []).map(([prefix, fn]) => ({ prefix, fn, system: s.name })));
const exact = (table) => {
  const map = new Map();
  for (const s of systems) for (const [id, fn] of Object.entries(s[table] ?? {})) map.set(id, { fn, system: s.name });
  return map;
};
const buttonHandlers = exact('buttons');
const modalHandlers = exact('modals');

// kind: 'button' | 'select' | 'modal'. route(): önce prefixed ("önek:"), sonra butonlarda tam eşleşme, modalda modals
function resolve(customId, kind) {
  const match = prefixed.find(({ prefix }) => customId.startsWith(`${prefix}:`));
  if (match) return { via: `önek ${match.prefix}:`, system: match.system, fn: match.fn, shadowed: kind === 'button' && buttonHandlers.has(customId) ? buttonHandlers.get(customId).system : kind === 'modal' && modalHandlers.has(customId) ? modalHandlers.get(customId).system : null };
  if (kind === 'button' && buttonHandlers.has(customId)) return { via: 'buttons', ...buttonHandlers.get(customId) };
  if (kind === 'modal' && modalHandlers.has(customId)) return { via: 'modals', ...modalHandlers.get(customId) };
  return null;
}

const coverage = []; // doğrulanan bağlar (verbose)
for (const sys of results) {
  for (const c of sys.cases) {
    if (!c.norm) continue;
    const where = `${sys.name}/${c.id}`;
    const targets =
      c.norm.kind === 'modal'
        ? [{ id: c.norm.modal.custom_id, kind: 'modal', path: 'custom_id', type: 'modal' }]
        : interactives(c.norm)
            .filter((i) => !i.comp?.disabled) // pasif bileşene basılamaz, handler gerekmez
            .map((i) => ({ id: i.id, kind: i.kind, path: i.path, type: i.type }));

    for (const t of targets) {
      if (!t.id) continue; // eksik custom_id lint'te raporlanır
      const hit = resolve(t.id, t.kind);
      if (!hit) {
        const why = t.kind === 'select' ? 'menüler sadece önekli (prefixed) handler ile yönlenir' : t.kind === 'modal' ? 'ne önekli ne de modals tablosunda' : 'ne önekli ne de buttons tablosunda';
        add('handler', sys.name, 'HATA', where, 'handler-yok', t.path, `"${t.id}" bir handler'a bağlı değil (${why})`);
      } else if (typeof hit.fn !== 'function') {
        add('handler', sys.name, 'HATA', where, 'handler-fonksiyon-degil', t.path, `"${t.id}" için handler fonksiyon değil`);
      } else {
        if (hit.shadowed) add('handler', sys.name, 'UYARI', where, 'handler-golgeleme', t.path, `"${t.id}" önek yönlendirmesine takılıyor (${hit.via}); ${hit.shadowed} sistemindeki tam eşleşen handler hiç çalışmaz`);
        coverage.push(`${where} ${t.id} -> ${hit.system} (${hit.via})`);
      }
    }
  }
}

// ── (c) komut denetimi ───────────────────────────────────────────────────────
const NAME_RE = /^[-_\p{L}\p{N}\p{sc=Devanagari}\p{sc=Thai}]{1,32}$/u;
// help.access artık arayüzde gösterilmez (yardım menüsü yalnızca üye komutlarını listeler), bu yüzden metin tek
// kalıba uymak zorunda değil: alan komutların kimin için olduğunu belgeleyen kayıt olarak durur.
const SUBCOMMAND = 1;
const SUBCOMMAND_GROUP = 2;

const cmdSystems = systems.filter((s) => !filter.length || filter.includes(s.name));
const allJson = []; // { system, json }

function checkDescription(system, where, path, text, required) {
  if (!required && !text) return;
  if (!text) return add('komut', system, 'HATA', where, 'aciklama-yok', path, 'Açıklama boş (en az 1 karakter olmalı)');
  if (text.length > 100) add('komut', system, 'HATA', where, 'aciklama-100', path, `Açıklama ${text.length} karakter (en çok 100): "${text.slice(0, 40)}..."`);
  if (!/[.!?]$/.test(text)) add('komut', system, 'UYARI', where, 'aciklama-nokta', path, `Açıklama noktayla bitmiyor: "${text}"`);
}

function checkOptions(system, where, path, options) {
  const list = options ?? [];
  if (list.length > 25) add('komut', system, 'HATA', where, 'secenek-25', path, `${list.length} seçenek/alt komut var (en çok 25)`);
  let optionalSeen = false;
  list.forEach((o, i) => {
    const p = `${path}.${o.name}`;
    if (!NAME_RE.test(o.name) || o.name !== o.name.toLocaleLowerCase()) add('komut', system, 'HATA', where, 'ad-gecersiz', p, `Seçenek adı geçersiz (küçük harf, 1-32 karakter, boşluksuz): "${o.name}"`);
    checkDescription(system, where, p, o.description, true);
    if (o.type !== SUBCOMMAND && o.type !== SUBCOMMAND_GROUP) {
      if (o.required) {
        if (optionalSeen) add('komut', system, 'HATA', where, 'zorunlu-sira', p, 'Zorunlu seçenek, isteğe bağlı seçeneklerden önce gelmeli');
      } else optionalSeen = true;
    }
    if ((o.choices ?? []).length > 25) add('komut', system, 'HATA', where, 'secim-25', p, `${o.choices.length} seçim var (en çok 25)`);
    for (const ch of o.choices ?? []) {
      if (String(ch.name).length > 100) add('komut', system, 'HATA', where, 'secim-ad-100', p, `Seçim adı ${String(ch.name).length} karakter (en çok 100)`);
      if (typeof ch.value === 'string' && ch.value.length > 100) add('komut', system, 'HATA', where, 'secim-deger-100', p, `Seçim değeri ${ch.value.length} karakter (en çok 100)`);
    }
    if (o.options) checkOptions(system, where, p, o.options);
  });
}

const sizeOf = (c) =>
  (c.name?.length ?? 0) +
  (c.description?.length ?? 0) +
  (c.options ?? []).reduce((n, o) => n + sizeOf(o) + (o.choices ?? []).reduce((m, ch) => m + String(ch.name).length + (typeof ch.value === 'string' ? ch.value.length : 0), 0), 0);

for (const sys of cmdSystems) {
  for (const command of sys.commands ?? []) {
    let json;
    try {
      json = command.toJSON();
    } catch (err) {
      add('komut', sys.name, 'HATA', `${sys.name}`, 'komut-json', '', `Komut toJSON edilemedi: ${err.message.split('\n')[0]}`);
      continue;
    }
    allJson.push({ system: sys.name, json });
    const where = `/${json.name}`;
    const isChat = json.type === undefined || json.type === 1;
    if (isChat) {
      if (!NAME_RE.test(json.name) || json.name !== json.name.toLocaleLowerCase()) add('komut', sys.name, 'HATA', where, 'ad-gecersiz', 'name', `Komut adı geçersiz (küçük harf, 1-32 karakter, boşluksuz): "${json.name}"`);
      checkDescription(sys.name, where, 'description', json.description, true);
      checkOptions(sys.name, where, 'options', json.options);
    } else if (json.name.length < 1 || json.name.length > 32) {
      add('komut', sys.name, 'HATA', where, 'ad-gecersiz', 'name', `Bağlam menüsü adı 1-32 karakter olmalı: "${json.name}"`);
    }
    if (sizeOf(json) > 8000) add('komut', sys.name, 'HATA', where, 'komut-8000', '', `Komut tanımı ${sizeOf(json)} karakter (en çok 8000)`);

    const handler = sys.slash?.[json.name];
    if (typeof handler !== 'function') add('komut', sys.name, 'HATA', where, 'slash-yok', '', `"${json.name}" için slash handler yok (bağlam menüsü komutları dahil)`);
  }

  // Komutu olmayan slash handler
  const names = new Set((sys.commands ?? []).map((c) => c.toJSON().name));
  for (const key of Object.keys(sys.slash ?? {})) {
    if (!names.has(key)) add('komut', sys.name, 'UYARI', `/${key}`, 'slash-fazla', '', `"${key}" slash handler'ının komut tanımı yok`);
  }

  // Yardım eşlemesi: yardim/index.js entriesFor ile aynı değişken yolları
  const jsons = (sys.commands ?? []).map((c) => c.toJSON());
  const paths = [];
  for (const json of jsons) {
    const subs = (json.options ?? []).filter((o) => o.type === SUBCOMMAND);
    if (subs.length) subs.forEach((s) => paths.push(`${json.name} ${s.name}`));
    else paths.push(json.name);
  }
  if (jsons.length && !sys.help) {
    add('komut', sys.name, 'HATA', sys.name, 'yardim-yok', '', `${sys.name} sisteminin komutları var ama help alanı yok (yardım menüsünde görünmez)`);
  }
  if (sys.help) {
    const access = sys.help.access ?? {};
    const menuNames = new Set(jsons.filter((j) => j.type === 2 || j.type === 3).map((j) => j.name));
    for (const p of paths) {
      if (access[p]) continue;
      // Sağ tık (bağlam menüsü) komutlarının açıklaması olmadığı için yardım listesinde yer almaları beklenmez: uyarı
      if (menuNames.has(p)) add('komut', sys.name, 'UYARI', `/${p}`, 'yardim-eksik-menu', '', `Bağlam menüsü komutu "${p}" help.access'te yok (yardım menüsü bu türü listelemez)`);
      else add('komut', sys.name, 'HATA', `/${p}`, 'yardim-eksik', '', `"${p}" komutunun help.access karşılığı yok`);
    }
    for (const key of Object.keys(access)) {
      if (!paths.includes(key)) add('komut', sys.name, 'HATA', `help.access`, 'yardim-fazla', '', `help.access'te "${key}" var ama böyle bir komut/alt komut yok`);
      else if (!ACCESS_TEXTS.has(access[key])) add('komut', sys.name, 'UYARI', `/${key}`, 'yardim-erisim-metni', '', `Erişim metni standart değil: "${access[key]}"`);
    }
    const [key, label] = sys.help.category ?? [];
    if (!key || !label) add('komut', sys.name, 'HATA', sys.name, 'yardim-kategori', '', 'help.category [anahtar, ad] biçiminde olmalı');
    else if (label.length > 20) add('komut', sys.name, 'UYARI', sys.name, 'yardim-kategori', '', `Kategori adı ${label.length} karakter (sekme butonu için hedef en çok 20)`);
  }
}

if (!filter.length) {
  const total = allJson.length;
  if (total > 100) add('komut', '(genel)', 'HATA', 'komutlar', 'komut-100', '', `Toplam ${total} komut var (en çok 100)`);
  const seen = new Map();
  for (const { system, json } of allJson) {
    if (seen.has(json.name) && (json.type ?? 1) === (seen.get(json.name).type ?? 1)) {
      add('komut', system, 'HATA', `/${json.name}`, 'komut-tekrar', '', `"${json.name}" komutu ${seen.get(json.name).system} sisteminde de tanımlı`);
    }
    seen.set(json.name, { system, type: json.type });
  }
  const cats = new Map();
  for (const s of systems.filter((x) => x.help?.category)) {
    const [key, label] = s.help.category;
    if (cats.has(key) && cats.get(key) !== label) add('komut', s.name, 'UYARI', s.name, 'yardim-kategori', '', `"${key}" kategorisi farklı adlarla tanımlı: "${cats.get(key)}" / "${label}"`);
    cats.set(key, label);
  }
  if (cats.size > 25) add('komut', '(genel)', 'HATA', 'help', 'yardim-kategori-25', '', `${cats.size} yardım kategorisi var (sekme butonları en çok 25)`);
}

// ── Çıktı ────────────────────────────────────────────────────────────────────
const SECTIONS = { lint: 'MESAJ LİNT', handler: 'HANDLER KAPSAMI', komut: 'KOMUT DENETİMİ' };
const shown = findings.filter((f) => f.level === 'HATA' || verbose);
for (const section of Object.keys(SECTIONS)) {
  const rows = shown.filter((f) => f.section === section);
  const errs = findings.filter((f) => f.section === section && f.level === 'HATA').length;
  const warns = findings.filter((f) => f.section === section && f.level === 'UYARI').length;
  console.log(`\n== ${SECTIONS[section]} (${errs} hata, ${warns} uyarı${!verbose && warns ? '; uyarılar için --verbose' : ''}) ==`);
  for (const f of rows) console.log(`[${f.level}] ${f.where}  ${f.rule}${f.path ? `  ${f.path}` : ''}  ${f.msg}`);
  if (section === 'handler' && verbose) {
    console.log(`(${coverage.length} etkileşim bir handler'a bağlı)`);
    for (const line of coverage) console.log(`  ok ${line}`);
  }
}

const count = (list, level) => list.filter((f) => f.level === level).length;
const pad = (v, n) => String(v).padEnd(n);
const padL = (v, n) => String(v).padStart(n);

console.log('\n== ÖZET ==');
console.log(`${pad('Sistem', 14)} ${padL('Case', 5)} ${padL('Lint hata', 10)} ${padL('Uyarı', 6)} ${padL('Handler', 8)}`);
let totalCases = 0;
for (const sys of results) {
  const mine = findings.filter((f) => f.system === sys.name);
  totalCases += sys.cases.length;
  console.log(`${pad(sys.name, 14)} ${padL(sys.cases.length, 5)} ${padL(count(mine.filter((f) => f.section === 'lint'), 'HATA'), 10)} ${padL(count(mine.filter((f) => f.section === 'lint'), 'UYARI'), 6)} ${padL(count(mine.filter((f) => f.section === 'handler'), 'HATA'), 8)}`);
}
const cmdErrors = count(findings.filter((f) => f.section === 'komut'), 'HATA');
const cmdWarns = count(findings.filter((f) => f.section === 'komut'), 'UYARI');
console.log(`${pad('TOPLAM', 14)} ${padL(totalCases, 5)} ${padL(count(findings.filter((f) => f.section === 'lint'), 'HATA'), 10)} ${padL(count(findings.filter((f) => f.section === 'lint'), 'UYARI'), 6)} ${padL(count(findings.filter((f) => f.section === 'handler'), 'HATA'), 8)}`);
console.log(`Komut denetimi: ${allJson.length} komut, ${cmdErrors} hata, ${cmdWarns} uyarı`);

const errorCount = count(findings, 'HATA');
console.log(`\n${errorCount ? `BAŞARISIZ: ${errorCount} hata` : 'TEMİZ: hata yok'} (${count(findings, 'UYARI')} uyarı)`);
process.exit(errorCount ? 1 : 0);
