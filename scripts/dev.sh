#!/usr/bin/env bash
set -Eeuo pipefail

api_pid=''
cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

pnpm --filter api run dev &
api_pid=$!

for attempt in {1..60}; do
  if curl --silent --fail http://127.0.0.1:3001/api/health >/dev/null; then
    exec pnpm --filter web run dev
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    wait "$api_pid"
    exit 1
  fi
  sleep 1
done

echo 'API did not become healthy within 60 seconds' >&2
exit 1
