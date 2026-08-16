#!/bin/bash
echo "Running CI Verification..."
./scripts/lint.sh || exit 1
./scripts/typecheck.sh || exit 1
pnpm run verify:production || exit 1
echo "All CI checks passed!"
