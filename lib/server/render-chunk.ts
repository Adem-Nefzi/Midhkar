/**
 * render-chunk.ts â€” encodes ONE verse-aligned chunk of a render plan
 * to an H.264/AAC MP4 (the old render-service/ Docker port was deleted)
 * (cumulative segments, alpha-sum-1 crossfades, bg seams, bitrate
 * ladder, x264 memory-diet profile). Identical encode parameters on
 * every chunk â†’ the MP4s concat losslessly.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { ensureFonts } from "./server-canvas/fonts";
import {
  drawAyahFrame,
  drawOverlayStyle,
  drawWatermark,
} from "./server-canvas/canva-utils";
import type { RenderPlanSpec, RenderChunk } from "@/lib/render-plan";
import type { VideoSettings } from "./server-canvas/types-settings";

const RENDER_FPS = 30;
const TRANSITION_WINDOW_FRAMES = 8;
const BOOKEND_FADE_FRAMES = 6;
const SEAM_FRAMES = 10;
const FALLBACK_DUR = 6;
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 128_000;

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

/** Decode any audio to mono 48kHz f32le PCM. Rejects on decode failure
 *  (non-zero exit / no samples) â€” a silent empty buffer would delete
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

/* â”€â”€ Bg frames â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Frames are extracted as JPEG (mjpeg) â€” ~10x smaller than PNG at
 * 1080Ã—1920 â€” and kept as encoded buffers; they are decoded to RGBA
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
       * resolve as "0 frames" â€” callers would render black video. */
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

/* â”€â”€ Binaries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

/* â”€â”€ Resolution / bitrate (mirror device-profile) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

function transitionFor(
  segIdx: number,
  segments: Segment[],
  transitionStyle: string,
): { pre: number; post: number } {
  if (transitionStyle === "none" || segIdx >= segments.length - 1) {
    return { pre: 0, post: 0 };
  }
  const trail = segments[segIdx].trailFrames;
  const nextLead = Math.max(
    0,
    segments[segIdx + 1].totalFrames - segments[segIdx + 1].trailFrames,
  );
  if (trail >= TRANSITION_WINDOW_FRAMES) {
    return { pre: TRANSITION_WINDOW_FRAMES, post: 0 };
  } else if (trail + nextLead >= TRANSITION_WINDOW_FRAMES) {
    return { pre: trail, post: TRANSITION_WINDOW_FRAMES - trail };
  }
  return {
    pre: Math.floor(TRANSITION_WINDOW_FRAMES / 2),
    post: TRANSITION_WINDOW_FRAMES - Math.floor(TRANSITION_WINDOW_FRAMES / 2),
  };
}

/* â”€â”€ The chunk render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
  /* The wire settings ARE the app's VideoSettings â€” the vendor copy
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
  };
  const { cw, ch } = outputResolution(spec.platform.aspect, spec.quality.isLowPower);
  const outputFps = spec.quality.isLowPower ? 30 : 60;
  const bitrate = videoBitrate(cw, ch, spec.quality.isLowPower);

  /* 1. Audio */
  const surahNo = Number(spec.surah.number);
  const verseSpacing = (s.verseSpacing as number) || 0;
  const ayahs = spec.ayahs.slice(chunk.from, chunk.to + 1);
  const buffers: Float32Array[] = [];
  const durations: { totalSec: number; trailSec: number }[] = [];
  for (let i = 0; i < ayahs.length; i++) {
    if (signal.aborted) throw new Error("Aborted");
    const raw = await fetchAudioBuffer(
      audioUrlCandidates(spec.reciter, surahNo, ayahs[i].numberInSurah),
    );
    if (!raw) {
      console.warn(
        `[render] audio fetch failed for ${spec.surah.number}:${ayahs[i].numberInSurah} â€” using ${FALLBACK_DUR}s silence`,
      );
    }
    let samples: Float32Array;
    try {
      samples = raw
        ? await decodeAudioPcm(raw)
        : new Float32Array(FALLBACK_DUR * SAMPLE_RATE);
    } catch (err) {
      console.warn(
        `[render] audio decode failed for ${spec.surah.number}:${ayahs[i].numberInSurah} â€” using ${FALLBACK_DUR}s silence:`,
        err instanceof Error ? err.message : err,
      );
      samples = new Float32Array(FALLBACK_DUR * SAMPLE_RATE);
    }
    buffers.push(samples);
    durations.push({ totalSec: samples.length / SAMPLE_RATE, trailSec: verseSpacing });
    onProgress(
      `Audio ${i + 1}/${ayahs.length}`,
      5 + Math.round(((i + 1) / ayahs.length) * 20),
    );
  }

  const totalDurSec = durations.reduce((a, d) => a + d.totalSec + d.trailSec, 0);
  const totalSamples = Math.round(totalDurSec * SAMPLE_RATE);
  const track = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    track.set(buffers[i], offset);
    offset += buffers[i].length + Math.round(durations[i].trailSec * SAMPLE_RATE);
  }

  /* 2. Segments */
  const { segments, totalFrames } = buildSegments(durations, RENDER_FPS);

  /* 3. Bg playlist frames.
   * Memory-bounded: JPEG-encoded frames only (decoded on demand in
   * the compositing loop, LRU-cached), hard cap on total stored
   * frames so a 2GB function never OOMs. A clip that fails to
   * extract after one retry is DROPPED. When the client has RELAYED
   * the bg bytes (bg-relay-*) those buffers are the source of truth;
   * if any clip still fails with relayed bytes it is a decode
   * problem, not a fetch problem — no relay loop. If NO relayed bytes
   * exist and EVERY URL clip fails (Pexels 403s datacenter IPs),
   * throw BgUnavailableError so the client can relay and retry. */
  onProgress("Preparing background…", 30);
  const bgUrlSources: (string | Buffer)[] =
    bgUploads.length > 0
      ? bgUploads.map((u) => Buffer.from(u))
      : !noBg && spec.bg.mode === "pexels" && (spec.bg.urls?.length ?? 0) > 0
        ? [...(spec.bg.urls ?? [])]
        : [];
  const bgWasRelayed = bgUploads.length > 0;
  const BG_HARD_CAP = 900; /* 900 JPEGs @1080×1920 ≈ ≤540MB stored */
  const bgFramesList: Buffer[][] = [];
  if (bgUrlSources.length > 0) {
    const cap = spec.quality.isLowPower ? 1200 : 2400;
    const budget = Math.min(cap * bgUrlSources.length, totalFrames + 64, BG_HARD_CAP);
    const durations2: number[] = [];
    for (const u of bgUrlSources) {
      if (typeof u === "string") {
        try {
          durations2.push(await probeDuration(u));
        } catch {
          durations2.push(0);
        }
      } else {
        durations2.push(0); /* uploaded bytes — even split */
      }
    }
    const known = durations2.filter((d) => d > 0);
    const alloc = durations2.map((d) => {
      if (known.length === 0) return Math.min(cap, Math.max(30, Math.floor(budget / durations2.length)));
      if (d <= 0) return 30;
      const sum = known.reduce((a, b) => a + b, 0);
      return Math.max(30, Math.min(cap, Math.round((budget * d) / sum)));
    });
    for (let i = 0; i < bgUrlSources.length; i++) {
      if (signal.aborted) throw new Error("Aborted");
      onProgress(`Decoding backgrounds ${i + 1}/${bgUrlSources.length}…`, 34);
      let frames: Buffer[] | null = null;
      for (let attempt = 0; attempt < 2 && !frames; attempt++) {
        try {
          frames = await extractBgFrames(bgUrlSources[i], cw, ch, alloc[i]);
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
      if (frames && frames.length > 0) bgFramesList.push(frames);
    }
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
  }
  const bgTotal = bgFramesList.reduce((a, f) => a + f.length, 0);
  const hasBgVideo = bgTotal > 0;
  const bgDarkenAlpha = hasBgVideo ? Math.min(0.8, (s.bgOverlay as number) / 100) : 0;

  /* 4. Overlays */
  const surah = {
    number: surahNo,
    name: spec.surah.name,
    englishName: spec.surah.englishName,
    englishNameTranslation: "",
    numberOfAyahs: spec.ayahs.length,
    revelationType: "Meccan",
  };
  const overlayImages: (Awaited<ReturnType<typeof loadImage>> | null)[] = [];
  for (let i = 0; i < ayahs.length; i++) {
    if (signal.aborted) throw new Error("Aborted");
    const canvas = createCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    /* Video backgrounds keep the overlay transparent; static bgs bake
       the default gradient (mirrors renderAyahOverlays client-side). */
    if (!hasBgVideo) {
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
    drawAyahFrame(
      ctx as unknown as CanvasRenderingContext2D,
      canvas as unknown as HTMLCanvasElement,
      {
        number: 0,
        numberInSurah: ayahs[i].numberInSurah,
        text: ayahs[i].text,
        translation: ayahs[i].translation,
        juz: 0,
        page: 0,
        sajda: false,
      },
      surah,
      s,
      1,
    );
    overlayImages.push(await loadImage(canvas.toBuffer("image/png")));
    onProgress(
      `Rendering overlay ${i + 1}/${ayahs.length}`,
      36 + Math.round(((i + 1) / ayahs.length) * 8),
    );
  }

  /* 5. Composite + encode via FFmpeg pipe */
  onProgress("Encoding chunkâ€¦", 48);
  const x264Level = cw * ch >= 2073600 ? "4.0" : cw * ch >= 1166400 ? "3.2" : "3.1";
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
    "-x264-params", "ref=1:rc-lookahead=8:bframes=0:threads=2",
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

  /* On-demand bg JPEG decode with a small LRU cache â€” NEVER hold all
   * frames decoded (RGBA @1080Ã—1920 â‰ˆ 8.3MB each; 900 would be 7.5GB).
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

  const transitionStyle = s.transitionStyle as string;
  const isFirstChild = chunkIndex === 0;
  const isLastChild = chunkIndex === chunkCount - 1;

  let segStart = 0;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];
    const trans = transitionFor(segIdx, segments, transitionStyle);
    for (let k = 0; k < seg.totalFrames; k++) {
      if (signal.aborted) throw new Error("Aborted");
      cctx.clearRect(0, 0, cw, ch);

      if (hasBgVideo) {
        const g = segStart + k;
        /* bgTotal > 0 here (hasBgVideo is derived from it) â€” the
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
          /* Index arithmetic gone wrong â€” paint gradient, never NaN. */
          clip = bgFramesList.length - 1;
          local = bgFramesList[clip].length - 1;
        }
        const imgs = bgFramesList[clip];
        const img = await bgDecode(clip, local);
        if (img) {
          cctx.drawImage(img, 0, 0, cw, ch);
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
                cctx.drawImage(next, 0, 0, cw, ch);
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

      const localEnd = seg.totalFrames - 1;
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

      /* Bookend fades only at the true start/end of the whole video â€”
         chunk seams stay flat or the seams would visibly pulse. */
      let bookend = 1;
      if (transitionStyle !== "none") {
        const globalIdx = segStart + k;
        if (isFirstChild && globalIdx < BOOKEND_FADE_FRAMES) {
          bookend = (globalIdx + 1) / (BOOKEND_FADE_FRAMES + 1);
        }
        const fromEnd = totalFrames - 1 - globalIdx;
        if (isLastChild && fromEnd < BOOKEND_FADE_FRAMES) {
          bookend = Math.min(bookend, (fromEnd + 1) / (BOOKEND_FADE_FRAMES + 1));
        }
      }

      drawOverlayImg(overlayImages[segIdx], oldAlpha * bookend, 0, 1);
      if (newAlpha > 0 && newIdx < overlayImages.length) {
        const t = newAlpha;
        let dy = 0;
        let scale = 1;
        if (transitionStyle === "slide") dy = (1 - t) * 40;
        if (transitionStyle === "scale") scale = 0.95 + t * 0.05;
        drawOverlayImg(overlayImages[newIdx], newAlpha * bookend, dy, scale);
      }

      if (s.showWatermark && typeof s.watermarkText === "string" && s.watermarkText.trim()) {
        drawWatermark(cctx as unknown as CanvasRenderingContext2D, cw, ch, s.watermarkText);
      }

      /* A/V SYNC: write each unique frame ONCE. The rawvideo input is
       * declared RENDER_FPS (30) and the output -r outputFps (60) â€”
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

  onProgress("Finalisingâ€¦", 94);
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
