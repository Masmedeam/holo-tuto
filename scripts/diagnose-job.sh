#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 JOB_ID" >&2
  exit 2
fi

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}"
JOB_ID="$1"

gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"holo-tutorial\" AND jsonPayload.jobId=\"$JOB_ID\"" \
  --project "$PROJECT_ID" \
  --order asc \
  --limit 200 \
  --format='table(timestamp,jsonPayload.event,jsonPayload.hSessionId,jsonPayload.scene,jsonPayload.elapsedMs,jsonPayload.error,textPayload)'
