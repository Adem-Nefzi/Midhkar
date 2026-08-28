/**
 * islamic-patterns.ts
 *
 * Deterministic, seed-based procedural Islamic geometric pattern engine.
 * Pure canvas 2D — no DOM, no network, no assets. Runs on the main thread
 * (preview + overlay pre-render) and is safe inside a Worker if ever needed.
 *
 * A single integer `seed` fully determines the output, so the same pattern
 * can be re-rendered identically at any resolution (thumbnail → 1080p frame).
 *
 * Families:
 *   star       — n-fold star rosettes on a "stars & crosses" grid
 *   girih      — decagon/pentagon strapwork tessellation
 *   arabesque  — flowing islimi vine scrollwork
 *   zellige    — Moroccan cut-tile mosaic
 *   muqarnas   — honeycomb vaulting cells
 *   arch       — mosque arcade of pointed arches
 *   border     — illuminated manuscript frame
 */

/* ══════════════════════════════════════════════════════════════
   Seeded PRNG (mulberry32) — deterministic per seed
══════════════════════════════════════════════════════════════ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ══════════════════════════════════════════════════════════════
   Palettes — drawn from historic Islamic art traditions
══════════════════════════════════════════════════════════════ */

export interface PatternPalette {
  id: string;
  nameEn: string;
  nameAr: string;
  bg: string;     // deep ground
  bg2: string;    // gradient end
  line: string;   // primary strap / line
  line2: string;  // secondary line
  accent: string; // glow / highlight
  fill: string;   // tile fill (zellige)
}

export const PATTERN_PALETTES: PatternPalette[] = [
  { id: "night-gold",   nameEn: "Night & Gold",      nameAr: "ليل وذهب",      bg: "#0a0a12", bg2: "#14101f", line: "#d4af37", line2: "#8a7a3a", accent: "#f5e6c8", fill: "#1c1626" },
  { id: "lapis-gold",   nameEn: "Lapis & Gold",      nameAr: "لازورد وذهب",   bg: "#0d1b3e", bg2: "#0a1230", line: "#c9a227", line2: "#7a6a2a", accent: "#e8d9a0", fill: "#16264e" },
  { id: "emerald-ivory",nameEn: "Emerald & Ivory",   nameAr: "زمرد وعاج",     bg: "#04150f", bg2: "#071f16", line: "#2e8b6e", line2: "#1f5c4a", accent: "#f0ead6", fill: "#0a2a1f" },
  { id: "burgundy-rose",nameEn: "Burgundy & Rose",   nameAr: "عنابي وورد",    bg: "#1a0508", bg2: "#240a10", line: "#c97b8a", line2: "#8a4a5a", accent: "#f2d5d0", fill: "#2e0a12" },
  { id: "indigo-silver",nameEn: "Indigo & Silver",   nameAr: "نيلي وفضة",     bg: "#0a0a1e", bg2: "#10102a", line: "#a8b5c8", line2: "#5a6478", accent: "#e0e6ef", fill: "#161636" },
  { id: "teal-amber",   nameEn: "Teal & Amber",      nameAr: "أزرق مخضر وكهرمان", bg: "#03151a", bg2: "#062028", line: "#d4923a", line2: "#8a5f2a", accent: "#f5deb3", fill: "#0a2a32" },
  { id: "purple-gold",  nameEn: "Tyrian & Gold",     nameAr: "أرجواني وذهب",  bg: "#140a24", bg2: "#1c0f30", line: "#c9a227", line2: "#7a5a8a", accent: "#e8d0f0", fill: "#241440" },
  { id: "forest-gold",  nameEn: "Forest & Brass",    nameAr: "غابة ونحاس",    bg: "#0a1408", bg2: "#0f1c0b", line: "#b8963a", line2: "#6a5a2a", accent: "#dce8c8", fill: "#14240f" },
  { id: "midnight-cyan",nameEn: "Midnight & Cyan",   nameAr: "منتصف الليل وسماوي", bg: "#050a1a", bg2: "#08102a", line: "#4a9ec9", line2: "#2a5a7a", accent: "#c8e8f5", fill: "#0d1830" },
  { id: "charcoal-copper", nameEn: "Charcoal & Copper", nameAr: "فحم ونحاس",  bg: "#0d0d0d", bg2: "#141414", line: "#b87333", line2: "#7a4a2a", accent: "#e8c8a0", fill: "#1c1c1c" },
  { id: "navy-gold",    nameEn: "Royal Navy & Gold", nameAr: "كحلي وذهب",     bg: "#0a1230", bg2: "#0d1840", line: "#d4af37", line2: "#8a7a3a", accent: "#f0e0b0", fill: "#141e46" },
  { id: "olive-cream",  nameEn: "Olive & Cream",     nameAr: "زيتوني وكريم",  bg: "#12140a", bg2: "#181a0d", line: "#a8a03a", line2: "#6a642a", accent: "#f0ecd0", fill: "#1e200f" },
];

export function getPalette(id: string): PatternPalette {
  return PATTERN_PALETTES.find((p) => p.id === id) ?? PATTERN_PALETTES[0];
}

/* ══════════════════════════════════════════════════════════════
   Families
══════════════════════════════════════════════════════════════ */

export type PatternFamily =
  | "star"
  | "girih"
  | "arabesque"
  | "zellige"
  | "muqarnas"
  | "arch"
  | "border";

export type PatternFillMode = "outline" | "solid" | "glow";

export interface PatternOptions {
  seed: number;
  family: PatternFamily;
  paletteId: string;
  density?: 1 | 2 | 3;
  scale?: number; // 0.6 – 1.8
  fillMode?: PatternFillMode;
}

/* ══════════════════════════════════════════════════════════════
   Color helpers
══════════════════════════════════════════════════════════════ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16,
  );
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ══════════════════════════════════════════════════════════════
   Render cache — one offscreen canvas per unique config, so the
   same pattern is drawn once and blitted for every verse overlay.
══════════════════════════════════════════════════════════════ */

const _cache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
const CACHE_MAX = 12;

function cacheKey(w: number, h: number, o: PatternOptions): string {
  return `${w}x${h}|${o.seed}|${o.family}|${o.paletteId}|${o.density ?? 2}|${(o.scale ?? 1).toFixed(2)}|${o.fillMode ?? "outline"}`;
}

/* ══════════════════════════════════════════════════════════════
   Public entry
══════════════════════════════════════════════════════════════ */

export function drawIslamicPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: PatternOptions,
): void {
  const key = cacheKey(w, h, opts);
  let layer = _cache.get(key);
  if (!layer) {
    layer = renderPattern(w, h, opts);
    if (_cache.size >= CACHE_MAX) {
      const first = _cache.keys().next().value;
      if (first) _cache.delete(first);
    }
    _cache.set(key, layer);
  }
  ctx.drawImage(layer as CanvasImageSource, 0, 0, w, h);
}

function renderPattern(
  w: number,
  h: number,
  o: PatternOptions,
): HTMLCanvasElement | OffscreenCanvas {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : (() => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        })();
  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
  const pal = getPalette(o.paletteId);
  const rng = mulberry32(o.seed || 1);

  paintGround(ctx as CanvasRenderingContext2D, w, h, pal);

  const family = o.family ?? "star";
  switch (family) {
    case "star":
      drawStarGrid(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
    case "girih":
      drawGirih(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
    case "arabesque":
      drawArabesque(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
    case "zellige":
      drawZellige(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
    case "muqarnas":
      drawMuqarnas(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
    case "arch":
      drawArch(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
    case "border":
      drawBorder(ctx as CanvasRenderingContext2D, w, h, rng, pal, o);
      break;
  }

  paintVignette(ctx as CanvasRenderingContext2D, w, h, pal);
  return canvas;
}

/* ── Ground + vignette ───────────────────────────────────────── */

function paintGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: PatternPalette,
): void {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, pal.bg);
  g.addColorStop(1, pal.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(
    w / 2, h / 2, 0,
    w / 2, h / 2, Math.max(w, h) * 0.6,
  );
  glow.addColorStop(0, rgba(pal.accent, 0.05));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function paintVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: PatternPalette,
): void {
  const v = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.25,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, rgba(pal.bg, 0.55));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/* ── Grid helpers ────────────────────────────────────────────── */

function gridMetrics(
  w: number,
  h: number,
  o: PatternOptions,
  baseCols: { 1: number; 2: number; 3: number },
): { cell: number; cols: number; rows: number } {
  const density = o.density ?? 2;
  const scale = o.scale ?? 1;
  const cols = Math.max(2, Math.round(baseCols[density] / scale));
  const cell = w / cols;
  const rows = Math.ceil(h / cell) + 1;
  return { cell, cols, rows };
}

function applyGlow(
  ctx: CanvasRenderingContext2D,
  o: PatternOptions,
  pal: PatternPalette,
  blur: number,
): void {
  if (o.fillMode === "glow") {
    ctx.shadowColor = rgba(pal.accent, 0.7);
    ctx.shadowBlur = blur;
  } else {
    ctx.shadowBlur = 0;
  }
}

/* ══════════════════════════════════════════════════════════════
   1. STAR ROSETTES — "stars & crosses" grid
══════════════════════════════════════════════════════════════ */

function rosettePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  n: number,
  innerRatio: number,
  rot: number,
): void {
  const r = R * innerRatio;
  ctx.beginPath();
  for (let i = 0; i < 2 * n; i++) {
    const ang = rot + (i * Math.PI) / n;
    const rad = i % 2 === 0 ? R : r;
    const x = cx + rad * Math.cos(ang);
    const y = cy + rad * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStarGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const { cell, cols, rows } = gridMetrics(w, h, o, { 1: 4, 2: 6, 3: 9 });
  const n = [8, 10, 12][Math.floor(rng() * 3)];
  const innerRatio = 0.4 + rng() * 0.12;
  const R = cell * 0.5;
  const rot = rng() * Math.PI;
  const lw = Math.max(1, cell * 0.018);

  ctx.lineJoin = "round";
  ctx.lineWidth = lw;

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const cx = col * cell;
      const cy = row * cell;

      applyGlow(ctx, o, pal, lw * 5);
      rosettePath(ctx, cx, cy, R, n, innerRatio, rot);
      if (o.fillMode === "solid") {
        ctx.fillStyle = rgba(pal.line, 0.07);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.line, 0.55);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // spokes to each outer point
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const ang = rot + (i * 2 * Math.PI) / n;
        ctx.moveTo(cx + R * innerRatio * 0.4 * Math.cos(ang), cy + R * innerRatio * 0.4 * Math.sin(ang));
        ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
      }
      ctx.strokeStyle = rgba(pal.line2, 0.28);
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
      ctx.lineWidth = lw;

      // central boss
      ctx.beginPath();
      ctx.arc(cx, cy, R * innerRatio * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal.accent, 0.5);
      ctx.stroke();
    }
  }

  // cross motifs at cell centres
  const cr = cell * 0.16;
  ctx.strokeStyle = rgba(pal.line2, 0.4);
  ctx.lineWidth = lw * 0.8;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * cell;
      const cy = (row + 0.5) * cell;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ang = rot + Math.PI / 4 + (i * Math.PI) / 2;
        ctx.moveTo(cx + cr * 0.3 * Math.cos(ang), cy + cr * 0.3 * Math.sin(ang));
        ctx.lineTo(cx + cr * Math.cos(ang), cy + cr * Math.sin(ang));
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   2. GIRIH — decagon + pentagon strapwork
══════════════════════════════════════════════════════════════ */

function polygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  sides: number,
  rot: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const ang = rot + (i * 2 * Math.PI) / sides;
    const x = cx + R * Math.cos(ang);
    const y = cy + R * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawGirih(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const { cell, cols, rows } = gridMetrics(w, h, o, { 1: 3, 2: 5, 3: 7 });
  const R = cell * 0.52;
  const rot = rng() * Math.PI;
  const lw = Math.max(1, cell * 0.02);
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const offset = row % 2 === 0 ? 0 : cell * 0.5;
      const cx = col * cell + offset;
      const cy = row * cell * 0.82;
      const isDeca = (row + col) % 2 === 0;

      if (isDeca) {
        applyGlow(ctx, o, pal, lw * 4);
        polygonPath(ctx, cx, cy, R, 10, rot);
        if (o.fillMode === "solid") {
          ctx.fillStyle = rgba(pal.fill, 0.5);
          ctx.fill();
        }
        ctx.strokeStyle = rgba(pal.line, 0.55);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // inner star formed by connecting every 3rd vertex
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a1 = rot + (i * 2 * Math.PI) / 10;
          const a2 = rot + (((i + 3) % 10) * 2 * Math.PI) / 10;
          ctx.moveTo(cx + R * Math.cos(a1), cy + R * Math.sin(a1));
          ctx.lineTo(cx + R * Math.cos(a2), cy + R * Math.sin(a2));
        }
        ctx.strokeStyle = rgba(pal.line2, 0.35);
        ctx.lineWidth = lw * 0.7;
        ctx.stroke();
        ctx.lineWidth = lw;
      } else {
        polygonPath(ctx, cx, cy, R * 0.62, 5, rot + Math.PI / 5);
        ctx.strokeStyle = rgba(pal.line2, 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(pal.accent, 0.4);
        ctx.stroke();
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   3. ARABESQUE — islimi vine scrollwork
══════════════════════════════════════════════════════════════ */

function drawArabesque(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const { cell, cols, rows } = gridMetrics(w, h, o, { 1: 3, 2: 4, 3: 6 });
  const lw = Math.max(1.2, cell * 0.022);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;

  const amp = cell * (0.32 + rng() * 0.12);

  for (let row = 0; row <= rows; row++) {
    const y0 = row * cell;
    const phase = rng() * Math.PI * 2;

    // main undulating vine across the row
    applyGlow(ctx, o, pal, lw * 4);
    ctx.beginPath();
    const steps = cols * 8;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * (w + cell) - cell * 0.5;
      const y = y0 + Math.sin((i / 8) * Math.PI + phase) * amp * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(pal.line, 0.5);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // curling tendrils + leaves at each crest
    for (let col = 0; col <= cols; col++) {
      const x = col * cell;
      const up = (col + row) % 2 === 0 ? 1 : -1;
      const cy = y0 + Math.sin((col * Math.PI) / 1 + phase) * amp * 0.5;

      // spiral tendril
      ctx.beginPath();
      const turns = 2.2;
      const tr = cell * 0.2;
      for (let t = 0; t <= 24; t++) {
        const a = (t / 24) * turns * Math.PI * 2;
        const rr = tr * (1 - t / 26);
        const px = x + Math.cos(a) * rr;
        const py = cy + up * Math.sin(a) * rr * 0.7 - up * tr * 0.4;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba(pal.line2, 0.42);
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();

      // leaf — two mirrored bezier petals
      ctx.beginPath();
      const lx = x;
      const ly = cy - up * tr * 0.9;
      ctx.moveTo(lx, ly);
      ctx.bezierCurveTo(
        lx + cell * 0.16, ly - up * cell * 0.14,
        lx + cell * 0.2, ly - up * cell * 0.02,
        lx + cell * 0.06, ly + up * cell * 0.04,
      );
      ctx.bezierCurveTo(
        lx + cell * 0.14, ly - up * cell * 0.02,
        lx + cell * 0.08, ly - up * cell * 0.1,
        lx, ly,
      );
      if (o.fillMode === "solid") {
        ctx.fillStyle = rgba(pal.line, 0.12);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.accent, 0.45);
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
      ctx.lineWidth = lw;
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   4. ZELLIGE — Moroccan cut-tile mosaic
══════════════════════════════════════════════════════════════ */

function drawZellige(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const { cell, cols, rows } = gridMetrics(w, h, o, { 1: 5, 2: 7, 3: 10 });
  const lw = Math.max(1, cell * 0.02);
  ctx.lineJoin = "round";

  const tones = [pal.fill, pal.bg2, rgba(pal.line, 0.16), rgba(pal.line2, 0.14)];

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const cx = col * cell;
      const cy = row * cell;
      const kind = Math.floor(rng() * 4);

      // alternating tile shapes: 8-point star, cross, diamond, square
      ctx.lineWidth = lw;
      if (kind === 0) {
        rosettePath(ctx, cx, cy, cell * 0.46, 8, 0.45, Math.PI / 8);
        ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
        ctx.fill();
        ctx.strokeStyle = rgba(pal.line, 0.5);
        ctx.stroke();
      } else if (kind === 1) {
        // plus / cross tile
        const a = cell * 0.16;
        const b = cell * 0.46;
        ctx.beginPath();
        ctx.moveTo(cx - a, cy - b); ctx.lineTo(cx + a, cy - b);
        ctx.lineTo(cx + a, cy - a); ctx.lineTo(cx + b, cy - a);
        ctx.lineTo(cx + b, cy + a); ctx.lineTo(cx + a, cy + a);
        ctx.lineTo(cx + a, cy + b); ctx.lineTo(cx - a, cy + b);
        ctx.lineTo(cx - a, cy + a); ctx.lineTo(cx - b, cy + a);
        ctx.lineTo(cx - b, cy - a); ctx.lineTo(cx - a, cy - a);
        ctx.closePath();
        ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
        ctx.fill();
        ctx.strokeStyle = rgba(pal.line2, 0.45);
        ctx.stroke();
      } else if (kind === 2) {
        polygonPath(ctx, cx, cy, cell * 0.42, 4, Math.PI / 4);
        ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
        ctx.fill();
        ctx.strokeStyle = rgba(pal.line, 0.4);
        ctx.stroke();
      } else {
        polygonPath(ctx, cx, cy, cell * 0.4, 4, 0);
        ctx.fillStyle = rgba(pal.bg2, 0.6);
        ctx.fill();
        ctx.strokeStyle = rgba(pal.line2, 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.14, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(pal.accent, 0.4);
        ctx.stroke();
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   5. MUQARNAS — honeycomb vaulting cells
══════════════════════════════════════════════════════════════ */

function drawMuqarnas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const { cell, cols } = gridMetrics(w, h, o, { 1: 5, 2: 7, 3: 10 });
  const lw = Math.max(1, cell * 0.018);
  const hexR = cell * 0.52;
  ctx.lineJoin = "round";
  ctx.lineWidth = lw;

  const vStep = cell * 0.86;
  for (let row = 0; row <= Math.ceil(h / vStep) + 1; row++) {
    for (let col = 0; col <= cols + 1; col++) {
      const offset = row % 2 === 0 ? 0 : cell * 0.5;
      const cx = col * cell + offset;
      const cy = row * vStep;

      // hexagon cell
      polygonPath(ctx, cx, cy, hexR, 6, Math.PI / 6);
      if (o.fillMode === "solid") {
        ctx.fillStyle = rgba(pal.fill, 0.4);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.line, 0.45);
      ctx.stroke();

      // tiered nested arcs inside (muqarnas corbelling)
      const tiers = 3;
      for (let t = 1; t <= tiers; t++) {
        const rr = hexR * (1 - t / (tiers + 1));
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a1 = Math.PI / 6 + (i * Math.PI) / 3;
          const a2 = Math.PI / 6 + ((i + 1) * Math.PI) / 3;
          const x1 = cx + rr * Math.cos(a1);
          const y1 = cy + rr * Math.sin(a1);
          const x2 = cx + rr * Math.cos(a2);
          const y2 = cy + rr * Math.sin(a2);
          ctx.moveTo(x1, y1);
          const mx = cx + rr * 0.72 * Math.cos((a1 + a2) / 2);
          const my = cy + rr * 0.72 * Math.sin((a1 + a2) / 2);
          ctx.quadraticCurveTo(mx, my, x2, y2);
        }
        ctx.strokeStyle = rgba(t % 2 === 0 ? pal.accent : pal.line2, 0.32);
        ctx.lineWidth = lw * 0.7;
        ctx.stroke();
      }
      ctx.lineWidth = lw;

      // centre drop
      ctx.beginPath();
      ctx.arc(cx, cy, hexR * 0.12, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal.accent, 0.5);
      ctx.stroke();
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   6. ARCH — mosque arcade of pointed arches
══════════════════════════════════════════════════════════════ */

function pointedArch(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  halfW: number,
  height: number,
): void {
  const apexY = baseY - height;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, baseY);
  ctx.lineTo(cx - halfW, baseY - height * 0.45);
  // left curve to apex
  ctx.bezierCurveTo(
    cx - halfW, baseY - height * 0.85,
    cx - halfW * 0.35, apexY - height * 0.06,
    cx, apexY,
  );
  // right curve down
  ctx.bezierCurveTo(
    cx + halfW * 0.35, apexY - height * 0.06,
    cx + halfW, baseY - height * 0.85,
    cx + halfW, baseY - height * 0.45,
  );
  ctx.lineTo(cx + halfW, baseY);
}

function drawArch(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const { cell, cols } = gridMetrics(w, h, o, { 1: 3, 2: 4, 3: 6 });
  const lw = Math.max(1.2, cell * 0.022);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lw;

  const rowH = cell * 1.35;
  const rows = Math.ceil(h / rowH) + 1;
  const halfW = cell * 0.42;
  const archH = cell * 1.05;

  for (let row = 0; row <= rows; row++) {
    const baseY = row * rowH + rowH;
    const offset = row % 2 === 0 ? 0 : cell * 0.5;
    for (let col = -1; col <= cols + 1; col++) {
      const cx = col * cell + offset;

      applyGlow(ctx, o, pal, lw * 4);
      pointedArch(ctx, cx, baseY, halfW, archH);
      if (o.fillMode === "solid") {
        ctx.fillStyle = rgba(pal.fill, 0.35);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(pal.line, 0.5);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // inner nested arch
      pointedArch(ctx, cx, baseY, halfW * 0.66, archH * 0.72);
      ctx.strokeStyle = rgba(pal.line2, 0.35);
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
      ctx.lineWidth = lw;

      // hanging lamp dot at apex
      const apexY = baseY - archH;
      ctx.beginPath();
      ctx.moveTo(cx, apexY + archH * 0.12);
      ctx.lineTo(cx, apexY + archH * 0.3);
      ctx.strokeStyle = rgba(pal.accent, 0.4);
      ctx.lineWidth = lw * 0.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, apexY + archH * 0.34, cell * 0.05, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal.accent, 0.55);
      ctx.stroke();
      ctx.lineWidth = lw;
    }
    // column baseline
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(w, baseY);
    ctx.strokeStyle = rgba(pal.line2, 0.3);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.lineWidth = lw;
  }
}

/* ══════════════════════════════════════════════════════════════
   7. BORDER — illuminated manuscript frame
══════════════════════════════════════════════════════════════ */

function drawBorder(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: () => number,
  pal: PatternPalette,
  o: PatternOptions,
): void {
  const pad = Math.min(w, h) * 0.06;
  const lw = Math.max(1.4, Math.min(w, h) * 0.004);
  ctx.lineJoin = "round";

  // faint interior field pattern — sparse rosettes
  const inner = gridMetrics(w, h, o, { 1: 3, 2: 4, 3: 5 });
  ctx.lineWidth = lw * 0.7;
  for (let row = 1; row < inner.rows; row++) {
    for (let col = 1; col < inner.cols; col++) {
      const cx = col * inner.cell;
      const cy = row * inner.cell;
      if (cx < pad || cx > w - pad || cy < pad || cy > h - pad) continue;
      rosettePath(ctx, cx, cy, inner.cell * 0.2, 8, 0.45, rng() * Math.PI);
      ctx.strokeStyle = rgba(pal.line2, 0.16);
      ctx.stroke();
    }
  }

  // outer rule
  applyGlow(ctx, o, pal, lw * 5);
  ctx.lineWidth = lw * 1.6;
  ctx.strokeStyle = rgba(pal.line, 0.7);
  ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
  ctx.shadowBlur = 0;

  // inner rule
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = rgba(pal.line, 0.4);
  ctx.strokeRect(pad * 1.5, pad * 1.5, w - pad * 3, h - pad * 3);

  // running motif along the band between the two rules
  const band = pad * 0.5;
  const mid = pad * 1.25;
  ctx.lineWidth = lw * 0.7;
  ctx.strokeStyle = rgba(pal.accent, 0.4);
  const step = Math.min(w, h) * 0.05;
  // top & bottom
  for (let x = pad * 1.6; x < w - pad * 1.6; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, mid - band * 0.3);
    ctx.lineTo(x + step * 0.5, mid + band * 0.3);
    ctx.lineTo(x + step, mid - band * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, h - mid + band * 0.3);
    ctx.lineTo(x + step * 0.5, h - mid - band * 0.3);
    ctx.lineTo(x + step, h - mid + band * 0.3);
    ctx.stroke();
  }

  // corner medallions
  const mr = pad * 0.7;
  const corners = [
    [pad, pad], [w - pad, pad], [pad, h - pad], [w - pad, h - pad],
  ];
  for (const [cx, cy] of corners) {
    applyGlow(ctx, o, pal, lw * 4);
    rosettePath(ctx, cx, cy, mr, 8, 0.45, Math.PI / 8);
    if (o.fillMode === "solid") {
      ctx.fillStyle = rgba(pal.line, 0.12);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(pal.line, 0.65);
    ctx.lineWidth = lw * 1.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, mr * 0.35, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(pal.accent, 0.55);
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
  }

  // top-centre headpiece (unwan)
  const hw = Math.min(w * 0.3, pad * 5);
  const hy = pad;
  ctx.beginPath();
  ctx.moveTo(w / 2 - hw, hy);
  ctx.quadraticCurveTo(w / 2, hy - pad * 0.9, w / 2 + hw, hy);
  ctx.strokeStyle = rgba(pal.accent, 0.5);
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  ctx.lineWidth = lw;
}
