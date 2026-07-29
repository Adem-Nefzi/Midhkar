import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

  if (!PEXELS_API_KEY) {
    return NextResponse.json(
      { error: "Pexels API key not configured. Set PEXELS_API_KEY in .env.local" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "nature";
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("per_page") || "30";

  try {
    const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=portrait`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Pexels API error: ${res.status}` },
        { status: res.status },
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

    return NextResponse.json({
      videos: results,
      totalResults: data.total_results || 0,
      page: data.page || 1,
      perPage: data.per_page || 30,
      nextPage: data.next_page || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[pexels] search error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
