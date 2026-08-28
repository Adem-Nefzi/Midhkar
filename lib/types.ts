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
  // Watermark
  showWatermark: boolean;
  watermarkText: string;
  // NEW: Text effects
  textGlow: boolean;          // golden glow behind Arabic text
  textOutline: boolean;       // thin outline around Arabic letters
  // NEW: Frame decoration
  frameStyle: "none" | "corners" | "full" | "arch"; // decorative border on video
  // NEW: Verse transition style
  verseSpacing: number;       // extra seconds of silence between ayahs 0–3
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
  translationFontFamily: "'Inter', 'Lato', sans-serif",
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
  showWatermark: false,
  watermarkText: "",
  textGlow: false,
  textOutline: false,
  frameStyle: "corners",
  verseSpacing: 0,
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

export const ARABIC_FONTS = [
  { id: "amiri",         name: "Amiri",           nameAr: "أميري",         family: "'Amiri', serif" },
  { id: "scheherazade",  name: "Scheherazade",     nameAr: "شهرزاد",        family: "'Scheherazade New', serif" },
  { id: "noto-naskh",   name: "Noto Naskh",       nameAr: "نوتو نسخ",      family: "'Noto Naskh Arabic', serif" },
  { id: "noto-kufi",    name: "Noto Kufi",        nameAr: "نوتو كوفي",     family: "'Noto Kufi Arabic', sans-serif" },
  { id: "cairo",        name: "Cairo",            nameAr: "القاهرة",       family: "'Cairo', sans-serif" },
  { id: "tajawal",      name: "Tajawal",          nameAr: "تجوال",         family: "'Tajawal', sans-serif" },
  { id: "lateef",       name: "Lateef",           nameAr: "لطيف",          family: "'Lateef', serif" },
  { id: "reem-kufi",    name: "Reem Kufi",        nameAr: "ريم كوفي",      family: "'Reem Kufi', sans-serif" },
] as const;

/* ── Translation / Latin fonts ───────────────────────────────── */

export const LATIN_FONTS = [
  { id: "inter",        name: "Inter",            family: "'Inter', sans-serif" },
  { id: "poppins",      name: "Poppins",          family: "'Poppins', sans-serif" },
  { id: "jetbrains",    name: "JetBrains Mono",   family: "'JetBrains Mono', monospace" },
  { id: "georgia",      name: "Georgia",          family: "'Georgia', 'Times New Roman', serif" },
  { id: "lato",         name: "Lato",             family: "'Lato', sans-serif" },
  { id: "playfair",     name: "Playfair Display", family: "'Playfair Display', serif" },
  { id: "merriweather", name: "Merriweather",     family: "'Merriweather', serif" },
  { id: "nunito",       name: "Nunito",           family: "'Nunito', sans-serif" },
  { id: "amiri-latin",  name: "Amiri",            family: "'Amiri', serif" },
] as const;

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
