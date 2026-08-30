# Deploying the Midhkar Render Service

The render service (`render-service/`) is a Docker container. You build
it once (root `Dockerfile`, verified working: health + full 4-verse
render e2e in 22.8s) and deploy it anywhere that runs containers.

**You must deploy it somewhere** — it cannot run on Vercel (Vercel
functions cap at ~10s-60s and have no ffmpeg).

## TL;DR — the recommendation

| Host | Verdict |
|---|---|
| **Google Cloud Run** ✅ | **Best option.** ~2,000 renders/month completely free (always-free tier), scale-to-zero (no idle cost), reliable, no sleep lag. Needs a Google billing account (card required, but usage stays $0 at our scale). |
| Hugging Face Spaces | CPU Basic compute is $0/hr, **but creating Docker Spaces now requires a paid PRO plan ($9/mo)** — no longer free. |
| Koyeb | No more free tier — cheapest plan is $29/mo. Eliminated. |
| Render free tier | 512MB RAM — too small for ffmpeg + frame buffers; spins down. Not recommended. |
| Oracle Cloud Always-Free VM | Truly free 4-core ARM VM, but requires Linux sysadmin (you manage the VM, Docker, TLS). Viable if you refuse all cards. |
| Railway | $5 one-time trial credit — fine for testing, then paid. |

---

## Option A — Google Cloud Run (recommended)

**Free-tier math (verified 2026-08 from cloud.google.com/run/pricing):**
always-free = 240,000 vCPU-seconds + 450,000 GiB-seconds/month.
One render ≈ 2 vCPU × 40s = 80 vCPU-s + 4GiB × 40s = 160 GiB-s.
→ **~3,000 renders/month free** (CPU-bound), far beyond Midhkar's needs.
Scale-to-zero: you pay nothing when idle. A card is required for the
billing account, but the bill stays $0 unless you exceed the tier.

### Step by step

1. **Google account** → https://console.cloud.google.com → agree/trial.
2. **Create a project**: project picker (top bar) → *New Project* →
   name it `midhkar` → note the **Project ID**.
3. **Enable billing**: *Billing* in the left menu → link a card.
   (No charge occurs at our usage; you can set a budget alert at
   *Billing → Budgets → Create budget → $1* for total peace of mind.)
4. **Install the gcloud CLI**: https://cloud.google.com/sdk/docs/install
   then:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
5. **Deploy from the repo root** (Windows: run in Git Bash/WSL):
   ```bash
   ./scripts/deploy-cloud-run.sh YOUR_PROJECT_ID europe-west1
   ```
   The script builds via Cloud Build (~3-5 min) and deploys with the
   settings the service needs: `--port 7860 --cpu 2 --memory 4Gi
   --timeout 3600 --cpu-boost --concurrency 1 --max-instances 2`.
   (`--timeout 3600` matters: default 60s would kill the SSE progress
   stream mid-render.)
6. **Copy the printed URL** (`https://midhkar-render-…run.app`), test:
   ```bash
   curl https://YOUR-SERVICE-URL/api/health
   # {"ok":true,"active":0,"waiting":0}
   ```
7. **Point the app at it**: Vercel → Midhkar project → Settings →
   Environment Variables → add for Production:
   ```
   NEXT_PUBLIC_RENDER_API_URL=https://midhkar-render-…run.app
   ```
   Redeploy the app. Done — generation now renders in the cloud and
   falls back to the browser automatically if the service is down.

### Updating later
Re-run the deploy script — Cloud Run reuses the same service name; new
image, zero-downtime rollout.

---

## Option B — Any Docker host (Koyeb, Railway, Fly.io, a VPS…)

The container is generic (listens on `$PORT`, default 7860). Manual
deploy on any platform:

```bash
docker build -t midhkar-render .
docker run -p 7860:7860 -e ALLOWED_ORIGINS="https://midhkar.vercel.app" midhkar-render
```

Requirements for the host: **≥2 vCPU, ≥4GB RAM**, request timeout
≥ 10 minutes (renders + SSE), ffmpeg included (the Dockerfile installs
it — don't use slim/runtimes that strip apt).

---

## Local testing

```bash
cd render-service
npm install
npm run dev                          # http://localhost:7860
# in another terminal (app):
NEXT_PUBLIC_RENDER_API_URL=http://localhost:7860 npm run dev
```

Container e2e (against the built image):
```bash
docker build -t midhkar-render .
docker run -d -p 7861:7860 --name mrt midhkar-render
cd render-service
RENDER_API_BASE=http://localhost:7861 npx tsx test/api.test.ts
docker rm -f mrt
```

## Cost guardrails (Cloud Run)

- `--min-instances 0` — scale to zero, idle costs $0
- `--max-instances 2` — caps concurrent spend
- Budget alert at $1 — email before anything real accrues
- Free tier resets monthly; unused allowance does not roll over
