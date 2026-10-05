// İnternetsiz görsel yer tutucular.
// Builder'lar thumbnail/galeri adreslerini http(s) olarak doğruladığı için mock'lar sahte bir adres üretir
// (https://placeholder.kazuki.invalid/...); önizleme çizilirken bu adres data URI SVG'ye çevrilir (resolve).
const HOST = 'https://placeholder.kazuki.invalid';
const enc = encodeURIComponent;

const hash = (value) => [...String(value)].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);
const hue = (seed) => hash(seed) % 360;
const svgUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Doğrudan data URI SVG (builder'a verilmeyecek yerlerde kullanılır)
function dataUri({ width = 128, height = 128, label = '', seed = label } = {}) {
  const small = Math.min(width, height);
  const square = width === height;
  const text = square ? ([...String(label || '?')][0] ?? '?').toLocaleUpperCase('tr') : String(label);
  const size = square ? small * 0.45 : Math.min(small * 0.18, 28);
  return svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="hsl(${hue(seed)} 45% 38%)"/>` +
      `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" fill="#fff" fill-opacity=".9">${text.replace(/[<&>]/g, '')}</text></svg>`,
  );
}

const avatar = (seed, label = seed) => `${HOST}/a/${enc(seed)}/${enc(label)}.png`;
const icon = (seed, label = seed) => `${HOST}/i/${enc(seed)}/${enc(label)}.png`;
const banner = (width = 960, height = 320, label = 'Banner') => `${HOST}/b/${width}x${height}/${enc(label)}.png`;

// Sahte adresi data URI'ye çevirir; başka adresler olduğu gibi döner
function resolve(url) {
  if (typeof url !== 'string' || !url.startsWith(HOST)) return url;
  const path = url.slice(HOST.length);
  let m = /^\/[ai]\/([^/]*)\/([^/]*)\.png$/.exec(path);
  if (m) return dataUri({ width: 128, height: 128, seed: decodeURIComponent(m[1]), label: decodeURIComponent(m[2]) });
  m = /^\/b\/(\d+)x(\d+)\/([^/]*)\.png$/.exec(path);
  if (m) return dataUri({ width: Number(m[1]), height: Number(m[2]), label: decodeURIComponent(m[3]) });
  return dataUri({ label: '?' });
}

module.exports = { HOST, hue, dataUri, avatar, icon, banner, resolve };
