#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." \
    && pwd
)"

cd "$ROOT_DIR"

if [[ ! -f .env.docker ]]; then
  echo "ERROR: .env.docker is missing."
  exit 1
fi

docker compose \
  --env-file .env.docker \
  down \
  --remove-orphans
