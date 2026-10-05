// Baz commit ile çalışma ağacı arasında "dokunulmaz" tanımlayıcıların (customId, komut adı, db anahtarı, dışa verilen ad)
// değişip değişmediğini denetler. Kullanım: node ids-diff.js [baz=HEAD] [src/yolu ...]
// Çıkış kodu 1 ise baz'da olup şimdi KAYBOLAN tanımlayıcı var demektir (gerekçesiz olmamalı).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const base = args[0] && !args[0].startsWith('src') ? args[0] : 'HEAD';
const prefixes = args.filter((a) => a.startsWith('src')).map((p) => p.replace(/\\/g, '/'));
const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

function listFiles() {
  const out = execSync(`git ls-tree -r --name-only ${base} -- src`, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return out.filter((f) => f.endsWith('.js') && (!prefixes.length || prefixes.some((p) => f.startsWith(p))));
}

const STR = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

// src içinde start'tan itibaren dengeli { } bloğunun gövdesini döndürür (dizgeleri atlar)
function balanced(src, start) {
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      // satır yorumundaki kesme işaretleri dizge sayılmasın
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      i++;
      while (i < src.length && src[i] !== q) i += src[i] === '\\' ? 2 : 1;
    }
    i++;
  }
  return src.slice(start, i - 1);
}

function extract(raw) {
  const src = raw.split('\r\n').join('\n');
  const ids = new Set();
  const add = (kind, value) => value && ids.add(`${kind}|${value.replace(/\$\{[^}]*\}/g, '${…}')}`);

  // setCustomId('...') ve setCustomId(`...`)
  for (const m of src.matchAll(/setCustomId\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g)) add('customId', m[1].slice(1, -1));

  // IDS = { ... } blokları: içindeki tüm dizgeler
  for (const m of src.matchAll(/(?:const|let)\s+IDS\s*=\s*\{/g)) {
    for (const x of balanced(src, m.index + m[0].length).matchAll(STR)) add('IDS', x[1] ?? x[2] ?? x[3]);
  }

  // .setName('...') (komut, alt komut, seçenek adları)
  for (const m of src.matchAll(/\.setName\(\s*'([^']*)'/g)) add('name', m[1]);

  // sistem adı ve slash/buttons/modals anahtarları
  for (const m of src.matchAll(/^\s{2}name:\s*'([^']+)'/gm)) add('systemName', m[1]);
  for (const blockName of ['slash', 'buttons', 'modals']) {
    const m = src.match(new RegExp(`^\\s{2}${blockName}:\\s*\\{`, 'm'));
    if (!m) continue;
    const body = balanced(src, m.index + m[0].length);
    for (const k of body.matchAll(/^\s*(?:'([^']+)'|"([^"]+)"|\[([^\]]+)\]|([\w$.]+))\s*:/gm)) add(blockName, k[1] ?? k[2] ?? k[3] ?? k[4]);
  }

  // prefixed: [[önek, işleyici], ...]
  const pm = src.match(/prefixed:\s*\[/);
  if (pm) {
    let depth = 1;
    let i = pm.index + pm[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth++;
      else if (src[i] === ']') depth--;
      i++;
    }
    for (const k of src.slice(start, i - 1).matchAll(/\[\s*([^,\]]+),/g)) add('prefixed', k[1].trim());
  }

  // syncPanel key / buttonId
  for (const m of src.matchAll(/\bkey:\s*'([^']+)'/g)) add('panelKey', m[1]);
  for (const m of src.matchAll(/buttonId:\s*([^,\n}]+)/g)) add('panelButton', m[1].trim());

  // db alanları
  for (const m of src.matchAll(/\bdata\.([A-Za-z_]\w*)/g)) add('db', m[1]);

  // dışa verilen adlar
  const em = src.match(/module\.exports\s*=\s*\{/);
  if (em) {
    for (const k of balanced(src, em.index + em[0].length).split(/[,\n]/)) {
      const name = k.trim().split(':')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) add('export', name);
    }
  }
  return ids;
}

let lost = 0;
let gained = 0;
const rows = [];
for (const file of listFiles()) {
  const before = execSync(`git show ${base}:${file}`, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  const nowPath = path.join(root, file);
  const after = fs.existsSync(nowPath) ? fs.readFileSync(nowPath, 'utf8') : '';
  const a = extract(before);
  const b = extract(after);
  const removed = [...a].filter((x) => !b.has(x));
  const added = [...b].filter((x) => !a.has(x));
  if (!removed.length && !added.length) continue;
  rows.push({ file, removed, added });
  lost += removed.length;
  gained += added.length;
}
for (const r of rows) {
  console.log(`\n${r.file}`);
  for (const x of r.removed) console.log(`  - KAYIP  ${x}`);
  for (const x of r.added) console.log(`  + yeni   ${x}`);
}
console.log(`\nToplam: ${lost} kayıp, ${gained} yeni tanımlayıcı (${rows.length} dosya).`);
process.exit(lost ? 1 : 0);
