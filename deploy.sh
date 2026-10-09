#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
RUN_REGION="${RUN_REGION:-europe-west1}"
VERTEX_LOCATION="${VERTEX_LOCATION:-global}"
MODEL="${MODEL:-gemini-2.5-flash}"
SERVICE="${SERVICE:-relance-ai}"
SA_NAME="${SA_NAME:-relance-ai-runtime}"
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:?Set ALLOWED_ORIGINS, comma separated}"
SA="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

if ! gcloud iam service-accounts describe "$SA" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="360 Relance Vertex runtime"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/aiplatform.user" >/dev/null

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$RUN_REGION" \
  --platform managed \
  --service-account "$SA" \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$VERTEX_LOCATION,GEMINI_MODEL=$MODEL,FIREBASE_PROJECT_ID=$PROJECT_ID,REQUIRE_FIREBASE_AUTH=true,REQUIRE_APP_CHECK=true,ALLOWED_ORIGINS=$ALLOWED_ORIGINS"

echo
echo "Cloud Run service deployed."
echo "The service is publicly reachable at the network layer, but /api/relance/ai requires Firebase Auth + App Check."
echo "Vertex AI authentication uses the Cloud Run service account; no Gemini API key is deployed."
