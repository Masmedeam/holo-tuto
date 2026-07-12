#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env with H_API_KEY and GRADIUM_API_KEY" >&2
  exit 1
fi

set -a
source .env
set +a
: "${H_API_KEY:?H_API_KEY is required}"
: "${GRADIUM_API_KEY:?GRADIUM_API_KEY is required}"

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"
REGION="${GOOGLE_CLOUD_REGION:-us-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-holo-tutorial}"
BUCKET="${VIDEO_BUCKET:-${PROJECT_ID}-holo-tutorial-videos}"
SA_NAME="${CLOUD_RUN_SERVICE_ACCOUNT:-holo-tutorial}"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com storage.googleapis.com --project "$PROJECT_ID"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --display-name="Holo Tutorial Cloud Run" --project "$PROJECT_ID"
fi

if ! gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT_ID" --location "$REGION" --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA_EMAIL" --role="roles/storage.objectAdmin" >/dev/null

ensure_secret() {
  local name="$1"
  if ! gcloud secrets describe "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic --project "$PROJECT_ID" >/dev/null
  fi
}

ensure_secret holo-h-api-key
ensure_secret holo-gradium-api-key
ensure_secret holo-access-code
printf '%s' "$H_API_KEY" | gcloud secrets versions add holo-h-api-key --data-file=- --project "$PROJECT_ID" >/dev/null
printf '%s' "$GRADIUM_API_KEY" | gcloud secrets versions add holo-gradium-api-key --data-file=- --project "$PROJECT_ID" >/dev/null

if ! gcloud secrets versions list holo-access-code --filter='state=ENABLED' --format='value(name)' --project "$PROJECT_ID" | grep -q .; then
  ACCESS_CODE="${HOLO_ACCESS_CODE:-$(openssl rand -hex 4)}"
  printf '%s' "$ACCESS_CODE" | gcloud secrets versions add holo-access-code --data-file=- --project "$PROJECT_ID" >/dev/null
fi

for secret in holo-h-api-key holo-gradium-api-key holo-access-code; do
  gcloud secrets add-iam-policy-binding "$secret" --member="serviceAccount:$SA_EMAIL" --role="roles/secretmanager.secretAccessor" --project "$PROJECT_ID" >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" --member="serviceAccount:$SA_EMAIL" --role="roles/iam.serviceAccountTokenCreator" --project "$PROJECT_ID" >/dev/null

gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --allow-unauthenticated \
  --cpu 2 \
  --memory 2Gi \
  --concurrency 2 \
  --timeout 900 \
  --max-instances 4 \
  --set-env-vars="VIDEO_BUCKET=$BUCKET" \
  --set-secrets="H_API_KEY=holo-h-api-key:latest,GRADIUM_API_KEY=holo-gradium-api-key:latest,HOLO_ACCESS_CODE=holo-access-code:latest"

SERVICE_URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo "SERVICE_URL=$SERVICE_URL"
echo "ACCESS_CODE is stored in Secret Manager as holo-access-code."
