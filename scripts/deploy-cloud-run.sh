#!/usr/bin/env bash
# deploy-cloud-run.sh — one-shot deploy of the Midhkar render service
# to Google Cloud Run (free tier covers ~2,000 renders/month).
#
# Prereqs: gcloud CLI installed + logged in, a GCP project with billing
# enabled (Cloud Run free tier requires a billing account, but the
# usage below stays free — see DEPLOY.md for the math).
#
# Usage:
#   ./scripts/deploy-cloud-run.sh [PROJECT_ID] [REGION]
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || echo "")}"
REGION="${2:-europe-west1}"   # Tier-1 pricing region (free-tier rates)
SERVICE="midhkar-render"
IMAGE="$REGION-run.dev/$PROJECT_ID/$SERVICE:latest"

if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: no PROJECT_ID given and gcloud has no default project."
  echo "Usage: $0 PROJECT_ID [REGION]"
  exit 1
fi

echo "→ Building & pushing image (Cloud Build, ~3-5 min)…"
gcloud builds submit \
  --project "$PROJECT_ID" \
  --tag "$IMAGE" \
  .

echo "→ Deploying to Cloud Run…"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE" \
  --port 7860 \
  --cpu 2 --memory 4Gi \
  --timeout 3600 \
  --cpu-boost \
  --concurrency 1 \
  --max-instances 2 \
  --min-instances 0 \
  --allow-unauthenticated \
  --set-env-vars "ALLOWED_ORIGINS=https://midhkar.vercel.app"

echo ""
echo "✅ Deployed. Service URL (set as NEXT_PUBLIC_RENDER_API_URL):"
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --format 'value(status.url)'
