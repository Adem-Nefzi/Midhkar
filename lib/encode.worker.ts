/**
 * encode.worker.ts
 *
 * Runs the entire encode pipeline inside a Web Worker using Mediabunny.
 *
 * Fixed:
 *  - Removed OfflineAudioContext which is main-thread only in some browsers.
 *  - Swapped AudioBufferSource for AudioSampleSource + native WebCodecs AudioData.
 *  - Constructed native AudioData directly in the worker and wrapped it in AudioSample.
 */

/// <reference lib="webworker" />

import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioSampleSource, // Use AudioSampleSource instead of AudioBufferSource
  AudioSample,       // Use AudioSample directly
  QUALITY_HIGH,
} from "mediabunny";

/* ── Message protocol ────────────────────────────────────────── */

export interface WorkerSegment {
  totalFrames: number;
}

export type WorkerInMessage =
  | {
      type: "start";
      payload: {
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
        bgBitmaps: ImageBitmap[];
        /** One continuous PCM track for the whole video, mono Float32. */
        fullAudioTrack: ArrayBuffer;
      };
    }
  | { type: "abort" };

export type WorkerOutMessage =
  | { type: "progress"; msg: string; pct: number }
  | { type: "done"; buffer: ArrayBuffer }
  | { type: "error"; message: string };

let aborted = false;

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  if (msg.type === "abort") {
    aborted = true;
    return;
  }
  if (msg.type === "start") {
    aborted = false;
    try {
      await runEncode(msg.payload);
    } catch (err: any) {
      post({ type: "error", message: err?.message ?? String(err) });
    }
  }
};

function post(m: WorkerOutMessage, transfer: Transferable[] = []) {
  (self as any).postMessage(m, transfer);
}

type StartPayload = Extract<WorkerInMessage, { type: "start" }>["payload"];

async function runEncode(payload: StartPayload) {
  const {
    cw,
    ch,
    fps,
    videoBitrate,
    audioBitrate,
    sampleRate,
    channels,
    frameDurationS,
    segments,
    ayahFrameBitmaps,
    bgBitmaps,
    fullAudioTrack,
  } = payload;

  post({ type: "progress", msg: "Initialising encoder…", pct: 42 });

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext("2d")!;

  const videoSource = new CanvasSource(canvas as any, {
    codec: "avc",
    bitrate: videoBitrate || QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  // Use AudioSampleSource instead of AudioBufferSource to feed raw AudioData packets directly
  const audioSource = new AudioSampleSource({
    codec: "aac",
    bitrate: audioBitrate || QUALITY_HIGH,
  });
  output.addAudioTrack(audioSource);

  await output.start();

  /* ── Encode audio: build native AudioData chunks directly ──────── */
  post({ type: "progress", msg: "Encoding audio…", pct: 46 });

  const fullTrack = new Float32Array(fullAudioTrack);
  
  // 5-second chunks
  const CHUNK_SECONDS = 5;
  const chunkFrames = Math.round(CHUNK_SECONDS * sampleRate);
  const totalChunks = Math.ceil(fullTrack.length / chunkFrames) || 1;

  let chunkIdx = 0;
  for (let offset = 0; offset < fullTrack.length; offset += chunkFrames) {
    if (aborted) throw new DOMException("Aborted", "AbortError");

    const count = Math.min(chunkFrames, fullTrack.length - offset);
    const audioDataSegment = fullTrack.subarray(offset, offset + count);

    // Construct standard WebCodecs AudioData directly in the worker
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: sampleRate,
      numberOfFrames: count,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000), // in microseconds
      data: audioDataSegment,
    });

    // Wrap in Mediabunny's AudioSample and pass to AudioSampleSource
    await audioSource.add(new AudioSample(audioData));
    
    // Close native AudioData object to free memory immediately
    audioData.close();

    chunkIdx++;
    if (chunkIdx % 4 === 0 || chunkIdx === totalChunks) {
      post({
        type: "progress",
        msg: `Encoding audio… ${chunkIdx}/${totalChunks}`,
        pct: 46 + Math.round((chunkIdx / totalChunks) * 6),
      });
    }
  }

  /* ── Encode video frames ──────────────────────────────────── */
  post({ type: "progress", msg: "Encoding video…", pct: 52 });

  let globalFrameIdx = 0;
  let timestampS = 0;
  const totalFrames = segments.reduce((s, seg) => s + seg.totalFrames, 0) || 1;
  let framesDone = 0;

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    if (aborted) throw new DOMException("Aborted", "AbortError");

    const seg = segments[segIdx];
    const overlayBitmap = ayahFrameBitmaps[segIdx];

    for (let f = 0; f < seg.totalFrames; f++) {
      if (aborted) throw new DOMException("Aborted", "AbortError");

      ctx.clearRect(0, 0, cw, ch);
      if (bgBitmaps.length > 0) {
        ctx.drawImage(
          bgBitmaps[globalFrameIdx % bgBitmaps.length],
          0,
          0,
          cw,
          ch,
        );
      }
      ctx.drawImage(overlayBitmap, 0, 0, cw, ch);

      await videoSource.add(timestampS, frameDurationS);

      timestampS += frameDurationS;
      globalFrameIdx++;
      framesDone++;

      if (framesDone % 16 === 0 || framesDone === totalFrames) {
        const pct = 52 + Math.round((framesDone / totalFrames) * 42);
        post({
          type: "progress",
          msg: `Encoding frame ${framesDone}/${totalFrames}…`,
          pct,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  /* ── Finalize ─────────────────────────────────────────────── */
  post({ type: "progress", msg: "Finalising…", pct: 96 });

  await output.finalize();

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Finalize completed but buffer is empty");

  // Free references
  ayahFrameBitmaps.forEach(b => b.close());
  bgBitmaps.forEach(b => b.close());

  post({ type: "progress", msg: "Done!", pct: 100 });
  post({ type: "done", buffer }, [buffer]);
}
