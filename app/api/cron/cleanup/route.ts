/**
 * GET /api/cron/cleanup — once-daily sweep of render jobs older than
 * 24h. Vercel Hobby permits exactly one cron per day; the client
 * already deletes each job right after download, so this only
 * catches abandoned ones.
 */
import { NextResponse } from "next/server";
import { jobIdToTimestamp } from "@/lib/render-plan";
import { isStoreConfigured, renderStore } from "@/lib/server/render-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function authorized(request: Request): boolean {
  if (!CRON_SECRET) return true; // dev: no secret set
  const header = request.headers.get("authorization") ?? "";
  const url = new URL(request.url);
  return (
    header === `Bearer ${CRON_SECRET}` ||
    url.searchParams.get("secret") === CRON_SECRET
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStoreConfigured()) {
    /* Disk backend (dev): nuke the whole dev scratch dir — it's ephemeral. */
    await renderStore.delete("renders/");
    return NextResponse.json({ ok: true, removed: -1 });
  }

  const { list } = await import("@vercel/blob");
  const cutoff = Date.now() - MAX_AGE_MS;
  const jobs = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "renders/", cursor });
    for (const b of page.blobs) {
      const m = b.pathname.match(/^renders\/([0-9a-z]{27,})\//);
      if (m && jobIdToTimestamp(m[1]) < cutoff) jobs.add(m[1]);
    }
    cursor = page.cursor;
  } while (cursor);

  for (const jobId of jobs) {
    await renderStore.delete(`renders/${jobId}/`);
  }
  return NextResponse.json({ ok: true, removed: jobs.size });
}
