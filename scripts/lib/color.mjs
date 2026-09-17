// Color parsing and perceptual distance for the token migration and lint.
// No dependencies. sRGB → CIE Lab (D65), distance is CIE76.

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function parseColor(text) {
  const s = String(text).trim();
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/i.exec(s))) {
    const h = m[1];
    if (![3, 4, 6, 8].includes(h.length)) return null;
    const full = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
    const n = (i) => parseInt(full.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 };
  }
  if ((m = /^rgba?\(\s*([^)]+)\)$/i.exec(s))) {
    const parts = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (v) => (v.endsWith("%") ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return { r: clamp255(ch(parts[0])), g: clamp255(ch(parts[1])), b: clamp255(ch(parts[2])), a };
  }
  if ((m = /^hsla?\(\s*([^)]+)\)$/i.exec(s))) {
    const parts = m[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
    const sat = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m0 = l - c / 2;
    const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: clamp255((r1 + m0) * 255), g: clamp255((g1 + m0) * 255), b: clamp255((b1 + m0) * 255), a };
  }
  return null;
}

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function toLab({ r, g, b }) {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 1.0;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return { L: 116 * f(Y) - 16, a: 500 * (f(X) - f(Y)), b: 200 * (f(Y) - f(Z)) };
}

export const deltaE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

export const hexOf = ({ r, g, b }) => "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");

export function familyOf(lab) {
  const chroma = Math.hypot(lab.a, lab.b);
  if (chroma < 8) return "neutral";
  const hue = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360;
  // Rust and terracotta (the brand oxide sits near 45°) read as red, not gold.
  if (hue < 55 || hue >= 340) return "red";
  if (hue < 105) return "gold";
  if (hue < 160) return "green";
  if (hue < 215) return "teal";
  if (hue < 300) return "blue";
  return "violet";
}

export function primitiveName(lab, taken) {
  const base = `--p-${familyOf(lab)}-${String(Math.max(0, Math.round(lab.L))).padStart(2, "0")}`;
  if (!taken.has(base)) return base;
  for (const suffix of "bcdefghijklmnopqrstuvwxyz") if (!taken.has(base + suffix)) return base + suffix;
  throw new Error(`too many primitives near ${base}`);
}
