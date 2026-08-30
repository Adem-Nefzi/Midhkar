/**
 * server.ts — Midhkar render service HTTP API.
 *   GET  /api/health            → 200 {ok} (wake-ping + deploy probe)
 *   POST /api/upload            → multipart bg video → {uploadId}
 *   POST /api/render            → RenderJobSpec → {jobId} (429 when full)
 *   GET  /api/render/:id        → SSE progress stream {msg,pct}
 *   GET  /api/render/:id/video  → video/mp4 (once)
 *   POST /api/render/:id/cancel → cancel
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { enqueue, getJob, cancelJob, createUpload, queueSize } from "./queue";
import type { RenderJobSpec } from "./render";

const PORT = Number(process.env.PORT ?? 7860);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_DURATION_MIN = 10;

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ??
  "https://midhkar.vercel.app,http://localhost:3000"
).split(",").map((o) => o.trim());

/* Per-IP token bucket — mirrors the app's lib/rate-limit.ts philosophy */
const buckets = new Map<string, { tokens: number; last: number }>();
const RATE_CAPACITY = 4;
const RATE_REFILL_PER_MIN = 2;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: RATE_CAPACITY, last: now };
    buckets.set(ip, b);
  }
  const refill = ((now - b.last) / 60000) * RATE_REFILL_PER_MIN;
  b.tokens = Math.min(RATE_CAPACITY, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.get("/api/health", (c) => c.json({ ok: true, ...queueSize() }));

app.post("/api/upload", async (c) => {
  const ip = c.req.header("x-forwarded-for") ?? "local";
  if (!rateLimit(ip)) return c.json({ error: "Too many requests" }, 429);
  const body = await c.req.arrayBuffer();
  if (!body || body.byteLength === 0) {
    return c.json({ error: "Empty upload" }, 400);
  }
  if (body.byteLength > MAX_UPLOAD_BYTES) {
    return c.json({ error: "Upload too large (max 100MB)" }, 413);
  }
  const uploadId = createUpload(Buffer.from(body));
  return c.json({ uploadId });
});

app.post("/api/render", async (c) => {
  const ip = c.req.header("x-forwarded-for") ?? "local";
  if (!rateLimit(ip)) return c.json({ error: "Too many requests" }, 429);
  const spec = (await c.req.json()) as RenderJobSpec;

  /* Basic validation — reject malformed specs early */
  if (!spec?.ayahs?.length || !spec.surah?.number || !spec.reciter?.quranApiNo) {
    return c.json({ error: "Invalid job spec" }, 400);
  }
  if (spec.ayahs.length > 400) {
    return c.json({ error: "Too many ayahs" }, 400);
  }
  // Duration cap: conservative estimate 12s/ayah (+spacing) keeps
  // renders under ~10 min of output on the free host.
  if (spec.ayahs.length * 12 > MAX_DURATION_MIN * 60) {
    return c.json(
      { error: "Selection too long for cloud render (max ~10 minutes)" },
      422,
    );
  }
  const { active, waiting } = queueSize();
  if (active + waiting >= 4) {
    return c.json({ error: "Queue full — try again shortly" }, 429);
  }
  const job = enqueue(spec);
  return c.json({ jobId: job.id });
});

app.get("/api/render/:id", async (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found" }, 404);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let sent = 0;
      const closed = () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const timer = setInterval(() => {
        if (job.status === "error") {
          controller.enqueue(
            enc.encode(`event: error\ndata: ${JSON.stringify({ message: job.error })}\n\n`),
          );
          closed();
          return;
        }
        while (sent < job.progress.length) {
          const p = job.progress[sent++];
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify(p)}\n\n`),
          );
        }
        if (job.status === "done") {
          controller.enqueue(enc.encode(`event: done\ndata: {}\n\n`));
          closed();
          return;
        }
        if (job.status === "cancelled") {
          controller.enqueue(enc.encode(`event: cancelled\ndata: {}\n\n`));
          closed();
          return;
        }
        // heartbeat keeps proxies from closing idle SSE
        controller.enqueue(enc.encode(`: hb\n\n`));
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

app.get("/api/render/:id/video", async (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "Job not found" }, 404);
  if (job.status !== "done" || !job.result) {
    return c.json({ error: "Video not ready" }, 409);
  }
  const buf = job.result;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
});

app.post("/api/render/:id/cancel", (c) => {
  const ok = cancelJob(c.req.param("id"));
  return c.json({ ok }, ok ? 200 : 404);
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`midhkar-render on http://0.0.0.0:${info.port}`);
});
