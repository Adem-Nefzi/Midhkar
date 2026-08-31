/**
 * GET /api/render/status?jobId=… — which chunks already exist. Powers
 * refresh-resume: the client re-opens where it left off.
 */
import { NextResponse } from "next/server";
import { renderStore, renderPaths } from "@/lib/server/render-store";
import type { RenderPlan } from "@/lib/render-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId || !/^[0-9a-z]{27,}$/.test(jobId)) {
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
