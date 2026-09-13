#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." \
    && pwd
)"

cd "$ROOT_DIR"

if [[ ! -f .env.docker ]]; then
  echo "ERROR: .env.docker is missing."
  echo "Create it from the local environment setup before starting infrastructure."
  exit 1
fi

echo "Starting Entropix Examination ERP local infrastructure..."

env \
  -u POSTGRES_BOOTSTRAP_PASSWORD \
  -u EXAM_MIGRATION_PASSWORD \
  -u EXAM_APP_PASSWORD \
  docker compose \
    --env-file .env.docker \
    up -d

echo
docker compose \
  --env-file .env.docker \
  ps
