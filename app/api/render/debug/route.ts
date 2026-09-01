/* TEMPORARY debug route — remove after diagnosing OIDC in functions. */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { head } = await import("@vercel/blob");
  const header = request.headers.get("x-vercel-oidc-token");

  let ctxInfo = "n/a";
  try {
    const { getContext } = await import("@vercel/oidc");
    const ctx = getContext() as
      | { headers?: Record<string, string> }
      | undefined;
    ctxInfo = JSON.stringify({
      hasCtx: !!ctx,
      ctxKeys: ctx ? Object.keys(ctx) : [],
      ctxHeaderCount: ctx?.headers ? Object.keys(ctx.headers).length : 0,
      hasOidcInCtx: !!ctx?.headers?.["x-vercel-oidc-token"],
    });
  } catch (e) {
    ctxInfo = "import failed: " + (e as Error).message;
  }

  let headNoOpts = "n/a";
  try {
    await head("renders/probe-x");
    headNoOpts = "exists";
  } catch (e) {
    const err = e as Error;
    headNoOpts = err?.constructor?.name + ": " + (err?.message ?? "").slice(0, 140);
  }

  let headExplicit = "n/a";
  if (header) {
    try {
      await head("renders/probe-x", {
        oidcToken: header,
        storeId: process.env.BLOB_STORE_ID,
      });
      headExplicit = "exists";
    } catch (e) {
      const err = e as Error;
      headExplicit = err?.constructor?.name + ": " + (err?.message ?? "").slice(0, 140);
    }
  }

  return NextResponse.json({
    envOidc: !!process.env.VERCEL_OIDC_TOKEN,
    headerOidc: !!header,
    storeId: !!process.env.BLOB_STORE_ID,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    ctxInfo,
    headNoOpts,
    headExplicit,
  });
}
