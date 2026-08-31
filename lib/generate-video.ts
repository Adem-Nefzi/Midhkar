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
  decodeAndResample,
  silenceSamples,
  acquireAudioContext,
  releaseAudioContext,
  SAMPLE_RATE,
  CHANNELS,
  isWebCodecsSupported,
} from "./webcodecs-muxer";

import {
  getAudioUrlCandidates,
} from "@/lib/quran";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { VideoSettings, Platform } from "@/lib/types";
import { drawAyahFrame, drawBackground, drawOverlayStyle, drawWatermark } from "@/lib/canva-utils";
import { ensureFontsReady } from "./fonts-ready";
import { getCachedVideoDuration } from "./video-meta";
import {
  getDeviceProfile,
  getOutputResolution,
  getVideoBitrate,
} from "./device-profile";
import type {
  WorkerInMessage,
  WorkerOutMessage,
  WorkerSegment,
} from "./encode.worker";

export { isWebCodecsSupported };

/* ── Constants ───────────────────────────────────────────────── */

const FPS = 30;
// No pre-roll silence — text/audio start at the same timestamp (invariant).
const FALLBACK_DUR = 6;
const MAX_BG_FRAMES = 2400;
/* Per-clip frame budget sent to the worker. Each selected video gets up to
   this many full-rate (30fps) frames covering its WHOLE duration, sampled
   evenly: `step = ceil(duration*30 / MAX_BG_FRAMES)`. 2400 ≈ 80 s per clip
   at full 30fps — i.e. any chosen clip plays end-to-end, no truncation.
   RAM cost scales with mobile (see profile-aware maxBgFrames below). */
const AUDIO_CONCURRENCY = 6;

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
/* LRU cap so a long browsing session can't grow the decoded-audio cache
   without bound. Re-inserting on read keeps hot entries; the oldest entry
   is evicted first. A miss just re-downloads, so eviction is always safe. */
const AUDIO_CACHE_MAX = 300;

function audioCacheKey(reciterNo: number, surah: number, ayah: number): string {
  return `${reciterNo}:${surah}:${ayah}`;
}

function audioCacheGet(key: string): Float32Array | undefined {
  const hit = _audioCache.get(key);
  if (hit !== undefined) {
    // Refresh recency (Map keeps insertion order).
    _audioCache.delete(key);
    _audioCache.set(key, hit);
  }
  return hit;
}

function audioCacheSet(key: string, samples: Float32Array): void {
  if (_audioCache.has(key)) _audioCache.delete(key);
  _audioCache.set(key, samples);
  while (_audioCache.size > AUDIO_CACHE_MAX) {
    const oldest = _audioCache.keys().next().value;
    if (oldest === undefined) break;
    _audioCache.delete(oldest);
  }
}

export async function prefetchAudio(
  ayahs: Ayah[],
  reciter: Reciter,
  surah: Surah,
): Promise<void> {
  if (reciter.source !== "quranapi" || !reciter.quranApiNo) return;

  acquireAudioContext();
  try {
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
          if (samples) audioCacheSet(key, samples);
        }
      },
      AUDIO_CONCURRENCY,
    );
  } finally {
    releaseAudioContext();
  }
}

export function clearAudioCache(): void {
  _audioCache.clear();
}

/**
 * Total length (seconds) of the generated video for the given verse selection:
 * sum of each ayah's actual decoded audio duration + per-ayah trailing spacing.
 * Decodes audio (concurrent, cache-aware). Returns null while unknown/aborted.
 */
export async function estimateTotalDurationSec({
  ayahs,
  reciter,
  surah,
  verseSpacingSec,
  signal,
}: {
  ayahs: Ayah[];
  reciter: Reciter;
  surah: Surah;
  verseSpacingSec: number;
  signal?: AbortSignal;
}): Promise<number | null> {
  if (!ayahs.length) return 0;
  acquireAudioContext();
  try {
    const durations = await parallelMap(
      ayahs,
      async (ayah) => {
        if (signal?.aborted) return 0;
        const key = reciter.quranApiNo
          ? audioCacheKey(reciter.quranApiNo, surah.number, ayah.numberInSurah)
          : "";
        let samples = key ? (audioCacheGet(key) ?? null) : null;
        if (!samples) {
          const urls = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
          const raw = await fetchAudioBuffer(urls, signal);
          samples = raw ? await decodeAndResample(raw) : null;
          // Feed the shared cache so prefetch/generation reuse this decode.
          if (samples && key) audioCacheSet(key, samples);
        }
        if (!samples) return FALLBACK_DUR;
        return samples.length / SAMPLE_RATE;
      },
      AUDIO_CONCURRENCY,
    );
    if (signal?.aborted) return null;
    const speech = durations.reduce((a, b) => a + b, 0);
    return speech + ayahs.length * verseSpacingSec;
  } finally {
    releaseAudioContext();
  }
}

/**
 * Per-ayah decoded durations (seconds), index-aligned with `ayahs`.
 * Feeds the serverless render planner — the server trusts the client
 * for chunk boundaries but verifies totals (10-min cap).
 */
export async function estimateAyahDurationsSec({
  ayahs,
  reciter,
  surah,
  signal,
}: {
  ayahs: Ayah[];
  reciter: Reciter;
  surah: Surah;
  signal?: AbortSignal;
}): Promise<number[] | null> {
  if (!ayahs.length) return [];
  acquireAudioContext();
  try {
    const durations = await parallelMap(
      ayahs,
      async (ayah) => {
        if (signal?.aborted) return 0;
        const key = reciter.quranApiNo
          ? audioCacheKey(reciter.quranApiNo, surah.number, ayah.numberInSurah)
          : "";
        let samples = key ? (audioCacheGet(key) ?? null) : null;
        if (!samples) {
          const urls = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
          const raw = await fetchAudioBuffer(urls, signal);
          samples = raw ? await decodeAndResample(raw) : null;
          if (samples && key) audioCacheSet(key, samples);
        }
        return samples ? samples.length / SAMPLE_RATE : FALLBACK_DUR;
      },
      AUDIO_CONCURRENCY,
    );
    if (signal?.aborted) return null;
    return durations;
  } finally {
    releaseAudioContext();
  }
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

/* Fetch raw bytes of ONE background video. Returns null on any failure. */
async function fetchVideoBytes(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch (err) {
    if ((err as any)?.name === "AbortError" || signal.aborted) return null;
    console.warn("[fetchVideoBytes] failed:", err);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   BACKGROUND PLAYLIST — ordered list of bytes, one per selected video.
   Upload mode: exactly one (the File). Library/Pexels: 1..N selected videoUrls.
   The worker decodes them all and crossfades between them in order.
══════════════════════════════════════════════════════════════ */

async function getBackgroundBytesList(
  settings: VideoSettings,
  signal: AbortSignal,
): Promise<{ bytes: ArrayBuffer[]; durations: number[] }> {
  try {
    if (settings.background === "upload") {
      if (!settings.uploadedVideoFile) return { bytes: [], durations: [] };
      return {
        bytes: [await settings.uploadedVideoFile.arrayBuffer()],
        // Unknown without probing; the worker falls back to an even split.
        durations: [0],
      };
    }
    if (settings.background === "library" || settings.background === "pexels") {
      // Prefer the ordered playlist; fall back to the legacy single videoUrl.
      const urls =
        settings.videoUrls && settings.videoUrls.length
          ? settings.videoUrls
          : settings.videoUrl
            ? [settings.videoUrl]
            : [];
      if (!urls.length) return { bytes: [], durations: [] };
      // Fetch in playlist order, one at a time (predictable bandwidth). The
      // decode budget per video is what limits playlist coverage, not the
      // source list — trimming it here just hides the real fix, so DON'T.
      const out: ArrayBuffer[] = [];
      const durs: number[] = [];
      for (const u of urls) {
        const b = await fetchVideoBytes(u, signal);
        if (signal.aborted) return { bytes: [], durations: [] };
        if (b === null) continue; // unreachable file: skip, keep going
        out.push(b);
        // Keep durations in lockstep with the bytes that survived, so the
        // worker's proportional budget split maps to the right clips.
        const d = getCachedVideoDuration(u);
        durs.push(d && isFinite(d) && d > 0 ? d : 0);
      }
      return { bytes: out, durations: durs };
    }
  } catch (err) {
    if (signal.aborted) return { bytes: [], durations: [] };
    console.warn("[getBackgroundBytesList] failed:", err);
  }
  return { bytes: [], durations: [] };
}

/* ══════════════════════════════════════════════════════════════
   Text-overlay pre-rendering (unchanged)
══════════════════════════════════════════════════════════════ */

async function renderAyahOverlays(
  prepared: { ayah: Ayah }[],
  surah: Surah,
  settings: VideoSettings,
  cw: number,
  ch: number,
  onBatch: (startIndex: number, bitmaps: ImageBitmap[]) => void,
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  // A "video" background with no actual source (empty playlist, nothing
  // uploaded) degrades gracefully: bake the elegant default gradient into
  // the overlay bitmaps instead of leaving them transparent over nothing.
  const hasBgVideo =
    settings.background === "upload"
      ? !!settings.uploadedVideoUrl
      : settings.background === "library" || settings.background === "pexels"
        ? (settings.videoUrls?.length ?? 0) > 0 || !!settings.videoUrl
        : false;
  const isStaticBg = !hasBgVideo;

  // Overlays stream to the worker in batches as they're rendered, so a
  // long surah never piles up hundreds of full-res bitmaps on either side.
  const OVERLAY_BATCH = 8;
  let batch: ImageBitmap[] = [];
  let batchStart = 0;

  const flush = () => {
    if (batch.length === 0) return;
    onBatch(batchStart, batch);
    batchStart += batch.length;
    batch = [];
  };

  for (let i = 0; i < prepared.length; i++) {
    ctx.clearRect(0, 0, cw, ch);

    if (isStaticBg) {
      drawBackground(ctx, cw, ch, settings.background, 0, settings);
      if (settings.bgOverlay > 0) {
        ctx.fillStyle = `rgba(0,0,0,${settings.bgOverlay / 100})`;
        ctx.fillRect(0, 0, cw, ch);
      }
    }
    // Video backgrounds: keep the bitmap transparent — the worker draws
    // the decoded video frame + darkness overlay beneath it.

    drawOverlayStyle(ctx, cw, ch, settings.overlayStyle, settings.bgOverlay);
    drawAyahFrame(ctx, canvas, prepared[i].ayah, surah, settings);
    if (settings.showWatermark && settings.watermarkText?.trim()) {
      drawWatermark(ctx, cw, ch, settings.watermarkText);
    }

    batch.push(
      await createImageBitmap(canvas, { premultiplyAlpha: "none" }),
    );
    if (batch.length >= OVERLAY_BATCH) flush();
    onProgress(i + 1, prepared.length);
  }
  flush();

  return prepared.length;
}

/* ── Audio URL helpers (unchanged) ───────────────────────────── */

function getAudioUrls(
  reciter: Reciter,
  surahNum: number,
  ayahNum: number,
): string[] {
  if (reciter.source !== "quranapi" || !reciter.quranApiNo) return [];
  return getAudioUrlCandidates(reciter.quranApiNo, surahNum, ayahNum);
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
  platform: Platform;
  onLog: (log: { msg: string; pct: number }) => void;
  signal: AbortSignal;
}): Promise<Blob> {
  const { ayahs, surah, reciter, settings, platform, onLog, signal } = params;
  // Overlay rendering and the worker report progress concurrently; keep the
  // bar monotone so interleaved messages never make it jump backwards.
  let lastPct = 0;
  const log = (msg: string, pct: number) => {
    if (pct >= 0) lastPct = Math.max(lastPct, pct);
    onLog({ msg, pct: pct >= 0 ? lastPct : pct });
  };

  const profile = getDeviceProfile();
  const [cw, ch] = getOutputResolution(platform.aspect, profile.isLowPower);

  const needsBgVideo =
    settings.background === "upload" ||
    settings.background === "library" ||
    settings.background === "pexels";

  await acquireWakeLock();
  signal.addEventListener("abort", releaseWakeLock, { once: true });

  try {
    /* ── 1a. Kick off background playlist fetch immediately — runs
       concurrently with audio download/decode below. ──────────── */
    const bgBytesPromise: Promise<{
      bytes: ArrayBuffer[];
      durations: number[];
    }> = needsBgVideo
      ? getBackgroundBytesList(settings, signal)
      : Promise.resolve({ bytes: [], durations: [] });

    /* ── 1b. Fetch + decode + resample audio (concurrent) ───── */
    log("Downloading & decoding audio…", 5);
    const verseSpacing = settings.verseSpacing ?? 0;

    acquireAudioContext();
    const prepared: PreparedAyah[] = await parallelMap(
      ayahs,
      async (ayah, i) => {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        const cacheKey = reciter.quranApiNo
          ? audioCacheKey(reciter.quranApiNo, surah.number, ayah.numberInSurah)
          : "";
        let samples = cacheKey ? (audioCacheGet(cacheKey) ?? null) : null;

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
    releaseAudioContext();

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

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

    /* ── 3. Wait for background bytes (already downloading since
       step 1a — usually already resolved). ─────────────────────── */
    log("Preparing background…", 30);
    const { bytes: bgVideoBytesList, durations: bgDurations } =
      await bgBytesPromise;
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const requestedBg =
      settings.background === "upload"
        ? 1
      : (settings.videoUrls?.length ?? (settings.videoUrl ? 1 : 0));
    if (needsBgVideo && requestedBg > 0 && bgVideoBytesList.length === 0) {
      throw new Error(
        "Could not load the selected background video. Please re-select it in Settings, then try again.",
      );
    }

    /* ── 4. Start the worker. Audio encoding + background decode begin
       immediately, overlapping with overlay rendering below. ───────── */
    log("Starting encoder (background thread)…", 33);

    const segments: WorkerSegment[] = buildSegments(prepared);
    const totalRenderFrames =
      segments.reduce((s, seg) => s + seg.totalFrames, 0) || 1;

    /* Per-clip frame budget, sampled evenly across each clip's real length.
       Desktop: 2400 frames = 80s at full 30fps (covers virtually any pick).
       Mobile drops to 1200 (≈40s @30fps) and 720p output so RAM stays sane. */
    const maxBgFrames = profile.isLowPower ? 1200 : MAX_BG_FRAMES;
    /* The playlist as a whole may never hold more frames than the output can
       actually display — this is what stops a long playlist from multiplying
       resident bitmap memory. Small margin covers the seam crossfades. */
    const maxTotalBgFrames = totalRenderFrames + 64;

    const enc = startWorkerEncode({
      cw,
      ch,
      renderFps: FPS,
      outputFps: profile.isLowPower ? 30 : 60,
      videoBitrate: getVideoBitrate(cw, ch, profile),
      audioBitrate: 128_000,
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      frameDurationS: 1 / FPS,
      segments,
      overlayCount: prepared.length,
      bgVideoBytes: bgVideoBytesList,
      maxBgFrames,
      maxTotalBgFrames,
      bgDurations,
      fullAudioTrack: fullTrack,
      transitionStyle: settings.transitionStyle,
      latencyMode: profile.latencyMode,
      bgOverlayPct: settings.bgOverlay ?? 0,
      onLog: (msg, pct) => log(msg, pct),
      signal: signal,
    });

    /* ── 5. Render text overlays and stream them to the worker in
       batches (it never holds more than a handful at once). ───────── */
    log("Rendering text overlays…", 36);
    try {
      await ensureFontsReady(settings); // Critical for mobile + new web fonts
      await renderAyahOverlays(
        prepared,
        surah,
        settings,
        cw,
        ch,
        (startIndex, bitmaps) => enc.postOverlays(startIndex, bitmaps),
        (done, total) =>
          log(
            `Rendering overlay ${done}/${total}`,
            36 + Math.round((done / total) * 10),
          ),
      );
    } catch (err) {
      enc.fail(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }

    if (signal.aborted) {
      enc.fail(new DOMException("Aborted", "AbortError"));
      throw new DOMException("Aborted", "AbortError");
    }

    const blob = await enc.promise;
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

function startWorkerEncode(opts: {
  cw: number;
  ch: number;
  renderFps: number;
  outputFps: number;
  videoBitrate: number;
  audioBitrate: number;
  sampleRate: number;
  channels: number;
  frameDurationS: number;
  segments: WorkerSegment[];
  overlayCount: number;
  bgVideoBytes: ArrayBuffer[];
  maxBgFrames: number;
  maxTotalBgFrames: number;
  bgDurations: number[];
  fullAudioTrack: Float32Array;
  transitionStyle: "none" | "fade" | "slide" | "scale";
  latencyMode: "quality" | "realtime";
  bgOverlayPct: number;
  onLog: (msg: string, pct: number) => void;
  signal: AbortSignal;
}): {
  promise: Promise<Blob>;
  postOverlays: (startIndex: number, bitmaps: ImageBitmap[]) => void;
  fail: (err: Error) => void;
} {
  const worker = new Worker(new URL("./encode.worker.ts", import.meta.url), {
    type: "module",
  });

  let settled = false;
  let resolveFn: (blob: Blob) => void = () => {};
  let rejectFn: (err: Error) => void = () => {};

  const cleanup = () => {
    worker.terminate();
    opts.signal.removeEventListener("abort", onAbort);
  };

  const onAbort = () => {
    // The worker is terminated immediately below — posting an "abort"
    // message first could never be processed in time, so just clean up.
    if (settled) return;
    settled = true;
    cleanup();
    rejectFn(new DOMException("Aborted", "AbortError"));
  };
  opts.signal.addEventListener("abort", onAbort);

  worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
    const msg = e.data;
    if (msg.type === "progress") {
      opts.onLog(msg.msg, msg.pct);
    } else if (msg.type === "done") {
      if (settled) return;
      settled = true;
      cleanup();
      resolveFn(new Blob([msg.buffer], { type: "video/mp4" }));
    } else if (msg.type === "error") {
      if (settled) return;
      settled = true;
      cleanup();
      rejectFn(new Error(msg.message));
    }
  };

  worker.onerror = (e) => {
    if (settled) return;
    settled = true;
    cleanup();
    // An ErrorEvent (script threw) carries file/line; a bare Event or a
    // module-load failure often has neither, but some browsers expose
    // `.error` — serialize everything we can find so we never guess.
    const ev = e as any;
    const parts: string[] = [];
    if (ev.message) parts.push(String(ev.message));
    if (ev.filename) parts.push(`${ev.filename.split("/").pop()}:${ev.lineno}:${ev.colno}`);
    if (ev.error) parts.push(ev.error?.stack || String(ev.error));
    const detail =
      parts.join(" · ") ||
      `script load failed (${e.type ?? "error"}) — likely a stale chunk; wipe .next and restart`;
    rejectFn(new Error(`Worker error: ${detail}`));
    // Also log the raw event for deep inspection in DevTools.
    console.error("[worker.onerror] raw event:", e);
  };

  const startMsg: WorkerInMessage = {
    type: "start",
    payload: {
      cw: opts.cw,
      ch: opts.ch,
      renderFps: opts.renderFps,
      outputFps: opts.outputFps,
      videoBitrate: opts.videoBitrate,
      audioBitrate: opts.audioBitrate,
      sampleRate: opts.sampleRate,
      channels: opts.channels,
      segments: opts.segments,
      overlayCount: opts.overlayCount,
      bgVideoBytes: opts.bgVideoBytes,
      maxBgFrames: opts.maxBgFrames,
      maxTotalBgFrames: opts.maxTotalBgFrames,
      bgDurations: opts.bgDurations,
      fullAudioTrack: opts.fullAudioTrack.buffer as ArrayBuffer,
      transitionStyle: opts.transitionStyle,
      latencyMode: opts.latencyMode,
      bgOverlayPct: opts.bgOverlayPct,
    },
  };

  const transferList: Transferable[] = [
    opts.fullAudioTrack.buffer as ArrayBuffer,
    ...opts.bgVideoBytes,
  ];

  worker.postMessage(startMsg, transferList);

  const promise = new Promise<Blob>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {
    promise,
    postOverlays: (startIndex, bitmaps) => {
      if (settled) {
        // Worker already gone — release bitmaps that will never be sent.
        bitmaps.forEach((b) => b.close());
        return;
      }
      worker.postMessage(
        { type: "overlays", startIndex, bitmaps },
        bitmaps as unknown as Transferable[],
      );
    },
    fail: (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectFn(err);
    },
  };
}
