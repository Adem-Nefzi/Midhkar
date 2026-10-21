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
  textGlowIntensity: number;
  textShadowIntensity: number;
  textOutlineWidth: number;
  showWatermark: boolean;
  watermarkText: string;
  watermarkPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  exportQuality: "standard" | "balanced" | "high";
  vignette: number;
  textGlow: boolean;
  textOutline: boolean;
  frameStyle: "none" | "corners" | "full" | "arch";
  verseSpacing: number;
  verseDisplay?: "auto" | "full";
  textAnimation: "none" | "fade";
  bgColor: string;
  bgColorSecondary: string;
  bgGradientAngle: number;
  transitionStyle: "none" | "fade" | "slide" | "scale";
  revealAnimation?: "fade" | "cut";
  bgMotion?: "none" | "zoom";
  transitionCurve?: "linear" | "ease";
  outputFps?: 60 | 30;
  audioGain?: number;
  bookendFadeSec?: number;
  patternSeed: number;
  patternFamily: "star" | "girih" | "arabesque" | "zellige" | "muqarnas" | "arch" | "border";
  patternPalette: string;
  patternDensity: 1 | 2 | 3;
  patternScale: number;
  patternFillMode: "outline" | "solid" | "glow";
}
