/**
 * compare.ts — pixel-diffs the server-rendered golden overlay against the
 * browser-rendered one. Both are 1080x1920. Reports:
 *  - mean absolute difference per channel (0-255)
 *  - % of pixels differing beyond tolerance (per-channel diff > tol)
 *  - max channel diff
 * Gate: <2% pixels beyond tol=24 AND mean diff < 3 → parity PASS.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "out");

async function load(file: string) {
  const img = await loadImage(readFileSync(join(dir, file)));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return { data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
}

const a = await load("golden-overlay-server.png");
const b = await load("golden-overlay-browser.png");

if (a.w !== b.w || a.h !== b.h) {
  console.error(`SIZE MISMATCH: server ${a.w}x${a.h} vs browser ${b.w}x${b.h}`);
  process.exit(1);
}

const n = a.w * a.h;
const tol = 24;
let overTol = 0;
let sumDiff = 0;
let maxDiff = 0;
let alphaMismatch = 0;

for (let i = 0; i < n; i++) {
  const sa = a.data[i * 4 + 3];
  const ba = b.data[i * 4 + 3];
  if (Math.abs(sa - ba) > tol) alphaMismatch++;
  let worst = 0;
  let s = 0;
  for (let c = 0; c < 3; c++) {
    const d = Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]);
    s += d;
    if (d > worst) worst = d;
  }
  sumDiff += s / 3;
  if (worst > maxDiff) maxDiff = worst;
  if (worst > tol) overTol++;
}

const mean = sumDiff / n;
const pct = (overTol / n) * 100;
const pctAlpha = (alphaMismatch / n) * 100;
console.log(JSON.stringify({
  pixels: n,
  meanChannelDiff: +mean.toFixed(3),
  maxChannelDiff: maxDiff,
  pctOverTolerance: +pct.toFixed(3),
  pctAlphaMismatch: +pctAlpha.toFixed(3),
  gate: pct < 2 && mean < 3 ? "PASS" : "FAIL",
}, null, 2));
process.exit(pct < 2 && mean < 3 ? 0 : 1);
