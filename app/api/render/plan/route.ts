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
  JOB_ID_RE,
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
const MAX_SPEC_BYTES = 512 * 1024;
const MAX_BG_URLS = 6;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** SSRF guard: only allowlisted public CDNs for bg video URLs. */
function safeBgUrl(raw: unknown): boolean {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.hostname === "videos.pexels.com" || url.hostname.endsWith(".pexels.com")) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) {
    return bad("Too many render requests — slow down.", 429);
  }

  /* Dev fallback: multipart with an existing jobId stores the bg
   * file for that job (client uploads go browser→Blob in prod).
   * Prod (VERCEL env or NODE_ENV=production) must never accept it. */
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const isDev = process.env.NODE_ENV !== "production" && !process.env.VERCEL;
    if (!isDev) return bad("Not found", 404);
    const form = await request.formData();
    const jobId = String(form.get("jobId") ?? "");
    const bg = form.get("bg");
    if (!JOB_ID_RE.test(jobId) || !(bg instanceof File)) {
      return bad("Invalid upload");
    }
    if (bg.size > MAX_BG_BYTES) return bad("Background video too large (max 100MB)", 413);
    const specBytes = await renderStore.get(renderPaths.spec(jobId));
    if (!specBytes) return bad("Job not found", 404);
    await renderStore.put(renderPaths.bgUpload(jobId), new Uint8Array(await bg.arrayBuffer()));
    return NextResponse.json({ ok: true });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SPEC_BYTES) return bad("Spec too large", 413);

  let spec: RenderPlanSpec;
  try {
    spec = (await request.json()) as RenderPlanSpec;
  } catch {
    return bad("Invalid request body");
  }

  /* Validation */
  if (!spec?.ayahs?.length) return bad("No ayahs selected");
  if (spec.ayahs.length > MAX_AYAHS) return bad("Too many ayahs");
  if (!spec.surah?.number || !/^\d{1,3}$/.test(spec.surah.number)) {
    return bad("Invalid spec");
  }
  if (
    !Number.isInteger(spec.reciter?.quranApiNo) ||
    spec.reciter.quranApiNo < 1 ||
    spec.reciter.quranApiNo > 300
  ) {
    return bad("Invalid reciter");
  }
  if (
    typeof spec.reciter.everyayahFolder !== "string" ||
    !/^[A-Za-z0-9_\-/.]{0,120}$/.test(spec.reciter.everyayahFolder)
  ) {
    return bad("Invalid reciter");
  }
  if (spec.bg.mode === "pexels") {
    const urls = spec.bg.urls ?? [];
    if (urls.length > MAX_BG_URLS) return bad("Too many background videos");
    for (const u of urls) {
      if (!safeBgUrl(u)) return bad("Invalid background URL");
    }
  }
  /* bg.mode === "upload" is fine: the FILE arrives via /upload-token
   * (prod client-upload) or the dev multipart branch above — never
   * inline in the spec body. */
  const verseSpacing = Number((spec.settings as Record<string, unknown>)?.verseSpacing ?? 0);
  if (!(verseSpacing >= 0 && verseSpacing <= 3)) return bad("Invalid verse spacing");
  for (const a of spec.ayahs) {
    if (!a.key || !a.text || !(a.durationSec > 0 && a.durationSec < 120)) {
      return bad("Invalid ayah durations");
    }
    if (a.key.length > 12) return bad("Invalid ayah key");
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

  /* Normalize the numeric/color fields the renderer divides or parses —
   * a missing value must never become NaN inside canvas. */
  const st = spec.settings as Record<string, unknown>;
  const num = (v: unknown, def: number, min: number, max: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  st.bgOverlay = num(st.bgOverlay, 35, 0, 100);
  st.textOpacity = num(st.textOpacity, 100, 0, 100);
  st.translationOpacity = num(st.translationOpacity, 80, 0, 100);
  st.verseSpacing = num(st.verseSpacing, 0, 0, 3);
  st.bgGradientAngle = num(st.bgGradientAngle, 135, 0, 360);
  if (typeof st.textColor !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(st.textColor)) {
    st.textColor = "#d4af37";
  }
  if (typeof st.bgColor !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(st.bgColor)) {
    st.bgColor = "#09090f";
  }
  if (typeof st.bgColorSecondary !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(st.bgColorSecondary)) {
    st.bgColorSecondary = "#1a0e00";
  }

  const jobId = newJobId();
  const plan: RenderPlan = {
    jobId,
    spec,
    chunks: planChunks(spec.ayahs, verseSpacing),
    totalDurationSec: totalDur,
    createdAt: Date.now(),
  };

  try {
    await renderStore.put(
      renderPaths.spec(jobId),
      new Uint8Array(Buffer.from(JSON.stringify(plan), "utf-8")),
    );
  } catch {
    return bad("Could not create job — try again shortly", 503);
  }

  return NextResponse.json({
    jobId,
    chunks: plan.chunks.length,
    totalDurationSec: plan.totalDurationSec,
  });
}
