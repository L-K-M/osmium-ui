#!/usr/bin/env bash
# Verify Osmium UI the way CI does.
# Usage: scripts/build.sh [--clean]
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly REPOSITORY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPOSITORY_ROOT"

# --clean reinstalls dependencies from scratch for convention.
if [[ "${1:-}" == "--clean" ]]; then
  rm -rf node_modules
  npm ci
else
  npm ci
fi

npm run typecheck
npm test
npm run demo:build
echo "Osmium UI checks passed."
