/**
 * generate-video.ts
 *
 * Pipeline:
 *  1. For each ayah: download MP3, render PNG frame, measure audio duration
 *     (all in the browser — unchanged from before)
 *  2. Upload all frames + audio to /api/generate-video, which runs real
 *     ffmpeg server-side (encode each segment, concat, return output.mp4)
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
    return dur + 0.6;
  } catch {
    return 6;
  }
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

  // ── 1. Build segments (unchanged) ───────────────────────────
  const segments: Segment[] = [];

  if (settings.showBasmalah) {
    log("Rendering Bismillah frame…", 5);
    drawBackground(
      ctx,
      cw,
      ch,
      settings.background,
      bgVideoEl,
      settings.bgOverlay,
    );
    drawAyahFrame(ctx, canvas, null, surah, settings, platform, true);
    segments.push({
      audio: makeSilenceWAV(3),
      audioExt: "wav",
      img: await canvasToPNG(canvas),
      dur: 3,
    });
  }

  for (let i = 0; i < ayahs.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const ayah = ayahs[i];
    log(
      `Preparing ayah ${ayah.numberInSurah} (${i + 1}/${ayahs.length})…`,
      5 + Math.round((i / ayahs.length) * 50),
    );

    const audioUrls = getAudioUrls(reciter, surah.number, ayah.numberInSurah);
    const rawAudio = await fetchAudioBuffer(audioUrls);
    const dur = rawAudio ? await measureAudioDuration(rawAudio) : 6;

    drawBackground(
      ctx,
      cw,
      ch,
      settings.background,
      bgVideoEl,
      settings.bgOverlay,
    );
    drawAyahFrame(ctx, canvas, ayah, surah, settings, platform, false);

    segments.push({
      audio: rawAudio ? new Uint8Array(rawAudio) : makeSilenceWAV(dur),
      audioExt: rawAudio ? "mp3" : "wav",
      img: await canvasToPNG(canvas),
      dur,
    });
  }

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // ── 2. Upload to server for real-ffmpeg encoding ────────────
  log("Uploading for encoding…", 60);

  const form = new FormData();
  form.append(
    "meta",
    JSON.stringify({
      width: cw,
      height: ch,
      segments: segments.map((s) => ({ dur: s.dur, audioExt: s.audioExt })),
    }),
  );
  segments.forEach((s, i) => {
    form.append(
      `frame_${i}`,
      new Blob([s.img], { type: "image/png" }),
      `frame_${i}.png`,
    );
    form.append(`audio_${i}`, new Blob([s.audio]), `audio_${i}.${s.audioExt}`);
  });

  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/generate-video");
    xhr.responseType = "blob";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        log(
          "Uploading for encoding…",
          60 + Math.round((e.loaded / e.total) * 25),
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

    log("Encoding on server…", 86);
    xhr.send(form);
  });
}
