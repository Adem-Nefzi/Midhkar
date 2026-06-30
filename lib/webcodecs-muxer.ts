/**
 * webcodecs-muxer.ts
 *
 * Now only handles audio DECODING + RESAMPLING on the main thread.
 * All muxing/encoding has moved to encode.worker.ts using Mediabunny —
 * see that file for why (backpressure handling, no manual AudioData
 * format-matching, official successor to deprecated mp4-muxer).
 */

export const SAMPLE_RATE = 48000; // matches most browser AudioContext defaults
export const CHANNELS = 1; // mono — Quran recitation needs no stereo

export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof AudioData !== "undefined"
  );
}

let _audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

export function releaseAudioContext(): void {
  _audioCtx?.close().catch(() => {});
  _audioCtx = null;
}

/**
 * Decode an MP3/WAV ArrayBuffer and resample to exactly SAMPLE_RATE, mono.
 * Returns a plain Float32Array — the only format the rest of the pipeline
 * deals with downstream.
 */
export async function decodeAndResample(
  buffer: ArrayBuffer,
): Promise<Float32Array | null> {
  try {
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(buffer.slice(0));

    if (decoded.sampleRate === SAMPLE_RATE && decoded.numberOfChannels === 1) {
      return decoded.getChannelData(0).slice();
    }

    const outLen = Math.ceil(decoded.duration * SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, outLen, SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } catch (err) {
    console.warn("[decodeAndResample] failed:", err);
    return null;
  }
}

/** Build a silent Float32Array of `seconds` duration at SAMPLE_RATE. */
export function silenceSamples(seconds: number): Float32Array {
  return new Float32Array(Math.round(seconds * SAMPLE_RATE));
}
