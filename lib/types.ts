/**
 * types.ts
 * Shared TypeScript types for the VideoBuilder feature.
 */

export interface VideoSettings {
  // Core
  background: string;
  platform: string;
  // Audio/text display
  showTranslation: boolean;
  translationLang: string;
  // Arabic text
  fontFamily: string;
  textColor: string;
  textOpacity: number;
  textPosition: string;
  // Translation
  translationFontFamily: string;
  translationColor: string;
  translationOpacity: number;
  // Badges
  showSurahName: boolean;
  showVerseNumber: boolean;
  // Background video
  uploadedVideoUrl: string | null;
  uploadedVideoFile: File | null;
  videoUrl: string | null;
  /** Ordered playlist of background videos (library/pexels). index 0 = first. */
  videoUrls: string[];
  // Effects
  textShadow: boolean;
  bgOverlay: number;         // 0–80 %
  fontSize: "small" | "medium" | "large";
  overlayStyle: "none" | "linear" | "radial";
  // Effect depth (professional controls)
  textGlowIntensity: number;   // 0–100, scales glow blur/alpha
  textShadowIntensity: number;  // 0–100, scales shadow blur/offset
  textOutlineWidth: number;     // 1–5, scales outline stroke
  // Watermark
  showWatermark: boolean;
  watermarkText: string;
  watermarkPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  // Export quality
  exportQuality: "standard" | "balanced" | "high";
  // NEW: Vignette (darkened frame edges), 0–100 %
  vignette: number;
  // NEW: Text effects
  textGlow: boolean;          // golden glow behind Arabic text
  textOutline: boolean;       // thin outline around Arabic letters
  // NEW: Frame decoration
  frameStyle: "none" | "corners" | "full" | "arch"; // decorative border on video
  // NEW: Verse transition style
  verseSpacing: number;       // extra seconds of silence between ayahs 0–3
  // NEW: Long-verse pager (auto = split long verses into recitation-synced pages)
  verseDisplay: "auto" | "full";
  // NEW: Text animation
  textAnimation: "none" | "fade"; // entrance animation for verse text
  // NEW: Background color (used when background = "color")
  bgColor: string;            // hex, e.g. "#0a0a0f"
  bgColorSecondary: string;   // hex for gradient end
  bgGradientAngle: number;    // 0–360 degrees
  // NEW: Verse transition style
  transitionStyle: "none" | "fade" | "slide" | "scale";
  // NEW: Procedural Islamic pattern background (background = "pattern")
  patternSeed: number;
  patternFamily: "star" | "girih" | "arabesque" | "zellige" | "muqarnas" | "arch" | "border";
  patternPalette: string;
  patternDensity: 1 | 2 | 3;
  patternScale: number;       // 0.6 – 1.8
  patternFillMode: "outline" | "solid" | "glow";
}

export interface GenLog {
  id: number; // unique per entry — React key (msg+pct can repeat)
  msg: string;
  pct: number; // 0–100, or -1 for error
}

export const DEFAULT_SETTINGS: VideoSettings = {
  background: "pexels",
  platform: "",              // empty = not yet chosen (blocks step 4)
  showTranslation: true,
  translationLang: "en",
  fontFamily: "'Amiri', 'Scheherazade New', serif",
  textColor: "#d4af37",
  textOpacity: 100,
  textPosition: "center",
  translationFontFamily: "'Inter', 'Amiri', sans-serif",
  translationColor: "#f5f0e8",
  translationOpacity: 80,
  showSurahName: true,
  showVerseNumber: true,
  uploadedVideoUrl: null,
  uploadedVideoFile: null,
  videoUrl: null,
  videoUrls: [],
  textShadow: true,
  bgOverlay: 35,
  fontSize: "medium",
  overlayStyle: "linear",
  textGlowIntensity: 100,
  textShadowIntensity: 100,
  textOutlineWidth: 3,
  showWatermark: false,
  watermarkText: "",
  watermarkPosition: "bottom-right",
  exportQuality: "balanced",
  vignette: 0,
  textGlow: false,
  textOutline: false,
  frameStyle: "corners",
  verseSpacing: 0,
  verseDisplay: "auto",
  textAnimation: "fade",
  bgColor: "#09090f",
  bgColorSecondary: "#1a0e00",
  bgGradientAngle: 135,
  transitionStyle: "fade",
  patternSeed: 108,
  patternFamily: "star",
  patternPalette: "night-gold",
  patternDensity: 2,
  patternScale: 1,
  patternFillMode: "glow",
};

/* ── Arabic fonts ────────────────────────────────────────────── */

/* Quranic-mark glyph audit (cmap, 2026-10): Cairo, Tajawal, Almarai,
   Changa, El Messiri, Markazi, Reem Kufi and Aref Ruqaa lack the waqf
   annotation signs (U+06D6…U+06E6) — Tajawal also lacks ٱ (U+0671).
   Every stack therefore carries 'Amiri' as a per-glyph fallback: it
   covers the full Uthmani set and is registered in BOTH the browser
   (globals.css + fonts-ready.ts) and the server canvas (fonts.ts).
   Browser canvas and napi-rs/skia both resolve missing glyphs down
   this chain — without it those marks render as blank boxes. */
export const ARABIC_FONTS = [
  { id: "amiri",         name: "Amiri",           nameAr: "أميري",         family: "'Amiri', serif" },
  { id: "amiri-quran",   name: "Amiri Quran",     nameAr: "أميري قرآن",    family: "'Amiri Quran', 'Amiri', serif" },
  { id: "scheherazade",  name: "Scheherazade",     nameAr: "شهرزاد",        family: "'Scheherazade New', 'Amiri', serif" },
  { id: "noto-naskh",   name: "Noto Naskh",       nameAr: "نوتو نسخ",      family: "'Noto Naskh Arabic', 'Amiri', serif" },
  { id: "noto-kufi",    name: "Noto Kufi",        nameAr: "نوتو كوفي",     family: "'Noto Kufi Arabic', 'Amiri', sans-serif" },
  { id: "noto-sans-ar", name: "Noto Sans Arabic", nameAr: "نوتو سانس عربي",  family: "'Noto Sans Arabic', 'Amiri', sans-serif" },
  { id: "ibm-plex-ar",  name: "IBM Plex Arabic",  nameAr: "آي بي إم بليكس",   family: "'IBM Plex Sans Arabic', 'Amiri', sans-serif" },
  { id: "cairo",        name: "Cairo",            nameAr: "القاهرة",       family: "'Cairo', 'Amiri', sans-serif" },
  { id: "tajawal",      name: "Tajawal",          nameAr: "تجوال",         family: "'Tajawal', 'Amiri', sans-serif" },
  { id: "almarai",      name: "Almarai",          nameAr: "المرعي",        family: "'Almarai', 'Amiri', sans-serif" },
  { id: "changa",       name: "Changa",           nameAr: "تشانغا",        family: "'Changa', 'Amiri', sans-serif" },
  { id: "el-messiri",   name: "El Messiri",       nameAr: "المسيري",       family: "'El Messiri', 'Amiri', sans-serif" },
  { id: "markazi",      name: "Markazi Text",     nameAr: "مرکزي",         family: "'Markazi Text', 'Amiri', serif" },
  { id: "lateef",       name: "Lateef",           nameAr: "لطيف",          family: "'Lateef', 'Amiri', serif" },
  { id: "reem-kufi",    name: "Reem Kufi",        nameAr: "ريم كوفي",      family: "'Reem Kufi', 'Amiri', sans-serif" },
  { id: "aref-ruqaa",   name: "Aref Ruqaa",       nameAr: "عارف رقعة",     family: "'Aref Ruqaa', 'Amiri', serif" },
] as const;

/* ── Translation / Latin fonts ───────────────────────────────── */

export const LATIN_FONTS = [
  { id: "inter",        name: "Inter",            family: "'Inter', 'Amiri', sans-serif" },
  { id: "poppins",      name: "Poppins",          family: "'Poppins', 'Amiri', sans-serif" },
  { id: "jetbrains",    name: "JetBrains Mono",   family: "'JetBrains Mono', 'Amiri', monospace" },
  { id: "georgia",      name: "Georgia",          family: "'Georgia', 'Times New Roman', 'Amiri', serif" },
  { id: "lato",         name: "Lato",             family: "'Lato', 'Amiri', sans-serif" },
  { id: "playfair",     name: "Playfair Display", family: "'Playfair Display', 'Amiri', serif" },
  { id: "merriweather", name: "Merriweather",     family: "'Merriweather', 'Amiri', serif" },
  { id: "nunito",       name: "Nunito",           family: "'Nunito', 'Amiri', sans-serif" },
  { id: "amiri-latin",  name: "Amiri",            family: "'Amiri', serif" },
] as const;

/** Default translation font when the translation language is Arabic
 *  (tafsir). Latin-only picks would render every glyph as a box on the
 *  server canvas — this stack always resolves Arabic. */
export const AR_TRANSLATION_FONT = "'IBM Plex Sans Arabic', 'Amiri', sans-serif";

/* ── Platform definitions (canonical source of truth) ───────── */

/** Minimal platform reference passed through the render/encode pipeline. */
export interface Platform {
  id: string;
  label: string;
  aspect: string;
}

export const PLATFORM_META = {
  youtube:   { label: "YouTube Shorts",   aspect: "9:16", icon: "▶",  color: "#FF0000" },
  instagram: { label: "Instagram Reel",   aspect: "9:16", icon: "◈",  color: "#E1306C" },
  tiktok:    { label: "TikTok",           aspect: "9:16", icon: "♪",  color: "#69C9D0" },
  facebook:  { label: "Facebook",         aspect: "1:1",  icon: "ƒ",  color: "#1877F2" },
  landscape: { label: "Widescreen 16:9",  aspect: "16:9", icon: "⬛", color: "#C9A84C" },
} as const;

export type PlatformId = keyof typeof PLATFORM_META;

/* ── Draft / Resume — REMOVED (auto-save feature deleted per user
   request). Legacy localStorage keys are wiped on app mount. ──── */

/* ── Presets — REMOVED (Quick Themes deleted with the Color bg) ── */
