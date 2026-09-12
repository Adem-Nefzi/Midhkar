/**
 * fonts.ts â€” registers the bundled TTFs with @napi-rs/canvas's
 * GlobalFontManager under the exact family names the app's settings
 * use, so vendored canva-utils measures/draws with identical font
 * binaries as the client.
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
import { SERVER_WEIGHTS, ALL_CANVAS_FAMILIES, getServerWeights } from "@/lib/font-spec";

function candidateFontDirs(): string[] {
  const dirs: string[] = [];
  /* Lambda (Vercel) + local next dev: project-relative layout. */
  dirs.push(join(process.cwd(), "lib", "server", "server-canvas", "fonts"));
  /* Repo-relative to this compiled module (dev, non-bundled run). */
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    dirs.push(join(here, "fonts"));
  } catch {
    /* webpack transform â€” ignore */
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

let registered = false;

export function ensureFonts(): void {
  if (registered) return;
  if (!FONTS_DIR) {
    throw new Error(
      "Font binaries not found â€” expected lib/server/server-canvas/fonts in the bundle",
    );
  }
  /* Register all families with all their required weights */
  for (const family of ALL_CANVAS_FAMILIES) {
    const weights = getServerWeights(family);
    for (const weight of weights) {
      const fileName = weight === "400" 
        ? `${family.toLowerCase().replace(/\s+/g, "-")}.ttf`
        : `${family.toLowerCase().replace(/\s+/g, "-")}-${weight}.ttf`;
      try {
        const data = readFileSync(join(FONTS_DIR, fileName));
        GlobalFonts.register(data, family);
      } catch {
        /* font file may not exist for every weight â€” try common naming */
        try {
          const altName = family.toLowerCase().replace(/\s+/g, "-");
          const altFile = weight === "400" 
            ? `${altName}.ttf` 
            : `${altName}-${weight}.ttf`;
          const data = readFileSync(join(FONTS_DIR, altFile));
          GlobalFonts.register(data, family);
        } catch {
          console.warn(`[fonts] Could not load ${family} ${weight}`);
        }
      }
    }
  }
  /* Also register Amiri Bold under "Amiri" for bold fallback */
  try {
    const bold = readFileSync(join(FONTS_DIR, "amiri-bold.ttf"));
    GlobalFonts.register(bold, "Amiri");
  } catch {
    /* best-effort */
  }
  registered = true;
}
