#!/usr/bin/env bash
# Builds demo-output/kinproof-demo.mp4. See scripts/compose-demo.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "ffmpeg is required (sudo apt install ffmpeg)"; exit 1; }
[ -f demo-output/raw/timeline.json ] || { echo "No footage yet. Run: pnpm record:demo"; exit 1; }
exec node --experimental-strip-types --no-warnings scripts/compose-demo.ts "$@"
