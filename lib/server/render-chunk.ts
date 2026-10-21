/**
 * render-chunk.ts — encodes ONE verse-aligned chunk of a render plan
 * to an H.264/AAC MP4 (the old render-service/ Docker port was deleted)
 * (cumulative segments, alpha-sum-1 crossfades, bg seams, bitrate
 * ladder, x264 memory-diet profile). Identical encode parameters on
 * every chunk → the MP4s concat losslessly.
 */
import { createCanvas, loadImage, type Canvas } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { ensureFonts } from "./server-canvas/fonts";
import {
  drawAyahFrame,
  drawOverlayStyle,
  drawVignette,
  drawWatermark,
} from "./server-canvas/canva-utils";
import type { RenderPlanSpec, RenderChunk, PlanAyah } from "@/lib/render-plan";
import type { VideoSettings } from "./server-canvas/types-settings";
import { applyAyahDeclick, applyBookendFades } from "@/lib/audio-fades";

const RENDER_FPS = 30;
const TRANSITION_WINDOW_FRAMES = 8;
const SEAM_FRAMES = 10;
const FALLBACK_DUR = 6;
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 160_000;

type ProgressFn = (msg: string, pct: number) => void;

/* Audio fetch + decode to mono 48kHz PCM */

function audioUrlCandidates(
  reciter: RenderPlanSpec["reciter"],
  surah: number,
  ayah: number,
): string[] {
  const urls: string[] = [];
  /* STRICT === true — mirrors lib/quran.ts getAudioUrlCandidates: an
   * omitted/undefined primary means the-quran-project folder is dead,
   * go straight to everyayah. `!== false` used to 404 first. */
  if (reciter.primary === true) {
    urls.push(
      `https://the-quran-project.github.io/Quran-Audio/Data/${reciter.quranApiNo}/${surah}_${ayah}.mp3`,
    );
  }
  const s = String(surah).padStart(3, "0");
  const a = String(ayah).padStart(3, "0");
  if (reciter.everyayahFolder) {
    urls.push(`https://everyayah.com/data/${reciter.everyayahFolder}/${s}${a}.mp3`);
  }
  return urls;
}

async function fetchAudioBuffer(urls: string[]): Promise<Buffer | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (r.ok) {
        const b = Buffer.from(await r.arrayBuffer());
        if (b.length > 512) return b; // reject 404-HTML bodies
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/* Concurrency-limited async map — index-aligned results. */
async function asyncPool<T, R>(
  limit: number,
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  let next = 0;
  const results: R[] = new Array(items.length);
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  /* Promise.all resolves with the RUNS' void return values, never with
     the filled array — results must be returned explicitly. */
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

/** Decode any audio to mono 48kHz f32le PCM. Rejects on decode failure
 *  (non-zero exit / no samples) — a silent empty buffer would delete
 *  that verse's audio and desync the whole video. */
function decodeAudioPcm(input: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), [
      "-v", "error",
      "-i", "pipe:0",
      "-ar", String(SAMPLE_RATE),
      "-ac", "1",
      "-f", "f32le",
      "-",
    ], { windowsHide: true });
    const chunks: Buffer[] = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        reject(new Error("audio decode timeout"));
      }
    }, 60_000);
    proc.stdout.on("data", (d) => chunks.push(d));
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if ((code ?? -1) !== 0) {
        reject(new Error(`audio decode failed (${code}): ${stderr.slice(-200)}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      if (buf.length < 4) {
        reject(new Error("audio decode produced no samples"));
        return;
      }
      const samples = new Float32Array(buf.length / 4);
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readFloatLE(i * 4);
      resolve(samples);
    });
    proc.stdin.end(input);
  });
}

/* ── Bg frames ──────────────────────────────────────────────────
 * Frames are extracted as JPEG (mjpeg) — ~10x smaller than PNG at
 * 1080×1920 — and kept as encoded buffers; they are decoded to RGBA
 * on demand with a small LRU cache. Storing PNG + pre-decoding every
 * frame needs multi-GB on a 2GB function.
 * JPEG streams are parsed on the EOI marker (FFD9), robust to
 * restart markers. */
const JPEG_EOI = Buffer.from([0xff, 0xd9]);

function extractBgFrames(
  input: string | Buffer,
  cw: number,
  ch: number,
  maxFrames: number,
): Promise<Buffer[]> {
  const scale = `scale='max(${cw},iw*${ch}/ih)':'max(${ch},ih*${cw}/iw)'`;
  const inputArgs = typeof input === "string"
    ? [
        /* Robust remote fetch: reconnect on mid-stream errors, fail
         * fast instead of hanging to the 300s function cap. */
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "4",
        "-rw_timeout", "20000000",
        "-i", input,
      ]
    : ["-i", "pipe:0"];
  const args = [
    "-v", "error",
    ...inputArgs,
    "-vf", `${scale},crop=${cw}:${ch}`,
    "-fps_mode", "vfr",
    "-frames:v", String(maxFrames),
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "-q:v", "4",
    "-",
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args, { windowsHide: true });
    const frames: Buffer[] = [];
    let buf = Buffer.alloc(0);
    let stderr = "";
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(frames);
    };
    proc.stdout.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      let idx;
      while ((idx = buf.indexOf(JPEG_EOI)) !== -1) {
        frames.push(Buffer.from(buf.subarray(0, idx + 2)));
        buf = buf.subarray(idx + 2);
      }
    });
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (e) => finish(new Error("bg frame extraction failed: " + e.message)));
    proc.on("close", (code) => {
      /* Exit code is the truth: a 403/timeout/demux failure must NOT
       * resolve as "0 frames" — callers would render black video. */
      if ((code ?? -1) !== 0) {
        finish(new Error(`bg extraction failed (${code}): ${stderr.slice(-200)}`));
        return;
      }
      finish();
    });
    if (Buffer.isBuffer(input)) proc.stdin.end(input);
    else proc.stdin.end();
  });
}

async function probeDuration(src: string): Promise<number> {
  const bin = await ffprobeBin();
  const out = await new Promise<string>((resolve, reject) => {
    const proc = spawn(bin, [
      "-v", "error",
      "-rw_timeout", "20000000",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      src,
    ], { windowsHide: true });
    let stdout = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGKILL");
        reject(new Error("probe timeout"));
      }
    }, 25_000);
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", () => {});
    proc.on("error", (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(stdout);
    });
  });
  const d = parseFloat(out.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe failed for ${src}`);
  return d;
}

/* ── Binaries ──────────────────────────────────────────────────── */

function ffmpegBin(): string {
  return (ffmpegStatic as unknown as string) || "ffmpeg";
}

let ffprobePath = "";
async function ffprobeBin(): Promise<string> {
  if (ffprobePath) return ffprobePath;
  try {
    const probe = (await import("ffprobe-static")).default as { path: string };
    ffprobePath = probe.path;
  } catch {
    ffprobePath = "ffprobe";
  }
  return ffprobePath;
}

/* Gradient fallback painted under the overlays whenever a bg frame is
 * missing/un-decodable and when there is no bg video at all — kept in
 * lockstep with the gradient the overlay-baking path uses. Darkening
 * is applied ONCE here (no separate bgOverlay pass when this runs). */
function drawFallbackBg(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
): void {
  const g = ctx.createLinearGradient(0, 0, cw, ch);
  g.addColorStop(0, "#09090f");
  g.addColorStop(0.5, "#120d03");
  g.addColorStop(1, "#09090f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  const glow = ctx.createRadialGradient(
    cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.55,
  );
  glow.addColorStop(0, "rgba(212,175,55,0.07)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, cw, ch);
}

/* ── Resolution / bitrate (mirror device-profile) ─────────────── */

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

/* Segments / transitions (cumulative-time allocation - drift-free) */

interface Segment {
  totalFrames: number;
  trailFrames: number;
  /** Later page of the same verse (long-verse pager) — page boundaries
   *  always crossfade, even with verse transitions disabled. */
  page?: boolean;
}

function buildSegments(
  durations: { totalSec: number; trailSec: number; page?: boolean }[],
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
    segments.push({ totalFrames: total, trailFrames: trail, page: d.page });
    cumFrames = newCum;
    totalFrames += total;
  }
  return { segments, totalFrames };
}

/** Page plan for one ayah: client-provided pages (when valid) scaled to
 *  the SERVER-measured audio duration, or a single full-ayah item. */
function planPagesFor(
  ayah: PlanAyah,
  measuredSec: number,
): {
  numberInSurah: number;
  text: string;
  translation: string;
  durationSec: number;
  pageInfo?: { index: number; total: number };
}[] {
  const single = [
    {
      numberInSurah: ayah.numberInSurah,
      text: ayah.text,
      translation: ayah.translation,
      durationSec: measuredSec,
    },
  ];
  const pages = ayah.pages;
  if (!pages || pages.length < 2) return single;
  let sum = 0;
  for (const p of pages) {
    if (
      typeof p?.text !== "string" ||
      typeof p?.translation !== "string" ||
      !Number.isFinite(p?.durationSec) ||
      p.durationSec <= 0
    ) {
      return single;
    }
    sum += p.durationSec;
  }
  if (!(sum > 0)) return single;
  const scale = measuredSec / sum;
  const total = pages.length;
  return pages.map((p, i) => ({
    numberInSurah: ayah.numberInSurah,
    text: p.text,
    translation: p.translation,
    durationSec: p.durationSec * scale,
    pageInfo: { index: i + 1, total },
  }));
}

/* Crossfade boundary AFTER a segment — mirrors encode.worker.ts
 * computeBoundaries. trailFrames is uniform across segments
 * (round(verseSpacing * fps); segment totals always exceed it), so
 * both sides of a chunk seam compute the SAME {pre, post} and the
 * crossfade stitches losslessly across concat.
 *   trail >= TW  -> whole window in the earlier verse's silence
 *   0 < trail<TW -> use the silence, remainder from the next verse
 *   trail = 0    -> split evenly across the hard cut
 * (The old nextLead branch returned {pre:0, post:8} for trail=0 —
 * a window that starts past the segment end, so ZERO frames ever
 * rendered: hard cut on every verse.) */
function boundaryFor(
  trailFrames: number,
  transitionStyle: string,
  isPage = false,
  revealAnimation = "fade",
): { pre: number; post: number } {
  const TW = TRANSITION_WINDOW_FRAMES;
  /* Page boundary inside one verse: hard cut when the user picked
     "cut" (matches encode.worker.ts computeBoundaries), otherwise
     crossfade split evenly — no silence to hide in. */
  if (isPage) {
    if (revealAnimation === "cut") return { pre: 0, post: 0 };
    return { pre: Math.floor(TW / 2), post: TW - Math.floor(TW / 2) };
  }
  if (transitionStyle === "none") return { pre: 0, post: 0 };
  const trail = Math.max(0, trailFrames);
  if (trail >= TW) return { pre: TW, post: 0 };
  if (trail > 0) return { pre: trail, post: TW - trail };
  return { pre: Math.floor(TW / 2), post: TW - Math.floor(TW / 2) };
}

/* ── The chunk render ─────────────────────────────────────────── */

/* Crossfade alpha easing (transitionCurve = "ease") — smooth S-curve
   instead of a linear ramp. Mirrors encode.worker.ts exactly; both
   engines must apply it at the same t so chunk seams lose no
   lockstep. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/* ── Bg relay signal ────────────────────────────────────────────
 * Thrown when bg videos were selected but every clip failed to
 * extract (typically Pexels/Cloudflare 403ing the Vercel datacenter
 * IP). The chunk route translates this to HTTP 422 bg_unavailable and
 * the CLIENT re-uploads the videos browser→Blob (its IP is clean) and
 * retries the chunk. */
export class BgUnavailableError extends Error {
  constructor(urlsAttempted: number) {
    super(
      `all ${urlsAttempted} background clips failed to fetch/decode server-side`,
    );
    this.name = "BgUnavailableError";
  }
}

export async function renderChunk(
  spec: RenderPlanSpec,
  chunk: RenderChunk,
  chunkIndex: number,
  chunkCount: number,
  onProgress: ProgressFn,
  signal: AbortSignal,
  bgUploads: Uint8Array[] = [],
  noBg = false,
): Promise<Buffer> {
  ensureFonts();
  /* The wire settings ARE the app's VideoSettings — the vendor copy
     expects that exact shape. Numeric fields fall back to defaults so
     a sparse spec can never produce NaN inside canvas ops. */
  const rawS = spec.settings as unknown as VideoSettings;
  const numOr = (v: unknown, def: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const s: VideoSettings = {
    ...rawS,
    bgOverlay: numOr(rawS.bgOverlay, 35),
    textOpacity: numOr(rawS.textOpacity, 100),
    translationOpacity: numOr(rawS.translationOpacity, 80),
    verseSpacing: numOr(rawS.verseSpacing, 0),
    bgGradientAngle: numOr(rawS.bgGradientAngle, 135),
    fontSize: (["small", "medium", "large"] as const).includes(
      rawS.fontSize as "small" | "medium" | "large",
    )
      ? rawS.fontSize
      : "medium",
    fontFamily:
      typeof rawS.fontFamily === "string" && rawS.fontFamily
        ? rawS.fontFamily
        : "'Amiri', serif",
    translationFontFamily:
      typeof rawS.translationFontFamily === "string" && rawS.translationFontFamily
        ? rawS.translationFontFamily
        : "'Inter', sans-serif",
    transitionStyle: (["none", "fade", "slide", "scale"] as const).includes(
      rawS.transitionStyle as "fade",
    )
      ? rawS.transitionStyle
      : "fade",
    transitionCurve: rawS.transitionCurve === "ease" ? "ease" : "linear",
    revealAnimation: rawS.revealAnimation === "cut" ? "cut" : "fade",
    bgMotion: rawS.bgMotion === "zoom" ? "zoom" : "none",
    outputFps: rawS.outputFps === 30 ? 30 : 60,
    audioGain: Math.min(200, Math.max(50, numOr(rawS.audioGain, 100))),
    bookendFadeSec: Math.min(2, Math.max(0, numOr(rawS.bookendFadeSec, 0.2))),
    textGlowIntensity: numOr(rawS.textGlowIntensity, 100),
    textShadowIntensity: numOr(rawS.textShadowIntensity, 100),
    textOutlineWidth: numOr(rawS.textOutlineWidth, 3),
    vignette: numOr(rawS.vignette, 0),
    watermarkPosition:
      typeof rawS.watermarkPosition === "string" && rawS.watermarkPosition
        ? rawS.watermarkPosition
        : "bottom-right",
    exportQuality:
      rawS.exportQuality === "standard" ||
      rawS.exportQuality === "balanced" ||
      rawS.exportQuality === "high"
        ? rawS.exportQuality
        : "balanced",
  };
  const { cw, ch } = outputResolution(spec.platform.aspect, spec.quality.isLowPower);
  const outputFps = (s.outputFps as number) === 30 ? 30 : 60;
  const bitrate = videoBitrate(cw, ch, spec.quality.isLowPower);

  /* Parallel phases: audio fetch/decode, bg extraction and overlay
     painting used to run strictly back-to-back; each is subprocess or
     decode bound, so overlap them. Progress is monotone — with
     concurrent phases the client must never see the pct go backwards. */
  let lastPct = 0;
  const progress = (msg: string, pct: number): void => {
    lastPct = Math.max(lastPct, Math.round(pct));
    onProgress(msg, lastPct);
  };
  const surahNo = Number(spec.surah.number);
  const verseSpacing = (s.verseSpacing as number) || 0;
  const ayahs = spec.ayahs.slice(chunk.from, chunk.to + 1);

  const bgUrlSources: (string | Buffer)[] =
    bgUploads.length > 0
      ? bgUploads.map((u) => Buffer.from(u))
      : !noBg && spec.bg.mode === "pexels" && (spec.bg.urls?.length ?? 0) > 0
        ? [...(spec.bg.urls ?? [])]
        : [];
  const hasBgIntent = bgUrlSources.length > 0;

  const BG_HARD_CAP = 900; /* 900 JPEGs @1080×1920 ≈ ≤540MB stored */
  let bgFramesList: Buffer[][] = [];
  let bgTotal = 0;
  let hasBgVideo = false;
  let bgDarkenAlpha = 0;
  /* Background extraction overlaps the audio pool below. The frame
     budget uses the CLIENT-provided durations (the server hasn't
     measured the audio yet) + a 2s margin; an undershoot just makes
     the playlist wrap a little sooner (modulo is safe). */
  const bgPhase = (async (): Promise<void> => {
    if (!hasBgIntent) return;
    progress("Preparing background…", 27);
    const bgWasRelayed = bgUploads.length > 0;
    const cap = spec.quality.isLowPower ? 1200 : 2400;
    const provisionalFrames = Math.max(
      1,
      Math.ceil(
        (ayahs.reduce((a, x) => a + (x.durationSec || 0), 0) +
          ayahs.length * verseSpacing +
          2) *
          RENDER_FPS,
      ),
    );
    const budget = Math.min(
      cap * bgUrlSources.length,
      provisionalFrames + 64,
      BG_HARD_CAP,
    );
    const durations2 = await asyncPool(4, bgUrlSources, async (u) => {
      if (typeof u !== "string") return 0; /* uploaded bytes — even split */
      try {
        return await probeDuration(u);
      } catch {
        return 0;
      }
    });
    const known = durations2.filter((d) => d > 0);
    const alloc = durations2.map((d) => {
      if (known.length === 0)
        return Math.min(cap, Math.max(30, Math.floor(budget / durations2.length)));
      if (d <= 0) return 30;
      const sum = known.reduce((a, b) => a + b, 0);
      return Math.max(30, Math.min(cap, Math.round((budget * d) / sum)));
    });
    const extracted = await asyncPool(
      2,
      bgUrlSources,
      async (src, i): Promise<Buffer[]> => {
        if (signal.aborted) throw new Error("Aborted");
        progress(
          `Decoding backgrounds ${i + 1}/${bgUrlSources.length}…`,
          30,
        );
        let frames: Buffer[] | null = null;
        for (let attempt = 0; attempt < 2 && !frames; attempt++) {
          try {
            frames = await extractBgFrames(src, cw, ch, alloc[i]);
            if (frames.length === 0) frames = null; /* 0 frames = failure */
          } catch (err) {
            if (attempt === 1) {
              console.warn(
                `[render] bg clip ${i} failed twice — dropping:`,
                err instanceof Error ? err.message : err,
              );
            }
          }
        }
        return frames && frames.length > 0 ? frames : [];
      },
    );
    bgFramesList = extracted.filter((f) => f.length > 0);
    if (bgFramesList.length === 0) {
      if (!bgWasRelayed && spec.bg.mode === "pexels" && (spec.bg.urls?.length ?? 0) > 0) {
        /* Server can't reach the CDN (likely 403 on the datacenter IP)
         * — tell the client to relay the bytes and retry. */
        throw new BgUnavailableError(spec.bg.urls?.length ?? 0);
      }
      console.warn(
        `[render] all ${bgUrlSources.length} bg clips failed — rendering gradient fallback`,
      );
    }
    bgTotal = bgFramesList.reduce((a, f) => a + f.length, 0);
    hasBgVideo = bgTotal > 0;
    bgDarkenAlpha = hasBgVideo ? Math.min(0.8, (s.bgOverlay as number) / 100) : 0;
  })();
  /* If the audio pool rejects first (abort), bgPhase might still
     reject later — pre-attach so it can never be unhandled; the REAL
     await below re-throws the original error. */
  void bgPhase.catch(() => {});

  /* 1. Audio — decoded 4-at-a-time while bg extraction runs above. */
  const audioPhase = asyncPool(
    4,
    ayahs,
    async (ayah, i): Promise<Float32Array> => {
      if (signal.aborted) throw new Error("Aborted");
      const raw = await fetchAudioBuffer(
        audioUrlCandidates(spec.reciter, surahNo, ayah.numberInSurah),
      );
      if (!raw) {
        console.warn(
          `[render] audio fetch failed for ${spec.surah.number}:${ayah.numberInSurah} — using ${FALLBACK_DUR}s silence`,
        );
      }
      let samples: Float32Array;
      try {
        samples = raw
          ? await decodeAudioPcm(raw)
          : new Float32Array(FALLBACK_DUR * SAMPLE_RATE);
      } catch (err) {
        console.warn(
          `[render] audio decode failed for ${spec.surah.number}:${ayah.numberInSurah} — using ${FALLBACK_DUR}s silence:`,
          err instanceof Error ? err.message : err,
        );
        samples = new Float32Array(FALLBACK_DUR * SAMPLE_RATE);
      }
      applyAyahDeclick(samples);
      progress(
        `Audio ${i + 1}/${ayahs.length}`,
        5 + Math.round(((i + 1) / ayahs.length) * 20),
      );
      return samples;
    },
  );
  const buffers = await audioPhase;
  const durations: { totalSec: number; trailSec: number }[] = buffers.map(
    (samples) => ({
      totalSec: samples.length / SAMPLE_RATE,
      trailSec: verseSpacing,
    }),
  );

  const totalDurSec = durations.reduce((a, d) => a + d.totalSec + d.trailSec, 0);
  const totalSamples = Math.round(totalDurSec * SAMPLE_RATE);
  const track = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    track.set(buffers[i], offset);
    offset += buffers[i].length + Math.round(durations[i].trailSec * SAMPLE_RATE);
  }

  /* Audio loudness (50–200%), then bookend fades at the configured
     length (matches the video bookend fade duration). */
  if ((s.audioGain ?? 100) !== 100) {
    const gain = (s.audioGain as number) / 100;
    for (let i = 0; i < track.length; i++) track[i] *= gain;
  }
  applyBookendFades(track, (s.bookendFadeSec ?? 0.2) as number);

  /* 2. Page plans + segments.
   * Each ayah's client-planned pages (long-verse pager) are scaled to the
   * SERVER-measured audio so per-page windows stay byte-identical to the
   * audio track; splash pages keep the verse's trailing silence. */
  const pagePlans = ayahs.map((a, i) => planPagesFor(a, durations[i].totalSec));
  const segDurations: { totalSec: number; trailSec: number; page?: boolean }[] =
    [];
  for (let i = 0; i < pagePlans.length; i++) {
    const pl = pagePlans[i];
    let acc = 0;
    for (let pg = 0; pg < pl.length; pg++) {
      const isLast = pg === pl.length - 1;
      let sec = pl[pg].durationSec;
      if (isLast) sec = Math.max(0.05, durations[i].totalSec - acc);
      acc += sec;
      segDurations.push({
        totalSec: sec,
        trailSec: isLast ? verseSpacing : 0,
        page: pg > 0 || undefined,
      });
    }
  }
  const { segments, totalFrames } = buildSegments(segDurations, RENDER_FPS);

  /* 3. (bg frames extracted in bgPhase above — ran concurrently with
   * audio + overlay painting) */

  /* 4. Overlays — painted to raw canvases (no PNG encode/decode
   * roundtrip; napi-rs drawImage accepts a Canvas directly) and
   * painted CONCURRENTLY with bgPhase. The baked bg decision is
   * provisional (intent-based); if the actual bg outcome flips, the
   * flat overlays are repainted once before compositing. */
  const surah = {
    number: surahNo,
    name: spec.surah.name,
    englishName: spec.surah.englishName,
    englishNameTranslation: "",
    numberOfAyahs: spec.ayahs.length,
    revelationType: "Meccan",
  };
  const transitionStyle = s.transitionStyle;
  const transitionEnabled = transitionStyle !== "none";
  /* Bookend fade length follows the audio setting (0.2s = the old
     fixed 6 frames @30fps). */
  const bookendFadeFrames = Math.max(
    0,
    Math.round(((s.bookendFadeSec ?? 0.2) as number) * RENDER_FPS),
  );
  /* Crossfade alpha easing — linear by default. */
  const curveT = (t: number): number =>
    s.transitionCurve === "ease" ? easeInOutCubic(t) : t;
  let bakedStatic = !hasBgIntent; /* overlays carry the gradient? */
  const overlayImages: Canvas[] = [];

  const renderOverlay = (
    item: {
      numberInSurah: number;
      text: string;
      translation: string;
      pageInfo?: { index: number; total: number };
    },
  ): Canvas => {
    const canvas = createCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    /* Video backgrounds keep the overlay transparent; static bgs bake
       the default gradient (mirrors renderAyahOverlays client-side). */
    if (bakedStatic) {
      const g = ctx.createLinearGradient(0, 0, cw, ch);
      g.addColorStop(0, "#09090f");
      g.addColorStop(0.5, "#120d03");
      g.addColorStop(1, "#09090f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      const glow = ctx.createRadialGradient(
        cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.55,
      );
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
    drawVignette(ctx as unknown as CanvasRenderingContext2D, cw, ch, s.vignette ?? 0);
    drawAyahFrame(
      ctx as unknown as CanvasRenderingContext2D,
      canvas as unknown as HTMLCanvasElement,
      {
        number: 0,
        numberInSurah: item.numberInSurah,
        text: item.text,
        translation: item.translation,
        juz: 0,
        page: 0,
        sajda: false,
        pageInfo: item.pageInfo,
      },
      surah,
      s,
      1,
    );
    return canvas;
  };

  const overlayTotal = pagePlans.reduce((a, pl) => a + pl.length, 0);
  const paintOverlays = async (): Promise<void> => {
    overlayImages.length = 0;
    let overlayDone = 0;
    for (const pl of pagePlans) {
      for (const pg of pl) {
        if (signal.aborted) throw new Error("Aborted");
        overlayImages.push(renderOverlay(pg));
        overlayDone++;
        progress(
          `Rendering overlay ${overlayDone}/${overlayTotal}`,
          36 + Math.round((overlayDone / overlayTotal) * 8),
        );
        /* napi canvas ops are sync CPU — yield so the ffmpeg children
           (audio decode / bg extraction) can make progress between
           overlays instead of starving them. */
        if (overlayDone % 2 === 0) {
          await new Promise<void>((r) => setImmediate(r));
        }
      }
    }
  };

  /* Chunk-seam neighbours: the verse crossfade AT a chunk boundary
     needs the verse just OUTSIDE this chunk so the fade continues
     across concat (previous chunk renders the outgoing half with the
     same boundary math — t stays continuous). For paged verses the
     neighbour is the LAST page (before) / FIRST page (after). */
  let prevOverlay: Canvas | null = null;
  let nextOverlay: Canvas | null = null;
  const paintNeighbours = (): void => {
    prevOverlay = null;
    nextOverlay = null;
    if (transitionEnabled && chunk.from > 0) {
      const prevAyah = spec.ayahs[chunk.from - 1];
      const pl = planPagesFor(prevAyah, prevAyah.durationSec);
      prevOverlay = renderOverlay(pl[pl.length - 1]);
    }
    if (transitionEnabled && chunk.to + 1 < spec.ayahs.length) {
      const nextAyah = spec.ayahs[chunk.to + 1];
      const pl = planPagesFor(nextAyah, nextAyah.durationSec);
      nextOverlay = renderOverlay(pl[0]);
    }
  };

  const overlaysPhase = (async (): Promise<void> => {
    await paintOverlays();
    paintNeighbours();
  })();

  await Promise.all([bgPhase, overlaysPhase]);
  if (bakedStatic === hasBgVideo) {
    /* painted gradient but video exists (double-darkening), or
       overlays left transparent but no video produced (black frames)
       — repaint once with the ACTUAL outcome. */
    bakedStatic = !hasBgVideo;
    console.warn(
      `[render] bg mismatch (intent=${hasBgIntent}, got=${hasBgVideo}) — repainting overlays`,
    );
    await paintOverlays();
    paintNeighbours();
  }

  /* 5. Composite + encode via FFmpeg pipe */
  onProgress("Encoding chunk…", 48);
  const x264Level = cw * ch >= 2073600 ? "4.2" : cw * ch >= 1166400 ? "4.0" : cw * ch >= 921600 ? "3.2" : "3.1";
  const outPath = join(
    tmpdir(),
    `midhkar-chunk-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
  );
  const audioPath = outPath.replace(/\.mp4$/, ".f32");
  await mkdir(dirname(outPath), { recursive: true });
  {
    const f32 = Buffer.alloc(track.length * 4);
    for (let i = 0; i < track.length; i++) f32.writeFloatLE(track[i], i * 4);
    await writeFile(audioPath, f32);
  }

  /* H.264 encode: capped-CRF for best quality within the bitrate cap,
   * ref=2 + lookahead=12 for quality, bframes=0 for speed/stability.
   * Level 4.2 for 1080×1920@60 (level 4.0 only supports 30fps at that res). */
  const x264Params = `ref=2:rc-lookahead=12:bframes=0:threads=2`;
  const crf =
    s.exportQuality === "high"
      ? "17"
      : s.exportQuality === "standard"
        ? "23"
        : "20";
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
    "-threads", "2",
    "-x264-params", x264Params,
    "-profile:v", "high",
    "-level", x264Level,
    "-crf", crf,
    "-maxrate", String(Math.round(bitrate * 1.45)),
    "-bufsize", String(bitrate * 2),
    "-g", String(2 * outputFps),
    "-pix_fmt", "yuv420p",
    "-r", String(outputFps),
    "-c:a", "aac",
    "-b:a", String(AUDIO_BITRATE),
    "-ar", String(SAMPLE_RATE),
    "-ac", "1",
    outPath,
  ];

  const proc = spawn(ffmpegBin(), args, { windowsHide: true });
  /* Abort must kill the encode immediately — otherwise a wedged stdin
   * write blocks until the function's hard timeout. */
  const onAbort = () => {
    try { proc.kill("SIGKILL"); } catch { /* already gone */ }
  };
  signal.addEventListener("abort", onAbort, { once: true });

  const composite = createCanvas(cw, ch);
  const cctx = composite.getContext("2d");

  const drawOverlayImg = (
    img: Canvas | null,
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

  /* On-demand bg JPEG decode with a small LRU cache — NEVER hold all
   * frames decoded (RGBA @1080×1920 ≈ 8.3MB each; 900 would be 7.5GB).
   * Cache covers the seam-lookahead window (current + next clip's
   * first frame + a working set of recently used frames). */
  const BG_CACHE_SIZE = 24;
  const bgCache = new Map<string, Awaited<ReturnType<typeof loadImage>>>();
  const bgDecode = async (clip: number, local: number) => {
    const key = `${clip}:${local}`;
    const hit = bgCache.get(key);
    if (hit) {
      bgCache.delete(key);
      bgCache.set(key, hit); /* LRU refresh */
      return hit;
    }
    let img: Awaited<ReturnType<typeof loadImage>> | null = null;
    try {
      img = await loadImage(bgFramesList[clip][local]);
    } catch {
      img = null;
    }
    if (img) {
      bgCache.set(key, img);
      if (bgCache.size > BG_CACHE_SIZE) {
        const oldest = bgCache.keys().next().value;
        if (oldest !== undefined) bgCache.delete(oldest);
      }
    }
    return img;
  };

  const isFirstChild = chunkIndex === 0;
  const isLastChild = chunkIndex === chunkCount - 1;

  /* Crossfade boundary AFTER each segment. The last segment of the
     chunk still gets one when a next verse exists globally (the
     chunk seam) — the neighbour overlay renders the other half.
     Page boundaries (later page of the same verse) ALWAYS crossfade. */
  const boundaries: ({ pre: number; post: number } | null)[] = segments.map(
    (seg, i) => {
      const isLastSeg = i === segments.length - 1;
      if (!isLastSeg && segments[i + 1].page) {
        return boundaryFor(0, transitionStyle, true, (s.revealAnimation as string) ?? "fade");
      }
      if (!transitionEnabled) return null;
      if (!isLastSeg || chunk.to + 1 < spec.ayahs.length) {
        return boundaryFor(seg.trailFrames, transitionStyle);
      }
      return null;
    },
  );

  let segStart = 0;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];
    /* Incoming crossfade from the previous verse: previous segment
       inside this chunk, or the chunk-seam neighbour for segment 0.
       Segment 0 is always the FIRST page of its ayah (chunks split at
       ayah boundaries), so its incoming boundary is a verse boundary —
       use the equivalent trail (round(verseSpacing*fps)) rather than
       seg.trailFrames (which is 0 on a first page and would make the
       two sides of the seam compute different windows). */
    const inB =
      segIdx > 0
        ? boundaries[segIdx - 1]
        : transitionEnabled && prevOverlay
          ? boundaryFor(Math.round(verseSpacing * RENDER_FPS), transitionStyle)
          : null;
    const outB = boundaries[segIdx];
    const outgoingPre = outB ? Math.min(outB.pre, seg.totalFrames) : 0;
    const incomingPost = inB
      ? Math.min(inB.post, Math.max(0, seg.totalFrames - outgoingPre))
      : 0;

    for (let k = 0; k < seg.totalFrames; k++) {
      if (signal.aborted) throw new Error("Aborted");
      cctx.clearRect(0, 0, cw, ch);

      if (hasBgVideo) {
        const g = segStart + k;
        /* bgTotal > 0 here (hasBgVideo is derived from it) — the
         * modulo is safe. A failed decode draws the gradient. */
        let pos = g % bgTotal;
        let clip = 0;
        let local = 0;
        let found = false;
        for (let i = 0; i < bgFramesList.length; i++) {
          if (pos < bgFramesList[i].length) {
            clip = i;
            local = pos;
            found = true;
            break;
          }
          pos -= bgFramesList[i].length;
        }
        if (!found) {
          /* Index arithmetic gone wrong — paint gradient, never NaN. */
          clip = bgFramesList.length - 1;
          local = bgFramesList[clip].length - 1;
        }
        const imgs = bgFramesList[clip];
        const img = await bgDecode(clip, local);
        /* Ken-Burns push-in (optional): 1 → 1.045 across one wallpaper
           pass (matches encode.worker.ts; `g % bgTotal` is the pass
           position — `pos` above is reduced to a clip-local index). */
        const z = s.bgMotion === "zoom" ? 1 + 0.045 * ((g % bgTotal) / bgTotal) : 1;
        if (img) {
          if (z !== 1) {
            const w = cw * z;
            const h = ch * z;
            cctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
          } else {
            cctx.drawImage(img, 0, 0, cw, ch);
          }
          const intoSeam = imgs.length - local;
          const nextClip = clip + 1 < bgFramesList.length ? clip + 1 : 0;
          if (
            transitionStyle !== "none" &&
            intoSeam <= SEAM_FRAMES &&
            bgFramesList[nextClip].length > 0
          ) {
            const next = await bgDecode(nextClip, 0);
            if (next) {
              const t = (SEAM_FRAMES - intoSeam + 1) / (SEAM_FRAMES + 1);
              if (t < 1) {
                cctx.globalAlpha = Math.min(1, t);
                if (z !== 1) {
                  const w = cw * z;
                  const h = ch * z;
                  cctx.drawImage(next, (cw - w) / 2, (ch - h) / 2, w, h);
                } else {
                  cctx.drawImage(next, 0, 0, cw, ch);
                }
                cctx.globalAlpha = 1;
              }
            }
          }
        } else {
          drawFallbackBg(cctx as unknown as CanvasRenderingContext2D, cw, ch);
        }
        if (bgDarkenAlpha > 0) {
          cctx.fillStyle = `rgba(0,0,0,${bgDarkenAlpha})`;
          cctx.fillRect(0, 0, cw, ch);
        }
      } else {
        drawFallbackBg(cctx as unknown as CanvasRenderingContext2D, cw, ch);
      }

      /* Verse crossfade — same math as encode.worker.ts: continuous t
         over incoming (segment start) and outgoing (segment end)
         windows, alphas sum to ~1, slide/scale transform rides the
         incoming verse. Windows never overlap the neighbour's (the
         other chunk renders its half with the same boundary). */
      let crossfade = false;
      let oldAlpha = 1;
      let newAlpha = 1;
      let transformT = 1;
      let oldImg: Canvas | null = null;
      let newImg: Canvas | null = overlayImages[segIdx];

      if (incomingPost > 0 && k < incomingPost) {
        const prev =
          segIdx > 0 ? overlayImages[segIdx - 1] : prevOverlay;
        if (prev && inB) {
          const totalW = inB.pre + inB.post;
          const t = curveT((inB.pre + k + 1) / (totalW + 1));
          oldImg = prev;
          oldAlpha = 1 - t;
          newAlpha = t;
          transformT = t;
          crossfade = true;
        }
      } else if (
        outgoingPre > 0 &&
        k >= seg.totalFrames - outgoingPre
      ) {
        const next =
          segIdx < segments.length - 1
            ? overlayImages[segIdx + 1]
            : nextOverlay;
        if (next && outB) {
          const totalW = outB.pre + outB.post;
          const t = curveT(
            (k - (seg.totalFrames - outgoingPre) + 1) / (totalW + 1),
          );
          oldImg = overlayImages[segIdx];
          oldAlpha = 1 - t;
          newImg = next;
          newAlpha = t;
          transformT = t;
          crossfade = true;
        }
      }

      /* Bookend fades only at the true start/end of the whole video —
         chunk seams stay flat or the seams would visibly pulse. */
      let bookend = 1;
      if (transitionEnabled && bookendFadeFrames > 0) {
        const globalIdx = segStart + k;
        if (isFirstChild && globalIdx < bookendFadeFrames) {
          bookend = (globalIdx + 1) / (bookendFadeFrames + 1);
        }
        const fromEnd = totalFrames - 1 - globalIdx;
        if (isLastChild && fromEnd < bookendFadeFrames) {
          bookend = Math.min(bookend, (fromEnd + 1) / (bookendFadeFrames + 1));
        }
      }

      if (crossfade) {
        drawOverlayImg(oldImg, oldAlpha * bookend, 0, 1);
        let dy = 0;
        let scale = 1;
        if (transitionStyle === "slide") dy = (1 - transformT) * 40;
        if (transitionStyle === "scale") scale = 0.95 + transformT * 0.05;
        drawOverlayImg(newImg, newAlpha * bookend, dy, scale);
      } else {
        drawOverlayImg(overlayImages[segIdx], bookend, 0, 1);
      }

      if (s.showWatermark && typeof s.watermarkText === "string" && s.watermarkText.trim()) {
        drawWatermark(cctx as unknown as CanvasRenderingContext2D, cw, ch, s.watermarkText, s.watermarkPosition);
      }

      /* A/V SYNC: write each unique frame ONCE. The rawvideo input is
       * declared RENDER_FPS (30) and the output -r outputFps (60) —
       * ffmpeg's frame duplication produces the 60fps track with EXACT
       * timestamps. Manually writing each frame twice (the old code)
       * declared 2x frames to a 30fps stdin, doubling video duration
       * vs audio (verified experimentally: 20s video / 10s audio). */
      const frameBuf = (composite as unknown as { data(): Buffer }).data();
      const ok = proc.stdin.write(frameBuf);
      if (!ok) {
        await new Promise<void>((res) => proc.stdin.once("drain", () => res()));
      }

      const globalIdx = segStart + k;
      if (globalIdx % 30 === 0) {
        onProgress(
          `Encoding frame ${globalIdx + 1}/${totalFrames}`,
          50 + Math.round((globalIdx / totalFrames) * 40),
        );
      }
    }
    segStart += seg.totalFrames;
  }

  proc.stdin.end();

  onProgress("Finalising…", 94);
  let stderrAll = "";
  proc.stderr.on("data", (d) => (stderrAll += d.toString()));
  const code: number = await new Promise((resolve) => {
    proc.on("close", (c) => resolve(c ?? -1));
  });
  const { readFileSync, unlinkSync } = await import("node:fs");
  if (code !== 0) {
    try { unlinkSync(audioPath); } catch { /* best-effort */ }
    try { unlinkSync(outPath); } catch { /* best-effort */ }
    throw new Error(`ffmpeg failed (${code}): ${stderrAll.slice(-400)}`);
  }

  const buffer = readFileSync(outPath);
  try { unlinkSync(audioPath); } catch { /* best-effort */ }
  try { unlinkSync(outPath); } catch { /* best-effort */ }
  onProgress("Done!", 100);
  return buffer;
}
