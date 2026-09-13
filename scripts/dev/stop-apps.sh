#!/usr/bin/env bash

set -euo pipefail

PORTS=(3000 3001 4173 5173)

for port in "${PORTS[@]}"; do
  PIDS="$(
    lsof \
      -tiTCP:"$port" \
      -sTCP:LISTEN \
      2>/dev/null \
      || true
  )"

  if [[ -z "$PIDS" ]]; then
    echo "Port $port: free"
    continue
  fi

  echo "Stopping listener(s) on port $port: $PIDS"

  # shellcheck disable=SC2086
  kill $PIDS 2>/dev/null || true
done
