/**
 * render-chunk.ts — encodes ONE verse-aligned chunk of a render plan
 * to an H.264/AAC MP4, port of the verified render-service pipeline
 * (cumulative segments, alpha-sum-1 crossfades, bg seams, bitrate
 * ladder, x264 memory-diet profile). Identical encode parameters on
 * every chunk → the MP4s concat losslessly.
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
const FALLBACK_BG_COLOR = "#0b0b0f";
const FALLBACK_DUR = 6;
const SAMPLE_RATE = 48000;
const AUDIO_BITRATE = 128_000;

type ProgressFn = (msg: string, pct: number) => void;

/* ── Audio (mirrors render-service/src/render.ts) ──────────────── */

function audioUrlCandidates(
  reciter: RenderPlanSpec["reciter"],
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

/** Decode any audio to mono 48kHz f32le PCM. */
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
      const buf = Buffer.concat(chunks);
      const samples = new Float32Array(buf.length / 4);
      for (let i = 0; i < samples.length; i++) samples[i] = buf.readFloatLE(i * 4);
      resolve(samples);
    });
    proc.stdin.end(input);
  });
}

/* ── Bg frames (mirrors render-service/src/ffmpeg.ts) ─────────── */

function extractBgFrames(
  input: string | Buffer,
  cw: number,
  ch: number,
  maxFrames: number,
): Promise<Buffer[]> {
  const scale = `scale='max(${cw},iw*${ch}/ih)':'max(${ch},ih*${cw}/iw)'`;
  const args = [
    "-v", "error",
    "-i", typeof input === "string" ? input : "pipe:0",
    "-vf", `${scale},crop=${cw}:${ch}`,
    "-fps_mode", "vfr",
    "-frames:v", String(maxFrames),
    "-f", "image2pipe",
    "-vcodec", "png",
    "-",
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args, { windowsHide: true });
    const frames: Buffer[] = [];
    let buf = Buffer.alloc(0);
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(frames);
    };
    proc.stdout.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      const IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
      let idx;
      while ((idx = buf.indexOf(IEND)) !== -1) {
        frames.push(Buffer.from(buf.subarray(0, idx + 8)));
        buf = buf.subarray(idx + 8);
      }
    });
    proc.stderr.on("data", () => {});
    proc.on("error", (e) => finish(new Error("bg frame extraction failed: " + e.message)));
    proc.on("close", () => finish());
    if (Buffer.isBuffer(input)) proc.stdin.end(input);
    else proc.stdin.end();
  });
}

async function probeDuration(src: string): Promise<number> {
  const bin = await ffprobeBin();
  const out = await new Promise<string>((resolve, reject) => {
    const proc = spawn(bin, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      src,
    ], { windowsHide: true });
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", () => {});
    proc.on("error", reject);
    proc.on("close", () => resolve(stdout));
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

/* ── Segments / transitions (verbatim from render-service) ────── */

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

/* ── The chunk render ─────────────────────────────────────────── */

export async function renderChunk(
  spec: RenderPlanSpec,
  chunk: RenderChunk,
  chunkIndex: number,
  chunkCount: number,
  onProgress: ProgressFn,
  signal: AbortSignal,
  bgUpload?: Uint8Array | null,
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
    const samples = raw
      ? await decodeAudioPcm(raw)
      : new Float32Array(FALLBACK_DUR * SAMPLE_RATE);
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

  /* 3. Bg playlist frames */
  onProgress("Preparing background…", 30);
  const bgSources: (string | Buffer)[] = bgUpload
    ? [Buffer.from(bgUpload)]
    : spec.bg.mode === "pexels" && (spec.bg.urls?.length ?? 0) > 0
      ? [...(spec.bg.urls ?? [])]
      : [];
  const hasBgVideo = bgSources.length > 0;
  const bgDarkenAlpha = hasBgVideo ? Math.min(0.8, (s.bgOverlay as number) / 100) : 0;
  const bgFramesList: Buffer[][] = [];
  if (hasBgVideo) {
    const cap = spec.quality.isLowPower ? 1200 : 2400;
    const budget = Math.min(cap * bgSources.length, totalFrames + 64);
    const durations2: number[] = [];
    for (const u of bgSources) {
      if (typeof u === "string") {
        try {
          durations2.push(await probeDuration(u));
        } catch {
          durations2.push(0);
        }
      } else {
        durations2.push(0); // uploaded bytes — even split
      }
    }
    const known = durations2.filter((d) => d > 0);
    const alloc = durations2.map((d) => {
      if (known.length === 0) return Math.min(cap, Math.max(30, Math.floor(budget / durations2.length)));
      if (d <= 0) return 30;
      const sum = known.reduce((a, b) => a + b, 0);
      return Math.max(30, Math.min(cap, Math.round((budget * d) / sum)));
    });
    for (let i = 0; i < bgSources.length; i++) {
      if (signal.aborted) throw new Error("Aborted");
      onProgress(`Decoding backgrounds ${i + 1}/${bgSources.length}…`, 34);
      bgFramesList.push(await extractBgFrames(bgSources[i], cw, ch, alloc[i]));
    }
  }
  const bgTotal = bgFramesList.reduce((a, f) => a + f.length, 0);

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
  onProgress("Encoding chunk…", 48);
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

  /* Pre-decode bg PNGs to images (once) */
  const bgDecodedImages: (Awaited<ReturnType<typeof loadImage>> | null)[][] = [];
  if (hasBgVideo) {
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

  const transitionStyle = s.transitionStyle as string;
  const frameDouble = Math.round(outputFps / RENDER_FPS);
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
        const idx = g % bgTotal;
        let pos = idx;
        let clip = 0;
        let local = 0;
        for (let i = 0; i < bgDecodedImages.length; i++) {
          if (pos < bgDecodedImages[i].length) { clip = i; local = pos; break; }
          pos -= bgDecodedImages[i].length;
        }
        const imgs = bgDecodedImages[clip];
        const img = imgs[local] ?? null;
        if (img) {
          cctx.drawImage(img, 0, 0, cw, ch);
          const intoSeam = imgs.length - local;
          const nextClip = clip + 1 < bgDecodedImages.length ? clip + 1 : 0;
          const next = bgDecodedImages[nextClip][0] ?? null;
          if (
            next &&
            transitionStyle !== "none" &&
            intoSeam <= SEAM_FRAMES
          ) {
            const t = (SEAM_FRAMES - intoSeam + 1) / (SEAM_FRAMES + 1);
            if (t < 1) {
              cctx.globalAlpha = Math.min(1, t);
              cctx.drawImage(next, 0, 0, cw, ch);
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

      /* Bookend fades only at the true start/end of the whole video —
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

      const frameBuf = (composite as unknown as { data(): Buffer }).data();
      for (let d = 0; d < frameDouble; d++) {
        const ok = proc.stdin.write(frameBuf);
        if (!ok) {
          await new Promise<void>((res) => proc.stdin.once("drain", () => res()));
        }
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
