// Mesaj yükünü terminalden okunabilir sade metin dökümüne çevirir.
const { T, BUTTON_STYLES, SELECT_TYPES, count, walk, rootsOf, findFile, fmtSize } = require('./common');

const SELECT_NAMES = { 3: 'Menü', 5: 'Kullanıcı Menüsü', 6: 'Rol Menüsü', 7: 'Üye/Rol Menüsü', 8: 'Kanal Menüsü' };
const hex = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;
const q = (value) => `"${String(value ?? '').replace(/\n/g, '\\n')}"`;

function buttonLine(c) {
  const style = BUTTON_STYLES[c.style] ?? `Stil${c.style}`;
  const extra = [
    c.style === 5 ? `url=${c.url ?? '(yok)'}` : `id=${c.custom_id ?? '(yok)'}`,
    c.emoji ? `emoji=${c.emoji.name ?? c.emoji.id}` : null,
    c.disabled ? 'devre-dışı' : null,
  ].filter(Boolean);
  return `[Buton ${style} ${q(c.label)} ${extra.join(' ')}]`;
}

function selectLines(c, pad) {
  const options = c.options ?? [];
  const head = [`[${SELECT_NAMES[c.type] ?? 'Menü'}`, c.placeholder ? q(c.placeholder) : null, c.type === 3 ? `${options.length} seçenek` : null, `id=${c.custom_id ?? '(yok)'}`, c.min_values != null || c.max_values != null ? `seçim=${c.min_values ?? 1}-${c.max_values ?? 1}` : null, c.disabled ? 'devre-dışı' : null]
    .filter(Boolean)
    .join(' ');
  const out = [`${pad}${head}]`];
  for (const o of options) {
    out.push(`${pad}  - ${o.label}${o.description ? ` | ${o.description}` : ''} (${o.value})${o.default ? ' [varsayılan]' : ''}${o.emoji ? ` emoji=${o.emoji.name}` : ''}`);
  }
  return out;
}

function componentLines(c, pad, ctx) {
  const out = [];
  const push = (line) => out.push(`${pad}${line}`);
  const indent = `${pad}  `;
  switch (c?.type) {
    case T.CONTAINER:
      push(`[Container${c.accent_color != null ? ` accent=${hex(c.accent_color)}` : ''}${c.spoiler ? ' spoiler' : ''}]`);
      for (const k of c.components ?? []) out.push(...componentLines(k, indent, ctx));
      break;
    case T.SECTION:
      push('[Bölüm]');
      for (const k of c.components ?? []) out.push(...componentLines(k, indent, ctx));
      if (c.accessory?.type === T.BUTTON) push(`  [Aksesuar] ${buttonLine(c.accessory)}`);
      else if (c.accessory?.type === T.THUMBNAIL) push(`  [Aksesuar Küçük Görsel ${c.accessory.media?.url ?? ''}]`);
      else if (c.accessory) push(`  [Aksesuar tip=${c.accessory.type}]`);
      else push('  [Aksesuar YOK]');
      break;
    case T.TEXT_DISPLAY:
      for (const line of String(c.content ?? '').split('\n')) push(line);
      break;
    case T.SEPARATOR: {
      const wide = c.spacing === 2;
      push(c.divider === false ? `(boşluk${wide ? ' geniş' : ''})` : `----${wide ? ' (geniş)' : ''}`);
      break;
    }
    case T.MEDIA_GALLERY:
      for (const it of c.items ?? []) push(`[Görsel ${it.media?.url ?? ''}${it.description ? ` ${q(it.description)}` : ''}]`);
      break;
    case T.FILE: {
      const f = findFile(ctx.files, c.file?.url);
      push(`[Dosya ${c.file?.url ?? ''}${f ? ` ${fmtSize(Buffer.from(f.buffer).length)}` : ''}]`);
      break;
    }
    case T.ACTION_ROW:
      push('[Satır]');
      for (const k of c.components ?? []) out.push(...componentLines(k, indent, ctx));
      break;
    case T.BUTTON:
      push(buttonLine(c));
      break;
    case T.THUMBNAIL:
      push(`[Küçük Görsel ${c.media?.url ?? ''}]`);
      break;
    case T.LABEL:
      push(`[Alan ${q(c.label)}${c.description ? ` açıklama=${q(c.description)}` : ''}]`);
      if (c.component) out.push(...componentLines(c.component, indent, ctx));
      break;
    case T.TEXT_INPUT:
      push(
        `[Giriş ${c.style === 2 ? 'paragraf' : 'kısa'} id=${c.custom_id ?? '(yok)'}${c.required === false ? ' isteğe-bağlı' : ' zorunlu'}${c.min_length ? ` min=${c.min_length}` : ''}${c.max_length ? ` max=${c.max_length}` : ''}${c.placeholder ? ` placeholder=${q(c.placeholder)}` : ''}${c.value ? ` değer=${q(c.value)}` : ''}]`,
      );
      break;
    default:
      if (SELECT_TYPES.has(c?.type)) out.push(...selectLines(c, pad));
      else push(`[Bilinmeyen bileşen tip=${c?.type}]`);
  }
  return out;
}

// İstatistikler: bileşen, karakter, ayırıcı, etkileşimli sayısı
function stats(norm) {
  const roots = rootsOf(norm);
  let chars = 0;
  let dividers = 0;
  let spaces = 0;
  let buttons = 0;
  let selects = 0;
  walk(roots, (c) => {
    if (c.type === T.TEXT_DISPLAY) chars += String(c.content ?? '').length;
    else if (c.type === T.SEPARATOR) c.divider === false ? spaces++ : dividers++;
    else if (c.type === T.BUTTON) buttons++;
    else if (SELECT_TYPES.has(c.type)) selects++;
  });
  return { components: count(roots), chars, dividers, spaces, buttons, selects };
}

function toText(norm) {
  const out = [];
  const ctx = { files: norm.files ?? [] };
  if (norm.kind === 'modal') {
    const m = norm.modal;
    out.push(`[Modal ${q(m.title)} id=${m.custom_id ?? '(yok)'}]`);
    for (const c of m.components ?? []) out.push(...componentLines(c, '  ', ctx));
  } else {
    if (norm.content) out.push(`[İçerik] ${norm.content.replace(/\n/g, '\n  ')}`);
    for (const e of norm.embeds ?? []) out.push(`[EMBED (yasak) ${q(e.title ?? e.description ?? '')}]`);
    for (const c of norm.components ?? []) out.push(...componentLines(c, '', ctx));
    for (const f of norm.files ?? []) out.push(`[Ek dosya ${f.name} ${fmtSize(Buffer.from(f.buffer).length)}]`);
  }
  const s = stats(norm);
  out.push(`-- bileşen: ${s.components}/40 | metin: ${s.chars}/4000 karakter | ayırıcı: ${s.dividers}${s.spaces ? ` (+${s.spaces} boşluk)` : ''} | buton: ${s.buttons} | menü: ${s.selects}`);
  return out.join('\n');
}

module.exports = { toText, stats };
