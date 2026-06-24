// app/api/generate-video/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

export const runtime = "nodejs"; // must NOT be "edge" — child_process needs Node
export const maxDuration = 300; // seconds; raise per your hosting plan's limit

interface SegmentMeta {
  dur: number;
  audioExt: "mp3" | "wav";
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
  // The "Preview & Generate" button is gated behind <SignedIn> in the UI,
  // but that's a UI-only gate — anyone can POST here directly otherwise.
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") {
    return new Response("Missing meta", { status: 400 });
  }

  const { segments, width, height } = JSON.parse(metaRaw) as {
    segments: SegmentMeta[];
    width: number;
    height: number;
  };

  const dir = await mkdtemp(join(tmpdir(), "qv-"));

  try {
    for (let i = 0; i < segments.length; i++) {
      const frame = form.get(`frame_${i}`) as Blob | null;
      const audio = form.get(`audio_${i}`) as Blob | null;
      if (!frame || !audio) {
        return new Response(`Missing files for segment ${i}`, { status: 400 });
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

    for (let i = 0; i < segments.length; i++) {
      const { dur, audioExt } = segments[i];
      await runFfmpeg(
        [
          "-y",
          "-loop",
          "1",
          "-t",
          String(dur),
          "-i",
          `frame_${i}.png`,
          "-i",
          `audio_${i}.${audioExt}`,
          "-vf",
          `scale=${width}:${height},format=yuv420p`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast", // real ffmpeg is fast enough to afford this over "ultrafast"
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
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

    const concatTxt = segments.map((_, i) => `file 'seg_${i}.mp4'`).join("\n");
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
        "-c",
        "copy",
        "output.mp4",
      ],
      dir,
    );

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
