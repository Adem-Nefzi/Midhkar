/**
 * ffmpeg-client.ts
 *
 * Singleton wrapper around @ffmpeg/ffmpeg (WASM).
 * Loads the ffmpeg core from CDN on first use, then reuses the instance.
 * No server roundtrip — everything runs in the browser.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";

const CORE_VERSION = "0.12.6";
const CDN_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[ffmpeg]", message);
      }
    });

    // Use direct CDN URLs — avoids blob URL module resolution issues.
    // unpkg sends proper CORS headers so this works cross-origin.
    await ffmpeg.load({
      coreURL: `${CDN_BASE}/ffmpeg-core.js`,
      wasmURL: `${CDN_BASE}/ffmpeg-core.wasm`,
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

/**
 * Write a Uint8Array into ffmpeg's virtual filesystem.
 */
export async function writeFFmpegFile(
  ffmpeg: FFmpeg,
  path: string,
  data: Uint8Array,
): Promise<void> {
  await ffmpeg.writeFile(path, data);
}

/**
 * Read a file from ffmpeg's virtual filesystem as Uint8Array.
 */
export async function readFFmpegFile(
  ffmpeg: FFmpeg,
  path: string,
): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(path);
  if (typeof data === "string") return new TextEncoder().encode(data);
  return new Uint8Array(data);
}

/**
 * Run an ffmpeg command and return the exit code.
 * Throws on non-zero exit.
 */
export async function runFFmpeg(
  ffmpeg: FFmpeg,
  args: string[],
): Promise<void> {
  const exitCode = await ffmpeg.exec(args);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}`);
  }
}

/**
 * Clean up files from ffmpeg's virtual filesystem.
 */
export async function cleanupFFmpegFiles(
  ffmpeg: FFmpeg,
  paths: string[],
): Promise<void> {
  for (const p of paths) {
    try {
      await ffmpeg.deleteFile(p);
    } catch {
      /* ignore — file may not exist */
    }
  }
}
