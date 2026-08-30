/**
 * mem-profile.ts — runs the golden render locally, printing RSS at
 * each phase and between frame batches. Finds the memory hog.
 */
import { renderVideo, type RenderJobSpec } from "../src/render";

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
    background: "pexels", platform: "youtube", showTranslation: true, translationLang: "en",
    fontFamily: "'Amiri', 'Scheherazade New', serif", textColor: "#d4af37", textOpacity: 100,
    textPosition: "center", translationFontFamily: "'Inter', 'Lato', sans-serif",
    translationColor: "#f5f0e8", translationOpacity: 80, showSurahName: true, showVerseNumber: true,
    uploadedVideoUrl: null, uploadedVideoFile: null, videoUrl: null, videoUrls: [],
    textShadow: true, bgOverlay: 35, fontSize: "medium", overlayStyle: "linear",
    showWatermark: false, watermarkText: "", textGlow: false, textOutline: false,
    frameStyle: "corners", verseSpacing: 0, textAnimation: "none",
    bgColor: "#121728", bgColorSecondary: "#1d2b1f", bgGradientAngle: 160,
    transitionStyle: "fade", patternSeed: 108, patternFamily: "star", patternPalette: "night-gold",
    patternDensity: 2, patternScale: 1, patternFillMode: "glow",
  },
  platform: { aspect: "9:16", id: "youtube" },
  bg: { mode: "none" },
  quality: { isLowPower: false },
};

const mb = () => (process.memoryUsage().rss / 1024 / 1024).toFixed(0) + "MB";
let phase = 0;
const t0 = Date.now();
const result = await renderVideo(
  spec,
  (msg, pct) => {
    // print at each new pct decade
    if (pct > phase * 10) {
      phase = Math.ceil(pct / 10);
      console.log(`[${pct}%] ${msg} — RSS ${mb()}`);
    }
  },
  new AbortController().signal,
  new Map(),
);
console.log("done in", ((Date.now() - t0) / 1000).toFixed(1) + "s, bytes:", result.buffer.length, "final RSS", mb());
