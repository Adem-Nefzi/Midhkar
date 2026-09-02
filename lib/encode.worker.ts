/**
 * encode.worker.ts  (v3 — synced, gapless verse transitions)
 *
 * Two fixes in this revision, both about audio/text sync:
 *
 *  1. DRIFT FIX: `totalFrames` per segment used to be computed independently
 *     via Math.round((totalSec+trailSec)*FPS). Each verse rounds to the
 *     nearest 1/30s on its own, and these small errors don't cancel — they
 *     accumulate across the video. `WorkerSegment.totalFrames` is now
 *     expected to already come from a CUMULATIVE allocation (see
 *     generate-video.ts) so total drift across the whole video stays at
 *     most half a frame, instead of growing with verse count.
 *
 *  2. TRANSITION FIX: previously each verse faded its OWN text out during
 *     its last 0.5s and faded its OWN text in during its first 0.5s —
 *     meaning for a full second around every verse boundary, text was
 *     dim/transitioning while the recitation kept playing right through
 *     it. Now it's a true crossfade between the outgoing and incoming
 *     verse's text (old alpha + new alpha always sum to 1, so there's
 *     never a dim/blank dip), and the window is placed:
 *       - inside the silence gap between verses, if `verseSpacing` leaves
 *         one (so neither verse's spoken audio is ever touched), or
 *       - split tightly across the exact audio cut point (~270ms total)
 *         if there's no gap, since that's the only time available.
 *     `WorkerSegment.trailFrames` (how many of a segment's own frames are
 *     trailing silence vs speech) is what makes this placement possible.
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
  BufferSource,
  CanvasSink,
  ALL_FORMATS,
} from "mediabunny";

/* ── Message protocol ────────────────────────────────────────── */

export interface WorkerSegment {
  /** Total frames for this verse, INCLUDING its trailing silence (if any).
   *  Must come from a cumulative (drift-free) allocation — see
   *  generate-video.ts's segment-building code. */
  totalFrames: number;
  /** How many of this segment's own trailing frames are silence (from
   *  `verseSpacing`), as opposed to actual spoken audio. Used to place the
   *  transition crossfade inside dead time instead of over speech. 0 if
   *  there's no gap after this verse. */
  trailFrames: number;
}

export type WorkerInMessage =
  | {
      type: "start";
      payload: {
        cw: number;
        ch: number;
        renderFps: number;   // Unique frames rendered per second (30)
        outputFps: number;   // Encoded output FPS (60 or 30)
        videoBitrate: number;
        audioBitrate: number;
        sampleRate: number;
        channels: number;
        segments: WorkerSegment[];
        /** Total overlay bitmaps that will arrive via "overlays" messages.
         *  They stream in batches (see below) instead of riding the start
         *  message, so a 200-verse video never holds 200 full-res transparent
         *  frames in worker RAM at once. */
        overlayCount: number;
        /** Ordered playlist of background videos (raw bytes). Empty = no video bg.
         *  They're played back-to-back; the last loops if the total is shorter
         *  than the output, and items stop early if it's longer. */
        bgVideoBytes: ArrayBuffer[];
        /** Per-clip cap on unique bg frames decoded (sampled evenly). */
        maxBgFrames: number;
        /** TOTAL bg frames allowed across the whole playlist. The worker
         *  splits this across clips (by duration when known) so resident
         *  bitmap memory never exceeds what the output can actually show. */
        maxTotalBgFrames: number;
        /** Known clip durations in seconds (0 = unknown), parallel to
         *  bgVideoBytes — used to split maxTotalBgFrames proportionally. */
        bgDurations: number[];
        /** One continuous PCM track for the whole video, mono Float32. */
        fullAudioTrack: ArrayBuffer;
        transitionStyle: "none" | "fade" | "slide" | "scale";
        latencyMode: "quality" | "realtime";
        /** Darkness overlay on top of the background video, 0–80 (%). */
        bgOverlayPct: number;
      };
    }
  | {
      type: "overlays";
      startIndex: number;
      bitmaps: ImageBitmap[];
    }
  | { type: "abort" };

export type WorkerOutMessage =
  | { type: "progress"; msg: string; pct: number }
  | { type: "done"; buffer: ArrayBuffer }
  | { type: "error"; message: string };

let aborted = false;

/* ── Streaming overlay store ────────────────────────────────────
   Overlay bitmaps arrive in batches AFTER the "start" message (they
   are rendered progressively on the main thread). The encode loop
   waits for the batch it needs, and closes each bitmap as soon as
   the segment after it has been drawn — so worker RAM holds only a
   handful of overlays at any moment, not one per verse. */
const overlayStore: (ImageBitmap | null)[] = [];
let overlaysReceived = 0;
let overlayNotify: (() => void) | null = null;

function storeOverlays(startIndex: number, bitmaps: ImageBitmap[]): void {
  for (let i = 0; i < bitmaps.length; i++) {
    overlayStore[startIndex + i] = bitmaps[i];
  }
  overlaysReceived += bitmaps.length;
  if (overlayNotify) {
    const n = overlayNotify;
    overlayNotify = null;
    n();
  }
}

async function ensureOverlays(upTo: number): Promise<void> {
  while (overlaysReceived < upTo + 1) {
    if (aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise<void>((resolve) => {
      overlayNotify = resolve;
    });
  }
}

// If the worker's own module init or any async path throws outside of
// runEncode, main-thread onerror gets an empty Event. Surface everything.
self.addEventListener("error", (e) => {
  console.error("[worker uncaught]", e);
  post({
    type: "error",
    message: `uncaught in worker: ${(e as ErrorEvent)?.message ?? String(e)}`,
  });
});
self.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  console.error("[worker unhandledrejection]", e.reason);
  const r = e.reason;
  post({
    type: "error",
    message: `unhandled rejection in worker: ${r?.stack || r?.message || String(r)}`,
  });
});

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;
  if (msg.type === "abort") {
    aborted = true;
    if (overlayNotify) {
      const n = overlayNotify;
      overlayNotify = null;
      n();
    }
    return;
  }
  if (msg.type === "overlays") {
    storeOverlays(msg.startIndex, msg.bitmaps);
    return;
  }
  if (msg.type === "start") {
    aborted = false;
    overlayStore.length = 0;
    overlaysReceived = 0;
    try {
      await runEncode(msg.payload);
    } catch (err: any) {
      console.error("[encode.worker error]", err);
      post({ type: "error", message: err?.stack || err?.message || String(err) });
    }
  }
};

function post(m: WorkerOutMessage, transfer: Transferable[] = []) {
  (self as any).postMessage(m, transfer);
}

type StartPayload = Extract<WorkerInMessage, { type: "start" }>["payload"];

/* Split the total background-frame budget across playlist clips.
   Proportional to known clip durations; even split when any duration is
   unknown. `perClipCap` stays the absolute ceiling per clip. The result:
   resident bg-bitmap memory never exceeds what the output can display,
   instead of scaling with playlist length × per-clip cap. */
function allocateBgBudget(
  durations: number[],
  count: number,
  totalBudget: number,
  perClipCap: number,
): number[] {
  if (count === 0) return [];
  const durs =
    durations.length === count ? durations : new Array<number>(count).fill(0);
  const allKnown = durs.every((d) => isFinite(d) && d > 0);
  if (allKnown) {
    const sum = durs.reduce((a, b) => a + b, 0);
    return durs.map((d) =>
      Math.max(30, Math.min(perClipCap, Math.round((totalBudget * d) / sum))),
    );
  }
  const even = Math.max(30, Math.floor(totalBudget / count));
  return new Array<number>(count).fill(Math.min(perClipCap, even));
}

/* ══════════════════════════════════════════════════════════════
   Background video decode — unchanged from v2: sequential,
   hardware-accelerated, no seeking.
══════════════════════════════════════════════════════════════ */

/* Gradient fallback for decode-failed bgs — matches the server
 * renderer's drawFallbackBg so local and cloud outputs look the same
 * instead of a flat near-black frame. */
function paintFallbackBgGradient(
  ctx: OffscreenCanvasRenderingContext2D,
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

async function decodeBackgroundFrames(
  bytes: ArrayBuffer,
  cw: number,
  ch: number,
  renderFps: number,
  maxFrames: number,
  onProgress: (done: number, total: number) => void,
): Promise<ImageBitmap[]> {
  let input: Input | null = null;
  try {
    // BufferSource = whole file already in RAM, so mediabunny seeks freely
    // (mp4 moov may trail mdat on stock clips) and reports FULL duration.
    input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack || !(await videoTrack.canDecode())) {
      console.warn(`[bg] ${(bytes.byteLength / 1e6).toFixed(1)}MB: no video track / not decodable`);
      return [];
    }

    // Compute exact playable duration; fall back to container metadata.
    let duration = await videoTrack.computeDuration();
    if (!isFinite(duration) || duration <= 0) {
      const meta = await videoTrack.getDurationFromMetadata().catch(() => null);
      duration = meta ?? 0;
    }
    if (!isFinite(duration) || duration <= 0) {
      console.warn(`[bg] ${(bytes.byteLength / 1e6).toFixed(1)}MB: no readable duration`);
      return [];
    }

    // Sampling: keep 1 of every `step` source frames covering [0, duration)
    // so the clip's whole timeline fits in `maxFrames` real bitmaps. This
    // keeps decode work near the budget instead of exploding with length.
    const step = Math.max(1, Math.ceil((duration * renderFps) / maxFrames));
    const sink = new CanvasSink(videoTrack, { width: cw, height: ch, fit: "cover" });
    const frames: ImageBitmap[] = [];
    let i = 0;
    for await (const result of sink.canvases(0, duration)) {
      if (aborted || !result) break;
      if (i % step === 0) {
        frames.push(
          await createImageBitmap(result.canvas as OffscreenCanvas, {
            premultiplyAlpha: "premultiply",
          }),
        );
        if (frames.length % 10 === 0) onProgress(frames.length, maxFrames);
        if (frames.length >= maxFrames) break;
      }
      i++;
    }
    console.log(
      `[bg] ${(bytes.byteLength / 1e6).toFixed(1)}MB · ${duration.toFixed(1)}s · step=${step} → ${frames.length} frames`,
    );
    return frames;
  } catch (err) {
    console.warn(
      `[bg] ${(bytes.byteLength / 1e6).toFixed(1)}MB: decode failed`,
      err instanceof Error ? err.stack ?? err.message : err,
    );
    return [];
  } finally {
    // Worker is one-shot; disposal releases the demuxer but MUST NOT touch
    // the decoded bitmaps, which outlive this scope.
    try { await input?.dispose(); } catch { /* ignore */ }
  }
}

/* ══════════════════════════════════════════════════════════════
   Transition scheduling
   ──────────────────────────────────────────────────────────────
   For each boundary between verse i and verse i+1, decide how many
   frames come from the END of verse i's segment ("preFrames") and how
   many from the START of verse i+1's segment ("postFrames") to make up
   the crossfade window. Preference order:
     1. If verse i has enough trailing silence, put the WHOLE window
        there — verse i+1's spoken audio starts exactly when its text
        has already fully arrived, and verse i's spoken audio is never
        touched.
     2. If there's SOME silence, use all of it, then take the remainder
        from the start of verse i+1.
     3. If there's none, split evenly across the hard cut.
══════════════════════════════════════════════════════════════ */

const TRANSITION_WINDOW_FRAMES = 8; // ~270ms @30fps total crossfade length
const BOOKEND_FADE_FRAMES = 6; // ~200ms fade at the very start/end of the video

interface Boundary {
  preFrames: number; // taken from the end of the earlier segment
  postFrames: number; // taken from the start of the later segment
}

function computeBoundaries(
  segments: WorkerSegment[],
  transitionEnabled: boolean,
): Boundary[] {
  if (!transitionEnabled) {
    return segments.slice(0, -1).map(() => ({ preFrames: 0, postFrames: 0 }));
  }
  return segments.slice(0, -1).map((seg) => {
    const trailAvail = Math.max(0, Math.min(seg.trailFrames, seg.totalFrames));
    const TW = TRANSITION_WINDOW_FRAMES;
    if (trailAvail >= TW) return { preFrames: TW, postFrames: 0 };
    if (trailAvail > 0)
      return { preFrames: trailAvail, postFrames: TW - trailAvail };
    const preFrames = Math.floor(TW / 2);
    return { preFrames, postFrames: TW - preFrames };
  });
}

async function runEncode(payload: StartPayload) {
  const {
    cw,
    ch,
    renderFps,
    outputFps,
    videoBitrate,
    audioBitrate,
    sampleRate,
    channels,
    segments,
    overlayCount,
    bgVideoBytes,
    maxBgFrames,
    maxTotalBgFrames,
    bgDurations,
    fullAudioTrack,
    transitionStyle,
    latencyMode,
    bgOverlayPct,
  } = payload;

  const frameDurationS = 1 / outputFps;
  const frameDouble = Math.round(outputFps / renderFps); // 2 for 60fps output, 1 for 30fps

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
  output.addVideoTrack(videoSource, { frameRate: outputFps });

  const audioSource = new AudioSampleSource({
    codec: "aac",
    bitrate: audioBitrate || QUALITY_HIGH,
  });
  output.addAudioTrack(audioSource);

  await output.start();

  /* ── Kick off background decode NOW — runs concurrently with
     audio encoding below. Each video is decoded IN PARALLEL into its
     own ordered frame list (playlist[i]). At composite time the lists
     are strung together end-to-end: video 1 fully, then video 2, etc.,
     with a quick crossfade at each seam. The FINAL video loops if the
     whole playlist is shorter than the output. ────────────────────── */
   const videoCount = bgVideoBytes.length;
   /* Per-clip budgets come from the shared total budget (≈ the output's own
      unique frame count), so a long playlist can't multiply RAM use. Each
      clip still gets up to `maxBgFrames` when the budget allows. */
   const perVideoCaps = allocateBgBudget(
     bgDurations,
     videoCount,
     Math.max(1, Math.floor(maxTotalBgFrames)),
     Math.max(1, Math.floor(maxBgFrames)),
   );
   const bgBudgetTotal =
     perVideoCaps.reduce((a, b) => a + b, 0) || 1;
   const decodedCounts = new Array<number>(videoCount).fill(0);
   const bgFramesPromise: Promise<ImageBitmap[][]> = videoCount
     ? Promise.all(
         bgVideoBytes.map((bytes, vi) =>
           decodeBackgroundFrames(
             bytes,
             cw,
             ch,
             renderFps,
             perVideoCaps[vi],
             (done, total) => {
               decodedCounts[vi] = done;
               const sum = decodedCounts.reduce((a, b) => a + b, 0);
               post({
                 type: "progress",
                 msg:
                   videoCount > 1
                     ? `Decoding backgrounds ${vi + 1}/${videoCount}…`
                     : `Decoding background… ${done}/${total}`,
                 pct: 40 + Math.round((sum / bgBudgetTotal) * 8),
               });
             },
           ),
         ),
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
    const audioDataSegment = fullTrack.slice(offset, offset + count);

    const sample = new AudioSample({
      format: "f32-planar",
      sampleRate: sampleRate,
      numberOfChannels: channels,
      timestamp: offset / sampleRate,
      data: audioDataSegment,
    });

    await audioSource.add(sample);
    sample.close();

    chunkIdx++;
    if (chunkIdx % 8 === 0 || chunkIdx === totalChunks) {
      post({
        type: "progress",
        msg: `Encoding audio… ${chunkIdx}/${totalChunks}`,
        pct: 48 + Math.round((chunkIdx / totalChunks) * 6), // 48 → 54
      });
    }
  }

  audioSource.close();

  /* ── Wait for background frames (usually already done). ───────── */
  post({ type: "progress", msg: "Finalising background…", pct: 54 });
  const bgPlaylist = await bgFramesPromise;
  console.log(`[bg] decoded per clip: [${bgPlaylist.map((l) => l.length).join(", ")}]`);
  /* Keep only clips that actually decoded ≥1 frame. bgCum/bgLen MUST stay
     in lockstep with the array the compositor indexes into; that lock-step
     is what used to re-play clip 0 forever. */
  const usable = bgPlaylist.filter((l) => l.length > 0);
  const bgLen = usable.map((l) => l.length);

  // Each clip's slot is its FULL decoded length; the last `seamFrames` of a
  // slot dissolve into the next clip's first frame (see the compositor).
  // Keeping the tail INSIDE the slot is what makes that region reachable —
  // reserving it away (the old behaviour) silently killed every seam fade.
  const seamFrames = Math.min(10, Math.round(renderFps / 3)); // short crossfade between playlist items
  const bgCum: number[] = [0];
  for (const n of bgLen) bgCum.push(bgCum[bgCum.length - 1] + Math.max(1, n));
  const bgTotal = bgCum[bgCum.length - 1] || 1;
  const hasBg = bgLen.length > 0;
  if (aborted) {
    bgPlaylist.flat().forEach((b) => b.close());
    throw new DOMException("Aborted", "AbortError");
  }
  const bgDecodeFailed = videoCount > 0 && !hasBg;
  const bgDarkenAlpha =
    hasBg || bgDecodeFailed
      ? Math.min(0.8, Math.max(0, bgOverlayPct / 100))
      : 0;
  if (bgDecodeFailed) {
    console.error(
      "[encode.worker] background video bytes were provided but could not be decoded — output will use the fallback background instead.",
    );
  }

  /* ── Encode video frames ──────────────────────────────────── */
  post({ type: "progress", msg: "Encoding video…", pct: 56 });

  const transitionEnabled = transitionStyle !== "none";
  const boundaries = computeBoundaries(segments, transitionEnabled);

  // totalFrames is the number of UNIQUE frames to render (at renderFps).
  // Each is added `frameDouble` times to the encoder for outputFps output.
  const totalRenderFrames =
    segments.reduce((s, seg) => s + seg.totalFrames, 0) || 1;
  const totalOutputFrames = totalRenderFrames * frameDouble;

  let globalRenderIdx = 0; // counts unique rendered frames
  let outputFrameIdx = 0;  // counts encoded (output) frames
  let oldestOpenOverlay = 0;

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    if (aborted) throw new DOMException("Aborted", "AbortError");

    // Wait until this segment's overlay AND the next one (needed for the
    // outgoing crossfade) have streamed in from the main thread.
    await ensureOverlays(Math.min(segIdx + 1, overlayCount - 1));

    const seg = segments[segIdx];
    const overlay = overlayStore[segIdx]!;
    const nextOverlay =
      segIdx < segments.length - 1 ? overlayStore[segIdx + 1] : null;
    const prevOverlay = segIdx > 0 ? overlayStore[segIdx - 1] : null;

    // Boundary INTO this segment (crossfade tail from the previous verse)
    const inB = segIdx > 0 ? boundaries[segIdx - 1] : null;
    // Boundary OUT of this segment (crossfade head into the next verse)
    const outB = segIdx < boundaries.length ? boundaries[segIdx] : null;

    const outgoingPre = outB ? Math.min(outB.preFrames, seg.totalFrames) : 0;
    const incomingPost = inB
      ? Math.min(inB.postFrames, Math.max(0, seg.totalFrames - outgoingPre))
      : 0;

    for (let f = 0; f < seg.totalFrames; f++) {
      if (aborted) throw new DOMException("Aborted", "AbortError");

      // ── Render unique frame content (once per renderFps frame) ───
      ctx.clearRect(0, 0, cw, ch);
      if (hasBg) {
        /* Deterministic wallpaper: `bgCum[i]` is clip i's START in the
           output timeline, `bgTotal` is the span of one full pass
           (everything before any clip loops). Binary-search → (i, cursor).
           Each slot is the clip's full decoded length; its final
           `seamFrames` dissolve into the next clip's first frame. */
        const pos = globalRenderIdx % bgTotal;
        let l = 0, r = bgCum.length - 2;
        while (l < r) {
          const mid = (l + r) >> 1;
          if (pos >= bgCum[mid + 1]) l = mid + 1;
          else r = mid;
        }
        const i = l;
        const cursor = pos - bgCum[i];

        const cur = usable[i][Math.min(cursor, usable[i].length - 1)];
        ctx.drawImage(cur, 0, 0, cw, ch);

        // Tail of the slot: dissolve into the NEXT clip's first frame
        // (clip 0 on the wrap loop). Single-clip playlists skip this.
        const nextI = i + 1 < bgLen.length ? i + 1 : 0;
        const withinTail = cursor >= bgLen[i] - seamFrames;
        if (nextI !== i && withinTail && transitionStyle !== "none") {
          const t = cursor - (bgLen[i] - seamFrames);
          const a = Math.min(1, (t + 1) / (seamFrames + 1));
          ctx.globalAlpha = a;
          ctx.drawImage(usable[nextI][0], 0, 0, cw, ch);
          ctx.globalAlpha = 1;
        }
      } else if (bgDecodeFailed) {
        paintFallbackBgGradient(ctx, cw, ch);
      }
      // Darkness overlay over the video bg (static-color bgs bake this
      // into their overlay bitmaps on the main thread instead).
      if (bgDarkenAlpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${bgDarkenAlpha})`;
        ctx.fillRect(0, 0, cw, ch);
      }

      let oldBitmap: ImageBitmap | null = null;
      let oldAlpha = 0;
      let newBitmap: ImageBitmap = overlay;
      let newAlpha = 1;
      let newTransformProgress = 1;

      if (incomingPost > 0 && f < incomingPost && prevOverlay) {
        const totalW = inB!.preFrames + inB!.postFrames;
        const k = inB!.preFrames + f;
        const t = (k + 1) / (totalW + 1);
        oldBitmap = prevOverlay;
        oldAlpha = 1 - t;
        newBitmap = overlay;
        newAlpha = t;
        newTransformProgress = t;
      } else if (
        outgoingPre > 0 &&
        f >= seg.totalFrames - outgoingPre &&
        nextOverlay
      ) {
        const totalW = outB!.preFrames + outB!.postFrames;
        const kLocal = f - (seg.totalFrames - outgoingPre);
        const t = (kLocal + 1) / (totalW + 1);
        oldBitmap = overlay;
        oldAlpha = 1 - t;
        newBitmap = nextOverlay;
        newAlpha = t;
        newTransformProgress = t;
      } else if (transitionEnabled && segIdx === 0 && f < BOOKEND_FADE_FRAMES) {
        newAlpha = (f + 1) / (BOOKEND_FADE_FRAMES + 1);
      } else if (
        transitionEnabled &&
        segIdx === segments.length - 1 &&
        f >= seg.totalFrames - BOOKEND_FADE_FRAMES
      ) {
        const kk = f - (seg.totalFrames - BOOKEND_FADE_FRAMES);
        newAlpha = 1 - (kk + 1) / (BOOKEND_FADE_FRAMES + 1);
      }

      if (oldBitmap && oldAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = oldAlpha;
        ctx.drawImage(oldBitmap, 0, 0, cw, ch);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = newAlpha;
      if (transitionStyle === "slide" && newTransformProgress < 1) {
        const offset = (1 - newTransformProgress) * 40;
        ctx.translate(0, offset);
      } else if (transitionStyle === "scale" && newTransformProgress < 1) {
        const scale = 0.95 + newTransformProgress * 0.05;
        ctx.translate(cw / 2, ch / 2);
        ctx.scale(scale, scale);
        ctx.translate(-cw / 2, -ch / 2);
      }
      ctx.drawImage(newBitmap, 0, 0, cw, ch);
      ctx.restore();

      // ── Submit to encoder: frameDouble times for outputFps ─────
      // H.264 P-frames make duplicate submissions nearly free (tiny
      // inter-frame reference, almost zero data).
      for (let d = 0; d < frameDouble; d++) {
        const timestampS = outputFrameIdx * frameDurationS;
        await videoSource.add(timestampS, frameDurationS);
        outputFrameIdx++;
      }

      globalRenderIdx++;

      if (outputFrameIdx % 60 === 0 || outputFrameIdx >= totalOutputFrames) {
        const pct = 56 + Math.round((outputFrameIdx / totalOutputFrames) * 40);
        post({
          type: "progress",
          msg: `Encoding frame ${outputFrameIdx}/${totalOutputFrames}…`,
          pct,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // This segment is done; the next one only reads segIdx and segIdx+1,
    // so everything older can be released.
    for (let k = oldestOpenOverlay; k < segIdx; k++) {
      overlayStore[k]?.close();
      overlayStore[k] = null;
    }
    oldestOpenOverlay = segIdx;
  }

  videoSource.close();

  /* ── Finalize ─────────────────────────────────────────────── */
  post({ type: "progress", msg: "Finalising…", pct: 97 });

  await output.finalize();

  const buffer = (output.target as BufferTarget).buffer;
  if (!buffer) throw new Error("Finalize completed but buffer is empty");

  for (let k = oldestOpenOverlay; k < overlayStore.length; k++) {
    overlayStore[k]?.close();
    overlayStore[k] = null;
  }
  bgPlaylist.flat().forEach((b) => b.close());

  post({ type: "progress", msg: "Done!", pct: 100 });
  post({ type: "done", buffer }, [buffer]);
}
