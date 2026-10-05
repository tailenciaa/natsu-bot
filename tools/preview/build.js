// node tools/preview/build.js [sistem ...]
// Case'leri çalıştırır; out/index.html (tek dosya, satır içi CSS/JS) ve out/<sistem>.txt üretir.
const fs = require('node:fs');
const path = require('node:path');
const { run, listCaseFiles, systemName } = require('./runner');
const { renderMessage, renderModal, css } = require('./render');
const { toText, stats } = require('./text');
const { esc } = require('./markdown');
const mock = require('./mock');
const { resolve: resolvePlaceholder } = require('./placeholder');
const config = require('./config');

const OUT = path.join(__dirname, 'out');
const VIS = {
  public: 'Herkese açık',
  ephemeral: 'Sadece kullanana görünür',
  dm: 'Özel mesaj (DM)',
  log: 'Log kanalı',
  panel: 'Panel (kalıcı)',
};
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

const SCRIPT = `
(function () {
  var body = document.body;
  function setWidth(w) {
    body.className = 'w-' + w;
    document.querySelectorAll('[data-w]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-w') === w); });
    try { localStorage.setItem('kazuki-preview-w', w); } catch (e) {}
  }
  document.querySelectorAll('[data-w]').forEach(function (b) {
    b.addEventListener('click', function () { setWidth(b.getAttribute('data-w')); });
  });
  var saved = 'desktop';
  try { saved = localStorage.getItem('kazuki-preview-w') || 'desktop'; } catch (e) {}
  setWidth(saved);

  var search = document.getElementById('q');
  var onlyBad = document.getElementById('bad');
  function filter() {
    var q = (search.value || '').toLocaleLowerCase('tr');
    var bad = onlyBad.checked;
    document.querySelectorAll('.card').forEach(function (card) {
      var ok = (!q || card.getAttribute('data-q').indexOf(q) !== -1) && (!bad || card.getAttribute('data-bad') === '1');
      card.classList.toggle('hidden', !ok);
    });
    document.querySelectorAll('.navitem').forEach(function (a) {
      var ok = (!q || a.getAttribute('data-q').indexOf(q) !== -1) && (!bad || a.getAttribute('data-bad') === '1');
      a.style.display = ok ? '' : 'none';
    });
  }
  search.addEventListener('input', filter);
  onlyBad.addEventListener('change', filter);

  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('.spoiler');
    if (s) s.classList.toggle('on');
  });
  // Yüklenemeyen görseller (internet yok / süresi dolmuş bağlantı) etiketli yer tutucuya dönüşür
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || !t.getAttribute('data-label')) return;
    var d = document.createElement('div');
    d.className = 'imgph' + (t.classList.contains('thumb') ? ' thumb' : '');
    var a = document.createElement('span'); a.textContent = 'Görsel yüklenemedi';
    var b = document.createElement('code'); b.textContent = t.getAttribute('data-label');
    d.appendChild(a); d.appendChild(b);
    t.replaceWith(d);
  }, true);
})();
`;

const clock = () => new Date().toLocaleTimeString('tr-TR', { timeZone: config.TIMEZONE, hour: '2-digit', minute: '2-digit' });

function lintHtml(lint) {
  const { errors, warnings } = lint;
  if (!errors.length && !warnings.length) return '';
  const items = [
    ...errors.map((f) => `<li class="err"><b>HATA</b> <code>${esc(f.rule)}</code> ${f.path ? `<code>${esc(f.path)}</code> ` : ''}${esc(f.msg)}</li>`),
    ...warnings.map((f) => `<li class="warn"><b>UYARI</b> <code>${esc(f.rule)}</code> ${f.path ? `<code>${esc(f.path)}</code> ` : ''}${esc(f.msg)}</li>`),
  ];
  return `<details class="lint" ${errors.length ? 'open' : ''}><summary>Lint bulguları</summary><ul>${items.join('')}</ul></details>`;
}

function badges(c) {
  const e = c.lint.errors.length;
  const w = c.lint.warnings.length;
  const out = [`<span class="badge vis">${esc(VIS[c.visibility] ?? c.visibility)}</span>`];
  if (!c.norm) out.push('<span class="badge err">Çalışmadı</span>');
  if (e) out.push(`<span class="badge err">${e} hata</span>`);
  if (w) out.push(`<span class="badge warn">${w} uyarı</span>`);
  if (!e && !w && c.norm) out.push('<span class="badge ok">temiz</span>');
  if (c.norm) {
    const s = stats(c.norm);
    out.push(`<span class="badge" title="bileşen sayısı / metin karakteri">${s.components} bileşen · ${s.chars} krk</span>`);
  }
  return out.join(' ');
}

function bodyHtml(c, ctx) {
  if (c.error) return `<div class="crash"><b>Case çalışırken hata verdi</b><pre>${esc(c.error)}</pre></div>`;
  if (c.norm.kind === 'modal') return `<div class="modalwrap">${renderModal(c.norm, ctx)}</div>`;
  const note = c.visibility === 'ephemeral' ? '<div class="ephnote">Bunu sadece sen görebilirsin.</div>' : '';
  const where = c.visibility === 'dm' ? 'Doğrudan mesaj' : '';
  return (
    `<div class="msgwrap"><img class="av" src="${esc(resolvePlaceholder(mock.avatar('Kazuki', 'K')))}" alt="">` +
    `<div class="mbody"><div class="mhead"><span class="uname">Kazuki</span><span class="tag">UYGULAMA</span><span class="mtime">Bugün ${clock()}${where ? ` · ${where}` : ''}</span></div>` +
    `${renderMessage(c.norm, ctx)}${note}</div></div>`
  );
}

function cardHtml(c, ctx) {
  const anchor = `c-${slug(c.system)}--${slug(c.id)}`;
  const bad = c.lint.errors.length > 0;
  const q = `${c.system} ${c.id} ${c.title} ${c.where}`.toLocaleLowerCase('tr');
  const dump = c.norm ? `<details class="dump"><summary>Metin dökümü</summary><pre>${esc(toText(c.norm))}</pre></details>` : '';
  return (
    `<article class="card${bad ? ' bad' : ''}" id="${anchor}" data-q="${esc(q)}" data-bad="${bad ? 1 : 0}">` +
    `<div class="ch"><h3>${esc(c.title)}</h3><span class="id">${esc(c.system)}/${esc(c.id)}</span></div>` +
    `<div class="where">${c.where ? `Nerede: ${esc(c.where)}` : ''}</div>` +
    `<div>${badges(c)}</div>${lintHtml(c.lint)}${bodyHtml(c, ctx)}${dump}</article>`
  );
}

function navHtml(systems) {
  return systems
    .map((s) => {
      const items = s.cases
        .map((c) => {
          const e = c.lint.errors.length;
          const w = c.lint.warnings.length;
          const badge = e ? `<span class="badge err">${e}</span>` : w ? `<span class="badge warn">${w}</span>` : '<span class="badge ok">ok</span>';
          const q = `${c.system} ${c.id} ${c.title}`.toLocaleLowerCase('tr');
          return `<a class="navitem" href="#c-${slug(c.system)}--${slug(c.id)}" data-q="${esc(q)}" data-bad="${e ? 1 : 0}"><span class="t">${esc(c.title)}</span>${badge}</a>`;
        })
        .join('');
      const errs = s.cases.reduce((n, c) => n + c.lint.errors.length, 0);
      return `<details open><summary>${esc(s.name)} <span class="badge">${s.cases.length}</span>${errs ? ` <span class="badge err">${errs}</span>` : ''}</summary>${items}</details>`;
    })
    .join('');
}

function pageHtml(systems) {
  const ctx = { lookup: mock.lookup, now: Date.now() };
  const all = systems.flatMap((s) => s.cases);
  const errs = all.reduce((n, c) => n + c.lint.errors.length, 0);
  const warns = all.reduce((n, c) => n + c.lint.warnings.length, 0);
  const sections = systems
    .map((s) => `<section id="sys-${slug(s.name)}"><h2 class="sysh">${esc(s.name)}</h2>${s.cases.map((c) => cardHtml(c, ctx)).join('')}</section>`)
    .join('');
  return (
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Kazuki Mesaj Önizleme</title><style>${css}</style></head><body class="w-desktop"><div id="app">` +
    `<aside id="nav"><h1>Kazuki mesaj önizleme</h1><input id="q" type="search" placeholder="Ara (sistem, başlık)..."><label class="sum"><input id="bad" type="checkbox"> sadece hatalı olanlar</label><div style="height:8px"></div>${navHtml(systems)}</aside>` +
    `<main id="main"><div class="top"><h2>${all.length} mesaj · ${errs} hata · ${warns} uyarı</h2>` +
    `<div class="seg"><button type="button" data-w="desktop">Masaüstü ${config.WIDTHS.desktop}px</button><button type="button" data-w="mobile">Mobil ${config.WIDTHS.mobile}px</button></div></div>` +
    `${sections}</main></div><script>${SCRIPT}</script></body></html>`
  );
}

const LEVEL = { errors: 'HATA', warnings: 'UYARI' };
function systemText(system) {
  const out = [`# ${system.name} (${system.cases.length} mesaj)`, ''];
  for (const c of system.cases) {
    out.push(`=== ${system.name}/${c.id} - ${c.title}`);
    out.push(`Nerede: ${c.where || '-'} | Görünürlük: ${VIS[c.visibility] ?? c.visibility} | Tür: ${c.kind}`);
    out.push(c.error ? `HATA (case çalışmadı):\n${c.error}` : toText(c.norm));
    for (const level of ['errors', 'warnings']) {
      for (const f of c.lint[level]) out.push(`  [${LEVEL[level]}] ${f.rule}${f.path ? ` ${f.path}` : ''}: ${f.msg}`);
    }
    out.push('');
  }
  return out.join('\n');
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const known = new Set(listCaseFiles().map(systemName));
  for (const a of args) if (!known.has(a.replace(/^_/, ''))) console.warn(`[uyarı] "${a}" adında case dosyası yok (var olanlar: ${[...known].join(', ')})`);

  const systems = run(args);
  if (!systems.length) {
    console.error('[hata] Çalıştırılacak case dosyası bulunamadı.');
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const html = pageHtml(systems);
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  for (const s of systems) fs.writeFileSync(path.join(OUT, `${s.name}.txt`), systemText(s));

  let total = 0;
  let errors = 0;
  let warnings = 0;
  for (const s of systems) {
    const e = s.cases.reduce((n, c) => n + c.lint.errors.length, 0);
    const w = s.cases.reduce((n, c) => n + c.lint.warnings.length, 0);
    total += s.cases.length;
    errors += e;
    warnings += w;
    console.log(`${s.name.padEnd(14)} ${String(s.cases.length).padStart(3)} mesaj  ${String(e).padStart(3)} hata  ${String(w).padStart(3)} uyarı`);
  }
  console.log(`\nToplam: ${total} mesaj, ${errors} lint hatası, ${warnings} uyarı`);
  console.log(`Yazıldı: ${path.join(OUT, 'index.html')} (${(html.length / 1024).toFixed(0)} KB) ve ${systems.length} adet .txt`);
  process.exit(0);
}

main();
