/**
 * fonts.ts — registers bundled TTFs with @napi-rs/canvas's GlobalFontManager.
 * Families are registered under the exact names the app's settings use
 * ('Amiri', 'Scheherazade New', 'Noto Naskh Arabic'), so vendored
 * canva-utils code measures/draws with identical font binaries.
 */
import { GlobalFonts } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FONTS_DIR = join(__dirname, "..", "fonts");

type FontSpec = { file: string; family: string; alias?: string[] };

const SPECS: FontSpec[] = [
  { file: "amiri.ttf", family: "Amiri" },
  { file: "amiri-bold.ttf", family: "Amiri Bold" },
  { file: "scholarazade.ttf", family: "Scheherazade New" },
  { file: "naskh-var.ttf", family: "Noto Naskh Arabic" },
];

let registered = false;

export function ensureFonts(): void {
  if (registered) return;
  for (const spec of SPECS) {
    const data = readFileSync(join(FONTS_DIR, spec.file));
    GlobalFonts.register(data, spec.family);
  }
  // Register the bold face as its own family too — ctx.font strings like
  // "bold 26px Amiri" resolve through the primary family; when only one
  // weight is registered under "Amiri", canvas synthesizes faux-bold.
  // Registering both 400 ("Amiri") and the 700 face under "Amiri" makes
  // napi-rs pick the real bold face.
  try {
    const bold = readFileSync(join(FONTS_DIR, "amiri-bold.ttf"));
    GlobalFonts.register(bold, "Amiri");
  } catch {
    /* best-effort */
  }
  registered = true;
}
