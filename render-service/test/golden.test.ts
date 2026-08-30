/**
 * golden.test.ts — Slice 2 gate: full server-side render of Al-Ikhlas 1-4
 * (Sudais) with the same settings as the client e2e, then probe the MP4.
 */
import { renderVideo, type RenderJobSpec } from "../src/render";
import { probeDuration } from "../src/ffmpeg";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, "out"), { recursive: true });

const spec: RenderJobSpec = {
  ayahs: [
    { key: "112:1", numberInSurah: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ", translation: "Say: He is Allah, the One and Only;" },
    { key: "112:2", numberInSurah: 2, text: "اللَّهُ الصَّمَدُ", translation: "Allah, the Eternal, Absolute;" },
    { key: "112:3", numberInSurah: 3, text: "لَمْ يَلِدْ وَلَمْ يُولَدْ", translation: "He begetteth not, nor is He begotten;" },
    { key: "112:4", numberInSurah: 4, text: "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ", translation: "And there is none like unto Him." },
  ],
  surah: { number: "112", name: "الإخلاص", englishName: "Al-Ikhlas" },
  reciter: { quranApiNo: 3, everyayahFolder: "Abdurrahmaan_As-Sudais_192kbps", primary: true },
  settings: {
    background: "pexels",
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
  },
  platform: { aspect: "9:16", id: "youtube" },
  bg: { mode: "none" },
  quality: { isLowPower: false },
};

const logs: { msg: string; pct: number }[] = [];
const t0 = Date.now();
const result = await renderVideo(
  spec,
  (msg, pct) => {
    logs.push({ msg, pct });
    process.stdout.write(`\r[${pct}%] ${msg}`);
  },
  new AbortController().signal,
  new Map(),
);
console.log();
const outPath = join(__dirname, "out", "golden-server.mp4");
writeFileSync(outPath, result.buffer);
const dur = await probeDuration(outPath);

console.log("=== GOLDEN SERVER RENDER ===");
console.log("file:", outPath);
console.log("bytes:", result.buffer.length);
console.log("expected duration ~ 17-19s, got:", dur.toFixed(2) + "s");
console.log("resolution:", `${result.cw}x${result.ch}`, "fps:", result.fps);
console.log("render time:", ((Date.now() - t0) / 1000).toFixed(1) + "s");
console.log("log entries:", logs.length);

if (result.buffer.length < 100_000) throw new Error("MP4 too small — encode failed?");
if (dur < 15 || dur > 22) throw new Error("Duration out of expected range");
console.log("GATE: PASS");
