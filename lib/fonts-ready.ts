/**
 * fonts-ready.ts
 *
 * Ensures all Arabic + Latin fonts used in canvas rendering are fully loaded
 * before the canvas tries to use them. This prevents the "fallback font" issue
 * on mobile devices where web fonts load asynchronously.
 */

const FONTS_TO_ENSURE = [
  // Arabic fonts (with weights used by the canvas)
  { family: "Amiri", weight: "400" },
  { family: "Amiri", weight: "700" },
  { family: "Scheherazade New", weight: "400" },
  { family: "Scheherazade New", weight: "700" },
  { family: "Noto Naskh Arabic", weight: "400" },
  { family: "Noto Naskh Arabic", weight: "700" },
  { family: "Noto Kufi Arabic", weight: "400" },
  { family: "Noto Kufi Arabic", weight: "700" },
  { family: "Cairo", weight: "400" },
  { family: "Cairo", weight: "600" },
  { family: "Cairo", weight: "700" },
  { family: "Tajawal", weight: "400" },
  { family: "Tajawal", weight: "700" },
  { family: "Lateef", weight: "400" },
  { family: "Lateef", weight: "700" },
  { family: "Reem Kufi", weight: "400" },
  { family: "Reem Kufi", weight: "700" },
  // Latin fonts
  { family: "Inter", weight: "400" },
  { family: "Inter", weight: "600" },
  { family: "Lato", weight: "400" },
  { family: "Lato", weight: "700" },
  { family: "Playfair Display", weight: "400" },
  { family: "Playfair Display", weight: "600" },
  { family: "Merriweather", weight: "400" },
  { family: "Merriweather", weight: "700" },
  { family: "Nunito", weight: "400" },
  { family: "Nunito", weight: "600" },
];

let _fontsReady: Promise<void> | null = null;

/**
 * Returns a promise that resolves when ALL canvas-relevant fonts are loaded.
 * Cached so repeated calls don't re-trigger font loading checks.
 */
export function ensureFontsReady(): Promise<void> {
  if (_fontsReady) return _fontsReady;

  _fontsReady = (async () => {
    if (typeof document === "undefined") return;

    // First wait for the document's font set to be ready
    await (document as any).fonts.ready;

    // Then explicitly load each font to make sure it's available for canvas
    const fontSet = (document as any).fonts;
    if (!fontSet?.load) return;

    await Promise.all(
      FONTS_TO_ENSURE.map(({ family, weight }) =>
        fontSet.load(`${weight} 16px "${family}"`).catch(() => {}),
      ),
    );
  })();

  return _fontsReady;
}
