/**
 * GET /api/render/status?jobId=… — which chunks already exist. Powers
 * refresh-resume: the client re-opens where it left off.
 */
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import { JOB_ID_RE, type RenderPlan } from "@/lib/render-plan";
import { renderStore, renderPaths } from "@/lib/server/render-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const perIp = new TokenBucketLimiter(30, 10 / 60);

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!perIp.consume(ip).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId || !JOB_ID_RE.test(jobId)) {
    return NextResponse.json({ error: "Invalid job" }, { status: 400 });
  }

  const specBytes = await renderStore.get(renderPaths.spec(jobId));
  if (!specBytes) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const plan = JSON.parse(Buffer.from(specBytes).toString("utf-8")) as RenderPlan;

  const done: boolean[] = [];
  for (let i = 0; i < plan.chunks.length; i++) {
    done.push(await renderStore.exists(renderPaths.chunk(jobId, i)));
  }
  return NextResponse.json({
    jobId,
    chunks: plan.chunks.length,
    done,
    finalized: await renderStore.exists(renderPaths.final(jobId)),
  });
}
