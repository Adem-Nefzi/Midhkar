/**
 * api.test.ts — end-to-end HTTP test against the running service:
 * enqueue → SSE progress → MP4 download → probe.
 */
const BASE = process.env.RENDER_API_BASE ?? "http://localhost:7860";

export {}; // module marker for top-level await

const spec = {
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

const res = await fetch(`${BASE}/api/render`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(spec),
});
if (!res.ok) throw new Error(`render POST failed: ${res.status} ${await res.text()}`);
const { jobId } = (await res.json()) as { jobId: string };
console.log("jobId:", jobId);

const t0 = Date.now();
let done = false;
const sse = await fetch(`${BASE}/api/render/${jobId}`);
const reader = sse.body!.getReader();
const dec = new TextDecoder();
let lastLine = "";
while (!done) {
  const { value, done: streamDone } = await reader.read();
  if (streamDone) break;
  lastLine += dec.decode(value, { stream: true });
  const events = lastLine.split("\n\n");
  lastLine = events.pop() ?? "";
  for (const ev of events) {
    if (ev.startsWith("event: done")) {
      done = true;
    } else if (ev.startsWith("event: error")) {
      throw new Error("render error: " + ev);
    } else if (ev.startsWith("data: ")) {
      const p = JSON.parse(ev.slice(6));
      process.stdout.write(`\r[${p.pct}%] ${p.msg}`);
    }
  }
}
console.log(`\nSSE completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const vid = await fetch(`${BASE}/api/render/${jobId}/video`);
if (!vid.ok) throw new Error(`video GET failed: ${vid.status}`);
const buf = Buffer.from(await vid.arrayBuffer());
console.log("video bytes:", buf.length);
if (buf.length < 100_000) throw new Error("video too small");
const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("test/out", { recursive: true });
writeFileSync("test/out/api-server.mp4", buf);
console.log("GATE: PASS");
