// app/api/generate-video/route.ts
import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

export const runtime = "nodejs";
export const maxDuration = 300;

interface SegmentMeta {
  dur: number;
  audioExt: "mp3" | "wav";
  transparentOverlay: boolean;
  leadIn?: number;
}

function runFfmpeg(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args, { cwd });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export async function POST(req: NextRequest) {
  // TODO: Add rate limiting — this endpoint is expensive (spawns ffmpeg, large file I/O).
  // Consider using a library like `next-rate-limit` or middleware-based IP throttling.

  const form = await req.formData();
  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") {
    return new Response("Missing meta", { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(metaRaw);
  } catch {
    return new Response("Invalid JSON in meta", { status: 400 });
  }

  const { segments, width, height } = parsed as {
    segments: SegmentMeta[];
    width: number;
    height: number;
  };

  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 30) {
    return new Response("Invalid segments array (must be 1-30)", { status: 400 });
  }
  if (typeof width !== "number" || typeof height !== "number" ||
      width < 1 || height < 1 || width > 7680 || height > 7680) {
    return new Response("Invalid width/height", { status: 400 });
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (typeof seg.dur !== "number" || seg.dur <= 0 || seg.dur > 600) {
      return new Response(`Invalid duration for segment ${i}`, { status: 400 });
    }
    if (seg.audioExt !== "mp3" && seg.audioExt !== "wav") {
      return new Response(`Invalid audioExt for segment ${i}`, { status: 400 });
    }
    if (typeof seg.transparentOverlay !== "boolean") {
      return new Response(`Invalid transparentOverlay for segment ${i}`, { status: 400 });
    }
  }

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

  const dir = await mkdtemp(join(tmpdir(), "qv-"));

  try {
    // ── Save uploaded files ────────────────────────────────────
    const bgVideo = form.get("background_video") as Blob | null;
    const hasBgVideo = !!bgVideo;
    if (bgVideo) {
      if (bgVideo.size > MAX_FILE_SIZE) {
        return new Response("Background video exceeds size limit", { status: 413 });
      }
      await writeFile(
        join(dir, "background_video.bin"),
        Buffer.from(await bgVideo.arrayBuffer()),
      );
    }

    for (let i = 0; i < segments.length; i++) {
      const frame = form.get(`frame_${i}`) as Blob | null;
      const audio = form.get(`audio_${i}`) as Blob | null;
      if (!frame || !audio) {
        return new Response(`Missing files for segment ${i}`, { status: 400 });
      }
      if (frame.size > MAX_FILE_SIZE || audio.size > MAX_FILE_SIZE) {
        return new Response(`File too large for segment ${i}`, { status: 413 });
      }
      await writeFile(
        join(dir, `frame_${i}.png`),
        Buffer.from(await frame.arrayBuffer()),
      );
      await writeFile(
        join(dir, `audio_${i}.${segments[i].audioExt}`),
        Buffer.from(await audio.arrayBuffer()),
      );
    }

    const useContinuousBg =
      hasBgVideo && segments.some((s) => s.transparentOverlay);

    if (useContinuousBg) {
      // ── CONTINUOUS BACKGROUND VIDEO MODE ──────────────────────

      // Prepend silence for lead-in to each audio segment, then concat
      for (let i = 0; i < segments.length; i++) {
        const leadIn = segments[i].leadIn ?? 0;
        if (leadIn > 0) {
          // Generate silence WAV and concat with original audio
          await runFfmpeg(
            [
              "-y",
              "-f",
              "lavfi",
              "-t",
              String(leadIn),
              "-i",
              `anullsrc=r=44100:cl=stereo`,
              "-i",
              `audio_${i}.${segments[i].audioExt}`,
              "-filter_complex",
              "[0:a][1:a]concat=n=2:v=0:a=1[out]",
              "-map",
              "[out]",
              "-c:a",
              "aac",
              "-b:a",
              "128k",
              "-ar",
              "44100",
              "-ac",
              "2",
              `padded_audio_${i}.m4a`,
            ],
            dir,
          );
        }
      }

      const audioConcat = segments
        .map((_, i) => {
          const leadIn = segments[i].leadIn ?? 0;
          return leadIn > 0
            ? `file 'padded_audio_${i}.m4a'`
            : `file 'audio_${i}.${segments[i].audioExt}'`;
        })
        .join("\n");
      await writeFile(join(dir, "audio_concat.txt"), audioConcat);

      // Concatenate all audio into one file
      await runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "audio_concat.txt",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "full_audio.m4a",
        ],
        dir,
      );

      // Calculate cumulative timestamps for each segment
      const timestamps: { start: number; end: number }[] = [];
      let cumTime = 0;
      for (const seg of segments) {
        timestamps.push({ start: cumTime, end: cumTime + seg.dur });
        cumTime += seg.dur;
      }
      const totalDur = cumTime;

      // Build the ffmpeg filter_complex for continuous background
      // with text overlays switching at segment boundaries.
      //
      // Strategy: overlay all frames simultaneously but use
      // `enable='between(t,start,end)'` to show only the active one.
      const filterParts: string[] = [];

      // Scale and crop bg video to target dimensions
      filterParts.push(
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
          `crop=${width}:${height},setsar=1,` +
          `trim=duration=${totalDur},setpts=PTS-STARTPTS[bg]`,
      );

      // For each segment, overlay its frame with enable timing
      let prevLabel = "bg";
      for (let i = 0; i < segments.length; i++) {
        const { start, end } = timestamps[i];
        const outLabel = i === segments.length - 1 ? "v" : `v${i}`;
        filterParts.push(
          `[${prevLabel}][${i + 1}:v]overlay=0:0:format=auto:` +
            `enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'` +
            `[${outLabel}]`,
        );
        prevLabel = outLabel;
      }

      const filterComplex = filterParts.join(";");

      // Build ffmpeg input list:
      //  [0] = background video
      //  [1..N] = text overlay frames
      //  [N+1] = concatenated audio
      const inputs = [
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        "background_video.bin",
      ];
      for (let i = 0; i < segments.length; i++) {
        inputs.push("-loop", "1", "-t", String(segments[i].dur), "-i", `frame_${i}.png`);
      }
      inputs.push("-i", "full_audio.m4a");

      const audioMapIdx = segments.length + 1;

      await runFfmpeg(
        [
          ...inputs,
          "-filter_complex",
          filterComplex,
          "-map",
          "[v]",
          "-map",
          `${audioMapIdx}:a`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-r",
          "24",
          "-t",
          String(totalDur),
          "-movflags",
          "+faststart",
          "-fflags",
          "+genpts",
          "output.mp4",
        ],
        dir,
      );
    } else {
      // ── STATIC BACKGROUND MODE (original per-segment approach) ─
      for (let i = 0; i < segments.length; i++) {
        const { dur, audioExt, leadIn } = segments[i];
        const audioDelay = leadIn ?? 0;
        await runFfmpeg(
          [
            "-y",
            "-loop",
            "1",
            "-t",
            String(dur),
            "-i",
            `frame_${i}.png`,
            ...(audioDelay > 0
              ? ["-itsoffset", String(audioDelay)]
              : []),
            "-i",
            `audio_${i}.${audioExt}`,
            "-vf",
            `scale=${width}:${height},format=yuv420p`,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-r",
            "24",
            "-shortest",
            "-movflags",
            "+faststart",
            `seg_${i}.mp4`,
          ],
          dir,
        );
      }

      const concatTxt = segments
        .map((_, i) => `file 'seg_${i}.mp4'`)
        .join("\n");
      await writeFile(join(dir, "concat.txt"), concatTxt);
      await runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "concat.txt",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-movflags",
          "+faststart",
          "-fflags",
          "+genpts",
          "output.mp4",
        ],
        dir,
      );
    }

    const output = await readFile(join(dir, "output.mp4"));
    return new Response(output, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(output.length),
      },
    });
  } catch (err) {
    return new Response(
      `Video generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 },
    );
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
