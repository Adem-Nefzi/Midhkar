/**
 * fonts.ts — registers the bundled TTFs with @napi-rs/canvas's
 * GlobalFontManager under the exact family names the app's settings
 * use, so vendored canva-utils measures/draws with identical font
 * binaries as the client. Port of render-service/src/canvas/fonts.ts.
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
    /* webpack transform — ignore */
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
  { file: "amiri.ttf", family: "Amiri" },
  { file: "amiri-bold.ttf", family: "Amiri Bold" },
  { file: "scholarazade.ttf", family: "Scheherazade New" },
  { file: "naskh-var.ttf", family: "Noto Naskh Arabic" },
];

let registered = false;

export function ensureFonts(): void {
  if (registered) return;
  if (!FONTS_DIR) {
    throw new Error(
      "Font binaries not found — expected lib/server/server-canvas/fonts in the bundle",
    );
  }
  for (const spec of SPECS) {
    const data = readFileSync(join(FONTS_DIR, spec.file));
    GlobalFonts.register(data, spec.family);
  }
  // Register the bold face under the primary family too, so ctx.font
  // strings like "bold 26px Amiri" resolve to the real 700 face
  // instead of canvas-synthesized faux-bold.
  try {
    const bold = readFileSync(join(FONTS_DIR, "amiri-bold.ttf"));
    GlobalFonts.register(bold, "Amiri");
  } catch {
    /* best-effort */
  }
  registered = true;
}
