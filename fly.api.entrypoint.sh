#!/usr/bin/env bash
set -Eeuo pipefail

if (($# > 0)); then
  exec "$@"
fi

pnpm --filter api run db:seed:if-empty
exec pnpm --filter api run start:prod
