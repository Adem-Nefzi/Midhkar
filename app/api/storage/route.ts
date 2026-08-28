import { NextResponse } from "next/server";
import { getSupabase, BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

/* ── Supabase Library (disabled — restore by flipping this flag and
   uncommenting the UI blocks in VideoBuilder.tsx / StepSettings.tsx) ── */
const STORAGE_LIBRARY_ENABLED = false;

export async function GET() {
  if (!STORAGE_LIBRARY_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Video library is not configured." },
      { status: 503 },
    );
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).list("videos", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      console.error("Supabase storage list error:", error.message);
      return NextResponse.json(
        { error: "Could not list the video library." },
        { status: 502 },
      );
    }

    const videoExts = /\.(mp4|webm|mov|mkv)$/i;
    const files = (data ?? [])
      .filter((file) => videoExts.test(file.name))
      .map((file) => {
        const filePath = `videos/${file.name}`;
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(filePath);
        return {
          id: file.id,
          name: file.name,
          url: urlData.publicUrl,
          size: file.metadata?.size ?? 0,
          createdAt: file.created_at ?? "",
        };
      });

    return NextResponse.json({ files });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Storage route error:", msg);
    return NextResponse.json(
      { error: "Could not list the video library." },
      { status: 502 },
    );
  }
}
