import ImageKit from "@imagekit/nodejs";
import { NextRequest, NextResponse } from "next/server";

const imagekit = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
});

export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") || "";
  const fileType = req.nextUrl.searchParams.get("fileType") || "non-image";

  try {
    const files = await imagekit.assets.list({
      path: folder || undefined,
      fileType: fileType as "all" | "image" | "non-image" | undefined || "non-image",
      type: "file",
      limit: 50,
      skip: 0,
      sort: "DESC_CREATED",
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("ImageKit API error:", error);
    return NextResponse.json({ error: "Failed to fetch files from ImageKit" }, { status: 500 });
  }
}
