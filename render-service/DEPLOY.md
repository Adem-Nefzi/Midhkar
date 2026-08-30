# Deploying the Midhkar Render Service

The render service (`render-service/`) is a Docker container (root
`Dockerfile` — verified: boots, `/api/health` OK, full 4-verse render
e2e). **You must deploy it somewhere** — it cannot run on Vercel
(functions cap at 10-60s, no ffmpeg).

## TL;DR — the recommendation

| Host | Verdict |
|---|---|
| **Render free tier** ✅ *no card* | **Works** — verified empirically: our container completes a full render inside 512MB (after an x264 memory-diet fix) at 0.5 CPU. On Render's real 0.1 CPU a short video takes **4-6 min**. Spins down after 15 min idle (~1 min wake, client auto-falls back). Zero card, zero cost, easiest setup. |
| **Google Cloud Run** ✅ *fastest* | **Best performance-free**: ~3,000 renders/month always-free, scale-to-zero, renders in ~40-60s. Requires a card on the billing account (bill stays $0 at our scale). |
| Hugging Face Spaces | CPU compute is $0/hr but creating Docker Spaces now needs a paid PRO plan ($9/mo). No longer free. |
| Koyeb | Killed their free tier — $29/mo minimum. |
| Oracle Always-Free VM | Truly free 4-core ARM, but you manage Linux/Docker/TLS yourself. Only if you refuse all cards. |

**If you have a card:** Cloud Run (fast renders, bigger free allowance).
**If you refuse all cards:** Render free tier — it genuinely works now.

---

## Option A — Render free tier (no card) — step by step

Verified facts (docs.render.com/free, 2026-08): free web service =
**512MB RAM / 0.1 CPU**, spins down after **15 min idle** (wake ≈ 1 min,
a loading page is shown meanwhile), **750 free instance-hours/month**
(a spun-down service doesn't consume them — effectively unlimited for
personal use), 5GB outbound bandwidth + 500 build minutes/month, no
persistent disk, ephemeral filesystem, custom domains + TLS included.

Our service was **empirically tested under these limits**: with the
`x264-params ref=1:rc-lookahead=8:bframes=0` memory profile, the golden
4-verse render completes in a 512MB container (peak ~200MB Node + ffmpeg)
and produces a valid MP4. At 0.5 CPU it took 148s; at Render's 0.1 CPU
expect **~4-6 minutes per short video**. The client already tolerates
this: progress watchdog is 120s, wake budget 90s, and any true failure
falls back to in-browser rendering automatically.

### Steps

1. **Push this repo to GitHub** (the `main` branch with v5.2+):
   ```bash
   git push origin main
   ```
   (If you deploy before pushing, Render can't see the code.)

2. **Sign up** at https://dashboard.render.com (email or Google — **no
   card required**).

3. Dashboard → **New** → **Web Service** → connect your GitHub account →
   pick the **Midhkar** repository.

4. Configure:
   - **Name**: `midhkar-render`
   - **Language/Type**: *Docker* (Render auto-detects the root `Dockerfile` —
     if it asks, set **Dockerfile Path** to `./Dockerfile` and **Docker Build
     Context** to the repo root `.`)
   - **Compute plan**: **Free** (512MB / 0.1 CPU)
   - **Health Check Path**: `/api/health`
   - **Environment variables** (Advanced → Add):
     - `ALLOWED_ORIGINS` = `https://midhkar.vercel.app,http://localhost:3000`
     - `NODE_ENV` = `production` (already in the Dockerfile)
   - Instance hours: leave default.

5. **Create Web Service** — first build takes ~4-8 min (apt ffmpeg +
   npm install). Watch the logs; success ends with
   `midhkar-render on http://0.0.0.0:7860`.

6. **Test it** (Render shows your URL, e.g.
   `https://midhkar-render.onrender.com`):
   ```bash
   curl https://midhkar-render.onrender.com/api/health
   # {"ok":true,"active":0,"waiting":0}
   ```
   First request after idle takes ~1 min (spin-up) — that's normal.

7. **Point the app at it** — Vercel → Midhkar → Settings → Environment
   Variables → Production **and** Preview:
   ```
   NEXT_PUBLIC_RENDER_API_URL=https://midhkar-render.onrender.com
   ```
   → **Redeploy** the app. Done.

### Updating later
Push to `main` — Render auto-builds and deploys (zero-downtime).

### Render-specific behavior to know
- **Sleep**: after 15 min with no traffic the service sleeps. The next
  user's generate triggers a wake (~1 min) — the client shows
  "Contacting render service…" then streams. If wake exceeds 90s, it
  silently falls back to browser rendering.
- **Bandwidth**: 5GB/month ≈ ~4,000 video downloads (1-2MB each). Fine
  for personal scale; Render emails you at 80%.
- **Queue**: our service enforces max 2 concurrent renders itself —
  at 0.1 CPU more than 1 concurrent render isn't advisable anyway.

---

## Option B — Google Cloud Run (fastest free option; needs card)

**Free-tier math (verified 2026-08, cloud.google.com/run/pricing):**
always-free = 240,000 vCPU-s + 450,000 GiB-s/month. One render ≈
2 vCPU × 40s → **~3,000 renders/month free**. Scale-to-zero, no idle
cost. A card is required for the billing account; set a $1 budget alert
for peace of mind.

### Steps

1. `console.cloud.google.com` → new project `midhkar` (note Project ID).
2. Billing → link a card → create a **$1 budget alert**.
3. Install gcloud CLI → `gcloud auth login` →
   `gcloud config set project YOUR_PROJECT_ID`.
4. From the repo root (Git Bash/WSL on Windows):
   ```bash
   ./scripts/deploy-cloud-run.sh YOUR_PROJECT_ID europe-west1
   ```
   Deploys with the required flags: `--port 7860 --cpu 2 --memory 4Gi
   --timeout 3600 --cpu-boost --concurrency 1 --max-instances 2`.
   (`--timeout 3600` matters — default 60s would kill SSE mid-render.)
5. `curl https://midhkar-render-…run.app/api/health` → `{"ok":true}`.
6. Set `NEXT_PUBLIC_RENDER_API_URL` on Vercel → redeploy.

---

## Any other Docker host (Koyeb/Railway/Fly/VPS)

The container is generic (listens on `$PORT`, default 7860):
```bash
docker build -t midhkar-render .
docker run -p 7860:7860 -e ALLOWED_ORIGINS="https://midhkar.vercel.app" midhkar-render
```
Host requirements: ≥2 vCPU + ≥4GB RAM for full-speed rendering
(the image itself now runs in 512MB if needed — the x264 profile
trades speed for memory), request timeout ≥ 10 min, ffmpeg included
(the Dockerfile installs it).

## Local dev & container test

```bash
cd render-service && npm install && npm run dev   # :7860
# against the built image:
docker build -t midhkar-render . && docker run -d -p 7861:7860 --name mrt midhkar-render
RENDER_API_BASE=http://127.0.0.1:7861 npx tsx test/api.test.ts   # full e2e
docker rm -f mrt
```

## Cost guardrails
- Render: no card on file = zero possible spend (hard cap by design).
- Cloud Run: `--min-instances 0` (scale-to-zero), `--max-instances 2`,
  $1 budget alert.
