/* Vendored from lib/types.ts — only the shape canva-utils consumes.
   The client's full file stays the source of truth; keep in sync. */

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
  showSurahName: boolean;
  showVerseNumber: boolean;
  uploadedVideoUrl: string | null;
  uploadedVideoFile: unknown | null;
  videoUrl: string | null;
  videoUrls: string[];
  textShadow: boolean;
  bgOverlay: number;
  fontSize: "small" | "medium" | "large";
  overlayStyle: "none" | "linear" | "radial";
  showWatermark: boolean;
  watermarkText: string;
  textGlow: boolean;
  textOutline: boolean;
  frameStyle: "none" | "corners" | "full" | "arch";
  verseSpacing: number;
  textAnimation: "none" | "fade";
  bgColor: string;
  bgColorSecondary: string;
  bgGradientAngle: number;
  transitionStyle: "none" | "fade" | "slide" | "scale";
  patternSeed: number;
  patternFamily: "star" | "girih" | "arabesque" | "zellige" | "muqarnas" | "arch" | "border";
  patternPalette: string;
  patternDensity: 1 | 2 | 3;
  patternScale: number;
  patternFillMode: "outline" | "solid" | "glow";
}
