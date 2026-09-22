/**
 * fonts.ts — registers the bundled TTFs with @napi-rs/canvas's
 * GlobalFontManager under the exact family names the app's settings
 * use, so vendored canva-utils measures/draws with identical font
 * binaries as the client. Every family offered by ARABIC_FONTS /
 * LATIN_FONTS in lib/types.ts is covered — a missing family falls
 * back to sans-serif on the lambda while the browser preview shows
 * the real font (the "wrong font in download" bug).
 *
 * Weights registered = weights the canvas actually draws with:
 *   - Arabic ayah text: unprefixed (400)
 *   - Translation: 600 (Lato/Merriweather have no 600 — the nearest
 *     faces are bundled so skia matches CSS font-matching rules)
 *   - Verse badge: bold (700) Noto Naskh Arabic
 *   - Georgia is proprietary: Gelasio (metric-compatible, OFL) is
 *     registered under the family name "Georgia".
 *
 * Path resolution must NOT rely on import.meta.url: inside the
 * serverless webpack bundle it resolves to the BUILD-time path
 * (/vercel/path0/...), which doesn't exist in the lambda. The lambda
 * extracts nft-traced files at project-relative paths with
 * process.cwd() as root, so cwd-relative resolution is the reliable
 * strategy; __dirname fallback keeps local `next dev` working.
 */
import { GlobalFonts } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function candidateFontDirs(): string[] {
  const dirs: string[] = [];
  /* Lambda (Vercel) + local next dev: project-relative layout. */
  dirs.push(join(process.cwd(), "lib", "server", "server-canvas", "fonts"));
  /* Repo-relative to this compiled module (dev, non-bundled run). */
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    dirs.push(join(here, "fonts"));
  } catch {
    /* webpack transform - ignore */
  }
  return dirs;
}

function resolveFontDir(): string | null {
  for (const dir of candidateFontDirs()) {
    try {
      readFileSync(join(dir, "amiri.ttf"));
      return dir;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export const FONTS_DIR: string | null = resolveFontDir();

type FontSpec = { file: string; family: string };

const SPECS: FontSpec[] = [
  /* Arabic (ayah text @400; Amiri Bold + Naskh Bold for faux-bold-free faces) */
  { file: "amiri.ttf", family: "Amiri" },
  { file: "amiri-bold.ttf", family: "Amiri" },
  { file: "scholarazade.ttf", family: "Scheherazade New" },
  { file: "naskh-var.ttf", family: "Noto Naskh Arabic" },
  { file: "notonaskharabic-700.ttf", family: "Noto Naskh Arabic" },
  { file: "notokufi-arabic-400.ttf", family: "Noto Kufi Arabic" },
  { file: "cairo-400.ttf", family: "Cairo" },
  { file: "tajawal-400.ttf", family: "Tajawal" },
  { file: "lateef-400.ttf", family: "Lateef" },
  { file: "reemkufi-400.ttf", family: "Reem Kufi" },
  /* Translation (drawn at weight 600) */
  { file: "inter-600.ttf", family: "Inter" },
  { file: "poppins-600.ttf", family: "Poppins" },
  { file: "jetbrainsmono-600.ttf", family: "JetBrains Mono" },
  { file: "gelasio-600.ttf", family: "Georgia" },
  { file: "lato-700.ttf", family: "Lato" },
  { file: "playfairdisplay-600.ttf", family: "Playfair Display" },
  { file: "merriweather-600.ttf", family: "Merriweather" },
  { file: "nunito-600.ttf", family: "Nunito" },
];

let registered = false;

export function ensureFonts(): void {
  if (registered) return;
  if (!FONTS_DIR) {
    throw new Error(
      "Font binaries not found - expected lib/server/server-canvas/fonts in the bundle",
    );
  }
  for (const spec of SPECS) {
    const data = readFileSync(join(FONTS_DIR, spec.file));
    GlobalFonts.register(data, spec.family);
  }
  registered = true;
}
