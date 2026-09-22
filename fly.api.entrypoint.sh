#!/usr/bin/env bash
set -Eeuo pipefail

if (($# > 0)); then
  exec "$@"
fi

exec pnpm --filter api run start:prod
