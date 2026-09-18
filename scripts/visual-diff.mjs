// Pixel diff between two folders of same-named PNG screenshots.
// Usage: node scripts/visual-diff.mjs <beforeDir> <afterDir> [thresholdPercent=0.5]
// Decodes 8-bit RGB/RGBA non-interlaced PNGs without dependencies.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, colorType = 6;
  const data = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); colorType = body[9]; }
    if (type === "IDAT") data.push(body);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(data));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width, height, bpp, data: out };
}

const [beforeDir, afterDir, thresholdArg = "0.5"] = process.argv.slice(2);
const threshold = Number(thresholdArg) / 100;
let flagged = 0;
for (const name of (await readdir(beforeDir)).filter((n) => n.endsWith(".png")).sort()) {
  const a = decodePng(await readFile(path.join(beforeDir, name)));
  const b = await readFile(path.join(afterDir, name)).then(decodePng).catch(() => null);
  if (!b) { console.log(`${name}: missing in ${afterDir}`); flagged += 1; continue; }
  if (a.width !== b.width || a.height !== b.height) { console.log(`${name}: size differs ${a.width}x${a.height} vs ${b.width}x${b.height}  <-- REVIEW`); flagged += 1; continue; }
  let diff = 0;
  const n = a.width * a.height;
  const channels = Math.min(a.bpp, b.bpp, 3);
  for (let i = 0; i < n; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      if (Math.abs(a.data[i * a.bpp + c] - b.data[i * b.bpp + c]) > 8) { diff += 1; break; }
    }
  }
  const ratio = diff / n;
  if (ratio > threshold) flagged += 1;
  console.log(`${name}: ${(ratio * 100).toFixed(2)}% pixels changed${ratio > threshold ? "  <-- REVIEW" : ""}`);
}
process.exit(flagged ? 1 : 0);
