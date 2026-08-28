import { NextResponse } from "next/server";
import {
  TokenBucketLimiter,
  GlobalWindowLimiter,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ── Abuse protection (per serverless instance) ─────────────────
   Per IP: burst of 8, refilling at 8/min. Across ALL IPs: 150/h —
   keeps the shared Pexels key (200 req/h) alive even under a
   many-IP trickle. Results are also cached 5 min below, so repeat
   searches don't spend quota at all. */
const perIp = new TokenBucketLimiter(8, 8 / 60);
const globalUpstream = new GlobalWindowLimiter(150, 60 * 60 * 1000);

const RESULT_TTL_MS = 5 * 60 * 1000;
const resultCache = new Map<string, { at: number; body: unknown }>();

const MAX_QUERY_LEN = 60;
const PER_PAGE = 30;
const UPSTREAM_TIMEOUT_MS = 10_000;

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests — please slow down." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSec)) },
    },
  );
}

export async function GET(request: Request) {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
  if (!PEXELS_API_KEY) {
    return NextResponse.json(
      { error: "Library search is not configured." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const bucket = perIp.consume(ip);
  if (!bucket.allowed) return rateLimited(bucket.retryAfterSec);

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") ?? "nature").trim().slice(0, MAX_QUERY_LEN) || "nature";
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isInteger(pageRaw) ? Math.min(Math.max(pageRaw, 1), 50) : 1;

  const cacheKey = `${query}|${page}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) {
    return NextResponse.json(cached.body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  }

  if (!globalUpstream.consume()) return rateLimited(60);

  try {
    const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${PER_PAGE}&orientation=portrait`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[pexels] upstream ${res.status} for query="${query}"`);
      return NextResponse.json(
        { error: "Video search is temporarily unavailable." },
        { status: res.status === 429 ? 429 : 502 },
      );
    }

    const data = await res.json();

    // Filter: 1080p+ HD only, 15+ seconds duration
    const filtered = (data.videos || []).filter(
      (v: any) =>
        v.duration >= 15 &&
        v.video_files?.some(
          (f: any) => f.width >= 1080 && f.height >= 1080,
        ),
    );

    // For each video, pick the best 1080p+ file
    const results = filtered.map((v: any) => {
      const hd = v.video_files
        ?.filter((f: any) => f.width >= 1080 && f.height >= 1080)
        .sort((a: any, b: any) => b.width * b.height - a.width * a.height);
      return {
        id: v.id,
        duration: v.duration,
        width: v.width,
        height: v.height,
        image: v.image,
        url: v.url,
        photographer: v.user?.name || "Unknown",
        photographerUrl: v.user?.url || "",
        videoUrl: hd?.[0]?.link || v.video_files?.[0]?.link || "",
      };
    });

    const body = {
      videos: results,
      totalResults: data.total_results || 0,
      page: data.page || 1,
      perPage: data.per_page || PER_PAGE,
      nextPage: data.next_page || null,
    };

    if (resultCache.size > 200) resultCache.clear();
    resultCache.set(cacheKey, { at: Date.now(), body });

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    const aborted =
      error instanceof DOMException && error.name === "TimeoutError";
    console.warn(
      `[pexels] search failed (${aborted ? "timeout" : "error"}) query="${query}"`,
    );
    return NextResponse.json(
      { error: "Video search is temporarily unavailable." },
      { status: aborted ? 504 : 502 },
    );
  }
}
