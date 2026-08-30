/**
 * parity.test.ts — Slice 1 golden overlay spike.
 * Renders Al-Ikhlas verse 1 (medium settings, translation on) with the
 * vendored canva-utils via @napi-rs/canvas and writes a PNG.
 * The browser equivalent (test/parity-browser.html rendered via the dev
 * page's canvas) must produce a visually identical image — verified by
 * pixel-diff in test/compare.ts.
 */
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureFonts } from "../src/canvas/fonts";
import { drawAyahFrame, drawOverlayStyle } from "../src/canvas/canva-utils";
import type { Ayah, Surah } from "../src/canvas/types-quran";
import type { VideoSettings } from "../src/canvas/types-settings";

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, "out"), { recursive: true });

ensureFonts();

const surah: Surah = {
  number: 112,
  name: "الإخلاص",
  englishName: "Al-Ikhlas",
  englishNameTranslation: "The Sincerity",
  numberOfAyahs: 4,
  revelationType: "Meccan",
};

const ayah: Ayah = {
  number: 6222,
  numberInSurah: 1,
  text: "قُلْ هُوَ اللَّهُ أَحَدٌ",
  translation: "Say: He is Allah, the One and Only;",
  juz: 30,
  page: 604,
  sajda: false,
};

const settings: VideoSettings = {
  background: "color",
  platform: "youtube",
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
  textAnimation: "none",
  bgColor: "#121728",
  bgColorSecondary: "#1d2b1f",
  bgGradientAngle: 160,
  transitionStyle: "fade",
  patternSeed: 108,
  patternFamily: "star",
  patternPalette: "night-gold",
  patternDensity: 2,
  patternScale: 1,
  patternFillMode: "glow",
};

const cw = 1080;
const ch = 1920;
const canvas = createCanvas(cw, ch);
const ctx = canvas.getContext("2d");

// Color-mode background (mirrors renderFullFrame's color branch)
{
  const angle = settings.bgGradientAngle * (Math.PI / 180);
  const x1 = cw / 2 + Math.cos(angle + Math.PI) * cw;
  const y1 = ch / 2 + Math.sin(angle + Math.PI) * ch;
  const x2 = cw / 2 + Math.cos(angle) * cw;
  const y2 = ch / 2 + Math.sin(angle) * ch;
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, settings.bgColor);
  g.addColorStop(1, settings.bgColorSecondary);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
}

drawOverlayStyle(ctx, cw, ch, settings.overlayStyle, settings.bgOverlay);
drawAyahFrame(ctx, canvas as unknown as HTMLCanvasElement, ayah, surah, settings, 1);

const png = canvas.toBuffer("image/png");
const out = join(__dirname, "out", "golden-overlay-server.png");
writeFileSync(out, png);
console.log("wrote", out, png.length, "bytes");
