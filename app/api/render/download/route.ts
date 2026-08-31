/**
 * GET /api/render/download?jobId=… — streams final.mp4 to the browser.
 * DELETE with the same param removes the whole job from the store.
 */
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import { renderStore, renderPaths } from "@/lib/server/render-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const perIp = new TokenBucketLimiter(10, 5 / 60);

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function validJob(jobId: string | null): boolean {
  return !!jobId && /^[0-9a-z]{27,}$/.test(jobId);
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) return bad("Too many requests", 429);

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!validJob(jobId)) return bad("Invalid job");

  const bytes = await renderStore.get(renderPaths.final(jobId!));
  if (!bytes) return bad("Video not ready", 404);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) return bad("Too many requests", 429);

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!validJob(jobId)) return bad("Invalid job");

  await renderStore.delete(`renders/${jobId}/`);
  return NextResponse.json({ ok: true });
}
