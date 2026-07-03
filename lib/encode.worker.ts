/**
 * encode.worker.ts  (v2 — in-worker background decode)
 *
 * Runs the ENTIRE pipeline inside a Web Worker using Mediabunny:
 *  - Decodes the background video (if any) directly from raw bytes using
 *    Input + BlobSource + CanvasSink. This replaces the old main-thread
 *    <video> + seek()-per-frame approach, which was the primary source of
 *    lag/stuttering (each seek was a full keyframe-seek + decode round
 *    trip via a DOM event, blocking the main thread for the entire
 *    duration of capture).
 *  - CanvasSink also handles resize + aspect-correct cropping (`fit:
 *    'cover'`) and respects the source video's rotation metadata
 *    automatically, so we no longer need a manual drawImage-stretch step.
 *  - Background decode is kicked off *before* the audio encode loop and
 *    only awaited once we actually need it (right before the video frame
 *    loop), so the two run concurrently instead of serially.
 *  - Encoder is configured with `latencyMode` + `hardwareAcceleration`
 *    hints for throughput (see generate-video.ts's DeviceProfile).
 *  - If the background video fails to decode for any reason, we fall back
 *    to a solid color instead of producing a broken/blank video.
 */

/// <reference lib="webworker" />

import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioSampleSource,
  AudioSample,
  QUALITY_HIGH,
  Input,
  BlobSource,
  CanvasSink,
  ALL_FORMATS,
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
        /** Raw bytes of the background video file, or null if no video bg. */
        bgVideoBytes: ArrayBuffer | null;
        /** Cap on how many unique background frames to decode (one loop). */
        maxBgFrames: number;
        /** One continuous PCM track for the whole video, mono Float32. */
        fullAudioTrack: ArrayBuffer;
        transitionStyle: "none" | "fade" | "slide" | "scale";
        latencyMode: "quality" | "realtime";
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

/* ══════════════════════════════════════════════════════════════
   Background video decode — sequential, hardware-accelerated,
   NO seeking. This is the replacement for the old main-thread
   captureBackgroundFrames().
══════════════════════════════════════════════════════════════ */

const FALLBACK_BG_COLOR = "#0b0b0f";

async function decodeBackgroundFrames(
  bytes: ArrayBuffer,
  cw: number,
  ch: number,
  fps: number,
  maxFrames: number,
  totalOutputFrames: number,
  onProgress: (done: number, total: number) => void,
): Promise<ImageBitmap[]> {
  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(new Blob([bytes])),
    });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack || !(await videoTrack.canDecode())) {
      console.warn("[worker] background video track missing or undecodable");
      return [];
    }

    const rawDuration = await videoTrack.computeDuration();
    const safeDuration =
      rawDuration && isFinite(rawDuration) && rawDuration > 0
        ? rawDuration
        : 10;
    const uniqueFrameCount = Math.max(1, Math.ceil(safeDuration * fps));
    const count = Math.min(
      uniqueFrameCount,
      maxFrames,
      totalOutputFrames || uniqueFrameCount,
    );

    // CanvasSink handles resize, aspect-correct cropping (fit: 'cover'),
    // and rotation-metadata correction for us — no manual scaling needed.
    const sink = new CanvasSink(videoTrack, {
      width: cw,
      height: ch,
      fit: "cover",
    });
    const frames: ImageBitmap[] = [];

    for await (const result of sink.canvases(0, safeDuration)) {
      if (aborted) break;
      if (!result) continue;
      frames.push(await createImageBitmap(result.canvas as OffscreenCanvas));
      if (frames.length % 15 === 0) onProgress(frames.length, count);
      if (frames.length >= count) break;
    }

    return frames;
  } catch (err) {
    console.warn(
      "[worker] background decode failed, falling back to solid color:",
      err,
    );
    return [];
  }
}

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
    bgVideoBytes,
    maxBgFrames,
    fullAudioTrack,
    transitionStyle,
    latencyMode,
  } = payload;

  post({ type: "progress", msg: "Initialising encoder…", pct: 40 });

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext("2d")!;

  const videoSource = new CanvasSource(canvas as any, {
    codec: "avc",
    bitrate: videoBitrate || QUALITY_HIGH,
    latencyMode,
    hardwareAcceleration: "prefer-hardware",
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const audioSource = new AudioSampleSource({
    codec: "aac",
    bitrate: audioBitrate || QUALITY_HIGH,
  });
  output.addAudioTrack(audioSource);

  await output.start();

  /* ── Kick off background decode NOW — it runs concurrently
     with audio encoding below since both are async/hardware-
     bound and don't block each other on the JS thread. ──────── */
  const totalFrames = segments.reduce((s, seg) => s + seg.totalFrames, 0) || 1;

  const bgFramesPromise: Promise<ImageBitmap[]> = bgVideoBytes
    ? decodeBackgroundFrames(
        bgVideoBytes,
        cw,
        ch,
        fps,
        maxBgFrames,
        totalFrames,
        (done, total) =>
          post({
            type: "progress",
            msg: `Decoding background… ${done}/${total}`,
            pct: 40 + Math.round((done / total) * 8), // 40 → 48
          }),
      )
    : Promise.resolve([]);

  /* ── Encode audio: build native AudioData chunks directly ──────── */
  post({ type: "progress", msg: "Encoding audio…", pct: 48 });

  const fullTrack = new Float32Array(fullAudioTrack);

  const CHUNK_SECONDS = 5;
  const chunkFrames = Math.round(CHUNK_SECONDS * sampleRate);
  const totalChunks = Math.ceil(fullTrack.length / chunkFrames) || 1;

  let chunkIdx = 0;
  for (let offset = 0; offset < fullTrack.length; offset += chunkFrames) {
    if (aborted) throw new DOMException("Aborted", "AbortError");

    const count = Math.min(chunkFrames, fullTrack.length - offset);
    const audioDataSegment = fullTrack.subarray(offset, offset + count);

    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: sampleRate,
      numberOfFrames: count,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: audioDataSegment,
    });

    await audioSource.add(new AudioSample(audioData));
    audioData.close();

    chunkIdx++;
    if (chunkIdx % 4 === 0 || chunkIdx === totalChunks) {
      post({
        type: "progress",
        msg: `Encoding audio… ${chunkIdx}/${totalChunks}`,
        pct: 48 + Math.round((chunkIdx / totalChunks) * 6), // 48 → 54
      });
    }
  }

  /* ── Now actually wait for background frames (usually already
     done, since it's been decoding since before the audio loop
     started). ─────────────────────────────────────────────────── */
  post({ type: "progress", msg: "Finalising background…", pct: 54 });
  const bgBitmaps = await bgFramesPromise;
  if (aborted) {
    bgBitmaps.forEach((b) => b.close());
    throw new DOMException("Aborted", "AbortError");
  }
  const bgDecodeFailed = !!bgVideoBytes && bgBitmaps.length === 0;

  /* ── Encode video frames ──────────────────────────────────── */
  post({ type: "progress", msg: "Encoding video…", pct: 56 });

  let globalFrameIdx = 0;
  let timestampS = 0;
  let framesDone = 0;

  const TRANSITION_FRAMES = 15; // 0.5s transition at 30fps

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
      } else if (bgDecodeFailed) {
        // Background video failed to decode — fall back to a solid
        // color rather than shipping a blank/broken video.
        ctx.fillStyle = FALLBACK_BG_COLOR;
        ctx.fillRect(0, 0, cw, ch);
      }

      let tProgress = 1;
      let isTransitioning = false;

      if (transitionStyle && transitionStyle !== "none") {
        if (f < TRANSITION_FRAMES) {
          tProgress = f / TRANSITION_FRAMES;
          isTransitioning = true;
        } else if (f > seg.totalFrames - TRANSITION_FRAMES) {
          tProgress = Math.max(0, (seg.totalFrames - f) / TRANSITION_FRAMES);
          isTransitioning = true;
        }
      }

      ctx.save();
      if (isTransitioning) {
        if (transitionStyle === "fade") {
          ctx.globalAlpha = tProgress;
        } else if (transitionStyle === "slide") {
          ctx.globalAlpha = tProgress;
          const offset = (1 - tProgress) * 40;
          ctx.translate(0, offset);
        } else if (transitionStyle === "scale") {
          ctx.globalAlpha = tProgress;
          const scale = 0.95 + tProgress * 0.05;
          ctx.translate(cw / 2, ch / 2);
          ctx.scale(scale, scale);
          ctx.translate(-cw / 2, -ch / 2);
        }
      }
      ctx.drawImage(overlayBitmap, 0, 0, cw, ch);
      ctx.restore();

      await videoSource.add(timestampS, frameDurationS);

      timestampS += frameDurationS;
      globalFrameIdx++;
      framesDone++;

      if (framesDone % 16 === 0 || framesDone === totalFrames) {
        const pct = 56 + Math.round((framesDone / totalFrames) * 40); // 56 → 96
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
  post({ type: "progress", msg: "Finalising…", pct: 97 });

  await output.finalize();

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Finalize completed but buffer is empty");

  ayahFrameBitmaps.forEach((b) => b.close());
  bgBitmaps.forEach((b) => b.close());

  post({ type: "progress", msg: "Done!", pct: 100 });
  post({ type: "done", buffer }, [buffer]);
}
