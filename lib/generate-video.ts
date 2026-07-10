"use client";
/**
 * generate-video.ts  —  Mediabunny + Worker edition (v8, synced verse transitions)
 *
 * Change from v7 (see encode.worker.ts v3 header for the full explanation):
 *  - Segment frame counts are now built via CUMULATIVE allocation instead of
 *    each verse rounding (totalSec+trailSec)*FPS independently. Independent
 *    per-verse rounding (up to ±16ms each) doesn't cancel out — it
 *    accumulates over the whole video, so a long surah could drift the
 *    video visibly out of sync with the audio by the last few verses.
 *    Cumulative allocation keeps total drift under half a frame, always,
 *    regardless of verse count.
 *  - Each segment now also carries `trailFrames` (how many of its own
 *    frames are trailing silence from `verseSpacing`, vs actual speech),
 *    which the worker uses to place verse-to-verse transitions inside
 *    silence gaps when one exists, instead of over spoken audio.
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

import {
  PLATFORMS,
  getQuranApiAudioUrl,
  getEveryayahAudioUrl,
} from "@/lib/quran";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { VideoSettings, GenLog } from "@/lib/types";
import { drawAyahFrame, drawBackground } from "@/lib/canva-utils";
import type {
  WorkerInMessage,
  WorkerOutMessage,
  WorkerSegment,
} from "./encode.worker";

export { isWebCodecsSupported };

/* ── Constants ───────────────────────────────────────────────── */

const FPS = 30;
const LEAD_IN_SEC = 0; // No pre-roll silence — text/audio start together.
const FALLBACK_DUR = 6;
const MAX_BG_FRAMES = 900;
const AUDIO_CONCURRENCY = 6;

const ASPECT: Record<string, [number, number]> = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "1:1": [1080, 1080],
};

/* ══════════════════════════════════════════════════════════════
   Device-adaptive quality profile (unchanged from v7)
══════════════════════════════════════════════════════════════ */

export interface DeviceProfile {
  isLowPower: boolean;
  bitrateScale: number;
  latencyMode: "quality" | "realtime";
}

export function getDeviceProfile(): DeviceProfile {
  if (typeof navigator === "undefined") {
    return { isLowPower: false, bitrateScale: 1, latencyMode: "realtime" };
  }
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory as number | undefined;

  const isLowPower =
    isMobileUA && (cores <= 6 || (mem !== undefined && mem <= 4));

  return {
    isLowPower,
    bitrateScale: isLowPower ? 0.7 : 1,
    latencyMode: "realtime",
  };
}

function getOutputResolution(
  platform: (typeof PLATFORMS)[0],
): [number, number] {
  return ASPECT[platform.aspect] ?? [720, 1280];
}

function getVideoBitrate(
  cw: number,
  ch: number,
  profile: DeviceProfile,
): number {
  const pixels = cw * ch;
  let base: number;
  if (pixels >= 1080 * 1080) base = 3_500_000;
  else if (pixels >= 1280 * 720) base = 3_000_000;
  else base = 2_500_000;
  return Math.round(base * profile.bitrateScale);
}

/* ══════════════════════════════════════════════════════════════
   Concurrent-limited parallel map (unchanged)
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
   Audio prefetch cache (unchanged)
══════════════════════════════════════════════════════════════ */

const _audioCache = new Map<string, Float32Array>();

function audioCacheKey(reciterNo: number, surah: number, ayah: number): string {
  return `${reciterNo}:${surah}:${ayah}`;
}

export async function prefetchAudio(
  ayahs: Ayah[],
  reciter: Reciter,
  surah: Surah,
): Promise<void> {
  if (reciter.source !== "quranapi" || !reciter.quranApiNo) return;

  await parallelMap(
    ayahs,
    async (ayah) => {
      const key = audioCacheKey(
        reciter.quranApiNo!,
        surah.number,
        ayah.numberInSurah,
      );
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

export function clearAudioCache(): void {
  _audioCache.clear();
}

/* ══════════════════════════════════════════════════════════════
   Wake Lock (unchanged)
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

/* ══════════════════════════════════════════════════════════════
   Background video: fetch raw bytes only (main thread) — unchanged
══════════════════════════════════════════════════════════════ */

async function getBackgroundBytes(
  settings: VideoSettings,
  signal: AbortSignal,
): Promise<ArrayBuffer | null> {
  try {
    if (settings.background === "upload" && settings.uploadedVideoFile) {
      return await settings.uploadedVideoFile.arrayBuffer();
    }
    if (settings.background === "library" && settings.videoUrl) {
      const r = await fetch(settings.videoUrl, { signal });
      if (!r.ok) return null;
      return await r.arrayBuffer();
    }
  } catch (err) {
    if (signal.aborted) return null;
    console.warn("[getBackgroundBytes] failed:", err);
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   Text-overlay pre-rendering (unchanged)
══════════════════════════════════════════════════════════════ */

async function renderAyahOverlays(
  prepared: { ayah: Ayah }[],
  surah: Surah,
  settings: VideoSettings,
  platform: (typeof PLATFORMS)[0],
  cw: number,
  ch: number,
  onProgress: (done: number, total: number) => void,
): Promise<ImageBitmap[]> {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  const isStaticBg =
    settings.background !== "upload" && settings.background !== "library";
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

/* ── Overlay + watermark helpers (unchanged) ─────────────────── */

function drawOverlayStyle(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  style: VideoSettings["overlayStyle"],
  intensityPct: number,
): void {
  if (style === "none" || intensityPct <= 0) return;
  const alpha = Math.min(0.85, (intensityPct / 100) * 0.85);
  let g: CanvasGradient;
  if (style === "radial") {
    g = ctx.createRadialGradient(
      cw / 2,
      ch / 2,
      Math.min(cw, ch) * 0.2,
      cw / 2,
      ch / 2,
      Math.max(cw, ch) * 0.7,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  } else {
    g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
  }
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  text: string,
): void {
  ctx.save();
  ctx.font = `${Math.round(ch * 0.022)}px sans-serif`;
  ctx.fillStyle = "rgba(245,240,232,0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const pad = Math.round(ch * 0.025);
  ctx.fillText(text, cw - pad, ch - pad);
  ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   renderFullFrame — kept for the live preview in StepGenerate (unchanged)
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

  const useVideoBg =
    settings.background === "upload" || settings.background === "library";
  if (useVideoBg) {
    if (bgBitmap) {
      ctx.drawImage(bgBitmap, 0, 0, w, h);
    } else if (videoEl) {
      try {
        ctx.drawImage(videoEl, 0, 0, w, h);
      } catch {
        /* not ready */
      }
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
    if (
      animProgress < 1 &&
      settings.transitionStyle &&
      settings.transitionStyle !== "none"
    ) {
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

/* ── Audio URL helpers (unchanged) ───────────────────────────── */

function getAudioUrls(
  reciter: Reciter,
  surahNum: number,
  ayahNum: number,
): string[] {
  if (reciter.source !== "quranapi" || !reciter.quranApiNo) return [];
  const urls = [getQuranApiAudioUrl(reciter.quranApiNo, surahNum, ayahNum)];
  const ev = getEveryayahAudioUrl(reciter.quranApiNo, surahNum, ayahNum);
  if (ev) urls.push(ev);
  return urls;
}

async function fetchAudioBuffer(
  urls: string[],
  signal?: AbortSignal,
): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, { mode: "cors", signal });
      if (r.ok) return r.arrayBuffer();
    } catch {
      if (signal?.aborted) return null;
      /* try next URL */
    }
  }
  return null;
}

/* ── Segment type ────────────────────────────────────────────── */

interface PreparedAyah {
  ayah: Ayah;
  samples: Float32Array;
  totalSec: number;
  trailSec: number;
}

/* ══════════════════════════════════════════════════════════════
   Drift-free segment (frame count) allocation
   ──────────────────────────────────────────────────────────────
   Rounding (totalSec+trailSec)*FPS independently PER VERSE is what
   caused long-surah drift: each verse's rounding error (up to ±16ms)
   just adds onto the next verse's, with nothing to cancel it out.
   Instead, track cumulative time and derive each segment's frame count
   as the DIFFERENCE between consecutive cumulative frame counts. This
   is the standard "frame accumulator" technique — the sum of all
   segments' frames always equals round(totalDuration*FPS) exactly, so
   drift never exceeds half a frame no matter how many verses there are.
══════════════════════════════════════════════════════════════ */

function buildSegments(prepared: PreparedAyah[]): WorkerSegment[] {
  let cumSec = 0;
  let cumFrames = 0;
  return prepared.map((p) => {
    cumSec += p.totalSec + p.trailSec;
    const newCumFrames = Math.round(cumSec * FPS);
    const totalFrames = Math.max(1, newCumFrames - cumFrames);
    cumFrames = newCumFrames;
    // trailFrames only needs to be approximately right (it just tells the
    // worker how much silence is available to hide a transition in), so a
    // simple non-cumulative rounding here is fine.
    const trailFrames = Math.min(totalFrames, Math.round(p.trailSec * FPS));
    return { totalFrames, trailFrames };
  });
}

/* ══════════════════════════════════════════════════════════════
   Main export — orchestrates prep, then delegates to the worker.
══════════════════════════════════════════════════════════════ */

export async function generateVideo(params: {
  ayahs: Ayah[];
  surah: Surah;
  reciter: Reciter;
  settings: VideoSettings;
  platform: (typeof PLATFORMS)[0];
  onLog: (log: GenLog) => void;
  signal: AbortSignal;
}): Promise<Blob> {
  const { ayahs, surah, reciter, settings, platform, onLog, signal } = params;
  const log = (msg: string, pct: number) => onLog({ msg, pct });

  const profile = getDeviceProfile();
  const [cw, ch] = getOutputResolution(platform);

  const needsBgVideo =
    settings.background === "upload" || settings.background === "library";

  await acquireWakeLock();
  signal.addEventListener("abort", releaseWakeLock, { once: true });

  try {
    /* ── 1a. Kick off background bytes fetch immediately — runs
       concurrently with audio download/decode below. ──────────── */
    const bgBytesPromise: Promise<ArrayBuffer | null> = needsBgVideo
      ? getBackgroundBytes(settings, signal)
      : Promise.resolve(null);

    /* ── 1b. Fetch + decode + resample audio (concurrent) ───── */
    log("Downloading & decoding audio…", 5);
    const verseSpacing = settings.verseSpacing ?? 0;

    const prepared: PreparedAyah[] = await parallelMap(
      ayahs,
      async (ayah, i) => {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        const cacheKey = reciter.quranApiNo
          ? audioCacheKey(reciter.quranApiNo, surah.number, ayah.numberInSurah)
          : "";
        let samples = cacheKey ? (_audioCache.get(cacheKey) ?? null) : null;

        if (!samples) {
          const urls = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
          const rawBuffer = await fetchAudioBuffer(urls, signal);
          samples = rawBuffer
            ? ((await decodeAndResample(rawBuffer)) ??
              silenceSamples(FALLBACK_DUR))
            : silenceSamples(FALLBACK_DUR);
        }

        const durSec = samples.length / SAMPLE_RATE;
        log(
          `Audio ${ayah.numberInSurah} (${i + 1}/${ayahs.length})`,
          5 + Math.round(((i + 1) / ayahs.length) * 20),
        );
        return { ayah, samples, totalSec: durSec, trailSec: verseSpacing };
      },
      AUDIO_CONCURRENCY,
    );

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    releaseAudioContext();

    /* ── 2. Build one continuous audio track ────────────────── */
    log("Assembling audio track…", 26);

    const totalDurSec = prepared.reduce(
      (s, p) => s + p.totalSec + p.trailSec,
      0,
    );
    const totalSamples = Math.round(totalDurSec * SAMPLE_RATE);
    const fullTrack = new Float32Array(totalSamples);

    {
      let offset = 0;
      for (const p of prepared) {
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

    /* ── 3. Render text overlays (main thread, cheap) ───────── */
    log("Rendering text overlays…", 30);
    const ayahFrameBitmaps = await renderAyahOverlays(
      prepared,
      surah,
      settings,
      platform,
      cw,
      ch,
      (done, total) =>
        log(
          `Rendering overlay ${done}/${total}`,
          30 + Math.round((done / total) * 8),
        ),
    );

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    /* ── 4. Wait for background bytes (already downloading since
       step 1a — usually already resolved). ─────────────────────── */
    log("Preparing background…", 40);
    const bgVideoBytes = await bgBytesPromise;
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    /* ── 5. Hand everything off to the Worker. ─────────────────── */
    log("Starting encoder (background thread)…", 42);

    const segments: WorkerSegment[] = buildSegments(prepared);

    const blob = await runWorkerEncode({
      cw,
      ch,
      fps: FPS,
      videoBitrate: getVideoBitrate(cw, ch, profile),
      audioBitrate: 128_000,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      frameDurationS: 1 / FPS,
      segments,
      ayahFrameBitmaps,
      bgVideoBytes,
      maxBgFrames: MAX_BG_FRAMES,
      fullAudioTrack: fullTrack,
      transitionStyle: settings.transitionStyle,
      latencyMode: profile.latencyMode,
      onLog: log,
      signal,
    });

    return blob;
  } finally {
    releaseAudioContext();
    releaseWakeLock();
    signal.removeEventListener("abort", releaseWakeLock);
  }
}

/* ══════════════════════════════════════════════════════════════
   Worker bootstrap
══════════════════════════════════════════════════════════════ */

function runWorkerEncode(opts: {
  cw: number;
  ch: number;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  sampleRate: number;
  channels: number;
  frameDurationS: number;
  segments: WorkerSegment[];
  ayahFrameBitmaps: ImageBitmap[];
  bgVideoBytes: ArrayBuffer | null;
  maxBgFrames: number;
  fullAudioTrack: Float32Array;
  transitionStyle: "none" | "fade" | "slide" | "scale";
  latencyMode: "quality" | "realtime";
  onLog: (msg: string, pct: number) => void;
  signal: AbortSignal;
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./encode.worker.ts", import.meta.url), {
      type: "module",
    });

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
        cw: opts.cw,
        ch: opts.ch,
        fps: opts.fps,
        videoBitrate: opts.videoBitrate,
        audioBitrate: opts.audioBitrate,
        sampleRate: opts.sampleRate,
        channels: opts.channels,
        frameDurationS: opts.frameDurationS,
        segments: opts.segments,
        ayahFrameBitmaps: opts.ayahFrameBitmaps,
        bgVideoBytes: opts.bgVideoBytes,
        maxBgFrames: opts.maxBgFrames,
        fullAudioTrack: opts.fullAudioTrack.buffer as ArrayBuffer,
        transitionStyle: opts.transitionStyle,
        latencyMode: opts.latencyMode,
      },
    };

    const transferList: Transferable[] = [
      opts.fullAudioTrack.buffer as ArrayBuffer,
      ...opts.ayahFrameBitmaps,
    ];
    if (opts.bgVideoBytes) transferList.push(opts.bgVideoBytes);

    worker.postMessage(startMsg, transferList);
  });
}
