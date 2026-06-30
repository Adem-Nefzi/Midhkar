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
  videoThumb: string | null;
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
}

export interface GenLog {
  msg: string;
  pct: number; // 0–100, or -1 for error
}

export const DEFAULT_SETTINGS: VideoSettings = {
  background: "library",
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
  videoThumb: null,
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
  { id: "lato",         name: "Lato",             family: "'Lato', sans-serif" },
  { id: "playfair",     name: "Playfair Display", family: "'Playfair Display', serif" },
  { id: "merriweather", name: "Merriweather",     family: "'Merriweather', serif" },
  { id: "nunito",       name: "Nunito",           family: "'Nunito', sans-serif" },
  { id: "amiri-latin",  name: "Amiri",            family: "'Amiri', serif" },
] as const;

// Legacy alias so existing imports still work
export const FONTS = ARABIC_FONTS;

/* ── Platform definitions (canonical source of truth) ───────── */
// (also in quran.ts — keep in sync or move fully here)

export const PLATFORM_META = {
  youtube:   { label: "YouTube Shorts",   aspect: "9:16", icon: "▶",  color: "#FF0000", dims: "720×1280" },
  instagram: { label: "Instagram Reel",   aspect: "9:16", icon: "◈",  color: "#E1306C", dims: "720×1280" },
  tiktok:    { label: "TikTok",           aspect: "9:16", icon: "♪",  color: "#69C9D0", dims: "720×1280" },
  facebook:  { label: "Facebook",         aspect: "1:1",  icon: "ƒ",  color: "#1877F2", dims: "1080×1080" },
  landscape: { label: "Widescreen 16:9",  aspect: "16:9", icon: "⬛", color: "#C9A84C", dims: "1280×720" },
} as const;

export type PlatformId = keyof typeof PLATFORM_META;

/* ── Draft / Resume ───────────────────────────────────────────── */

export interface Draft {
  step: 1 | 2 | 3 | 4;
  settings: VideoSettings;
  surahNumber: number;
  selectedNums: number[];
  reciterIdentifier: string | null;
  reciterSource: string | null;
  savedAt: number;
}

export const DRAFT_KEY = "midhkar-draft";

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full or unavailable */ }
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    // 24h expiry
    if (Date.now() - parsed.savedAt > 86400000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
}

/* ── Presets ──────────────────────────────────────────────────── */

export interface Preset {
  id: string;
  nameEn: string;
  nameAr: string;
  emoji: string;
  settings: Partial<VideoSettings>;
}

export const PRESETS: Preset[] = [
  {
    id: "ramadan-night",
    nameEn: "Ramadan Night",
    nameAr: "ليلة رمضان",
    emoji: "🌙",
    settings: {
      bgColor: "#0a0015",
      bgColorSecondary: "#1a0a2e",
      textColor: "#ffd700",
      fontFamily: "'Noto Naskh Arabic', serif",
      bgOverlay: 40,
      overlayStyle: "radial",
      frameStyle: "arch",
      textGlow: true,
      textShadow: true,
      textAnimation: "fade",
    },
  },
  {
    id: "medina-sunrise",
    nameEn: "Medina Sunrise",
    nameAr: "شروق المدينة",
    emoji: "🌅",
    settings: {
      bgColor: "#1a0a00",
      bgColorSecondary: "#3d1c00",
      textColor: "#f5c542",
      fontFamily: "'Amiri', serif",
      bgOverlay: 25,
      overlayStyle: "linear",
      frameStyle: "corners",
      textGlow: true,
      textShadow: true,
      textAnimation: "fade",
    },
  },
  {
    id: "ocean-calm",
    nameEn: "Ocean Calm",
    nameAr: "هدوء المحيط",
    emoji: "🌊",
    settings: {
      bgColor: "#000d1a",
      bgColorSecondary: "#00264d",
      textColor: "#7ec8e3",
      fontFamily: "'Scheherazade New', serif",
      bgOverlay: 30,
      overlayStyle: "radial",
      frameStyle: "none",
      textGlow: false,
      textShadow: true,
      textAnimation: "fade",
    },
  },
  {
    id: "emerald",
    nameEn: "Emerald Garden",
    nameAr: "الحديقة الزمردية",
    emoji: "🌿",
    settings: {
      bgColor: "#001a0f",
      bgColorSecondary: "#00331f",
      textColor: "#a3d977",
      fontFamily: "'Lateef', serif",
      bgOverlay: 35,
      overlayStyle: "linear",
      frameStyle: "full",
      textGlow: false,
      textShadow: true,
      textAnimation: "none",
    },
  },
  {
    id: "royal-gold",
    nameEn: "Royal Gold",
    nameAr: "الذهبي الملكي",
    emoji: "👑",
    settings: {
      bgColor: "#0a0500",
      bgColorSecondary: "#2a1a00",
      textColor: "#ffd700",
      fontFamily: "'Noto Naskh Arabic', serif",
      bgOverlay: 20,
      overlayStyle: "radial",
      frameStyle: "full",
      textGlow: true,
      textShadow: true,
      textAnimation: "fade",
      textOutline: true,
    },
  },
  {
    id: "desert-sunset",
    nameEn: "Desert Sunset",
    nameAr: "غروب الصحراء",
    emoji: "🏜️",
    settings: {
      bgColor: "#1a0a00",
      bgColorSecondary: "#4a1a00",
      textColor: "#e8a040",
      fontFamily: "'Cairo', sans-serif",
      bgOverlay: 25,
      overlayStyle: "linear",
      frameStyle: "corners",
      textGlow: true,
      textShadow: true,
      textAnimation: "fade",
    },
  },
];