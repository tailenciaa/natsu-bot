// Mesaj / modal yükleri için lint kuralları. Sonuç: { errors: [{ rule, path, msg }], warnings: [...] }
const { T, SELECT_TYPES, walk, count, rootsOf, findFile, FLAG } = require('./common');
const config = require('./config');

const CONTAINER_CHILDREN = new Set([T.ACTION_ROW, T.SECTION, T.TEXT_DISPLAY, T.MEDIA_GALLERY, T.FILE, T.SEPARATOR]);
const MESSAGE_ROOTS = new Set([...CONTAINER_CHILDREN, T.CONTAINER]);
const LABEL_CHILDREN = new Set([T.STRING_SELECT, T.TEXT_INPUT, T.USER_SELECT, T.ROLE_SELECT, T.MENTIONABLE_SELECT, T.CHANNEL_SELECT, T.FILE_UPLOAD, 21, 22, 23]);

// Emoji / süs simgesi: Unicode pictograph, FE0F, bölge göstergeleri, ten rengi değiştiriciler, tuş kapakları.
// ⭐ ve ALLOW_EMOJI listesi serbest. (Ok işareti olarak sadece emojiye dönüşenler yakalanır; "→" serbest.)
const PICTO = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u{FE0F}|\u{20E3}|[\u{1F3FB}-\u{1F3FF}]/gu;
const NEUTRAL = new Set(['©', '®', '™', '⭐']);

function emojisIn(value) {
  const found = [];
  for (const m of String(value ?? '').matchAll(PICTO)) {
    const ch = m[0];
    if (NEUTRAL.has(ch) || config.ALLOW_EMOJI.includes(ch)) continue;
    if (!found.includes(ch)) found.push(ch);
  }
  return found;
}
const codepoints = (list) => list.map((ch) => `${ch.trim() ? ch : ''} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`.trim()).join(', ');

// Kod parçaları, etiketler ve bağlantılar kural kontrollerinden çıkarılır
const stripCode = (s) => String(s).replace(/```[\s\S]*?```/g, '§').replace(/`[^`\n]+`/g, '§');
const stripTokens = (s) => stripCode(s).replace(/<[@#t/a:][^>\n]*>/g, '§').replace(/https?:\/\/\S+/g, '§');

const lower = (s) => s.toLocaleLowerCase('tr');
const wordRe = (word) => new RegExp(`(?<![\\p{L}\\p{N}])${word}(?![\\p{L}\\p{N}])`, 'u');

function lint(norm) {
  const errors = [];
  const warnings = [];
  const err = (rule, path, msg) => errors.push({ rule, path, msg });
  const warn = (rule, path, msg) => warnings.push({ rule, path, msg });

  const isModal = norm.kind === 'modal';
  const roots = rootsOf(norm);
  const files = norm.files ?? [];
  const strings = []; // { kind, path, value }
  const add = (kind, path, value) => {
    if (typeof value === 'string' && value.length) strings.push({ kind, path, value });
  };
  const ids = new Map(); // custom_id -> ilk yol
  const noteId = (id, path) => {
    if (typeof id !== 'string' || !id) return;
    if (id.length > 100) err('custom-id-100', path, `custom_id ${id.length} karakter (en çok 100): ${id.slice(0, 40)}...`);
    if (ids.has(id)) err('custom-id-tekrar', path, `custom_id "${id}" bu mesajda ${ids.get(id)} ile tekrar ediyor`);
    else ids.set(id, path);
  };
  const needFile = (url, path) => {
    if (typeof url === 'string' && url.startsWith('attachment://') && !findFile(files, url)) {
      err('ek-dosya-eksik', path, `${url} için payload.files içinde dosya yok`);
    }
  };

  // ── Mesaj düzeyi ───────────────────────────────────────────────────────────
  if (!isModal) {
    if ((norm.embeds ?? []).length) err('embed', 'embeds', `Embed kullanılamaz (${norm.embeds.length} adet)`);
    const v2 = Boolean((norm.flags ?? 0) & FLAG.CV2);
    if (v2 && norm.content) err('v2-content', 'content', 'IsComponentsV2 bayrağı varken content gönderilemez');
    if (!v2 && roots.some((c) => ![T.ACTION_ROW].includes(c.type))) err('v2-bayrak-yok', 'flags', 'Container/Section/TextDisplay için IsComponentsV2 bayrağı gerekir');
    add('content', 'content', norm.content);
    roots.forEach((c, i) => {
      if (!MESSAGE_ROOTS.has(c?.type)) err('gecersiz-yapi', `components[${i}]`, `Üst düzeyde ${c?.type} tipi bileşen olamaz`);
    });
  } else {
    const m = norm.modal;
    if (!m.title) err('modal-baslik-yok', 'title', 'Modal başlığı yok');
    if ((m.title ?? '').length > 45) err('modal-baslik-45', 'title', `Modal başlığı ${m.title.length} karakter (en çok 45)`);
    add('title', 'title', m.title);
    noteId(m.custom_id, 'custom_id');
    if (!m.custom_id) err('custom-id-yok', 'custom_id', 'Modal custom_id yok');
    if (!roots.length) err('gecersiz-yapi', 'components', 'Modalda bileşen yok');
    if (roots.length > 5) err('modal-bilesen-sayisi', 'components', `Modalda ${roots.length} üst düzey bileşen var (en çok 5)`);
  }

  // ── Bileşen gezintisi ──────────────────────────────────────────────────────
  walk(roots, (c, path, parent) => {
    switch (c.type) {
      case T.CONTAINER:
        if (parent) err('gecersiz-yapi', path, 'Container başka bir bileşenin içine konamaz');
        (c.components ?? []).forEach((k, i) => {
          if (!CONTAINER_CHILDREN.has(k?.type)) err('gecersiz-yapi', `${path}.components[${i}]`, `Container içinde ${k?.type} tipi bileşen olamaz`);
        });
        if (!(c.components ?? []).length) err('gecersiz-yapi', path, 'Boş Container');
        break;

      case T.SECTION: {
        const kids = c.components ?? [];
        if (kids.length < 1 || kids.length > 3) err('section-yapi', path, `Section ${kids.length} metin içeriyor (1-3 olmalı)`);
        kids.forEach((k, i) => {
          if (k?.type === T.ACTION_ROW) err('section-icinde-satir', `${path}.components[${i}]`, 'ActionRow Section içine konamaz');
          else if (k?.type !== T.TEXT_DISPLAY) err('section-yapi', `${path}.components[${i}]`, 'Section içinde sadece TextDisplay olabilir');
        });
        if (!c.accessory) err('section-yapi', path, 'Section için accessory (buton ya da thumbnail) şart');
        else if (c.accessory.type === T.ACTION_ROW) err('section-icinde-satir', `${path}.accessory`, 'ActionRow Section aksesuarı olamaz');
        else if (![T.BUTTON, T.THUMBNAIL].includes(c.accessory.type)) err('section-yapi', `${path}.accessory`, `Section aksesuarı buton ya da thumbnail olmalı (tip ${c.accessory.type})`);
        break;
      }

      case T.ACTION_ROW: {
        if (parent?.type === T.SECTION) break; // yukarıda raporlandı
        const kids = c.components ?? [];
        const buttons = kids.filter((k) => k.type === T.BUTTON);
        const selects = kids.filter((k) => SELECT_TYPES.has(k.type));
        const inputs = kids.filter((k) => k.type === T.TEXT_INPUT);
        if (!kids.length) err('satir-bos', path, 'Boş ActionRow');
        if (buttons.length > 5) err('satir-buton-sayisi', path, `Satırda ${buttons.length} buton var (en çok 5)`);
        if (buttons.length && selects.length) err('satir-karisik', path, 'Buton ve menü aynı satırda olamaz');
        if (selects.length > 1) err('satir-menu-sayisi', path, `Satırda ${selects.length} menü var (menü tek başına olmalı)`);
        if (inputs.length && !isModal) err('gecersiz-yapi', path, 'TextInput mesajda kullanılamaz');
        if (inputs.length > 1) err('satir-giris-sayisi', path, 'Satırda en fazla 1 TextInput olabilir');
        break;
      }

      case T.BUTTON: {
        const label = c.label ?? '';
        if (label.length > 80) err('buton-etiket-80', path, `Buton etiketi ${label.length} karakter (en çok 80): "${label.slice(0, 30)}..."`);
        else if (label.length > 20) warn('buton-etiket-20', path, `Buton etiketi ${label.length} karakter (hedef en çok 20): "${label}"`);
        if (!label && !c.emoji) err('buton-bos', path, 'Butonun etiketi ya da emojisi yok');
        add('button', `${path}.label`, label);
        if (c.emoji) {
          const e = c.emoji.name ?? '';
          if (c.emoji.id || e) err('emoji', `${path}.emoji`, `Butonda emoji var: ${e || c.emoji.id}`);
        }
        if (c.style === 5) {
          if (c.custom_id) err('link-custom-id', path, `Link butonunda custom_id olamaz ("${c.custom_id}")`);
          if (!c.url) err('link-url-yok', path, 'Link butonunda url yok');
        } else {
          if (!c.custom_id) err('buton-custom-id-yok', path, `Link olmayan butonda custom_id yok ("${label}")`);
          else noteId(c.custom_id, path);
          if (c.url) err('buton-url', path, 'Link olmayan butonda url olamaz');
        }
        break;
      }

      case T.STRING_SELECT:
      case T.USER_SELECT:
      case T.ROLE_SELECT:
      case T.MENTIONABLE_SELECT:
      case T.CHANNEL_SELECT: {
        if (!c.custom_id) err('custom-id-yok', path, 'Menüde custom_id yok');
        else noteId(c.custom_id, path);
        if ((c.placeholder ?? '').length > 150) err('placeholder-150', path, `Yer tutucu ${c.placeholder.length} karakter (en çok 150)`);
        add('placeholder', `${path}.placeholder`, c.placeholder);
        if ((c.max_values ?? 1) > 25) err('menu-secim', path, `max_values ${c.max_values} (en çok 25)`);
        if ((c.min_values ?? 1) > (c.max_values ?? 1) && c.min_values !== undefined) err('menu-secim', path, `min_values (${c.min_values}) max_values'tan (${c.max_values ?? 1}) büyük`);
        if (c.type === T.STRING_SELECT) {
          const opts = c.options ?? [];
          if (!opts.length) err('menu-secenek-yok', path, 'Menüde seçenek yok');
          if (opts.length > 25) err('secenek-25', path, `Menüde ${opts.length} seçenek var (en çok 25)`);
          const seen = new Set();
          opts.forEach((o, i) => {
            const p = `${path}.options[${i}]`;
            for (const key of ['label', 'value', 'description']) {
              if ((o[key] ?? '').length > 100) err('secenek-100', `${p}.${key}`, `Seçenek ${key} ${o[key].length} karakter (en çok 100)`);
            }
            if (!o.label) err('secenek-bos', p, 'Seçenek etiketi boş');
            if (!o.value) err('secenek-bos', p, 'Seçenek değeri boş');
            if (seen.has(o.value)) err('secenek-tekrar', p, `Seçenek değeri tekrar ediyor: ${o.value}`);
            seen.add(o.value);
            add('option', `${p}.label`, o.label);
            add('optdesc', `${p}.description`, o.description);
            if (o.emoji && (o.emoji.name || o.emoji.id)) err('emoji', `${p}.emoji`, `Seçenekte emoji var: ${o.emoji.name ?? o.emoji.id}`);
          });
        }
        break;
      }

      case T.TEXT_INPUT:
        if (!c.custom_id) err('custom-id-yok', path, 'TextInput custom_id yok');
        else noteId(c.custom_id, path);
        if ((c.placeholder ?? '').length > 100) err('placeholder-100', path, `Yer tutucu ${c.placeholder.length} karakter (metin girişinde en çok 100)`);
        if ((c.max_length ?? 0) > 4000) err('giris-uzunluk', path, `max_length ${c.max_length} (en çok 4000)`);
        if (c.min_length != null && c.max_length != null && c.min_length > c.max_length) err('giris-uzunluk', path, 'min_length max_length\'ten büyük');
        if ((c.label ?? '').length > 45) err('alan-etiket-45', path, `Alan etiketi ${c.label.length} karakter (en çok 45)`);
        add('placeholder', `${path}.placeholder`, c.placeholder);
        add('other', `${path}.value`, c.value);
        break;

      case T.TEXT_DISPLAY:
        if (typeof c.content !== 'string' || !c.content.trim()) err('bos-metin', path, 'Boş TextDisplay');
        add('text', `${path}.content`, c.content);
        break;

      case T.THUMBNAIL:
        if (parent?.type !== T.SECTION) err('gecersiz-yapi', path, 'Thumbnail sadece Section aksesuarı olabilir');
        if (!c.media?.url) err('gorsel-url-yok', path, 'Thumbnail url yok');
        needFile(c.media?.url, path);
        break;

      case T.MEDIA_GALLERY: {
        const items = c.items ?? [];
        if (items.length < 1 || items.length > 10) err('galeri-sayisi', path, `Galeride ${items.length} görsel var (1-10)`);
        items.forEach((it, i) => {
          if (!it.media?.url) err('gorsel-url-yok', `${path}.items[${i}]`, 'Görsel url yok');
          needFile(it.media?.url, `${path}.items[${i}]`);
        });
        break;
      }

      case T.FILE:
        if (!String(c.file?.url ?? '').startsWith('attachment://')) err('dosya-url', path, 'File bileşeni attachment:// adresi kullanmalı');
        needFile(c.file?.url, path);
        break;

      case T.SEPARATOR:
        if (c.spacing != null && ![1, 2].includes(c.spacing)) err('gecersiz-yapi', path, `Ayırıcı boşluğu 1 ya da 2 olmalı (${c.spacing})`);
        break;

      case T.LABEL:
        if (!isModal) err('gecersiz-yapi', path, 'Label sadece modalda kullanılabilir');
        if (!c.label) err('alan-etiket-yok', path, 'Alan etiketi boş');
        if ((c.label ?? '').length > 45) err('alan-etiket-45', path, `Alan etiketi ${c.label.length} karakter (en çok 45): "${c.label.slice(0, 30)}..."`);
        if ((c.description ?? '').length > 100) err('alan-aciklama-100', path, `Alan açıklaması ${c.description.length} karakter (en çok 100)`);
        if (!c.component) err('gecersiz-yapi', path, 'Label içinde bileşen yok');
        else if (!LABEL_CHILDREN.has(c.component.type)) err('gecersiz-yapi', `${path}.component`, `Label içinde ${c.component.type} tipi bileşen olamaz`);
        add('label', `${path}.label`, c.label);
        add('label', `${path}.description`, c.description);
        break;

      default:
        err('bilinmeyen-tip', path, `Bilinmeyen bileşen tipi: ${c.type}`);
    }
  });

  // ── Toplamlar ──────────────────────────────────────────────────────────────
  const total = count(roots);
  if (total > 40) err('bilesen-sayisi', 'components', `Toplam ${total} bileşen var (en çok 40)`);
  const textTotal = strings.filter((s) => s.kind === 'text').reduce((n, s) => n + s.value.length, 0);
  if (textTotal > 4000) err('metin-4000', 'components', `Metinlerin toplamı ${textTotal} karakter (en çok 4000)`);

  // ── İçerik kuralları ───────────────────────────────────────────────────────
  let bangs = 0;
  const lines = new Map(); // normalize satır -> [yol]

  for (const s of strings) {
    const isText = s.kind === 'text' || s.kind === 'content';

    const emojis = emojisIn(s.value);
    if (emojis.length) err('emoji', s.path, `Emoji/süs simgesi: ${codepoints(emojis)}`);

    const plain = stripTokens(s.value);

    const low = lower(plain);
    for (const word of config.DIRECTION_WORDS) {
      if (wordRe(lower(word)).test(low)) warn('yon-sozcugu', s.path, `"${word}" yön sözcüğü geçiyor, elle gözden geçirilsin`);
    }
    // Kırpılmış metindeki tek karakterlik … (core shorten) kabul edilir; yalnızca iki ya da dörtten fazla nokta uyarılır
    if (/(?<!\.)\.{2}(?!\.)|\.{4,}/.test(plain)) warn('uc-nokta', s.path, 'Üç nokta "..." olarak yazılmalı');
    for (const m of plain.matchAll(/(?<![\p{L}\p{N}_])\p{Lu}{4,}(?![\p{L}\p{N}_])/gu)) {
      if (!config.ABBREVIATIONS.includes(m[0])) warn('buyuk-harf', s.path, `Tamamen büyük harfli sözcük: ${m[0]}`);
    }

    if (!isText) continue;

    // Başlık uzunluğu (kod blokları dışında)
    let fenced = false;
    for (const line of s.value.split('\n')) {
      if (/^```/.test(line.trim())) fenced = !fenced;
      if (fenced) continue;
      const h = /^## (.*)$/.exec(line);
      if (!h || /^\d+\. /.test(h[1])) continue; // sıralama satırları başlık sayılmaz
      // Etiketler yaklaşık görünen ad uzunluğuna, biçim işaretleri hiçbir şeye çevrilir
      const shown = h[1].replace(/<[@#][&!]?\d+>/g, '@xxxxxxxx').replace(/<t:[^>]+>/g, 'xxxxxxxxxxxxxxxx').replace(/\*\*|__|~~|`/g, '').trim();
      if (shown.length > 28) warn('baslik-uzun', s.path, `## başlığı ${shown.length} karakter (hedef en çok 28): "${shown}"`);
    }

    // Küçük gri yazı (-#) başlığın hemen altındaki açıklamada ASLA kullanılmaz (o açıklama her zaman normal boyutta,
    // önemli sözcükleri kalın yazılır); gri yazı yalnızca mesajın en altında, zaman damgası, sayfa bilgisi ve
    // sıralama listesinin 4. sıradan sonraki satırlarında kullanılır (aşırı gri yazı okunmaz)
    {
      const rows = s.value.split('\n');
      rows.forEach((line, i) => {
        if (!line.startsWith('-# ')) return;
        const underTitle = i > 0 && /^#{1,3} /.test(rows[i - 1]);
        const stamp = /^-# <t:\d+:[A-Za-z]>$/.test(line);
        const pager = /^-# Sayfa \d+ \/ \d+/.test(line);
        const rank = /^-# \d+\. /.test(line); // sıralama listelerinde ilk üçten sonraki satırlar
        const footer = /<t:\d+:[A-Za-z]>/.test(line) || /^-# .* - (Başvuru|Talep|Ceza) #\d+$/.test(line); // zaman damgalı ya da vaka kimlikli alt satır
        const empty = /(yok|bulunmuyor)\.$/.test(line); // boş durum satırı ("-# Ceza kaydı yok.")
        const compact = /^### /.test(rows[0]) && i === 2; // kısa bildirim kartı (### başlık, kalın cümle, gri teşekkür; ör. etiket teşekkürü)
        if (underTitle) err('kucuk-yazi', s.path, `Başlığın hemen altındaki açıklama gri (-#) olamaz, normal yazı olmalı: ${line.slice(0, 60)}`);
        else if (!stamp && !pager && !rank && !footer && !empty && !compact) err('kucuk-yazi', s.path, `Küçük gri yazı (-#) izin verilen yerlerde değil: ${line.slice(0, 60)}`);
      });
    }
    const noCode = stripCode(s.value);
    if (/\S {2,}\S/.test(noCode.replace(/^ +/gm, ''))) warn('cift-bosluk', s.path, 'Çift boşluk var');
    if (/[ \t]+$/m.test(noCode)) warn('satir-sonu-bosluk', s.path, 'Satır sonunda boşluk var');
    if (/(?:\n[ \t]*){4,}/.test(noCode)) warn('bos-satir-cok', s.path, 'Ardışık 3 ya da daha fazla boş satır var');
    const bold = (noCode.replace(/\\\*/g, '').match(/\*\*/g) ?? []).length;
    if (bold % 2) warn('kalin-dengesiz', s.path, 'Kalın işareti (**) dengesiz');

    const bangText = stripTokens(s.value);
    bangs += (bangText.match(/!/g) ?? []).length;
    if (/!!/.test(bangText)) warn('unlem-cift', s.path, 'Art arda ünlem ("!!")');

    if (s.kind === 'text') {
      let fence = false;
      for (const raw of s.value.split('\n')) {
        if (/^```/.test(raw.trim())) fence = !fence;
        if (fence) continue;
        const key = raw.trim();
        if (key.length < 10 || !/\p{L}/u.test(key) || config.REPEAT_IGNORE.some((re) => re.test(key))) continue;
        if (!lines.has(key)) lines.set(key, []);
        lines.get(key).push(s.path);
      }
    }
  }

  if (bangs > 2) warn('unlem-cok', 'components', `Mesajda ${bangs} ünlem var (en çok 2)`);
  for (const [line, paths] of lines) {
    if (paths.length > 1) warn('tekrar', paths[1], `Aynı satır mesajda ${paths.length} kez geçiyor: "${line.length > 50 ? `${line.slice(0, 47)}...` : line}"`);
  }

  // Durum yazan ama rengi olmayan container
  if (!isModal) {
    const statusRe = /kapat[ıi]ld[ıi]|reddedildi|onayland[ıi]/;
    roots.forEach((c, i) => {
      if (c?.type !== T.CONTAINER || c.accent_color != null) return;
      const body = [];
      walk(c.components ?? [], (k) => k.type === T.TEXT_DISPLAY && body.push(k.content ?? ''));
      const hit = statusRe.exec(lower(body.join('\n')));
      if (hit) warn('durum-renk-yok', `components[${i}]`, `Durum mesajı ("${hit[0]}") ama accent_color yok`);
    });
  }

  return { errors, warnings };
}

module.exports = { lint, emojisIn, config };
