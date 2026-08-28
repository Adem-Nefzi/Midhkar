/**
 * device-profile.ts — device-adaptive output quality.
 *
 * Tiny standalone module so UI components (preview, platform picker,
 * generate step) can read the real output resolution WITHOUT importing
 * the heavy generate-video pipeline.
 */

export interface DeviceProfile {
  isLowPower: boolean;
  bitrateScale: number;
  latencyMode: "quality" | "realtime";
}

export function getDeviceProfile(): DeviceProfile {
  if (typeof navigator === "undefined") {
    return { isLowPower: false, bitrateScale: 1, latencyMode: "realtime" };
  }
  const ua = navigator.userAgent || "";
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory as number | undefined;

  const isLowPower =
    isMobileUA && (cores <= 6 || (mem !== undefined && mem <= 4));

  return {
    isLowPower,
    bitrateScale: isLowPower ? 0.7 : 1,
    latencyMode: "realtime",
  };
}

/* Single source of truth for output resolution. Desktop encodes true
   1080p; low-power mobile stays 720p-class to keep RAM/encode time sane.
   Used by the encoder, the live preview, and the platform picker UI so
   what you see is exactly what gets encoded. */
const ASPECT_HQ: Record<string, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};
const ASPECT_LQ: Record<string, [number, number]> = {
  "16:9": [1280, 720],
  "9:16": [720, 1280],
  "1:1": [1080, 1080],
};

export function getOutputResolution(
  aspect: string,
  isLowPower: boolean,
): [number, number] {
  const table = isLowPower ? ASPECT_LQ : ASPECT_HQ;
  return table[aspect] ?? (isLowPower ? [720, 1280] : [1080, 1920]);
}

export function getVideoBitrate(
  cw: number,
  ch: number,
  profile: DeviceProfile,
): number {
  const pixels = cw * ch;
  let base: number;
  if (pixels >= 1080 * 1920) base = 6_000_000; // desktop true-1080p portrait/landscape
  else if (pixels >= 1080 * 1080) base = 4_500_000; // square
  else if (pixels >= 1280 * 720) base = 3_000_000; // 720p landscape
  else base = 2_500_000; // 720p portrait
  return Math.round(base * profile.bitrateScale);
}
