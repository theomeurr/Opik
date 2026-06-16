// Génère les icônes PNG de l'app (sans dépendance externe).
// Sac de courses (dégradé vert + coche) sur fond noir arrondi, via supersampling.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// --- palette ---
const BG = [26, 30, 33];          // #1a1e21
const ACC_TOP = [242, 201, 76];   // #f2c94c (moutarde clair)
const ACC_BOT = [154, 107, 0];    // #9a6b00 (curry foncé)
const ACC_MID = [221, 165, 12];   // #dda50c
const WHITE = [255, 255, 255];

function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

function roundedRectContains(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function capsuleContains(px, py, x1, y1, x2, y2, hw) {
  const vx = x2 - x1, vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : ((px - x1) * vx + (py - y1) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * vx, cy = y1 + t * vy;
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= hw * hw;
}

// Anneau (demi-supérieur) : pour l'anse du sac.
function archContains(px, py, cx, cy, ri, ro) {
  if (py > cy) return false;
  const d = Math.hypot(px - cx, py - cy);
  return d >= ri && d <= ro;
}

// Trapèze (corps du sac, plus large en haut), coins bas légèrement arrondis.
function bagBodyContains(px, py, topY, botY, cx, topHW, botHW, r) {
  if (py < topY || py > botY) return false;
  const t = (py - topY) / (botY - topY);
  const halfW = topHW + (botHW - topHW) * t;
  const dx = Math.abs(px - cx);
  if (dx > halfW) return false;
  // arrondi des deux coins du bas
  if (py > botY - r && dx > halfW - r) {
    const ddx = dx - (halfW - r), ddy = py - (botY - r);
    return ddx * ddx + ddy * ddy <= r * r;
  }
  return true;
}

// Composite la couleur d'un point (coordonnées 0..1). Renvoie [r,g,b,a].
function sample(px, py) {
  let col = [0, 0, 0, 0];
  const over = (c) => { col = [c[0], c[1], c[2], 1]; };

  // fond arrondi (iOS applique son propre masque)
  if (!roundedRectContains(px, py, 0, 0, 1, 1, 0.225)) return col;
  over(BG);

  // corps du sac (trapèze)
  const topY = 0.44, botY = 0.80, cx = 0.5, topHW = 0.225, botHW = 0.205;
  const inBody = bagBodyContains(px, py, topY, botY, cx, topHW, botHW, 0.05);

  // anse unique, fine, centrée (dessinée avant le corps)
  if (archContains(px, py, cx, topY, 0.085, 0.115)) over(ACC_MID);

  // corps avec dégradé vertical
  if (inBody) {
    const t = Math.min(1, Math.max(0, (py - topY) / (botY - topY)));
    over(lerp(ACC_TOP, ACC_BOT, t));

    // coche blanche centrée sur le sac
    const p1 = [0.405, 0.63];
    const p2 = [0.47, 0.70];
    const p3 = [0.62, 0.55];
    if (capsuleContains(px, py, p1[0], p1[1], p2[0], p2[1], 0.027) ||
        capsuleContains(px, py, p2[0], p2[1], p3[0], p3[1], 0.027)) over(WHITE);
  }
  return col;
}

function render(size) {
  const SS = 4; // supersampling
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          const c = sample(px, py);
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      const alpha = a / n;
      // couleur pré-multipliée -> normalisée
      buf[idx] = alpha > 0 ? Math.round(r / a) : 0;
      buf[idx + 1] = alpha > 0 ? Math.round(g / a) : 0;
      buf[idx + 2] = alpha > 0 ? Math.round(b / a) : 0;
      buf[idx + 3] = Math.round(alpha * 255);
    }
  }
  return buf;
}

// --- encodage PNG ---
const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, '..', 'icons');
const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
];
for (const t of targets) {
  const png = encodePNG(render(t.size), t.size);
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log('wrote', t.name, png.length, 'bytes');
}
