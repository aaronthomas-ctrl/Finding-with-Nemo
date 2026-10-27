// Draws the app icon (a compass) as PNGs without any image library.
// Usage: node scripts/make-icons.mjs  ->  public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
import fs from 'node:fs';
import zlib from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };

function png(size, scale, rounded) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const ss = 3; // supersampling
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const px = x + (sx + 0.5) / ss, py = y + (sy + 0.5) / ss;
        // background: rounded square for normal icons, full bleed for maskable
        const dx = Math.abs(px - cx), dy = Math.abs(py - cy), R = size * 0.22, h = size / 2;
        const inside = !rounded || (dx <= h - R || dy <= h - R || Math.hypot(dx - (h - R), dy - (h - R)) <= R);
        if (!inside) continue;
        let col = [37, 99, 235]; // blue
        const u0 = (px - cx) / (size * scale), v0 = (py - cy) / (size * scale);
        const rad = Math.hypot(u0, v0);
        if (rad <= 0.34 && rad >= 0.285) col = [255, 255, 255]; // ring
        // needle along the NE diagonal
        const u = (u0 - v0) * Math.SQRT1_2 * -1, v = (u0 + v0) * Math.SQRT1_2; // rotate 45 degrees
        const L = 0.24, W = 0.075;
        if (Math.abs(u) < L && Math.abs(v) < W * (1 - Math.abs(u) / L)) col = u > 0 ? [255, 255, 255] : [147, 197, 253];
        if (rad < 0.025) col = [37, 99, 235];
        r += col[0]; g += col[1]; b += col[2]; a += 255;
      }
      const n = ss * ss, i = y * (size * 4 + 1) + 1 + x * 4;
      const cov = a / (255 * n);
      raw[i] = cov ? Math.round(r / (cov * n)) : 0; raw[i + 1] = cov ? Math.round(g / (cov * n)) : 0; raw[i + 2] = cov ? Math.round(b / (cov * n)) : 0; raw[i + 3] = Math.round(cov * 255);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = 'public/icons';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/icon-192.png`, png(192, 1, true));
fs.writeFileSync(`${out}/icon-512.png`, png(512, 1, true));
fs.writeFileSync(`${out}/icon-maskable-512.png`, png(512, 0.78, false)); // content inside the safe zone
fs.writeFileSync(`${out}/apple-touch-icon.png`, png(180, 0.9, false));
console.log('icons written');
