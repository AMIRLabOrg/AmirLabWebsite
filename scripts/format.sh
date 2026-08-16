#!/bin/bash
echo "Formatting backend (if applicable)..."
pnpm --dir backend run --if-present format || exit 1
echo "Formatting frontend (if applicable)..."
pnpm --dir frontend run --if-present format || exit 1
