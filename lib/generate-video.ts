/**
 * generate-video.ts
 *
 * Fully client-side video generation using @ffmpeg/ffmpeg (WASM).
 * No server roundtrip — frames, audio, and encoding all happen in the browser.
 *
 * Pipeline:
 *  1. For each ayah: download MP3, render a frame, measure audio duration.
 *  2. Load ffmpeg WASM (cached after first load).
 *  3. Write all assets to ffmpeg's virtual filesystem.
 *  4. Encode each segment (image + audio → mp4).
 *  5. Concat all segments into the final output.
 *  6. Return as Blob for download.
 */

import {
  getFFmpeg,
  writeFFmpegFile,
  readFFmpegFile,
  runFFmpeg,
  cleanupFFmpegFiles,
} from "./ffmpeg-client";
import { PLATFORMS, getQuranApiAudioUrl, getEveryayahAudioUrl } from "@/lib/quran";
import type { Ayah, Surah, Reciter } from "@/lib/quran";
import type { VideoSettings, GenLog } from "./types";
import { canvasToPNG, drawAyahFrame, drawBackground } from "./canva-utils";

/* ── Constants ───────────────────────────────────────────────── */

const LEAD_IN = 0.35; // seconds of text shown before audio starts

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

/* ── Canvas styling helpers ────────────────────────────────────── */

function drawOverlayStyle(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  style: VideoSettings["overlayStyle"],
  intensityPct: number,
) {
  if (style === "none" || intensityPct <= 0) return;
  const alpha = Math.min(0.85, (intensityPct / 100) * 0.85);
  let gradient: CanvasGradient;
  if (style === "radial") {
    gradient = ctx.createRadialGradient(
      cw / 2, ch / 2, Math.min(cw, ch) * 0.2,
      cw / 2, ch / 2, Math.max(cw, ch) * 0.7,
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
}

/* ── Main export ──────────────────────────────────────────────── */

export async function generateVideo(params: {
  ayahs: Ayah[];
  surah: Surah;
  reciter: Reciter;
  settings: VideoSettings;
  platform: (typeof PLATFORMS)[0];
  bgVideoEl: HTMLVideoElement | null;
  bgVideoBytes: Uint8Array | null;
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
    bgVideoBytes,
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

  // ── 0. Resolve background video bytes (if applicable) ─────
  log("Preparing background...", 3);

  let bgVideoData: Uint8Array | null = null;

  // Priority 1: pre-read bytes from upload (avoids blob: URL fetch)
  if (bgVideoBytes && (settings.background === "upload" || settings.background === "library")) {
    bgVideoData = bgVideoBytes;
  }
  // Priority 2: library video — fetch from CDN URL
  else if (settings.background === "library" && settings.videoUrl) {
    try {
      const r = await fetch(settings.videoUrl);
      if (r.ok) bgVideoData = new Uint8Array(await r.arrayBuffer());
    } catch { /* fall through to static bg */ }
  }
  // Priority 3: uploaded video — try the raw File object
  else if (settings.background === "upload" && settings.uploadedVideoFile) {
    try {
      bgVideoData = new Uint8Array(await settings.uploadedVideoFile.arrayBuffer());
    } catch { /* fall through to static bg */ }
  }

  const useVideoBg = bgVideoData !== null;

  const renderFrame = (ayah: Ayah | null) => {
    ctx.clearRect(0, 0, cw, ch);
    if (!useVideoBg) {
      drawBackground(ctx, cw, ch, settings.background, bgVideoEl, settings.bgOverlay);
    }
    drawOverlayStyle(
      ctx, cw, ch, settings.overlayStyle,
      useVideoBg ? settings.bgOverlay : Math.min(settings.bgOverlay, 40),
    );
    drawAyahFrame(ctx, canvas, ayah, surah, settings, platform);
    if (settings.showWatermark) drawWatermark(ctx, cw, ch, settings.watermarkText);
  };

  // ── 1. Build segments ────────────────────────────────────
  log("Downloading audio & rendering frames...", 5);
  const segments: Segment[] = [];

  for (let i = 0; i < ayahs.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const ayah = ayahs[i];
    log(
      `Preparing ayah ${ayah.numberInSurah} (${i + 1}/${ayahs.length})...`,
      5 + Math.round((i / ayahs.length) * 35),
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
    });
  }

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // ── 2. Load ffmpeg WASM ──────────────────────────────────
  log("Loading video encoder...", 42);
  const ffmpeg = await getFFmpeg();
  log("Encoder ready.", 48);

  // ── 3. Write assets to virtual FS ────────────────────────
  log("Preparing assets for encoding...", 50);
  const cleanupPaths: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const frameName = `frame_${i}.png`;
    const audioName = `audio_${i}.${s.audioExt}`;
    await writeFFmpegFile(ffmpeg, frameName, s.img);
    await writeFFmpegFile(ffmpeg, audioName, s.audio);
    cleanupPaths.push(frameName, audioName, `seg_${i}.mp4`);
  }

  if (useVideoBg && bgVideoData) {
    await writeFFmpegFile(ffmpeg, "bg_video", bgVideoData);
    cleanupPaths.push("bg_video");
  }

  // ── 4. Encode segments ───────────────────────────────────
  const totalSegs = segments.length;

  if (useVideoBg) {
    // ── CONTINUOUS BACKGROUND MODE ─────────────────────────
    // Concat all audio, then create a single video with
    // the bg looping and text overlays switching at timestamps.

    // 4a. Add lead-in silence to each audio, then concat
    log("Mixing audio with lead-in silence...", 52);
    const audioList: string[] = [];

    for (let i = 0; i < totalSegs; i++) {
      const paddedName = `padded_${i}.aac`;
      await runFFmpeg(ffmpeg, [
        "-y", "-f", "lavfi", "-t", String(LEAD_IN),
        "-i", "anullsrc=r=44100:cl=stereo",
        "-i", `audio_${i}.${segments[i].audioExt}`,
        "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]",
        "-map", "[out]", "-c:a", "aac", "-b:a", "128k",
        "-ar", "44100", "-ac", "2", paddedName,
      ]);
      audioList.push(`file '${paddedName}'`);
      cleanupPaths.push(paddedName);
    }

    await writeFFmpegFile(
      ffmpeg,
      "audio_concat.txt",
      new TextEncoder().encode(audioList.join("\n")),
    );
    cleanupPaths.push("audio_concat.txt", "full_audio.m4a");

    await runFFmpeg(ffmpeg, [
      "-y", "-f", "concat", "-safe", "0",
      "-i", "audio_concat.txt",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "full_audio.m4a",
    ]);

    // 4b. Build overlay filter for continuous bg
    log("Encoding video with continuous background...", 60);
    const timestamps: { start: number; end: number }[] = [];
    let cumTime = 0;
    for (const seg of segments) {
      timestamps.push({ start: cumTime, end: cumTime + seg.dur + LEAD_IN });
      cumTime += seg.dur + LEAD_IN;
    }
    const totalDur = cumTime;

    const filterParts: string[] = [];
    filterParts.push(
      `[0:v]scale=${cw}:${ch}:force_original_aspect_ratio=increase,` +
      `crop=${cw}:${ch},setsar=1,trim=duration=${totalDur.toFixed(3)},setpts=PTS-STARTPTS[bg]`,
    );

    let prevLabel = "bg";
    for (let i = 0; i < totalSegs; i++) {
      const { start, end } = timestamps[i];
      const outLabel = i === totalSegs - 1 ? "v" : `v${i}`;
      filterParts.push(
        `[${prevLabel}][${i + 1}:v]overlay=0:0:format=auto:` +
        `enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'` +
        `[${outLabel}]`,
      );
      prevLabel = outLabel;
    }

    const inputs: string[] = ["-y", "-stream_loop", "-1", "-i", "bg_video"];
    for (let i = 0; i < totalSegs; i++) {
      inputs.push("-loop", "1", "-t", String(segments[i].dur + LEAD_IN), "-i", `frame_${i}.png`);
    }
    inputs.push("-i", "full_audio.m4a");

    const audioMapIdx = totalSegs + 1;

    await runFFmpeg(ffmpeg, [
      ...inputs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[v]", "-map", `${audioMapIdx}:a`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "-r", "24", "-t", String(totalDur.toFixed(3)),
      "-movflags", "+faststart",
      "output.mp4",
    ]);
  } else {
    // ── STATIC BACKGROUND MODE ─────────────────────────────
    // Same single-pass approach: concat audio, overlay frames.

    // 4c. Add lead-in silence to each audio, then concat
    log("Mixing audio...", 52);
    const audioList: string[] = [];

    for (let i = 0; i < totalSegs; i++) {
      const paddedName = `padded_${i}.aac`;
      await runFFmpeg(ffmpeg, [
        "-y", "-f", "lavfi", "-t", String(LEAD_IN),
        "-i", "anullsrc=r=44100:cl=stereo",
        "-i", `audio_${i}.${segments[i].audioExt}`,
        "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]",
        "-map", "[out]", "-c:a", "aac", "-b:a", "128k",
        "-ar", "44100", "-ac", "2", paddedName,
      ]);
      audioList.push(`file '${paddedName}'`);
      cleanupPaths.push(paddedName);
    }

    await writeFFmpegFile(
      ffmpeg,
      "audio_concat.txt",
      new TextEncoder().encode(audioList.join("\n")),
    );
    cleanupPaths.push("audio_concat.txt", "full_audio.m4a");

    await runFFmpeg(ffmpeg, [
      "-y", "-f", "concat", "-safe", "0",
      "-i", "audio_concat.txt",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "full_audio.m4a",
    ]);

    // 4d. Build overlay filter — same as video bg mode
    log("Encoding video...", 65);
    const timestamps: { start: number; end: number }[] = [];
    let cumTime = 0;
    for (const seg of segments) {
      timestamps.push({ start: cumTime, end: cumTime + seg.dur + LEAD_IN });
      cumTime += seg.dur + LEAD_IN;
    }
    const totalDur = cumTime;

    // Render a single background frame (the first ayah's baked frame)
    const bgName = "static_bg.png";
    await writeFFmpegFile(ffmpeg, bgName, segments[0].img);
    cleanupPaths.push(bgName);

    const filterParts: string[] = [];
    // Scale the static background to target size
    filterParts.push(
      `[0:v]scale=${cw}:${ch},setsar=1,` +
      `trim=duration=${totalDur.toFixed(3)},setpts=PTS-STARTPTS[bg]`,
    );

    // Overlay each text frame at the right timestamp
    let prevLabel = "bg";
    for (let i = 0; i < totalSegs; i++) {
      const { start, end } = timestamps[i];
      const outLabel = i === totalSegs - 1 ? "v" : `v${i}`;
      filterParts.push(
        `[${prevLabel}][${i + 1}:v]overlay=0:0:format=auto:` +
        `enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'` +
        `[${outLabel}]`,
      );
      prevLabel = outLabel;
    }

    // Inputs: [0] = static bg, [1..N] = text frames, [N+1] = audio
    const inputs: string[] = ["-y", "-loop", "1", "-t", String(totalDur.toFixed(3)), "-i", bgName];
    for (let i = 0; i < totalSegs; i++) {
      inputs.push("-loop", "1", "-t", String(segments[i].dur + LEAD_IN), "-i", `frame_${i}.png`);
    }
    inputs.push("-i", "full_audio.m4a");

    const audioMapIdx = totalSegs + 1;

    await runFFmpeg(ffmpeg, [
      ...inputs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[v]", "-map", `${audioMapIdx}:a`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "-r", "24", "-t", String(totalDur.toFixed(3)),
      "-movflags", "+faststart",
      "output.mp4",
    ]);
  }

  // ── 5. Read output ───────────────────────────────────────
  log("Finalising...", 96);
  const outputData = await readFFmpegFile(ffmpeg, "output.mp4");

  // ── 6. Cleanup virtual FS ────────────────────────────────
  await cleanupFFmpegFiles(ffmpeg, cleanupPaths);

  log("Done!", 100);
  return new Blob([outputData.buffer as BlobPart], { type: "video/mp4" });
}
