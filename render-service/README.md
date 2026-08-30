# Midhkar Render Service

Server-side Quran video renderer (FFmpeg + @napi-rs/canvas) for Midhkar.
Pixel-compatible with the client's WebCodecs pipeline — same timing math,
same overlays (vendored canva-utils), same encode ladder.

**Deployment: see [DEPLOY.md](./DEPLOY.md).**
Recommended host: Google Cloud Run (free tier ≈ thousands of renders/month,
scale-to-zero). Hugging Face Spaces Docker now requires a paid PRO plan.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | liveness + queue state (wake-ping) |
| `POST /api/upload` | bg video body → `{uploadId}` (≤100MB, 30min TTL) |
| `POST /api/render` | job spec JSON → `{jobId}` (429 queue full, 422 >10min) |
| `GET /api/render/:id` | SSE progress: `data:{msg,pct}`, `event: done` |
| `GET /api/render/:id/video` | the MP4 (available while job lives) |
| `POST /api/render/:id/cancel` | abort |

## Rate limits
Per-IP token bucket: 4 burst, +2/min refill. Max 2 concurrent renders,
queue depth 4, job TTL 30 min, uploads 30 min.

## Local dev

```bash
cd render-service
npm install
npm run dev        # http://localhost:7860
npm run test       # golden overlay parity + full render
```

Client wiring lives in `lib/render-client.ts` + `VideoBuilder.tsx`
(cloud-first, local fallback). Full hosting guides: [DEPLOY.md](./DEPLOY.md).
