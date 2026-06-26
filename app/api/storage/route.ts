import { NextResponse } from "next/server";
import { supabase, BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase credentials not configured" },
      { status: 500 },
    );
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).list("videos", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      console.error("Supabase storage list error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const videoExts = /\.(mp4|webm|mov|mkv)$/i;
    const files = (data ?? [])
      .filter((file) => videoExts.test(file.name))
      .map((file) => {
        const filePath = `Videos/${file.name}`;
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
