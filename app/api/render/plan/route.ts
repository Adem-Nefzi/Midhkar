/**
 * POST /api/render/plan — accepts the render spec (optionally with an
 * uploaded background video), validates it, plans verse-aligned
 * chunks, and persists the job. Blob paths are the state.
 */
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import {
  planChunks,
  newJobId,
  MAX_TOTAL_SEC,
  type RenderPlan,
  type RenderPlanSpec,
} from "@/lib/render-plan";
import { renderStore, renderPaths } from "@/lib/server/render-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const perIp = new TokenBucketLimiter(4, 2 / 60);
const MAX_BG_BYTES = 100 * 1024 * 1024;
const MAX_AYAHS = 400;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) {
    return bad("Too many render requests — slow down.", 429);
  }

  /* Dev fallback: multipart with an existing jobId stores the bg
     file for that job (client uploads go browser→Blob in prod). */
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const jobId = String(form.get("jobId") ?? "");
    const bg = form.get("bg");
    if (!/^[0-9a-z]{27,}$/.test(jobId) || !(bg instanceof File)) {
      return bad("Invalid upload");
    }
    if (bg.size > MAX_BG_BYTES) return bad("Background video too large (max 100MB)", 413);
    const specBytes = await renderStore.get(renderPaths.spec(jobId));
    if (!specBytes) return bad("Job not found", 404);
    await renderStore.put(renderPaths.bgUpload(jobId), new Uint8Array(await bg.arrayBuffer()));
    return NextResponse.json({ ok: true });
  }

  let spec: RenderPlanSpec;
  try {
    spec = (await request.json()) as RenderPlanSpec;
  } catch {
    return bad("Invalid request body");
  }

  /* Validation */
  if (!spec?.ayahs?.length) return bad("No ayahs selected");
  if (spec.ayahs.length > MAX_AYAHS) return bad("Too many ayahs");
  if (!spec.surah?.number || !spec.reciter?.quranApiNo) return bad("Invalid spec");
  if (spec.bg.mode === "pexels" && (spec.bg.urls?.length ?? 0) > 6) {
    return bad("Too many background videos");
  }
  const verseSpacing = Number((spec.settings as Record<string, unknown>)?.verseSpacing ?? 0);
  if (!(verseSpacing >= 0 && verseSpacing <= 3)) return bad("Invalid verse spacing");
  for (const a of spec.ayahs) {
    if (!a.key || !a.text || !(a.durationSec > 0 && a.durationSec < 120)) {
      return bad("Invalid ayah durations");
    }
  }
  const totalDur = spec.ayahs.reduce(
    (s, a) => s + a.durationSec + verseSpacing,
    0,
  );
  if (totalDur > MAX_TOTAL_SEC) {
    return bad("Selection too long for cloud render (max ~10 minutes)", 422);
  }
  if (!["16:9", "9:16", "1:1"].includes(spec.platform?.aspect ?? "")) {
    return bad("Invalid platform");
  }

  const jobId = newJobId();
  const plan: RenderPlan = {
    jobId,
    spec,
    chunks: planChunks(spec.ayahs, verseSpacing),
    totalDurationSec: totalDur,
    createdAt: Date.now(),
  };

  await renderStore.put(
    renderPaths.spec(jobId),
    new Uint8Array(Buffer.from(JSON.stringify(plan), "utf-8")),
  );

  return NextResponse.json({
    jobId,
    chunks: plan.chunks.length,
    totalDurationSec: plan.totalDurationSec,
  });
}
