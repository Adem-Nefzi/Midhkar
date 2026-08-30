/**
 * render.ts — server-side orchestrator, port of lib/generate-video.ts.
 * Same contract: cumulative segments, LEAD_IN=0, 8-frame verse crossfades
 * (alpha-sum-1), bookend fades, 10-frame bg seams, whole-playlist loop,
 * 30 unique fps doubled to 60, bitrate ladder, AAC 128k mono 48k.
 */
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { ffmpegBin } from "./ffmpeg";
import { ensureFonts } from "./canvas/fonts";
import {
  drawAyahFrame,
  drawOverlayStyle,
  drawWatermark,
  FONT_SIZES,
} from "./canvas/canva-utils";
import type { Ayah, Surah } from "./canvas/types-quran";
import type { VideoSettings } from "./canvas/types-settings";

/* ── Constants (mirror the client) ─────────────────────────────── */
const RENDER_FPS = 30;
const TRANSITION_WINDOW_FRAMES = 8;
const BOOKEND_FADE_FRAMES = 6;
const SEAM_FRAMES = 10; // min(10, round(30/3))
const FALLBACK_BG_COLOR = "#0b0b0f";
const FALLBACK_DUR = 6; // seconds of silence for missing audio
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 128_000;

/* ── Job spec (wire format) ─────────────────────────────────────── */
export interface RenderJobSpec {
  ayahs: { key: string; text: string; translation: string; numberInSurah: number }[];
  surah: { number: string; name: string; englishName: string };
  reciter: { quranApiNo: number; everyayahFolder: string; primary: boolean };
  settings: VideoSettings;
  platform: { aspect: "16:9" | "9:16" | "1:1"; id: string };
  bg: { mode: "pexels" | "upload" | "none"; urls?: string[]; uploadId?: string };
  quality: { isLowPower: boolean };
}

export interface ProgressFn {
  (msg: string, pct: number): void;
}

/* ── Audio ─────────────────────────────────────────────────────── */
async function fetchBuffer(url: string, signal?: AbortSignal): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

function audioUrlCandidates(
  reciter: RenderJobSpec["reciter"],
  surah: number,
  ayah: number,
): string[] {
  const urls: string[] = [];
  if (reciter.primary !== false) {
    urls.push(
      `https://the-quran-project.github.io/Quran-Audio/Data/${reciter.quranApiNo}/${surah}_${ayah}.mp3`,
    );
  }
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  urls.push(`https://everyayah.com/data/${reciter.everyayahFolder}/${s}${a}.mp3`);
  return urls;
}

async function fetchAudioBuffer(
  urls: string[],
  signal?: AbortSignal,
): Promise<Buffer | null> {
  for (const url of urls) {
    const b = await fetchBuffer(url, signal);
    if (b && b.length > 0) {
      // MP3 sanity: reject obvious 404-HTML bodies
      if (b.length < 512) continue;
      return b;
    }
  }
  return null;
}

/* ── Segments (cumulative — verbatim math from the client) ──────── */
interface Segment {
  totalFrames: number;
  trailFrames: number;
}

function buildSegments(
  durations: { totalSec: number; trailSec: number }[],
  fps: number,
): { segments: Segment[]; totalFrames: number } {
  const segments: Segment[] = [];
  let cumSec = 0;
  let cumFrames = 0;
  let totalFrames = 0;
  for (const d of durations) {
    cumSec += d.totalSec + d.trailSec;
    const newCum = Math.round(cumSec * fps);
    const total = Math.max(1, newCum - cumFrames);
    const trail = Math.min(total, Math.round(d.trailSec * fps));
    segments.push({ totalFrames: total, trailFrames: trail });
    cumFrames = newCum;
    totalFrames += total;
  }
  return { segments, totalFrames };
}

/* ── Resolution / bitrate (mirror device-profile) ───────────────── */
function outputResolution(aspect: string, isLowPower: boolean) {
  if (isLowPower) {
    if (aspect === "16:9") return { cw: 1280, ch: 720 };
    if (aspect === "1:1") return { cw: 1080, ch: 1080 };
    return { cw: 720, ch: 1280 };
  }
  if (aspect === "16:9") return { cw: 1920, ch: 1080 };
  if (aspect === "1:1") return { cw: 1080, ch: 1080 };
  return { cw: 1080, ch: 1920 };
}

function videoBitrate(cw: number, ch: number, isLowPower: boolean) {
  const px = cw * ch;
  let bitrate: number;
  if (px >= 2073600) bitrate = 6_000_000;
  else if (px >= 1166400) bitrate = 4_500_000;
  else if (px >= 921600) bitrate = 3_000_000;
  else bitrate = 2_500_000;
  return Math.round(bitrate * (isLowPower ? 0.7 : 1.0));
}

/* ── Bg frame budget (mirror encode.worker) ─────────────────────── */
function allocateBgBudget(
  durations: number[],
  budget: number,
  cap: number,
): number[] {
  const count = durations.length;
  const known = durations.filter((d) => d > 0);
  if (known.length === 0) {
    const even = Math.max(30, Math.floor(budget / count));
    return durations.map(() => Math.min(cap, even));
  }
  const sum = known.reduce((a, b) => a + b, 0);
  return durations.map((d) => {
    if (d <= 0) return 30;
    const alloc = Math.round((budget * d) / sum);
    return Math.max(30, Math.min(cap, alloc));
  });
}

/* ── Transition math (mirror encode.worker) ─────────────────────── */
function transitionFor(
  segIdx: number,
  segments: Segment[],
  transitionStyle: VideoSettings["transitionStyle"],
): { pre: number; post: number } {
  if (transitionStyle === "none" || segIdx >= segments.length - 1) {
    return { pre: 0, post: 0 };
  }
  const trail = segments[segIdx].trailFrames;
  const nextLead = Math.max(0, segments[segIdx + 1].totalFrames - segments[segIdx + 1].trailFrames);
  if (trail >= TRANSITION_WINDOW_FRAMES) {
    return { pre: TRANSITION_WINDOW_FRAMES, post: 0 };
  } else if (trail + nextLead >= TRANSITION_WINDOW_FRAMES) {
    return { pre: trail, post: TRANSITION_WINDOW_FRAMES - trail };
  }
  return { pre: Math.floor(TRANSITION_WINDOW_FRAMES / 2), post: TRANSITION_WINDOW_FRAMES - Math.floor(TRANSITION_WINDOW_FRAMES / 2) };
}

/* ── The render ─────────────────────────────────────────────────── */
export interface RenderResult {
  buffer: Buffer;
  durationSec: number;
  cw: number;
  ch: number;
  fps: number;
}

export async function renderVideo(
  spec: RenderJobSpec,
  onProgress: ProgressFn,
  signal: AbortSignal,
  uploadStore: Map<string, Buffer>,
): Promise<RenderResult> {
  ensureFonts();
  const s = spec.settings;
  const { cw, ch } = outputResolution(spec.platform.aspect, spec.quality.isLowPower);
  const outputFps = spec.quality.isLowPower ? 30 : 60;
  const bitrate = videoBitrate(cw, ch, spec.quality.isLowPower);

  /* 1. Audio — fetch + decode to 48k mono PCM (durations = truth) */
  onProgress("Downloading & decoding audio…", 5);
  const ayahs: Ayah[] = [];
  const durations: { totalSec: number; trailSec: number }[] = [];
  const buffers: Float32Array[] = [];
  let done = 0;
  for (const a of spec.ayahs) {
    if (signal.aborted) throw new Error("Aborted");
    const [surahNo] = a.key.split(":");
    const candidates = audioUrlCandidates(spec.reciter, Number(surahNo), a.numberInSurah);
    const raw = await fetchAudioBuffer(candidates, signal);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { decodeAudioPcm } = await import("./ffmpeg");
    const samples = raw
      ? await decodeAudioPcm(raw, { timeoutMs: 60_000 })
      : new Float32Array(FALLBACK_DUR * SAMPLE_RATE);
    buffers.push(samples);
    durations.push({
      totalSec: samples.length / SAMPLE_RATE,
      trailSec: s.verseSpacing,
    });
    ayahs.push({
      number: 0,
      numberInSurah: a.numberInSurah,
      text: a.text,
      translation: a.translation,
      juz: 0,
      page: 0,
      sajda: false,
    });
    done++;
    onProgress(`Audio ${done} (${done}/${spec.ayahs.length})`, 5 + Math.round((done / spec.ayahs.length) * 20));
  }

  /* 2. Assemble full audio track (verbatim from client) */
  onProgress("Assembling audio track…", 26);
  const totalDurSec = durations.reduce((acc, d) => acc + d.totalSec + d.trailSec, 0);
  const totalSamples = Math.round(totalDurSec * SAMPLE_RATE);
  const track = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const b = buffers[i];
    track.set(b, offset);
    offset += b.length + Math.round(durations[i].trailSec * SAMPLE_RATE);
  }

  /* 3. Segments */
  const { segments, totalFrames } = buildSegments(durations, RENDER_FPS);

  /* 4. Overlays — vendored canva-utils, same as client renderAyahOverlays */
  onProgress("Preparing background…", 30);
  const hasBgVideo =
    (spec.bg.mode === "pexels" && (spec.bg.urls?.length ?? 0) > 0) ||
    (spec.bg.mode === "upload" && !!spec.bg.uploadId);
  const isStaticBg = !hasBgVideo;

  const surah: Surah = {
    number: Number(spec.surah.number),
    name: spec.surah.name,
    englishName: spec.surah.englishName,
    englishNameTranslation: "",
    numberOfAyahs: spec.ayahs.length,
    revelationType: "Meccan",
  };

  const overlays: (SKRSContext2D | null)[] = [];
  for (let i = 0; i < ayahs.length; i++) {
    if (signal.aborted) throw new Error("Aborted");
    const canvas = createCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    if (isStaticBg) {
      // bake default dark gradient + darkness (mirrors client)
      const g = ctx.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, "#09090f");
      g.addColorStop(0.5, "#120d03");
      g.addColorStop(1, "#09090f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      const glow = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.55);
      glow.addColorStop(0, "rgba(212,175,55,0.07)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, cw, ch);
      if (s.bgOverlay > 0) {
        ctx.fillStyle = `rgba(0,0,0,${s.bgOverlay / 100})`;
        ctx.fillRect(0, 0, cw, ch);
      }
    }
    drawOverlayStyle(ctx as unknown as CanvasRenderingContext2D, cw, ch, s.overlayStyle, s.bgOverlay);
    drawAyahFrame(
      ctx as unknown as CanvasRenderingContext2D,
      canvas as unknown as HTMLCanvasElement,
      ayahs[i],
      surah,
      s,
      1,
    );
    overlays.push(ctx);
    onProgress(`Rendering overlay ${i + 1}/${ayahs.length}`, 36 + Math.round(((i + 1) / ayahs.length) * 10));
  }

  /* 5. Bg playlist frames */
  onProgress("Starting encoder…", 33);
  const bgFramesList: Buffer[][] = [];
  const bgDarkenAlpha = hasBgVideo ? Math.min(0.8, s.bgOverlay / 100) : 0;
  if (hasBgVideo) {
    const { extractBgFrames, probeDuration } = await import("./ffmpeg");
    const urls: (string | Buffer)[] = [];
    if (spec.bg.mode === "pexels" && spec.bg.urls) {
      urls.push(...spec.bg.urls);
    } else if (spec.bg.mode === "upload" && spec.bg.uploadId) {
      const buf = uploadStore.get(spec.bg.uploadId);
      if (buf) urls.push(buf);
    }
    const cap = spec.quality.isLowPower ? 1200 : 2400;
    const budget = Math.min(cap * urls.length, totalFrames + 64);
    // probe durations (server ffprobe — better than client <video> probe).
    // Upload buffers get a temp file; URLs probe directly.
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const durations2: number[] = [];
    const tempFiles: string[] = [];
    for (const u of urls) {
      if (signal.aborted) throw new Error("Aborted");
      if (Buffer.isBuffer(u)) {
        const p = join(tmpdir(), `midhkar-bg-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
        writeFileSync(p, u);
        tempFiles.push(p);
        try {
          durations2.push(await probeDuration(p));
        } catch {
          durations2.push(0);
        }
      } else {
        try {
          durations2.push(await probeDuration(u));
        } catch {
          durations2.push(0);
        }
      }
    }
    for (const p of tempFiles) {
      try {
        unlinkSync(p);
      } catch {
        /* best-effort */
      }
    }
    const alloc = allocateBgBudget(durations2, budget, cap);
    for (let i = 0; i < urls.length; i++) {
      if (signal.aborted) throw new Error("Aborted");
      onProgress(`Decoding backgrounds ${i + 1}/${urls.length}…`, 40 + Math.round((i / urls.length) * 8));
      const frames = await extractBgFrames(urls[i], cw, ch, alloc[i]);
      bgFramesList.push(frames);
    }
  }
  const bgTotal = bgFramesList.reduce((a, f) => a + f.length, 0);

  /* 6. Composite + encode via FFmpeg pipe */
  onProgress("Encoding audio…", 48);
  const x264Level =
    cw * ch >= 2073600 ? "4.0" : cw * ch >= 1166400 ? "3.2" : "3.1";

  // Audio goes via temp file (single stdin is the video pipe)
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const audioPath = join(tmpdir(), `midhkar-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.f32`);
  {
    const f32 = Buffer.alloc(track.length * 4);
    for (let i = 0; i < track.length; i++) {
      f32.writeFloatLE(track[i], i * 4);
    }
    writeFileSync(audioPath, f32);
  }

  // Output via temp file (mp4+faststart needs a seekable target, not a pipe)
  const outPath = join(tmpdir(), `midhkar-out-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
  const args = [
    "-y",
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "-s", `${cw}x${ch}`,
    "-r", String(RENDER_FPS),
    "-i", "-",
    "-f", "f32le",
    "-ar", String(SAMPLE_RATE),
    "-ac", "1",
    "-i", audioPath,
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", x264Level,
    "-b:v", String(bitrate),
    "-maxrate", String(Math.round(bitrate * 1.45)),
    "-bufsize", String(bitrate * 2),
    "-g", String(2 * outputFps),
    "-pix_fmt", "yuv420p",
    "-r", String(outputFps),
    "-c:a", "aac",
    "-b:a", String(AUDIO_BITRATE),
    "-ar", String(SAMPLE_RATE),
    "-ac", "1",
    "-movflags", "+faststart",
    outPath,
  ];

  const { spawn } = await import("node:child_process");
  const proc = spawn(ffmpegBin(), args, { windowsHide: true });
  const cleanupAudio = () => {
    try {
      unlinkSync(audioPath);
    } catch {
      /* best-effort */
    }
  };
  proc.on("close", () => cleanupAudio());
  proc.on("error", () => cleanupAudio());

  const composite = createCanvas(cw, ch);
  const cctx = composite.getContext("2d");

  // Pre-decode overlay PNGs to images (once)
  const overlayImages = await Promise.all(
    overlays.map(async (ov) => {
      if (!ov) return null;
      const png = (ov.canvas as unknown as { toBuffer(f: string): Buffer }).toBuffer("image/png");
      return await loadImage(png);
    }),
  );

  const drawOverlayImg = (
    img: Awaited<ReturnType<typeof loadImage>> | null,
    alpha: number,
    dy: number,
    scale: number,
  ) => {
    if (!img || alpha <= 0) return;
    cctx.globalAlpha = alpha;
    if (scale !== 1 || dy !== 0) {
      const w = cw * scale;
      const h = ch * scale;
      cctx.drawImage(img, (cw - w) / 2, (ch - h) / 2 + dy, w, h);
    } else {
      cctx.drawImage(img, 0, 0);
    }
    cctx.globalAlpha = 1;
  };

  const bgDecodedImages: (Awaited<ReturnType<typeof loadImage>> | null)[][] = [];
  if (hasBgVideo) {
    onProgress("Finalising background…", 54);
    for (let clip = 0; clip < bgFramesList.length; clip++) {
      const imgs: (Awaited<ReturnType<typeof loadImage>> | null)[] = [];
      for (const f of bgFramesList[clip]) {
        if (signal.aborted) throw new Error("Aborted");
        try {
          imgs.push(await loadImage(f));
        } catch {
          imgs.push(null);
        }
      }
      bgDecodedImages.push(imgs);
    }
  }

  const bgFrameFor = (globalIdx: number): { img: Awaited<ReturnType<typeof loadImage>> | null; next: Awaited<ReturnType<typeof loadImage>> | null; intoSeam: number; clip: number } => {
    if (bgTotal === 0) return { img: null, next: null, intoSeam: 0, clip: -1 };
    let pos = globalIdx % bgTotal;
    let clip = 0;
    let local = 0;
    for (let i = 0; i < bgDecodedImages.length; i++) {
      const len = bgDecodedImages[i].length;
      if (pos < len) {
        clip = i;
        local = pos;
        break;
      }
      pos -= len;
    }
    const imgs = bgDecodedImages[clip];
    const img = imgs[local] ?? null;
    const clipLen = imgs.length;
    const intoSeam = clipLen - local;
    let next: Awaited<ReturnType<typeof loadImage>> | null = null;
    if (clipLen - local <= SEAM_FRAMES && bgDecodedImages.length > 0) {
      const nextClip = clip + 1 < bgDecodedImages.length ? clip + 1 : 0;
      next = bgDecodedImages[nextClip][0] ?? null;
    }
    return { img, next, intoSeam, clip };
  };

  const transitionStyle = s.transitionStyle;
  const frameDouble = Math.round(outputFps / RENDER_FPS);

  let segStart = 0;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];
    const trans = transitionFor(segIdx, segments, transitionStyle);
    for (let k = 0; k < seg.totalFrames; k++) {
      if (signal.aborted) throw new Error("Aborted");
      cctx.clearRect(0, 0, cw, ch);

      // Background
      if (hasBgVideo) {
        const g = segStart + k;
        const { img, next, intoSeam } = bgFrameFor(g);
        if (img) {
          cctx.drawImage(img, 0, 0);
          if (next && transitionStyle !== "none" && intoSeam <= SEAM_FRAMES) {
            const t = (SEAM_FRAMES - intoSeam + 1) / (SEAM_FRAMES + 1);
            if (t < 1) {
              cctx.globalAlpha = Math.min(1, t);
              cctx.drawImage(next, 0, 0);
              cctx.globalAlpha = 1;
            }
          }
        } else {
          cctx.fillStyle = FALLBACK_BG_COLOR;
          cctx.fillRect(0, 0, cw, ch);
        }
        if (bgDarkenAlpha > 0) {
          cctx.fillStyle = `rgba(0,0,0,${bgDarkenAlpha})`;
          cctx.fillRect(0, 0, cw, ch);
        }
      }

      // Overlay crossfade (mirror encode.worker logic)
      const localEnd = seg.totalFrames - 1;
      const inWindow =
        transitionStyle !== "none" &&
        trans.pre + trans.post > 0 &&
        k >= localEnd - trans.pre + 1 - 1 && k <= localEnd + trans.post;
      // Compute old/new alpha (mirror worker)
      let oldAlpha = 1;
      let newAlpha = 0;
      const newIdx = segIdx + 1;
      if (transitionStyle !== "none" && segIdx < segments.length - 1) {
        const totalW = trans.pre + trans.post;
        if (totalW > 0) {
          const pos = k - (localEnd - trans.pre + 1);
          if (pos >= 0 && pos < totalW) {
            const t = (pos + 1) / (totalW + 1);
            oldAlpha = 1 - t;
            newAlpha = t;
          }
        }
      }
      // Bookend fades
      let bookend = 1;
      if (transitionStyle !== "none") {
        const globalIdx = segStart + k;
        if (globalIdx < BOOKEND_FADE_FRAMES) {
          bookend = (globalIdx + 1) / (BOOKEND_FADE_FRAMES + 1);
        }
        const fromEnd = totalFrames - 1 - globalIdx;
        if (fromEnd < BOOKEND_FADE_FRAMES) {
          bookend = Math.min(bookend, (fromEnd + 1) / (BOOKEND_FADE_FRAMES + 1));
        }
      }

      // Draw current overlay
      drawOverlayImg(overlayImages[segIdx], oldAlpha * bookend, 0, 1);
      // Draw incoming overlay with slide/scale transform
      if (newAlpha > 0 && newIdx < overlayImages.length) {
        const t = newAlpha;
        let dy = 0;
        let scale = 1;
        if (transitionStyle === "slide") dy = (1 - t) * 40;
        if (transitionStyle === "scale") scale = 0.95 + t * 0.05;
        drawOverlayImg(overlayImages[newIdx], newAlpha * bookend, dy, scale);
      }

      // Watermark
      if (s.showWatermark && s.watermarkText.trim()) {
        drawWatermark(cctx as unknown as CanvasRenderingContext2D, cw, ch, s.watermarkText);
      }

      const frameBuf = (
        composite as unknown as { data(): Buffer }
      ).data();
      for (let d = 0; d < frameDouble; d++) {
        const ok = proc.stdin.write(frameBuf);
        if (!ok) {
          await new Promise<void>((res) => proc.stdin.once("drain", () => res()));
        }
      }

      const globalIdx = segStart + k;
      if (globalIdx % 30 === 0) {
        const pct = 56 + Math.round((globalIdx / totalFrames) * 40);
        onProgress(`Encoding frame ${globalIdx + 1}/${totalFrames}…`, Math.min(96, pct));
      }
    }
    segStart += seg.totalFrames;
  }

  proc.stdin.end();

  onProgress("Finalising…", 97);
  let stderrAll = "";
  proc.stderr.on("data", (d) => (stderrAll += d.toString()));
  const code: number = await new Promise((resolve) => {
    proc.on("close", (c) => resolve(c ?? -1));
  });

  if (code !== 0) {
    try {
      unlinkSync(outPath);
    } catch {
      /* best-effort */
    }
    throw new Error(`ffmpeg failed (${code}): ${stderrAll.slice(-400)}`);
  }

  const { readFileSync } = await import("node:fs");
  const buffer = readFileSync(outPath);
  try {
    unlinkSync(outPath);
  } catch {
    /* best-effort */
  }
  onProgress("Done!", 100);
  return {
    buffer,
    durationSec: totalDurSec,
    cw,
    ch,
    fps: outputFps,
  };
}
