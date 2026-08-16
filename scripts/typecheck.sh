#!/bin/bash
echo "Typechecking backend..."
pnpm --dir backend run typecheck || exit 1
echo "Typechecking frontend..."
pnpm --dir frontend run typecheck || exit 1
