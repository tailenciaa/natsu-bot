// Discord markdown -> HTML (Türkçe zaman biçimleriyle).
// ctx: { lookup: { user(id), role(id), channel(id) }, now: ms }
const { TIMEZONE } = require('./config');

const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Zaman damgaları ──────────────────────────────────────────────────────────
const fmt = (opts) => new Intl.DateTimeFormat('tr-TR', { timeZone: TIMEZONE, hour12: false, ...opts });
const F_DATE_LONG = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const F_WEEKDAY = fmt({ weekday: 'long' });
const F_DATE_SHORT = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const F_TIME = fmt({ hour: '2-digit', minute: '2-digit' });
const F_TIME_SEC = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit' });

function relative(ms, now) {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const suffix = diff <= 0 ? 'önce' : 'sonra';
  const units = [
    [365 * 86400000, 'yıl'],
    [30 * 86400000, 'ay'],
    [86400000, 'gün'],
    [3600000, 'saat'],
    [60000, 'dakika'],
  ];
  if (abs < 45000) return `birkaç saniye ${suffix}`;
  for (const [size, name] of units) {
    if (abs >= size) return `${Math.round(abs / size)} ${name} ${suffix}`;
  }
  return `1 dakika ${suffix}`;
}

function formatTimestamp(unix, style = 'f', now = Date.now()) {
  const date = new Date(Number(unix) * 1000);
  if (Number.isNaN(date.getTime())) return '(geçersiz zaman)';
  switch (style) {
    case 't':
      return F_TIME.format(date);
    case 'T':
      return F_TIME_SEC.format(date);
    case 'd':
      return F_DATE_SHORT.format(date);
    case 'D':
      return F_DATE_LONG.format(date);
    case 'F':
      return `${F_DATE_LONG.format(date)} ${F_WEEKDAY.format(date)} ${F_TIME.format(date)}`;
    case 'R':
      return relative(date.getTime(), now);
    default:
      return `${F_DATE_LONG.format(date)} ${F_TIME.format(date)}`;
  }
}

// ── Yer tutucu deposu: kod, etiket gibi parçalar emphasis işlemlerinden korunur ──
function stash() {
  const items = [];
  return {
    put(html) {
      items.push(html);
      return `${items.length - 1}`;
    },
    restore(text) {
      let out = text;
      for (let i = 0; i < 8 && /\d+/.test(out); i++) out = out.replace(/(\d+)/g, (_, n) => items[Number(n)]);
      return out;
    },
  };
}

const last4 = (id) => String(id).slice(-4);
const hex = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;

function inline(source, ctx = {}) {
  const st = stash();
  const lookup = ctx.lookup ?? {};
  const now = ctx.now ?? Date.now();
  let s = String(source ?? '').replace(/[-]/g, '');

  // Satır içi kod
  s = s.replace(/(?<!`)(`{1,2})(?!`)([\s\S]+?)(?<!`)\1(?!`)/g, (m, ticks, code) => st.put(`<code class="ic">${esc(code)}</code>`));
  // Ters eğik çizgiyle kaçırılan karakterler
  s = s.replace(/\\([\\`*_~|>#<@\-[\]()!.:])/g, (m, c) => st.put(esc(c)));

  // Etiketler ve özel biçimler
  s = s.replace(/<@&(\d+)>/g, (m, id) => {
    const role = lookup.role?.(id);
    const color = role?.color ? hex(role.color) : '';
    const style = color ? ` style="color:${color};background:${color}2b"` : '';
    return st.put(`<span class="pill mention role"${style} title="rol ${id}">@${esc(role?.name ?? `Rol ${last4(id)}`)}</span>`);
  });
  s = s.replace(/<@!?(\d+)>/g, (m, id) => {
    const user = lookup.user?.(id);
    return st.put(`<span class="pill mention" title="kullanıcı ${id}">@${esc(user?.name ?? `Üye ${last4(id)}`)}</span>`);
  });
  s = s.replace(/<#(\d+)>/g, (m, id) => {
    const channel = lookup.channel?.(id);
    return st.put(`<span class="pill mention" title="kanal ${id}">#${esc(channel?.name ?? `kanal-${last4(id)}`)}</span>`);
  });
  s = s.replace(/<t:(-?\d+)(?::([tTdDfFR]))?>/g, (m, unix, style) =>
    st.put(`<span class="pill ts" title="${esc(m)}">${esc(formatTimestamp(unix, style ?? 'f', now))}</span>`),
  );
  s = s.replace(/<\/([^:<>\n]+):(\d+)>/g, (m, name) => st.put(`<span class="pill mention cmd">/${esc(name)}</span>`));
  s = s.replace(/<(a?):(\w+):(\d+)>/g, (m, anim, name) => st.put(`<span class="emj" title="özel emoji">:${esc(name)}:</span>`));
  s = s.replace(/@(everyone|here)\b/g, (m, w) => st.put(`<span class="pill mention">@${w}</span>`));

  // Bağlantılar
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => st.put(`<a href="${esc(url)}" target="_blank" rel="noopener">${inline(label, ctx)}</a>`));
  s = s.replace(/<(https?:\/\/[^\s>]+)>/g, (m, url) => st.put(`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`));
  s = s.replace(/https?:\/\/[^\s<>]+/g, (url) => {
    const trail = /[.,;:!?)]+$/.exec(url)?.[0] ?? '';
    const clean = trail ? url.slice(0, -trail.length) : url;
    return st.put(`<a href="${esc(clean)}" target="_blank" rel="noopener">${esc(clean)}</a>`) + trail;
  });

  s = esc(s);

  // Spoiler ve vurgular
  s = s.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler">$1</span>');
  s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, '<b><i>$1</i></b>');
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__([\s\S]+?)__/g, '<u>$1</u>');
  s = s.replace(/(?<![*\w])\*(?![\s*])([^\n]+?)(?<![\s*])\*(?![*\w])/g, '<i>$1</i>');
  s = s.replace(/(?<![\w_])_(?![\s_])([^\n]+?)(?<![\s_])_(?![\w_])/g, '<i>$1</i>');
  s = s.replace(/~~([\s\S]+?)~~/g, '<s>$1</s>');

  return st.restore(s);
}

// ── Blok düzeyi ──────────────────────────────────────────────────────────────
function lines(text, ctx) {
  const rows = text.split('\n');
  const out = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    let m;
    if ((m = /^>>> ?([\s\S]*)$/.exec(row))) {
      const body = [m[1], ...rows.slice(i + 1)].map((r) => inline(r, ctx)).join('<br>');
      out.push(`<div class="quote"><div class="qbar"></div><div class="qbody">${body}</div></div>`);
      break;
    }
    if (/^>( |$)/.test(row)) {
      const group = [];
      while (i < rows.length && /^>( |$)/.test(rows[i])) group.push(rows[i++].replace(/^> ?/, ''));
      out.push(`<div class="quote"><div class="qbar"></div><div class="qbody">${group.map((r) => inline(r, ctx)).join('<br>')}</div></div>`);
      continue;
    }
    if ((m = /^-# (.*)$/.exec(row))) out.push(`<div class="sub">${inline(m[1], ctx)}</div>`);
    else if ((m = /^(#{1,3}) (.*)$/.exec(row))) out.push(`<div class="h h${m[1].length}">${inline(m[2], ctx)}</div>`);
    else if ((m = /^(\s*)([-*]) (.*)$/.exec(row))) {
      const level = Math.min(3, Math.floor(m[1].length / 2));
      out.push(`<div class="li" style="margin-left:${level * 18}px"><span class="bul">${level ? '◦' : '•'}</span><span>${inline(m[3], ctx)}</span></div>`);
    } else if ((m = /^(\s*)(\d+)\. (.*)$/.exec(row))) {
      const level = Math.min(3, Math.floor(m[1].length / 2));
      out.push(`<div class="li" style="margin-left:${level * 18}px"><span class="bul">${m[2]}.</span><span>${inline(m[3], ctx)}</span></div>`);
    } else if (row.trim() === '') out.push('<div class="blank"></div>');
    else out.push(`<div class="ln">${inline(row, ctx)}</div>`);
    i++;
  }
  return out.join('');
}

// Tam metin: kod blokları ayrılır, kalan satır satır işlenir
function renderMarkdown(source, ctx = {}) {
  const text = String(source ?? '').replace(/\r\n/g, '\n');
  const parts = [];
  let last = 0;
  const re = /```(?:([\w+-]*)\n)?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(lines(text.slice(last, m.index).replace(/^\n|\n$/g, ''), ctx));
    parts.push(`<pre class="cb"><code>${esc(m[2].replace(/\n$/, ''))}</code></pre>`);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(lines(text.slice(last).replace(/^\n/, ''), ctx));
  return parts.join('');
}

module.exports = { esc, inline, renderMarkdown, formatTimestamp };
