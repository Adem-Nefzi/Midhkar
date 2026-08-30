# Midhkar Render Service

Server-side Quran video renderer (FFmpeg + @napi-rs/canvas) for Midhkar.
Pixel-compatible with the client's WebCodecs pipeline — same timing math,
same overlays (vendored canva-utils), same encode ladder.

## Deploy to Hugging Face Spaces (free, no card)

1. Push this repo (or the `render-service/` + `Dockerfile` subset) to a
   GitHub repo your HF account can access.
2. On https://huggingface.co/new-space create a Space:
   - **SDK: Docker** · **Plan: CPU basic (free)** · name e.g. `midhkar-render`
3. In the Space's **Settings → Files** (or the Space's GitHub repo at
   `https://huggingface.co/spaces/<you>/midhkar-render`), ensure the repo
   root contains `Dockerfile` and `render-service/` as in this project.
   If deploying the full Midhkar repo, the Dockerfile already builds from
   the `render-service/` subfolder.
4. Wait for the build (~2-4 min). The Space will be at
   `https://<you>-midhkar-render.hf.space`.
5. Set the app env var (Vercel → Midhkar → Settings → Environment
   Variables):

   ```
   NEXT_PUBLIC_RENDER_API_URL=https://<you>-midhkar-render.hf.space
   ```

6. Redeploy the app. Generation now renders server-side first; if the
   Space is asleep (48h idle) or fails, the browser pipeline takes over
   automatically.

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
(cloud-first, local fallback).
