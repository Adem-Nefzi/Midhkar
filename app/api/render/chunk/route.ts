/**
 * POST /api/render/chunk — renders ONE verse-aligned chunk of a plan
 * and stores it as chunk-N.mp4. Idempotent: an existing chunk returns
 * immediately, so client retries and refresh-resume are safe.
 */
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import type { RenderPlan } from "@/lib/render-plan";
import { renderStore, renderPaths } from "@/lib/server/render-store";
import { renderChunk } from "@/lib/server/render-chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const perIp = new TokenBucketLimiter(30, 10 / 60);

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) return bad("Too many requests", 429);

  let jobId = "";
  let chunkIndex = -1;
  try {
    const body = (await request.json()) as { jobId?: string; chunk?: number };
    jobId = String(body.jobId ?? "");
    chunkIndex = Number(body.chunk ?? -1);
  } catch {
    return bad("Invalid body");
  }
  if (!/^[0-9a-z]{27,}$/.test(jobId) || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return bad("Invalid job");
  }

  const specBytes = await renderStore.get(renderPaths.spec(jobId));
  if (!specBytes) return bad("Job not found (expired?)", 404);
  const plan = JSON.parse(Buffer.from(specBytes).toString("utf-8")) as RenderPlan;
  if (chunkIndex >= plan.chunks.length) return bad("Chunk out of range");

  /* Idempotency — already rendered (retry / resume)? */
  if (await renderStore.exists(renderPaths.chunk(jobId, chunkIndex))) {
    return NextResponse.json({ ok: true, cached: true });
  }

  /* Upload-mode bg bytes come from the store; pexels mode uses URLs. */
  let bgUpload: Uint8Array | null = null;
  if (plan.spec.bg.mode === "upload") {
    bgUpload = await renderStore.get(renderPaths.bgUpload(jobId));
    if (!bgUpload) return bad("Background video missing", 410);
  }

  const buffer = await renderChunk(
    plan.spec,
    plan.chunks[chunkIndex],
    chunkIndex,
    plan.chunks.length,
    () => {},
    AbortSignal.timeout(280_000),
  );

  await renderStore.put(renderPaths.chunk(jobId, chunkIndex), new Uint8Array(buffer));
  return NextResponse.json({ ok: true });
}
