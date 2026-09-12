/**
 * Shared font specification — single source of truth for font families
 * used by both client (LivePreview) and server (render-chunk).
 * Ensures pixel-perfect font matching between preview and final render.
 */

export type FontWeight = "400" | "500" | "600" | "700";

export interface FontSpec {
  /** CSS font-family string (for client CSS) */
  readonly cssFamily: string;
  /** Exact family name registered with @napi-rs/canvas GlobalFontManager */
  readonly canvasFamily: string;
  /** Available weights for this family */
  readonly weights: readonly FontWeight[];
}

/** Canonical font families — single source of truth */
export const FONT_SPECS: readonly FontSpec[] = [
  {
    cssFamily: "'Amiri', 'Scheherazade New', serif",
    canvasFamily: "Amiri",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Scheherazade New', serif",
    canvasFamily: "Scheherazade New",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Noto Naskh Arabic', serif",
    canvasFamily: "Noto Naskh Arabic",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Noto Kufi Arabic', serif",
    canvasFamily: "Noto Naskh Arabic",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Cairo', sans-serif",
    canvasFamily: "Cairo",
    weights: ["400", "600", "700"],
  },
  {
    cssFamily: "'Tajawal', sans-serif",
    canvasFamily: "Tajawal",
    weights: ["400", "600", "700"],
  },
  {
    cssFamily: "'Lateef', serif",
    canvasFamily: "Lateef",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Reem Kufi', sans-serif",
    canvasFamily: "Reem Kufi",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Inter', 'Lato', sans-serif",
    canvasFamily: "Inter",
    weights: ["400", "500", "600", "600"],
  },
  {
    cssFamily: "'Poppins', sans-serif",
    canvasFamily: "Poppins",
    weights: ["400", "500", "600", "700"],
  },
  {
    cssFamily: "'JetBrains Mono', monospace",
    canvasFamily: "JetBrains Mono",
    weights: ["400", "500"],
  },
  {
    cssFamily: "'Georgia', serif",
    canvasFamily: "Georgia",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Lato', sans-serif",
    canvasFamily: "Lato",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Playfair Display', serif",
    canvasFamily: "Playfair Display",
    weights: ["400", "600"],
  },
  {
    cssFamily: "'Merriweather', serif",
    canvasFamily: "Merriweather",
    weights: ["400", "700"],
  },
  {
    cssFamily: "'Nunito', sans-serif",
    canvasFamily: "Nunito",
    weights: ["400", "600"],
  },
  {
    cssFamily: "'Amiri', serif",
    canvasFamily: "Amiri",
    weights: ["400", "700"],
  },
] as const;

/** All weights the server must register for each canvas family */
export const SERVER_WEIGHTS: ReadonlyMap<string, readonly FontWeight[]> = new Map([
  ["Amiri", ["400", "700"] as const],
  ["Scheherazade New", ["400", "700"] as const],
  ["Noto Naskh Arabic", ["400", "700"] as const],
  ["Cairo", ["400", "600", "700"] as const],
  ["Tajawal", ["400", "600", "700"] as const],
  ["Lateef", ["400", "700"] as const],
  ["Reem Kufi", ["400", "700"] as const],
  ["Inter", ["400", "500", "600"] as const],
  ["Poppins", ["400", "500", "600", "700"] as const],
  ["JetBrains Mono", ["400", "500"] as const],
  ["Georgia", ["400", "700"] as const],
  ["Lato", ["400", "700"] as const],
  ["Playfair Display", ["400", "600"] as const],
  ["Merriweather", ["400", "700"] as const],
  ["Nunito", ["400", "600"] as const],
  ["Amiri", ["400", "700"] as const],
]);

/** Get the weights that must be registered for a given canvas family */
export function getServerWeights(family: string): readonly FontWeight[] {
  return SERVER_WEIGHTS.get(family) ?? (["400", "700"] as const);
}

/** Get the CSS font-family string for a given canvas family */
export function getCssFamily(canvasFamily: string): string {
  const spec = FONT_SPECS.find((f) => f.canvasFamily === canvasFamily);
  return spec?.cssFamily ?? "'Amiri', 'Scheherazade New', serif";
}

/** All canvas family names that must be registered on the server */
export const ALL_CANVAS_FAMILIES: readonly string[] = [
  "Amiri",
  "Scheherazade New",
  "Noto Naskh Arabic",
  "Cairo",
  "Tajawal",
  "Lateef",
  "Reem Kufi",
  "Inter",
  "Poppins",
  "JetBrains Mono",
  "Georgia",
  "Lato",
  "Playfair Display",
  "Merriweather",
  "Nunito",
  "Amiri",
] as const;