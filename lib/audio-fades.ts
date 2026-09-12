/**
 * audio-fades.ts — shared micro-fade / bookend utilities for audio tracks.
 * Used by both the server (render-chunk.ts) and client (generate-video.ts)
 * to ensure identical, click-free ayah-to-ayah transitions.
 */

export const SAMPLE_RATE = 48000;

/**
 * Raised-cosine (Hann) window for smooth, click-free fades.
 * length: number of samples
 * type: "in" for fade-in, "out" for fade-out
 */
export function raisedCosineFade(length: number, type: "in" | "out"): Float32Array {
  const win = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // raised cosine: 0.5 * (1 - cos(pi * i / (len-1))) for fade-in
    // reverse for fade-out
    const t = i / (length - 1);
    const val = type === "in"
      ? 0.5 * (1 - Math.cos(Math.PI * t))
      : 0.5 * (1 - Math.cos(Math.PI * (1 - t)));
    win[i] = val;
  }
  return win;
}

/** Micro-fade lengths (samples @ 48kHz) */
const FADE_IN_SAMPLES = Math.round(0.010 * 48000);  // 10ms
const FADE_OUT_SAMPLES = Math.round(0.015 * 48000); // 15ms
const BOOKEND_FADE_SAMPLES = Math.round(0.200 * 48000); // 200ms

const FADE_IN = raisedCosineFade(FADE_IN_SAMPLES, "in");
const FADE_OUT = raisedCosineFade(FADE_OUT_SAMPLES, "out");
const BOOKEND_FADE_IN = raisedCosineFade(BOOKEND_FADE_SAMPLES, "in");
const BOOKEND_FADE_OUT = raisedCosineFade(BOOKEND_FADE_SAMPLES, "out");

/**
 * Apply micro-fades to a single ayah's PCM samples (in-place).
 * Fade-in at the head, fade-out at the tail.
 */
export function applyAyahDeclick(samples: Float32Array): void {
  const len = samples.length;
  if (len === 0) return;

  // Fade in
  const fadeInLen = Math.min(FADE_IN_SAMPLES, len);
  for (let i = 0; i < fadeInLen; i++) {
    samples[i] *= FADE_IN[i];
  }

  // Fade out
  const fadeOutLen = Math.min(FADE_OUT_SAMPLES, len);
  const fadeOutStart = len - FADE_OUT_SAMPLES;
  for (let i = 0; i < FADE_OUT_SAMPLES; i++) {
    if (fadeOutStart + i >= 0) {
      samples[fadeOutStart + i] *= FADE_OUT[i];
    }
  }
}

/**
 * Apply bookend fades to the full concatenated track.
 * Fade-in at the very start, fade-out at the very end.
 * Lengths: ~200ms each (matches video bookend fades).
 */
export function applyBookendFades(track: Float32Array): void {
  const len = track.length;
  if (len === 0) return;

  const fadeInLen = Math.min(BOOKEND_FADE_IN.length, len);
  for (let i = 0; i < fadeInLen; i++) {
    track[i] *= BOOKEND_FADE_IN[i];
  }

  const fadeOutLen = Math.min(BOOKEND_FADE_OUT.length, track.length);
  const fadeOutStart = track.length - BOOKEND_FADE_OUT.length;
  for (let i = 0; i < BOOKEND_FADE_OUT.length; i++) {
    if (fadeOutStart + i >= 0) {
      track[fadeOutStart + i] *= BOOKEND_FADE_OUT[i];
    }
  }
}