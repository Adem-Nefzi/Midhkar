/**
 * types.ts
 * Shared TypeScript types for the VideoBuilder feature.
 */

export interface VideoSettings {
  background: string;
  platform: string;
  showTranslation: boolean;
  translationLang: string;
  fontFamily: string;
  textColor: string;
  textOpacity: number;
  textPosition: string;
  translationFontFamily: string;
  translationColor: string;
  translationOpacity: number;
  showBasmalah: boolean;
  showSurahName: boolean;
  showVerseNumber: boolean;
  uploadedVideoUrl: string | null;
  imageKitUrl: string | null;
  imageKitThumb: string | null;
  textShadow: boolean;
  bgOverlay: number; // 0–80 %
  fontSize: "small" | "medium" | "large";
}

export interface GenLog {
  msg: string;
  pct: number; // 0–100, or -1 for error messages
}

export const DEFAULT_SETTINGS: VideoSettings = {
  background: "golden-pulse",
  platform: "reels",
  showTranslation: true,
  translationLang: "en",
  fontFamily: "'Amiri', 'Scheherazade New', serif",
  textColor: "#d4af37",
  textOpacity: 100,
  textPosition: "center",
  translationFontFamily: "'Amiri', 'Scheherazade New', serif",
  translationColor: "#f5f0e8",
  translationOpacity: 80,
  showBasmalah: true,
  showSurahName: true,
  showVerseNumber: true,
  uploadedVideoUrl: null,
  imageKitUrl: null,
  imageKitThumb: null,
  textShadow: true,
  bgOverlay: 35,
  fontSize: "medium",
};

export const FONTS = [
  { id: "amiri", name: "Amiri", family: "'Amiri', 'Scheherazade New', serif" },
  {
    id: "scheherazade",
    name: "Scheherazade",
    family: "'Scheherazade New', serif",
  },
  { id: "noto", name: "Noto Naskh", family: "'Noto Naskh Arabic', serif" },
  { id: "kufi", name: "Kufi", family: "'Traditional Arabic', serif" },
] as const;
