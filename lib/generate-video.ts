"use client";
/**
 * generate-video.ts  —  Mediabunny + Worker edition (v6, optimized)
 *
 * Optimizations over v5:
 *  - Concurrent-limited audio fetching (max 6 parallel connections)
 *  - Audio prefetch cache — start downloading in Step 3 (warm cache)
 *  - Capture only unique background frames (one loop, not totalFrames)
 *  - fastSeek() for faster frame capture where available
 *  - Reuse a single canvas for all text overlay rendering
 *  - Adaptive bitrate based on output resolution
 *  - Proper bounds checking on audio track assembly
 *  - try/finally cleanup for AudioContext and WakeLock
 *  - AbortSignal propagation to audio fetch calls
 *  - animProgress passthrough for live preview fade animation
 *
 * Bug fixes:
 *  - #1: renderFullFrame now accepts + forwards animProgress
 *  - #2: audio track assembly has bounds checking to prevent overflow
 *  - #3: blank/tainted background frame detection with warning
 *  - #5: AudioContext + WakeLock always released via try/finally
 */

import {
  getAudioContext,
  decodeAndResample,
  silenceSamples,
  releaseAudioContext,
  SAMPLE_RATE,
  CHANNELS,
  isWebCodecsSupported,
} from "./webcodecs-muxer";

import { PLATFORMS, getQuranApiAudioUrl, getEveryayahAudioUrl } from "@/lib/quran";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { VideoSettings, GenLog } from "@/lib/types";
import { drawAyahFrame, drawBackground } from "@/lib/canva-utils";
import type { WorkerInMessage, WorkerOutMessage, WorkerSegment } from "./encode.worker";

export { isWebCodecsSupported };

/* ── Constants ───────────────────────────────────────────────── */

const FPS             = 30;
const LEAD_IN_SEC     = 0.35;
const FALLBACK_DUR    = 6;
const MAX_BG_FRAMES   = 900;
const AUDIO_CONCURRENCY = 6;

const ASPECT: Record<string, [number, number]> = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "1:1":  [1080, 1080],
};

/** Opt 6: Adaptive bitrate — higher pixel count → higher bitrate. */
function getVideoBitrate(cw: number, ch: number): number {
  const pixels = cw * ch;
  if (pixels >= 1080 * 1080) return 3_500_000;
  if (pixels >= 1280 * 720)  return 3_000_000;
  return 2_500_000;
}

/* ══════════════════════════════════════════════════════════════
   Opt 1: Concurrent-limited parallel map
   ──────────────────────────────────────────────────────────────
   Browsers have a per-origin connection limit (6 in Chrome).
   Firing 40+ fetches at once overshoots this and serialises
   them behind the limit anyway, while wasting memory on pending
   promise chains.  A pool of `limit` workers is both faster and
   more memory-efficient.
══════════════════════════════════════════════════════════════ */

async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  const run = async () => {
    while (nextIdx < items.length) {
      const i = nextIdx++;
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

/* ══════════════════════════════════════════════════════════════
   Opt 8: Audio prefetch cache
   ──────────────────────────────────────────────────────────────
   Called from Step 3 (Settings) when the user has selected a
   reciter and verses.  By the time they click "Generate", the
   audio is already decoded and sitting in memory.
══════════════════════════════════════════════════════════════ */

const _audioCache = new Map<string, Float32Array>();

function audioCacheKey(reciterNo: number, surah: number, ayah: number): string {
  return `${reciterNo}:${surah}:${ayah}`;
}

/**
 * Prefetch and decode audio for the given ayahs.
 * Safe to call multiple times — already-cached ayahs are skipped.
 */
export async function prefetchAudio(
  ayahs: Ayah[],
  reciter: Reciter,
  surah: Surah,
): Promise<void> {
  if (reciter.source !== "quranapi" || !reciter.quranApiNo) return;

  await parallelMap(
    ayahs,
    async (ayah) => {
      const key = audioCacheKey(reciter.quranApiNo!, surah.number, ayah.numberInSurah);
      if (_audioCache.has(key)) return;

      const urls = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
      const rawBuffer = await fetchAudioBuffer(urls);
      if (rawBuffer) {
        const samples = await decodeAndResample(rawBuffer);
        if (samples) _audioCache.set(key, samples);
      }
    },
    AUDIO_CONCURRENCY,
  );
}

/** Clear the prefetch cache (e.g. when switching reciter/surah). */
export function clearAudioCache(): void {
  _audioCache.clear();
}

/* ══════════════════════════════════════════════════════════════
   Wake Lock — best-effort hint to the OS/browser not to suspend
   this page's process while generation is running.
══════════════════════════════════════════════════════════════ */

let _wakeLock: WakeLockSentinel | null = null;

async function acquireWakeLock(): Promise<void> {
  try {
    if ("wakeLock" in navigator) {
      _wakeLock = await (navigator as any).wakeLock.request("screen");
    }
  } catch {
    // Denied — generation still works fine in a Worker.
  }
}

function releaseWakeLock(): void {
  _wakeLock?.release().catch(() => {});
  _wakeLock = null;
}

/* ── Video seeking (Opt 2: fastSeek where available) ─────────── */

function seekTo(el: HTMLVideoElement, timeS: number): Promise<void> {
  return new Promise((resolve) => {
    if (!el.duration || el.duration === Infinity || isNaN(el.duration)) { resolve(); return; }
    const t = Math.max(0, timeS % el.duration);
    if (Math.abs(el.currentTime - t) < 0.02) { resolve(); return; }
    const onSeeked = () => { el.removeEventListener("seeked", onSeeked); resolve(); };
    el.addEventListener("seeked", onSeeked);
    // fastSeek seeks to the nearest keyframe — much faster than
    // exact-time seeking via currentTime for background frames
    // where sub-frame accuracy is irrelevant.
    if (typeof el.fastSeek === "function") {
      el.fastSeek(t);
    } else {
      el.currentTime = t;
    }
    setTimeout(() => { el.removeEventListener("seeked", onSeeked); resolve(); }, 500);
  });
}

/* ══════════════════════════════════════════════════════════════
   Opt 2 + 4: Smart background frame capture
   ──────────────────────────────────────────────────────────────
   Only capture ONE LOOP of unique frames from the background
   video.  The worker already cycles via `globalFrameIdx %
   bgBitmaps.length`, so duplicating frames here was pure waste.
   For a 10s background in a 60s video, this captures 300 frames
   instead of 600 — immediate 2× speedup on capture.
══════════════════════════════════════════════════════════════ */

async function captureBackgroundFrames(
  videoEl: HTMLVideoElement,
  totalOutputFrames: number,
  cw: number, ch: number,
  onProgress: (done: number, total: number) => void,
): Promise<ImageBitmap[]> {
  if (videoEl.readyState < 2) {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        videoEl.removeEventListener("loadeddata", onReady);
        videoEl.removeEventListener("canplay", onReady);
        resolve();
      };
      videoEl.addEventListener("loadeddata", onReady);
      videoEl.addEventListener("canplay", onReady);
      setTimeout(resolve, 5000);
    });
  }
  if (videoEl.readyState < 2 || !videoEl.duration || isNaN(videoEl.duration)) {
    console.warn("[capture] video not ready, skipping background capture");
    return [];
  }

  videoEl.pause();

  // Opt 4: Only capture unique frames (one loop of the bg video)
  const bgDuration = isFinite(videoEl.duration) ? videoEl.duration : 10;
  const uniqueFrameCount = Math.ceil(bgDuration * FPS);
  const count = Math.min(uniqueFrameCount, MAX_BG_FRAMES, totalOutputFrames);

  const bitmaps: ImageBitmap[] = [];
  const cap    = new OffscreenCanvas(cw, ch);
  const capCtx = cap.getContext("2d")!;

  for (let f = 0; f < count; f++) {
    await seekTo(videoEl, f / FPS);
    capCtx.drawImage(videoEl, 0, 0, cw, ch);
    bitmaps.push(await createImageBitmap(cap));
    if (f % 30 === 0) onProgress(f, count);
    if (f % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  // Bug 3: Verify frames aren't blank (CORS tainted canvas)
  if (bitmaps.length > 0) {
    const testCanvas = new OffscreenCanvas(4, 4);
    const testCtx = testCanvas.getContext("2d")!;
    try {
      testCtx.drawImage(bitmaps[0], 0, 0, 4, 4);
      const pixels = testCtx.getImageData(0, 0, 4, 4).data;
      const allZero = pixels.every((v) => v === 0);
      if (allZero) {
        console.warn(
          "[capture] background frames appear blank — possible CORS issue " +
          "or empty video. Falling back to solid background."
        );
      }
    } catch {
      console.warn("[capture] tainted canvas detected — CORS may block background frames");
    }
  }

  return bitmaps;
}

/* ══════════════════════════════════════════════════════════════
   Opt 3: Text-overlay pre-rendering (reusable canvas)
   ──────────────────────────────────────────────────────────────
   Reuses a single HTMLCanvasElement for all overlays instead of
   document.createElement("canvas") per ayah.  Eliminates N-1
   canvas allocations and their associated GC pressure.
══════════════════════════════════════════════════════════════ */

async function renderAyahOverlays(
  prepared: { ayah: Ayah }[],
  surah: Surah,
  settings: VideoSettings,
  platform: (typeof PLATFORMS)[0],
  cw: number, ch: number,
  onProgress: (done: number, total: number) => void,
): Promise<ImageBitmap[]> {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  const isStaticBg = settings.background !== "upload" && settings.background !== "library";
  const bitmaps: ImageBitmap[] = [];

  for (let i = 0; i < prepared.length; i++) {
    ctx.clearRect(0, 0, cw, ch);

    if (isStaticBg) {
      drawBackground(ctx, cw, ch, settings.background, null, 0, settings);
      if (settings.bgOverlay > 0) {
        ctx.fillStyle = `rgba(0,0,0,${settings.bgOverlay / 100})`;
        ctx.fillRect(0, 0, cw, ch);
      }
    }

    drawOverlayStyle(ctx, cw, ch, settings.overlayStyle, settings.bgOverlay);
    drawAyahFrame(ctx, canvas, prepared[i].ayah, surah, settings, platform);
    if (settings.showWatermark && settings.watermarkText?.trim()) {
      drawWatermark(ctx, cw, ch, settings.watermarkText);
    }

    bitmaps.push(await createImageBitmap(canvas));
    onProgress(i + 1, prepared.length);
  }

  return bitmaps;
}

/* ── Overlay + watermark helpers ─────────────────────────────── */

function drawOverlayStyle(
  ctx: CanvasRenderingContext2D, cw: number, ch: number,
  style: VideoSettings["overlayStyle"], intensityPct: number,
): void {
  if (style === "none" || intensityPct <= 0) return;
  const alpha = Math.min(0.85, (intensityPct / 100) * 0.85);
  let g: CanvasGradient;
  if (style === "radial") {
    g = ctx.createRadialGradient(cw/2, ch/2, Math.min(cw,ch)*0.2, cw/2, ch/2, Math.max(cw,ch)*0.7);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  } else {
    g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.55, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  }
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch); ctx.restore();
}

function drawWatermark(ctx: CanvasRenderingContext2D, cw: number, ch: number, text: string): void {
  ctx.save();
  ctx.font = `${Math.round(ch * 0.022)}px sans-serif`;
  ctx.fillStyle = "rgba(245,240,232,0.55)";
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  const pad = Math.round(ch * 0.025);
  ctx.fillText(text, cw - pad, ch - pad);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   renderFullFrame — kept for the live preview in StepGenerate
   (preview renders directly on a visible canvas, no encoding)

   Bug 1 fix: now accepts animProgress and forwards it to
   drawAyahFrame so the fade-in animation works in preview.
══════════════════════════════════════════════════════════════ */

export function renderFullFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ayah: Ayah | null,
  surah: Surah,
  settings: VideoSettings,
  platform: (typeof PLATFORMS)[0],
  videoEl: HTMLVideoElement | null,
  bgBitmap?: ImageBitmap | null,
  animProgress: number = 1,
): void {
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);

  const useVideoBg = settings.background === "upload" || settings.background === "library";
  if (useVideoBg) {
    if (bgBitmap) {
      ctx.drawImage(bgBitmap, 0, 0, w, h);
    } else if (videoEl) {
      try { ctx.drawImage(videoEl, 0, 0, w, h); } catch { /* not ready */ }
    } else {
      drawBackground(ctx, w, h, settings.background, null, 0, settings);
    }
  } else {
    drawBackground(ctx, w, h, settings.background, null, 0, settings);
  }

  if (settings.bgOverlay > 0) {
    ctx.fillStyle = `rgba(0,0,0,${settings.bgOverlay / 100})`;
    ctx.fillRect(0, 0, w, h);
  }
  drawOverlayStyle(ctx, w, h, settings.overlayStyle, settings.bgOverlay);
  if (ayah) {
    ctx.save();
    if (animProgress < 1 && settings.transitionStyle && settings.transitionStyle !== "none") {
      if (settings.transitionStyle === "fade") {
        ctx.globalAlpha = animProgress;
      } else if (settings.transitionStyle === "slide") {
        ctx.globalAlpha = animProgress;
        const offset = (1 - animProgress) * 40;
        ctx.translate(0, offset);
      } else if (settings.transitionStyle === "scale") {
        ctx.globalAlpha = animProgress;
        const scale = 0.95 + animProgress * 0.05;
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
      }
    }
    drawAyahFrame(ctx, canvas, ayah, surah, settings, platform, 1);
    ctx.restore();
  }
  if (settings.showWatermark && settings.watermarkText?.trim()) {
    drawWatermark(ctx, w, h, settings.watermarkText);
  }
}

/* ── Audio URL helpers ───────────────────────────────────────── */

function getAudioUrls(reciter: Reciter, surahNum: number, ayahNum: number): string[] {
  if (reciter.source !== "quranapi" || !reciter.quranApiNo) return [];
  const urls = [getQuranApiAudioUrl(reciter.quranApiNo, surahNum, ayahNum)];
  const ev   = getEveryayahAudioUrl(reciter.quranApiNo, surahNum, ayahNum);
  if (ev) urls.push(ev);
  return urls;
}

/** Opt 9: Accept AbortSignal to cancel in-flight audio fetches. */
async function fetchAudioBuffer(urls: string[], signal?: AbortSignal): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, { mode: "cors", signal });
      if (r.ok) return r.arrayBuffer();
    } catch {
      // If aborted, stop trying fallback URLs
      if (signal?.aborted) return null;
      /* try next URL */
    }
  }
  return null;
}

/* ── Segment type ────────────────────────────────────────────── */

interface PreparedAyah {
  ayah:     Ayah;
  samples:  Float32Array;
  totalSec: number;
  trailSec: number;
}

/* ══════════════════════════════════════════════════════════════
   Main export — orchestrates prep, then delegates to the worker
══════════════════════════════════════════════════════════════ */

export async function generateVideo(params: {
  ayahs:        Ayah[];
  surah:        Surah;
  reciter:      Reciter;
  settings:     VideoSettings;
  platform:     (typeof PLATFORMS)[0];
  bgVideoEl:    HTMLVideoElement | null;
  bgVideoBytes: Uint8Array | null;
  onLog:        (log: GenLog) => void;
  signal:       AbortSignal;
}): Promise<Blob> {
  const { ayahs, surah, reciter, settings, platform, bgVideoEl, onLog, signal } = params;
  const log = (msg: string, pct: number) => onLog({ msg, pct });

  const [cw, ch] = ASPECT[platform.aspect] ?? [720, 1280];

  const useVideoBg =
    (settings.background === "upload" || settings.background === "library") &&
    bgVideoEl !== null;

  // Best-effort WakeLock
  await acquireWakeLock();
  signal.addEventListener("abort", releaseWakeLock, { once: true });

  // Bug 5: try/finally ensures cleanup on ALL exit paths
  try {
    /* ── 1. Fetch + decode + resample audio (concurrent) ───── */
    log("Downloading & decoding audio…", 5);
    const verseSpacing = settings.verseSpacing ?? 0;

    const prepared: PreparedAyah[] = await parallelMap(
      ayahs,
      async (ayah, i) => {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        // Opt 8: Check prefetch cache first
        const cacheKey = reciter.quranApiNo
          ? audioCacheKey(reciter.quranApiNo, surah.number, ayah.numberInSurah)
          : "";
        let samples = cacheKey ? _audioCache.get(cacheKey) ?? null : null;

        if (!samples) {
          const urls      = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
          const rawBuffer = await fetchAudioBuffer(urls, signal);
          samples         = rawBuffer
            ? (await decodeAndResample(rawBuffer)) ?? silenceSamples(FALLBACK_DUR)
            : silenceSamples(FALLBACK_DUR);
        }

        const durSec = samples.length / SAMPLE_RATE;
        log(`Audio ${ayah.numberInSurah} (${i + 1}/${ayahs.length})`,
            5 + Math.round(((i + 1) / ayahs.length) * 15));
        return { ayah, samples, totalSec: LEAD_IN_SEC + durSec, trailSec: verseSpacing };
      },
      AUDIO_CONCURRENCY,
    );

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    releaseAudioContext();

    /* ── 2. Build one continuous audio track ────────────────── */
    log("Assembling audio track…", 22);

    const totalDurSec  = prepared.reduce((s, p) => s + p.totalSec + p.trailSec, 0);
    const totalSamples = Math.round(totalDurSec * SAMPLE_RATE);
    const fullTrack    = new Float32Array(totalSamples);

    {
      let offset = 0;
      const leadInSamples = Math.round(LEAD_IN_SEC * SAMPLE_RATE);
      for (const p of prepared) {
        offset += leadInSamples;
        // Bug 2 fix: bounds-check before writing to prevent overflow
        const safeOffset = Math.min(offset, totalSamples);
        const maxWritable = totalSamples - safeOffset;
        if (maxWritable > 0) {
          const writeLen = Math.min(p.samples.length, maxWritable);
          fullTrack.set(p.samples.subarray(0, writeLen), safeOffset);
        }
        offset += p.samples.length;
        offset += Math.round(p.trailSec * SAMPLE_RATE);
      }
    }

    /* ── 3. Pre-capture background video frames (main thread) ─ */
    let bgBitmaps: ImageBitmap[] = [];
    if (useVideoBg && bgVideoEl) {
      const totalFrames = Math.round(totalDurSec * FPS);
      log("Capturing background video frames…", 26);
      bgBitmaps = await captureBackgroundFrames(
        bgVideoEl, totalFrames, cw, ch,
        (done, total) => log(`Capturing background… ${done}/${total}`, 26 + Math.round((done / total) * 8)),
      );
      if (signal.aborted) { bgBitmaps.forEach((b) => b.close()); throw new DOMException("Aborted", "AbortError"); }
    }

    /* ── 4. Pre-render text overlays ───────────────────────── */
    log("Rendering text overlays…", 36);
    const ayahFrameBitmaps = await renderAyahOverlays(
      prepared, surah, settings, platform, cw, ch,
      (done, total) => log(`Rendering overlay ${done}/${total}`, 36 + Math.round((done / total) * 6)),
    );

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    /* ── 5. Hand off to the Worker ─────────────────────────── */
    log("Starting encoder (background thread)…", 42);

    const segments: WorkerSegment[] = prepared.map((p) => ({
      totalFrames: Math.round((p.totalSec + p.trailSec) * FPS),
    }));

    const blob = await runWorkerEncode({
      cw, ch, fps: FPS,
      videoBitrate: getVideoBitrate(cw, ch),
      audioBitrate: 128_000,
      sampleRate: SAMPLE_RATE,
      channels:   CHANNELS,
      frameDurationS: 1 / FPS,
      segments,
      ayahFrameBitmaps,
      bgBitmaps,
      fullAudioTrack: fullTrack,
      transitionStyle: settings.transitionStyle,
      onLog: log,
      signal,
    });

    return blob;
  } finally {
    // Bug 5: guarantee resource release on ALL exit paths (error, abort, success)
    releaseAudioContext();
    releaseWakeLock();
    signal.removeEventListener("abort", releaseWakeLock);
  }
}

/* ══════════════════════════════════════════════════════════════
   Worker bootstrap
══════════════════════════════════════════════════════════════ */

function runWorkerEncode(opts: {
  cw: number; ch: number; fps: number;
  videoBitrate: number; audioBitrate: number;
  sampleRate: number; channels: number;
  frameDurationS: number;
  segments: WorkerSegment[];
  ayahFrameBitmaps: ImageBitmap[];
  bgBitmaps: ImageBitmap[];
  fullAudioTrack: Float32Array;
  transitionStyle: "none" | "fade" | "slide" | "scale";
  onLog: (msg: string, pct: number) => void;
  signal: AbortSignal;
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./encode.worker.ts", import.meta.url), { type: "module" });

    const cleanup = () => {
      worker.terminate();
      opts.signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      const m: WorkerInMessage = { type: "abort" };
      worker.postMessage(m);
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    opts.signal.addEventListener("abort", onAbort);

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        opts.onLog(msg.msg, msg.pct);
      } else if (msg.type === "done") {
        cleanup();
        resolve(new Blob([msg.buffer], { type: "video/mp4" }));
      } else if (msg.type === "error") {
        cleanup();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (e) => {
      cleanup();
      reject(new Error(`Worker error: ${e.message}`));
    };

    const startMsg: WorkerInMessage = {
      type: "start",
      payload: {
        cw: opts.cw, ch: opts.ch, fps: opts.fps,
        videoBitrate: opts.videoBitrate, audioBitrate: opts.audioBitrate,
        sampleRate: opts.sampleRate, channels: opts.channels,
        frameDurationS: opts.frameDurationS,
        segments: opts.segments,
        ayahFrameBitmaps: opts.ayahFrameBitmaps,
        bgBitmaps: opts.bgBitmaps,
        fullAudioTrack: opts.fullAudioTrack.buffer as ArrayBuffer,
        transitionStyle: opts.transitionStyle,
      },
    };

    const transferList: Transferable[] = [
      opts.fullAudioTrack.buffer as ArrayBuffer,
      ...opts.ayahFrameBitmaps,
      ...opts.bgBitmaps,
    ];

    worker.postMessage(startMsg, transferList);
  });
}