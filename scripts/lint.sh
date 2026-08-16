#!/bin/bash
echo "Linting backend..."
pnpm --dir backend run lint || exit 1
echo "Linting frontend..."
pnpm --dir frontend run lint || exit 1
