// Samples the dominant colours of public/palawi-logo.png and writes design tokens.
// Usage: node scripts/extract-palette.mjs
// Output: src/styles/tokens.css (CSS variables) and src/styles/palette.json (raw samples)
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(import.meta.dirname, "..");
const png = PNG.sync.read(fs.readFileSync(path.join(root, "public/palawi-logo.png")));

const toHsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
};
const hslToRgb = ([h, s, l]) => {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const lum = (rgb) => {
  const c = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Quantise opaque, non-white pixels into buckets (4 bits per channel).
const buckets = new Map();
for (let i = 0; i < png.data.length; i += 4) {
  const [r, g, b, a] = png.data.subarray(i, i + 4);
  if (a < 200) continue;
  if (r > 235 && g > 235 && b > 235) continue; // background
  const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
  const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
  e.n++; e.r += r; e.g += g; e.b += b;
  buckets.set(key, e);
}
const clusters = [...buckets.values()]
  .map((e) => ({ n: e.n, rgb: [e.r / e.n, e.g / e.n, e.b / e.n].map(Math.round) }))
  .map((c) => ({ ...c, hsl: toHsl(c.rgb) }))
  .sort((a, b) => b.n - a.n);

// Pick representative colours by hue family, weighted by pixel count.
const pick = (pred) => {
  const set = clusters.filter((c) => pred(c.hsl));
  const n = set.reduce((s, c) => s + c.n, 0);
  if (!n) return null;
  const rgb = [0, 1, 2].map((i) => Math.round(set.reduce((s, c) => s + c.rgb[i] * c.n, 0) / n));
  return { rgb, hex: hex(rgb), pixels: n };
};
const teal = pick(([h, s, l]) => h >= 140 && h <= 200 && s > 0.2 && l < 0.65);
const leaf = pick(([h, s, l]) => h >= 60 && h < 115 && s > 0.3 && l > 0.5);
const skin = pick(([h, s, l]) => (h < 40 || h > 340) && s > 0.2 && l > 0.5);
if (!teal || !leaf) throw new Error("Could not find teal/leaf colours in the logo");

// Build a tonal scale from a base colour by moving lightness, keeping hue.
const scale = (rgb) => {
  const [h, s, base] = toHsl(rgb);
  // The exact logo colour sits at 500 when its lightness fits there; otherwise it is kept as a named token only.
  const stops = { 50: 0.96, 100: 0.92, 200: 0.84, 300: 0.72, 400: 0.58, 500: base > 0.42 && base < 0.56 ? null : 0.47, 600: 0.36, 700: 0.29, 800: 0.22, 900: 0.15 };
  return Object.fromEntries(
    Object.entries(stops).map(([k, l]) => [k, hex(l === null ? rgb : hslToRgb([h, Math.min(s, l > 0.8 ? 0.5 : s), l]))]),
  );
};
const tealScale = scale(teal.rgb);
const leafScale = scale(leaf.rgb);
const [th, ts] = toHsl(teal.rgb);
const ink = hex(hslToRgb([th, Math.min(ts, 0.35), 0.16]));
const inkMuted = hex(hslToRgb([th, Math.min(ts, 0.2), 0.36]));
const surface = hex(hslToRgb([th, 0.35, 0.975]));

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const white = [255, 255, 255];
const report = {
  source: "public/palawi-logo.png",
  extracted: { teal: teal.hex, leaf: leaf.hex, skin: skin?.hex ?? null },
  checks: {
    "white on primary-600": contrast(white, rgbOf(tealScale[600])).toFixed(2),
    "white on primary-700": contrast(white, rgbOf(tealScale[700])).toFixed(2),
    "ink on surface": contrast(rgbOf(ink), rgbOf(surface)).toFixed(2),
    "ink-muted on white": contrast(rgbOf(inkMuted), white).toFixed(2),
    "ink on secondary-200": contrast(rgbOf(ink), rgbOf(leafScale[200])).toFixed(2),
    "white on secondary-700": contrast(white, rgbOf(leafScale[700])).toFixed(2),
  },
  primary: tealScale,
  secondary: leafScale,
};

// Red is used only for alerts (client decision, see README).
const alert = { 50: "#fef2f2", 100: "#fee2e2", 600: "#dc2626", 700: "#b91c1c" };

// tokens.json feeds tailwind.config.ts; tokens.css exposes the same colours as CSS variables (charts, print).
const tokens = {
  logo: { teal: teal.hex, leaf: leaf.hex },
  primary: tealScale,
  secondary: leafScale,
  accent: skin?.hex ?? "#f2c9a8",
  surface,
  ink: { DEFAULT: ink, muted: inkMuted },
  alert,
};
const vars = [];
const walk = (obj, prefix) =>
  Object.entries(obj).forEach(([k, v]) => {
    const name = k === "DEFAULT" ? prefix : `${prefix}-${k}`;
    if (typeof v === "object") walk(v, name);
    else vars.push(`  --color${name}: ${v};`);
  });
walk(tokens, "");
fs.mkdirSync(path.join(root, "src/styles"), { recursive: true });
fs.writeFileSync(path.join(root, "src/styles/tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
fs.writeFileSync(
  path.join(root, "src/styles/tokens.css"),
  ["/* Generated by scripts/extract-palette.mjs from public/palawi-logo.png. Do not edit by hand. */", ":root {", ...vars, "}", ""].join("\n"),
);
fs.writeFileSync(path.join(root, "src/styles/palette.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
