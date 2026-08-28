/**
 * fonts-ready.ts
 *
 * Ensures the fonts used by canvas rendering are fully loaded before the
 * canvas draws text with them. Prevents the "fallback font" issue on
 * mobile devices where web fonts load asynchronously.
 *
 * Selective: only the Arabic + translation families actually referenced by
 * the passed settings are fetched, so generation no longer downloads all
 * ~35 font files regardless of what the user chose. No argument = the
 * default pair (Amiri + Inter). Results are cached per family set.
 */

type FontSpec = {
  fontFamily?: string;
  translationFontFamily?: string;
};

/* Weights the canvas actually draws with, per family. Families absent
   from this map are system fonts (e.g. Georgia) — nothing to fetch. */
const WEIGHTS: Record<string, string[]> = {
  Amiri: ["400", "700"],
  "Scheherazade New": ["400", "700"],
  "Noto Naskh Arabic": ["400", "700"],
  "Noto Kufi Arabic": ["400", "700"],
  Cairo: ["400", "600", "700"],
  Tajawal: ["400", "700"],
  Lateef: ["400", "700"],
  "Reem Kufi": ["400", "700"],
  Inter: ["400", "600"],
  Poppins: ["400", "500", "600"],
  "JetBrains Mono": ["400", "500"],
  Lato: ["400", "700"],
  "Playfair Display": ["400", "600"],
  Merriweather: ["400", "700"],
  Nunito: ["400", "600"],
};

function familyFromStack(stack: string | undefined): string | null {
  if (!stack) return null;
  const quoted = stack.match(/['"]([^'"]+)['"]/);
  if (quoted) return quoted[1];
  const first = stack.split(",")[0].trim();
  return first || null;
}

const _cache = new Map<string, Promise<void>>();

export function ensureFontsReady(settings?: FontSpec): Promise<void> {
  const families = [
    familyFromStack(settings?.fontFamily) ?? "Amiri",
    familyFromStack(settings?.translationFontFamily) ?? "Inter",
  ];
  const key = [...new Set(families)].sort().join("|");
  const cached = _cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    if (typeof document === "undefined") return;
    const fontSet = (document as any).fonts;
    if (!fontSet?.load) return;

    // First wait for the document's font set to be ready
    await fontSet.ready;

    const jobs: Promise<unknown>[] = [];
    for (const family of families) {
      const weights = WEIGHTS[family];
      if (!weights) continue; // system font — instant, nothing to fetch
      for (const weight of weights) {
        jobs.push(fontSet.load(`${weight} 16px "${family}"`).catch(() => {}));
      }
    }
    await Promise.all(jobs);
  })();

  _cache.set(key, promise);
  return promise;
}
