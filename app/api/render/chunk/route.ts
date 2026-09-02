/**
 * POST /api/render/chunk — renders ONE verse-aligned chunk of a plan
 * and stores it as chunk-N.mp4. Idempotent: an existing chunk returns
 * immediately, so client retries and refresh-resume are safe.
 *
 * Bg relay: when the server can't fetch bg videos (Pexels 403s the
 * datacenter IP), this route returns 422 bg_unavailable. The client
 * then uploads the videos browser→Blob as bg-relay-N and re-POSTs
 * with bgRelayed:true — renderChunk then reads those bytes instead.
 */
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import { JOB_ID_RE, type RenderPlan } from "@/lib/render-plan";
import { renderStore, renderPaths } from "@/lib/server/render-store";
import { renderChunk, BgUnavailableError } from "@/lib/server/render-chunk";

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
  let bgRelayed = false;
  let noBg = false;
  try {
    const body = (await request.json()) as {
      jobId?: string;
      chunk?: number;
      bgRelayed?: boolean;
      noBg?: boolean;
    };
    jobId = String(body.jobId ?? "");
    chunkIndex = Number(body.chunk ?? -1);
    bgRelayed = body.bgRelayed === true;
    noBg = body.noBg === true;
  } catch {
    return bad("Invalid body");
  }
  if (!JOB_ID_RE.test(jobId) || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
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

  /* Bg bytes: relayed uploads first, else upload-mode's bg-input.mp4.
   * noBg (client's relay failed): skip the CDN entirely — gradient. */
  let bgUploads: Uint8Array[] = [];
  if (bgRelayed) {
    for (let i = 0; ; i++) {
      const bytes = await renderStore.get(renderPaths.bgRelay(jobId, i));
      if (!bytes) break;
      bgUploads.push(bytes);
    }
    if (bgUploads.length === 0) return bad("Relayed backgrounds missing", 410);
  } else if (!noBg && plan.spec.bg.mode === "upload") {
    const bg = await renderStore.get(renderPaths.bgUpload(jobId));
    if (!bg) return bad("Background video missing", 410);
    bgUploads = [bg];
  }

  try {
    const buffer = await renderChunk(
      plan.spec,
      plan.chunks[chunkIndex],
      chunkIndex,
      plan.chunks.length,
      () => {},
      AbortSignal.timeout(280_000),
      bgUploads,
      noBg,
    );
    await renderStore.put(renderPaths.chunk(jobId, chunkIndex), new Uint8Array(buffer));
  } catch (err) {
    if (err instanceof BgUnavailableError) {
      /* Server can't reach the CDN — client relays the bytes. */
      return NextResponse.json(
        { error: "bg_unavailable", detail: err.message },
        { status: 422 },
      );
    }
    /* Generic message — never leak ffmpeg stderr / stack to client. */
    console.error(`[render] chunk ${chunkIndex} of ${jobId} failed:`, err);
    return bad("Chunk render failed — please try again", 500);
  }
  return NextResponse.json({ ok: true });
}
