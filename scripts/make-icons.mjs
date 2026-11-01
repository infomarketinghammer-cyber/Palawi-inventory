// Builds square PWA icons from public/palawi-logo.png (logo centred on white, bilinear scaling).
// Usage: node scripts/make-icons.mjs
// The source logo is small (185x70); replace with a high-resolution logo when the client provides one.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const root = path.resolve(import.meta.dirname, "..");
const src = PNG.sync.read(fs.readFileSync(path.join(root, "public/palawi-logo.png")));

function sample(x, y) {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(y)));
  const x1 = Math.min(src.width - 1, x0 + 1);
  const y1 = Math.min(src.height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const px = (xx, yy, c) => src.data[(yy * src.width + xx) * 4 + c];
  return [0, 1, 2, 3].map((c) =>
    px(x0, y0, c) * (1 - fx) * (1 - fy) + px(x1, y0, c) * fx * (1 - fy) + px(x0, y1, c) * (1 - fx) * fy + px(x1, y1, c) * fx * fy,
  );
}

for (const size of [192, 512]) {
  const out = new PNG({ width: size, height: size });
  const pad = size * 0.1;
  const scale = (size - 2 * pad) / src.width;
  const h = src.height * scale;
  const top = (size - h) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let rgb = [255, 255, 255];
      const sx = (x - pad) / scale, sy = (y - top) / scale;
      if (sx >= 0 && sy >= 0 && sx < src.width && sy < src.height) {
        const [r, g, b, a] = sample(sx, sy);
        const al = a / 255;
        rgb = [r * al + 255 * (1 - al), g * al + 255 * (1 - al), b * al + 255 * (1 - al)];
      }
      out.data[i] = rgb[0]; out.data[i + 1] = rgb[1]; out.data[i + 2] = rgb[2]; out.data[i + 3] = 255;
    }
  }
  fs.mkdirSync(path.join(root, "public/icons"), { recursive: true });
  fs.writeFileSync(path.join(root, `public/icons/icon-${size}.png`), PNG.sync.write(out));
  console.log(`public/icons/icon-${size}.png`);
}
