/**
 * ffmpeg.ts — FFmpeg/ffprobe helpers for the render service.
 * Binaries: ffmpeg-static / ffprobe-static locally, system ffmpeg in Docker.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

let ffmpegPath: string;
let ffprobePath: string;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ffmpegPath = (await import("ffmpeg-static")).default as string;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const probe = (await import("ffprobe-static")).default as { path: string };
  ffprobePath = probe.path;
} catch {
  ffmpegPath = "ffmpeg";
  ffprobePath = "ffprobe";
}
// In Docker (linux), prefer system ffmpeg (apt) over static if missing
if (process.platform === "linux" && !existsSync(ffmpegPath)) ffmpegPath = "ffmpeg";
if (process.platform === "linux" && !existsSync(ffprobePath)) ffprobePath = "ffprobe";

export function ffmpegBin(): string {
  return ffmpegPath;
}
export function ffprobeBin(): string {
  return ffprobePath;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(
  bin: string,
  args: string[],
  opts: { onStderr?: (chunk: string) => void; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | null = null;
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`${bin} timed out after ${opts.timeoutMs}ms`));
      }, opts.timeoutMs);
    }
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      opts.onStderr?.(s);
    });
    proc.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** ffprobe duration (seconds) of a media file/URL. */
export async function probeDuration(src: string): Promise<number> {
  const r = await run(ffprobeBin(), [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    src,
  ], { timeoutMs: 30_000 });
  const d = parseFloat(r.stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe failed for ${src}`);
  return d;
}

/** Decode any audio to mono 48kHz f32le PCM. Returns raw samples. */
export async function decodeAudioPcm(
  input: string | Buffer,
  opts: { timeoutMs?: number } = {},
): Promise<Float32Array> {
  const args = [
    "-v", "error",
    "-i", typeof input === "string" ? input : "pipe:0",
    "-ar", "48000",
    "-ac", "1",
    "-f", "f32le",
    "-",
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args, { windowsHide: true });
    const chunks: Buffer[] = [];
    let stderr = "";
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        proc.kill("SIGKILL");
        reject(new Error("audio decode timeout"));
      }
    }, opts.timeoutMs ?? 60_000);
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      const samples = new Float32Array(buf.length / 4);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = buf.readFloatLE(i * 4);
      }
      resolve(samples);
    });
    if (Buffer.isBuffer(input)) proc.stdin.end(input);
    else proc.stdin.end();
  });
}

/** Sample frames from a video, cover-fit to cw×ch at fps, as PNG buffers. */
export async function extractBgFrames(
  input: string | Buffer,
  cw: number,
  ch: number,
  maxFrames: number,
): Promise<Buffer[]> {
  // Scale to cover: scale so both dims >= target, then center-crop.
  const scale = `scale='max(${cw},iw*${ch}/ih)':'max(${ch},ih*${cw}/iw)'`;
  const crop = `crop=${cw}:${ch}`;
  const args = [
    "-v", "error",
    "-i", typeof input === "string" ? input : "pipe:0",
    "-vf", `${scale},${crop}`,
    "-fps_mode", "vfr",
    "-frames:v", String(maxFrames),
    "-f", "image2pipe",
    "-vcodec", "png",
    "-",
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args, { windowsHide: true });
    const frames: Buffer[] = [];
    let buf = Buffer.alloc(0);
    let stderr = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(frames);
    };
    proc.stdout.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      // PNG stream: scan for IEND chunks to split frames
      let idx;
      while ((idx = buf.indexOf(Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]))) !== -1) {
        const frame = buf.subarray(0, idx + 8);
        frames.push(Buffer.from(frame));
        buf = buf.subarray(idx + 8);
      }
    });
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (e) => {
      if (done) return;
      done = true;
      reject(new Error("bg frame extraction failed: " + e.message));
    });
    proc.on("close", () => {
      if (buf.length > 0) {
        // trailing partial frame — ignore
      }
      if (stderr.trim()) {
        // non-fatal warnings ok; hard errors would yield zero frames
      }
      finish();
    });
    if (Buffer.isBuffer(input)) proc.stdin.end(input);
    else proc.stdin.end();
  });
}
