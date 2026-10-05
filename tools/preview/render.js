// Components V2 yükünü Discord karanlık temasına benzer HTML'e çevirir.
const { esc, renderMarkdown, inline } = require('./markdown');
const { resolve: resolvePlaceholder } = require('./placeholder');
const { T, SELECT_TYPES, findFile, fmtSize, mimeOf } = require('./common');

const hex = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;

// attachment:// adresini dosya tamponundan data URI'ye çevirir; bulunamazsa null
function mediaSrc(url, ctx) {
  if (!url) return null;
  if (url.startsWith('attachment://')) {
    const f = findFile(ctx.files, url);
    return f ? `data:${mimeOf(f.name)};base64,${Buffer.from(f.buffer).toString('base64')}` : null;
  }
  return resolvePlaceholder(url);
}

const placeholderBox = (label) => `<div class="imgph"><span>Görsel</span><code>${esc(label)}</code></div>`;
const img = (url, ctx, cls = '', alt = '') => {
  const src = mediaSrc(url, ctx);
  if (!src) return placeholderBox(url);
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" data-label="${esc(url.length > 60 ? `${url.slice(0, 57)}...` : url)}" loading="lazy">`;
};

const md = (text, ctx) => `<div class="md">${renderMarkdown(text, ctx)}</div>`;

const ICON_LINK = '<svg class="ico" viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z"/></svg>';
const ICON_CHEVRON = '<svg class="ico chev" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>';
const ICON_CHECK = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>';
const ICON_FILE = '<svg class="ico" viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="M6 2h8l6 6v14H6V2zm7 1.5V9h5.5L13 3.5z"/></svg>';

// ── Bileşenler ───────────────────────────────────────────────────────────────

function button(c) {
  const style = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'link', 6: 'premium' }[c.style] ?? 'secondary';
  const emoji = c.emoji ? `<span class="bemoji">${c.emoji.id ? `:${esc(c.emoji.name)}:` : esc(c.emoji.name)}</span>` : '';
  const label = c.label ? `<span>${esc(c.label)}</span>` : '';
  const cls = `btn ${style}${c.disabled ? ' dis' : ''}`;
  if (c.style === 5) {
    return `<a class="${cls}" href="${esc(c.url ?? '#')}" target="_blank" rel="noopener" title="${esc(c.url ?? '(url yok)')}">${emoji}${label}${ICON_LINK}</a>`;
  }
  return `<button type="button" class="${cls}" title="${esc(`custom_id: ${c.custom_id ?? '(yok)'}`)}">${emoji}${label}</button>`;
}

const SELECT_INFO = {
  3: ['Seçim yap...', null],
  5: ['Kullanıcı seç...', 'Discord burada sunucudaki kullanıcıları listeler.'],
  6: ['Rol seç...', 'Discord burada sunucudaki rolleri listeler.'],
  7: ['Kullanıcı veya rol seç...', 'Discord burada kullanıcıları ve rolleri listeler.'],
  8: ['Kanal seç...', 'Discord burada sunucudaki kanalları listeler.'],
};

function select(c, ctx) {
  const [defaultPh, note] = SELECT_INFO[c.type] ?? SELECT_INFO[3];
  const options = c.options ?? [];
  const chosen = options.filter((o) => o.default).map((o) => o.label);
  const defaults = (c.default_values ?? []).map((d) => {
    const info = d.type === 'role' ? ctx.lookup?.role?.(d.id) : d.type === 'channel' ? ctx.lookup?.channel?.(d.id) : ctx.lookup?.user?.(d.id);
    const prefix = d.type === 'role' ? '@' : d.type === 'channel' ? '#' : '@';
    return `${prefix}${info?.name ?? d.id.slice(-4)}`;
  });
  const shown = chosen.length ? chosen : defaults;
  const head = shown.length ? `<span class="val">${esc(shown.join(', '))}</span>` : `<span class="ph">${esc(c.placeholder ?? defaultPh)}</span>`;
  const meta = `min ${c.min_values ?? 1} / en çok ${c.max_values ?? 1}`;
  const list = options.length
    ? options
        .map(
          (o) =>
            `<div class="opt${o.default ? ' on' : ''}"><div><div class="ol">${o.emoji ? `${esc(o.emoji.name ?? '')} ` : ''}${esc(o.label)}</div>${o.description ? `<div class="od">${esc(o.description)}</div>` : ''}</div>${o.default ? ICON_CHECK : ''}</div>`,
        )
        .join('')
    : `<div class="opt note">${esc(note ?? 'Seçenek yok.')}</div>`;
  return (
    `<details class="sel${c.disabled ? ' dis' : ''}" title="${esc(`custom_id: ${c.custom_id ?? '(yok)'} | ${meta}`)}">` +
    `<summary>${head}${ICON_CHEVRON}</summary><div class="opts">${list}<div class="optmeta">${esc(meta)} | ${options.length} seçenek</div></div></details>`
  );
}

function actionRow(c, ctx) {
  const items = (c.components ?? []).map((k) => (k.type === T.BUTTON ? button(k) : SELECT_TYPES.has(k.type) ? select(k, ctx) : unknown(k)));
  return `<div class="arow">${items.join('')}</div>`;
}

const unknown = (c) => `<div class="unk">Bilinmeyen bileşen (tip ${esc(c?.type)})</div>`;

function component(c, ctx) {
  switch (c?.type) {
    case T.TEXT_DISPLAY:
      return md(c.content ?? '', ctx);
    case T.SEPARATOR:
      return `<div class="sep ${c.divider === false ? 'nodiv' : ''} sp${c.spacing === 2 ? 2 : 1}"></div>`;
    case T.ACTION_ROW:
      return actionRow(c, ctx);
    case T.BUTTON:
      return `<div class="arow">${button(c)}</div>`;
    case T.SECTION: {
      const acc = c.accessory;
      const accHtml = acc?.type === T.THUMBNAIL ? img(acc.media?.url, ctx, 'thumb', acc.description ?? '') : acc?.type === T.BUTTON ? button(acc) : '';
      return `<div class="section"><div class="sbody">${(c.components ?? []).map((k) => component(k, ctx)).join('')}</div>${accHtml ? `<div class="sacc">${accHtml}</div>` : ''}</div>`;
    }
    case T.THUMBNAIL:
      return img(c.media?.url, ctx, 'thumb', c.description ?? '');
    case T.MEDIA_GALLERY: {
      const items = c.items ?? [];
      return `<div class="gallery n${Math.min(items.length, 10)}">${items.map((it) => `<div class="gi">${img(it.media?.url, ctx, 'gimg', it.description ?? '')}</div>`).join('')}</div>`;
    }
    case T.FILE: {
      const url = c.file?.url ?? '';
      const f = findFile(ctx.files, url);
      const name = url.startsWith('attachment://') ? decodeURIComponent(url.slice(13)) : url.split('/').pop();
      return `<div class="filebox">${ICON_FILE}<div><div class="fname">${esc(name)}</div><div class="fsize">${f ? fmtSize(Buffer.from(f.buffer).length) : 'dosya eksik'}</div></div></div>`;
    }
    case T.CONTAINER:
      return container(c, ctx);
    default:
      return unknown(c);
  }
}

function container(c, ctx) {
  const accent = c.accent_color != null ? hex(c.accent_color) : null;
  const style = accent ? ` style="--accent:${accent}"` : '';
  return `<div class="container${accent ? ' accented' : ''}"${style}>${(c.components ?? []).map((k) => component(k, ctx)).join('')}</div>`;
}

// Mesaj gövdesi: düz içerik, bileşenler, (yasak) embed uyarısı
function renderMessage(norm, ctx = {}) {
  const c = { ...ctx, files: norm.files ?? ctx.files ?? [] };
  const parts = [];
  if (norm.content) parts.push(`<div class="mtext">${renderMarkdown(norm.content, c)}</div>`);
  for (const embed of norm.embeds ?? []) {
    parts.push(`<div class="embedwarn"><b>Embed var (yasak)</b><div>${esc(embed.title ?? '')} ${esc(embed.description ?? '')}</div></div>`);
  }
  const body = (norm.components ?? []).map((k) => component(k, c));
  parts.push(`<div class="stack">${body.join('')}</div>`);
  return parts.join('');
}

// ── Modal ────────────────────────────────────────────────────────────────────

function textInput(c) {
  const para = c.style === 2;
  const meta = [c.min_length ? `en az ${c.min_length}` : null, c.max_length ? `en çok ${c.max_length}` : null].filter(Boolean).join(' · ');
  const body = c.value ? `<span class="val">${esc(c.value)}</span>` : `<span class="ph">${esc(c.placeholder ?? '')}</span>`;
  return `<div class="tin ${para ? 'para' : 'short'}" title="${esc(`custom_id: ${c.custom_id ?? '(yok)'}`)}">${body}</div>${meta ? `<div class="tmeta">${esc(meta)} karakter</div>` : ''}`;
}

function modalChild(c, ctx) {
  if (c.type === T.LABEL) {
    const inner = c.component;
    const required = inner && inner.required !== false && inner.type !== 10;
    const control = !inner ? '' : inner.type === T.TEXT_INPUT ? textInput(inner) : SELECT_TYPES.has(inner.type) ? select(inner, ctx) : `<div class="unk">Bileşen (tip ${esc(inner.type)})</div>`;
    return `<div class="mlabel"><div class="mlt">${esc(c.label ?? '')}${required ? '<span class="req">*</span>' : ''}</div>${c.description ? `<div class="mdesc">${esc(c.description)}</div>` : ''}${control}</div>`;
  }
  if (c.type === T.TEXT_DISPLAY) return md(c.content ?? '', ctx);
  if (c.type === T.ACTION_ROW) {
    return (c.components ?? []).map((k) => `<div class="mlabel"><div class="mlt">${esc(k.label ?? '')}${k.required !== false ? '<span class="req">*</span>' : ''}</div>${k.type === T.TEXT_INPUT ? textInput(k) : unknown(k)}</div>`).join('');
  }
  return unknown(c);
}

function renderModal(norm, ctx = {}) {
  const m = norm.modal;
  return (
    `<div class="modal" title="${esc(`custom_id: ${m.custom_id ?? '(yok)'}`)}"><div class="mh"><span>${esc(m.title ?? '')}</span><span class="x">x</span></div>` +
    `<div class="mb">${(m.components ?? []).map((k) => modalChild(k, ctx)).join('')}</div>` +
    `<div class="mf"><span class="btn secondary">İptal</span><span class="btn primary">Gönder</span></div></div>`
  );
}

// ── Stil ─────────────────────────────────────────────────────────────────────
const css = `
:root{--bg:#1e1f22;--panel:#2b2d31;--panel2:#313338;--line:#3f4147;--text:#dbdee1;--muted:#949ba4;--link:#00a8fc;--primary:#5865f2;--success:#248046;--danger:#da373c;--secondary:#4e5058;--warn:#f0b132;--msgw:520px}
body.w-mobile{--msgw:360px}
*{box-sizing:border-box}
html,body{margin:0;background:var(--panel2);color:var(--text);font:15px/1.375 "gg sans","Segoe UI",system-ui,sans-serif}
a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}
code{font-family:Consolas,"Courier New",monospace}
#app{display:flex;min-height:100vh}
#nav{width:290px;flex:none;position:sticky;top:0;height:100vh;overflow:auto;background:var(--bg);border-right:1px solid #111214;padding:14px 12px}
#nav h1{font-size:15px;margin:0 0 10px;color:#fff}
#nav input[type=search]{width:100%;padding:7px 9px;border-radius:6px;border:1px solid var(--line);background:#111214;color:var(--text);margin-bottom:10px}
#nav details{margin-bottom:6px}
#nav summary{cursor:pointer;font-weight:600;padding:5px 6px;border-radius:6px;display:flex;gap:6px;align-items:center}
#nav summary:hover{background:#2b2d31}
#nav .navitem{display:flex;gap:6px;align-items:center;padding:3px 8px 3px 16px;color:var(--text);font-size:13px;border-radius:5px;justify-content:space-between}
#nav .navitem:hover{background:#2b2d31;text-decoration:none}
#nav .navitem span.t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#main{flex:1;min-width:0;padding:0 24px 80px}
.top{position:sticky;top:0;z-index:5;background:var(--panel2);padding:14px 0 10px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.top h2{margin:0;font-size:18px;color:#fff;flex:1;min-width:200px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.seg button{background:#2b2d31;color:var(--text);border:0;padding:6px 12px;cursor:pointer;font:inherit}
.seg button.on{background:var(--primary);color:#fff}
.sum{font-size:13px;color:var(--muted)}
.sysh{margin:34px 0 4px;font-size:22px;color:#fff;border-bottom:1px solid var(--line);padding-bottom:6px}
.card{margin:22px 0;background:var(--bg);border:1px solid #111214;border-radius:10px;padding:14px 16px}
.card.bad{border-color:#7a2a2d}
.card.hidden{display:none}
.ch{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin-bottom:4px}
.ch h3{margin:0;font-size:16px;color:#fff}
.ch .id{font-size:12px;color:var(--muted)}
.where{font-size:13px;color:var(--muted);margin-bottom:8px}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:9px;background:#3f4147;color:var(--text)}
.badge.err{background:#7a2a2d;color:#ffd0d1}.badge.warn{background:#6b5410;color:#ffe9a6}.badge.ok{background:#1d5a37;color:#c5f3d8}
.badge.vis{background:#2f3a66;color:#cfd6ff}
.lint{margin:6px 0 10px;font-size:13px}
.lint summary{cursor:pointer}
.lint ul{margin:6px 0 0;padding-left:18px}
.lint li.err{color:#ff9fa1}.lint li.warn{color:#f5d77a}
.lint code{color:var(--muted)}
.msgwrap{display:flex;gap:12px;background:var(--panel2);border-radius:8px;padding:12px 10px}
.msgwrap .av{width:40px;height:40px;border-radius:50%;flex:none}
.mbody{min-width:0;flex:1}
.mhead{display:flex;gap:6px;align-items:center;margin-bottom:2px}
.uname{font-weight:600;color:#fff}
.tag{background:var(--primary);color:#fff;font-size:10px;font-weight:700;border-radius:3px;padding:1px 4px}
.mtime{font-size:12px;color:var(--muted)}
.mtext{margin-bottom:6px;max-width:var(--msgw)}
.stack{display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:var(--msgw)}
.ephnote{font-size:12px;color:var(--muted);margin-top:6px}
.container{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px 14px 16px;display:flex;flex-direction:column;gap:6px;position:relative;overflow:hidden;max-width:100%}
.container.accented{border-left:4px solid var(--accent);padding-left:14px}
.md{min-width:0;word-break:break-word}
.md .ln,.md .li{min-height:1.375em}
.md .blank{height:.7em}
.md .h{font-weight:700;line-height:1.2;margin:2px 0}
.md .h1{font-size:1.6em}.md .h2{font-size:1.3em}.md .h3{font-size:1.1em}
.md .sub{font-size:.8em;color:var(--muted);line-height:1.4}
.md .quote{display:flex;margin:2px 0}
.md .qbar{width:4px;border-radius:4px;background:#4e5058;margin-right:10px;flex:none}
.md .li{display:flex;gap:8px}.md .bul{color:var(--muted)}
.md .cb{background:#1e1f22;border:1px solid var(--line);border-radius:4px;padding:8px;overflow:auto;margin:4px 0}
code.ic{background:#1e1f22;border-radius:3px;padding:0 4px;font-size:.88em}
.pill{border-radius:3px;padding:0 3px;font-weight:500;white-space:nowrap}
.pill.mention{background:rgba(88,101,242,.3);color:#c9cdfb}
.pill.ts{background:#3f4147;color:var(--text)}
.emj{color:var(--muted);font-size:.9em}
.spoiler{background:#1e1f22;color:transparent;border-radius:3px;cursor:pointer;padding:0 2px}
.spoiler.on{background:#3f4147;color:var(--text)}
.sep{height:1px;background:var(--line);margin:4px 0}.sep.sp2{margin:10px 0}.sep.nodiv{background:none;height:8px}.sep.nodiv.sp2{height:16px}
.section{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}
.sbody{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.sacc{flex:none}
.thumb{width:80px;height:80px;border-radius:8px;object-fit:cover;display:block}
.gallery{display:grid;gap:4px;grid-template-columns:1fr;border-radius:8px;overflow:hidden}
.gallery:not(.n1){grid-template-columns:1fr 1fr}
.gallery.n3 .gi:first-child,.gallery.n5 .gi:first-child{grid-column:span 2}
.gimg{width:100%;display:block;border-radius:4px}
.imgph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:80px;aspect-ratio:16/6;background:#1e1f22;border:1px dashed #5c5f66;border-radius:6px;color:var(--muted);font-size:12px;padding:6px;text-align:center;word-break:break-all}
.thumb.imgph{width:80px;height:80px;aspect-ratio:auto;min-height:0}
.filebox{display:flex;gap:10px;align-items:center;background:#1e1f22;border:1px solid var(--line);border-radius:6px;padding:10px 12px;color:var(--link)}
.fname{color:var(--link);font-weight:500}.fsize{color:var(--muted);font-size:12px}
.arow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:3px;padding:2px 16px;min-height:32px;font-weight:500;font-size:14px;line-height:1.2;font-family:inherit;color:#fff;cursor:pointer;text-decoration:none}
.btn:hover{text-decoration:none;filter:brightness(1.08)}
.btn.primary,.btn.premium{background:var(--primary)}.btn.secondary,.btn.link{background:var(--secondary)}.btn.success{background:var(--success)}.btn.danger{background:var(--danger)}
.btn.dis{opacity:.5;cursor:not-allowed}
.btn .ico{opacity:.9}
.sel{width:100%;min-width:min(300px,100%);max-width:100%;position:relative;font-size:14px}
.sel summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#1e1f22;border:1px solid #111214;border-radius:4px;padding:8px 10px;min-height:40px}
.sel summary::-webkit-details-marker{display:none}
.sel .ph{color:var(--muted)}.sel .val{color:var(--text)}
.sel[open] .chev{transform:rotate(180deg)}
.sel .opts{background:#1e1f22;border:1px solid #111214;border-radius:4px;margin-top:4px;max-height:260px;overflow:auto;padding:4px}
.opt{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:3px}
.opt:hover{background:#2b2d31}.opt.on{background:#35373c}.opt.note{color:var(--muted);font-style:italic}
.opt .od{font-size:12px;color:var(--muted)}
.optmeta{font-size:11px;color:var(--muted);padding:4px 8px;border-top:1px solid var(--line);margin-top:4px}
.sel.dis{opacity:.5;pointer-events:none}
.unk{background:#3a1f20;color:#ffb3b5;padding:6px 8px;border-radius:4px;font-size:12px}
.embedwarn{border-left:4px solid var(--danger);background:#3a1f20;padding:8px 10px;border-radius:4px;max-width:var(--msgw);margin-bottom:6px}
.modal{width:100%;max-width:440px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.mh{display:flex;justify-content:space-between;padding:16px;font-size:20px;font-weight:700;color:#fff}.mh .x{color:var(--muted);font-weight:400}
.mb{padding:0 16px 16px;display:flex;flex-direction:column;gap:14px}
.mlt{font-size:12px;font-weight:700;color:#b5bac1;text-transform:none;margin-bottom:4px}
.req{color:#f23f42;margin-left:3px}
.mdesc{font-size:12px;color:var(--muted);margin-bottom:6px}
.tin{background:#1e1f22;border:1px solid #111214;border-radius:4px;padding:10px;color:var(--muted)}
.tin.para{min-height:96px}.tin .val{color:var(--text)}
.tmeta{font-size:11px;color:var(--muted);margin-top:3px;text-align:right}
.mf{display:flex;justify-content:flex-end;gap:8px;padding:14px 16px;background:#2b2d31;border-radius:0 0 8px 8px}
.crash{background:#3a1f20;border:1px solid #7a2a2d;border-radius:8px;padding:12px;color:#ffb3b5}
.crash pre{margin:6px 0 0;white-space:pre-wrap;font-size:12px;color:#ffd0d1}
.dump summary{cursor:pointer;color:var(--muted);font-size:13px;margin-top:8px}
.dump pre{background:#111214;border-radius:6px;padding:10px;overflow:auto;font-size:12px;line-height:1.45;color:#c9ccd1;margin:6px 0 0}
`;

module.exports = { renderMessage, renderModal, css, inline };
