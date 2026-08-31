/**
 * POST /api/render/upload-token — token-signing route for browser
 * background-video uploads (Vercel Blob client uploads bypass the
 * 4.5MB function body limit). Doc'd pattern:
 * https://vercel.com/docs/vercel-blob/client-upload
 */
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const perIp = new TokenBucketLimiter(6, 3 / 60);
const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const gate = perIp.consume(ip);
  if (!gate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^renders\/[0-9a-z]{27,}\/bg-input\.[a-z0-9]+$/.test(pathname)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
        };
      },
      /* No onUploadCompleted: local dev can't receive Blob webhooks,
         and the chunk route verifies existence itself. */
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload token failed" },
      { status: 400 },
    );
  }
}
