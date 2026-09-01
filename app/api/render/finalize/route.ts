/**
 * POST /api/render/finalize — verifies all chunks exist, concatenates
 * them losslessly (-c copy) and applies +faststart, storing final.mp4.
 * Idempotent.
 */
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { JOB_ID_RE, type RenderPlan } from "@/lib/render-plan";
import { renderStore, renderPaths } from "@/lib/server/render-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const perIp = new TokenBucketLimiter(8, 4 / 60);

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) return bad("Too many requests", 429);

  let jobId = "";
  try {
    const body = (await request.json()) as { jobId?: string };
    jobId = String(body.jobId ?? "");
  } catch {
    return bad("Invalid body");
  }
  if (!JOB_ID_RE.test(jobId)) return bad("Invalid job");

  if (await renderStore.exists(renderPaths.final(jobId))) {
    return NextResponse.json({ ok: true, cached: true });
  }

  const specBytes = await renderStore.get(renderPaths.spec(jobId));
  if (!specBytes) return bad("Job not found (expired?)", 404);
  const plan = JSON.parse(Buffer.from(specBytes).toString("utf-8")) as RenderPlan;

  /* All chunks must be present */
  for (let i = 0; i < plan.chunks.length; i++) {
    if (!(await renderStore.exists(renderPaths.chunk(jobId, i)))) {
      return bad(`Missing chunk ${i}`, 409);
    }
  }

  /* Concat locally, then faststart */
  const listPath = join(tmpdir(), `midhkar-concat-${jobId}.txt`);
  const outPath = listPath.replace(/\.txt$/, ".mp4");
  try {
    const lines: string[] = [];
    for (let i = 0; i < plan.chunks.length; i++) {
      const part = join(tmpdir(), `midhkar-part-${jobId}-${i}.mp4`);
      const bytes = await renderStore.get(renderPaths.chunk(jobId, i));
      if (!bytes) return bad(`Missing chunk ${i}`, 409);
      await writeFile(part, bytes);
      lines.push(`file '${part.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`);
    }
    await writeFile(listPath, lines.join("\n"), "utf-8");

    const bin = (ffmpegStatic as unknown as string) || "ffmpeg";
    await new Promise<number>((resolve, reject) => {
      const proc = spawn(
        bin,
        ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outPath],
        { windowsHide: true },
      );
      let stderr = "";
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("error", reject);
      proc.on("close", (c) => {
        if ((c ?? -1) !== 0) reject(new Error(`concat failed: ${stderr.slice(-300)}`));
        else resolve(0);
      });
    });

    const final = await readFile(outPath);
    await renderStore.put(renderPaths.final(jobId), new Uint8Array(final));
    return NextResponse.json({ ok: true, sizeBytes: final.length });
  } catch (err) {
    console.error(`[render] finalize ${jobId} failed:`, err);
    return bad("Finalize failed — please try again", 500);
  } finally {
    for (const p of [listPath, outPath]) {
      await unlink(p).catch(() => {});
    }
    for (let i = 0; i < plan.chunks.length; i++) {
      await unlink(join(tmpdir(), `midhkar-part-${jobId}-${i}.mp4`)).catch(() => {});
    }
  }
}
