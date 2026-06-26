/**
 * generate-video.ts
 *
 * Pipeline:
 *  1. For each ayah: download MP3, render a frame, measure audio duration.
 *     - If the chosen background is a real VIDEO (upload / library), the
 *       frame is rendered with a TRANSPARENT canvas — text/badges only, no
 *       baked-in background — so the server can composite it over the
 *       actual looping background video per segment (real motion, not a
 *       single freeze-frame like before).
 *     - Otherwise (animated canvas bg / none), behavior is unchanged: an
 *       opaque baked frame, exactly as before.
 *  2. Upload everything (frames, audio, and — once — the background video
 *     bytes if applicable) to /api/generate-video, which runs real ffmpeg
 *     server-side and returns output.mp4.
 */

import { PLATFORMS } from "@/lib/quran";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { VideoSettings, GenLog } from "./types";
import { canvasToPNG, drawAyahFrame, drawBackground } from "./canva-utils";

/* ── Silence generator (pure JS → WAV) ───────────────────────── */

function makeSilenceWAV(seconds: number): Uint8Array {
  const sampleRate = 44100;
  const numSamples = Math.ceil(sampleRate * seconds);
  const dataSize = numSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, dataSize, true);
  return new Uint8Array(buf);
}

/* ── Audio download ───────────────────────────────────────────── */

export function getAudioUrls(
  reciter: Reciter,
  surahNum: number,
  ayahNum: number,
): string[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getQuranApiAudioUrl, getEveryayahAudioUrl } = require("@/lib/quran");
  const urls: string[] = [];
  if (reciter.source === "quranapi" && reciter.quranApiNo) {
    urls.push(getQuranApiAudioUrl(reciter.quranApiNo, surahNum, ayahNum));
    const ev = getEveryayahAudioUrl(reciter.quranApiNo, surahNum, ayahNum);
    if (ev) urls.push(ev);
  }
  return urls;
}

async function fetchAudioBuffer(urls: string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, { mode: "cors" });
      if (r.ok) return r.arrayBuffer();
    } catch {
      /* try next URL */
    }
  }
  return null;
}

async function measureAudioDuration(buffer: ArrayBuffer): Promise<number> {
  try {
    const ac = new AudioContext();
    const decoded = await ac.decodeAudioData(buffer.slice(0));
    const dur = decoded.duration;
    await ac.close();
    return dur;
  } catch {
    return 6;
  }
}

/* ── Background video resolution (for real motion backgrounds) ─ */

/**
 * Returns the raw bytes of the chosen background video, if the background
 * type is a real video ("upload" or "library"). Works for both:
 *  - "upload": settings.uploadedVideoUrl is a blob: URL created via
 *    URL.createObjectURL() in this same page — fetchable directly here.
 *  - "library": settings.videoUrl is a normal https:// CDN URL.
 * Returns null if not applicable, or if the fetch fails (caller falls
 * back to the old opaque-frame behavior automatically in that case).
 */
async function resolveBackgroundVideoBlob(
  settings: VideoSettings,
): Promise<Blob | null> {
  const isVideoBg =
    settings.background === "upload" || settings.background === "library";
  if (!isVideoBg) return null;

  const src =
    settings.background === "upload"
      ? settings.uploadedVideoUrl
      : settings.videoUrl;
  if (!src) return null;

  try {
    const r = await fetch(src);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

/* ── New styling helpers (pure canvas, no canva-utils changes needed) ─ */

function drawOverlayStyle(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  style: VideoSettings["overlayStyle"],
  intensityPct: number, // 0-100
) {
  if (style === "none" || intensityPct <= 0) return;
  const alpha = Math.min(0.85, (intensityPct / 100) * 0.85);
  let gradient: CanvasGradient;
  if (style === "radial") {
    gradient = ctx.createRadialGradient(
      cw / 2,
      ch / 2,
      Math.min(cw, ch) * 0.2,
      cw / 2,
      ch / 2,
      Math.max(cw, ch) * 0.7,
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  } else {
    gradient = ctx.createLinearGradient(0, 0, 0, ch);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.55, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  }
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  text: string,
) {
  if (!text || !text.trim()) return;
  ctx.save();
  ctx.font = `${Math.round(ch * 0.022)}px sans-serif`;
  ctx.fillStyle = "rgba(245,240,232,0.55)";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const pad = Math.round(ch * 0.025);
  ctx.fillText(text, cw - pad, ch - pad);
  ctx.restore();
}

/* ── Segment type ─────────────────────────────────────────────── */

interface Segment {
  audio: Uint8Array;
  audioExt: "mp3" | "wav";
  img: Uint8Array;
  dur: number;
  /** True when img is a transparent overlay meant to be composited over
   *  the shared background video server-side, rather than a flattened,
   *  opaque frame. */
  transparentOverlay: boolean;
}

/* ── Main export ──────────────────────────────────────────────── */

export async function generateVideo(params: {
  ayahs: Ayah[];
  surah: Surah;
  reciter: Reciter;
  settings: VideoSettings;
  platform: (typeof PLATFORMS)[0];
  bgVideoEl: HTMLVideoElement | null;
  onLog: (log: GenLog) => void;
  signal: AbortSignal;
}): Promise<Blob> {
  const {
    ayahs,
    surah,
    reciter,
    settings,
    platform,
    bgVideoEl,
    onLog,
    signal,
  } = params;
  const log = (msg: string, pct: number) => onLog({ msg, pct });

  const ASPECT: Record<string, [number, number]> = {
    "16:9": [1280, 720],
    "9:16": [720, 1280],
    "1:1": [1080, 1080],
  };
  const [cw, ch] = ASPECT[platform.aspect] ?? [720, 1280];
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  // ── 0. Resolve background video bytes once (if applicable) ──
  log("Preparing background…", 3);
  const bgVideoBlob = await resolveBackgroundVideoBlob(settings);
  // Only treat segments as "transparent overlay" if we actually got bytes —
  // otherwise fall back cleanly to the old opaque-frame path below.
  const useTransparentOverlay = bgVideoBlob !== null;

  const renderFrame = (ayah: Ayah | null) => {
    ctx.clearRect(0, 0, cw, ch);
    if (!useTransparentOverlay) {
      drawBackground(
        ctx,
        cw,
        ch,
        settings.background,
        bgVideoEl,
        settings.bgOverlay,
      );
    }
    drawOverlayStyle(
      ctx,
      cw,
      ch,
      settings.overlayStyle,
      useTransparentOverlay
        ? settings.bgOverlay
        : Math.min(settings.bgOverlay, 40),
    );
    drawAyahFrame(ctx, canvas, ayah, surah, settings, platform);
    if (settings.showWatermark)
      drawWatermark(ctx, cw, ch, settings.watermarkText);
  };

  // ── 1. Build segments ────────────────────────────────────────
  const segments: Segment[] = [];

  for (let i = 0; i < ayahs.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const ayah = ayahs[i];
    log(
      `Preparing ayah ${ayah.numberInSurah} (${i + 1}/${ayahs.length})…`,
      5 + Math.round((i / ayahs.length) * 45),
    );

    const audioUrls = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
    const rawAudio = await fetchAudioBuffer(audioUrls);
    const dur = rawAudio ? await measureAudioDuration(rawAudio) : 6;

    renderFrame(ayah);

    segments.push({
      audio: rawAudio ? new Uint8Array(rawAudio) : makeSilenceWAV(dur),
      audioExt: rawAudio ? "mp3" : "wav",
      img: await canvasToPNG(canvas),
      dur,
      transparentOverlay: useTransparentOverlay,
    });
  }

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // ── 2. Upload to server for real-ffmpeg encoding ────────────
  log("Uploading for encoding...", 55);

  const LEAD_IN = 0.35; // seconds of text shown before audio starts

  const form = new FormData();
  form.append(
    "meta",
    JSON.stringify({
      width: cw,
      height: ch,
      segments: segments.map((s) => ({
        dur: s.dur + LEAD_IN,
        audioExt: s.audioExt,
        transparentOverlay: s.transparentOverlay,
        leadIn: LEAD_IN,
      })),
    }),
  );
  segments.forEach((s, i) => {
    form.append(
      `frame_${i}`,
      new Blob([s.img.buffer as BlobPart], { type: "image/png" }),
      `frame_${i}.png`,
    );
    form.append(`audio_${i}`, new Blob([s.audio.buffer as BlobPart]), `audio_${i}.${s.audioExt}`);
  });
  if (useTransparentOverlay && bgVideoBlob) {
    form.append("background_video", bgVideoBlob, "background_video");
  }

  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/generate-video");
    xhr.responseType = "blob";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        log(
          "Uploading for encoding…",
          55 + Math.round((e.loaded / e.total) * 25),
        );
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        log("Finalising…", 99);
        resolve(xhr.response as Blob);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => reject(new Error(String(reader.result)));
      reader.onerror = () =>
        reject(new Error(`Encoding failed (${xhr.status})`));
      reader.readAsText(xhr.response as Blob);
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort());

    log("Encoding on server…", 82);
    xhr.send(form);
  });
}
