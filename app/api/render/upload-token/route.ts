/**
 * POST /api/render/upload-token — presigned client-upload signing for
 * browser background-video uploads (Vercel Blob direct, bypassing the
 * 4.5MB function-body cap). Uses the OIDC-compatible presigned flow
 * (`handleUploadPresigned` + `issueSignedToken`) — the legacy
 * `handleUpload` requires a static read-write token, which OIDC-only
 * store connections don't provide.
 */
import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { TokenBucketLimiter, getClientIp } from "@/lib/rate-limit";
import { renderStore, renderPaths } from "@/lib/server/render-store";

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

  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const m = pathname.match(/^renders\/([0-9a-z]{22,})\/bg-input\.[a-z0-9]+$/);
        if (!m) throw new Error("Invalid upload path");
        /* Only sign for jobs whose plan already exists — blocks
           anonymous storage-fill via direct token requests. */
        const spec = await renderStore.get(renderPaths.spec(m[1]));
        if (!spec) throw new Error("Job not found");
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: false,
            allowOverwrite: true,
            validUntil: Date.now() + 10 * 60 * 1000,
          },
        };
      },
      /* No onUploadCompleted: localhost can't receive Blob webhooks and
         the chunk route verifies the bg blob's existence itself. */
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload token failed" },
      { status: 400 },
    );
  }
}
