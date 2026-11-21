#!/usr/bin/env bash
# Starts the Pythia engine (:8088) and the Osiris UI (:3000) in this container.
# Replaces run-all.sh, which kills processes by port and opens a browser on the Mac.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! curl -s -o /dev/null --max-time 3 "${LLM_BASE_URL%/}/models"; then
  echo "[pythia] Ollama not reachable at $LLM_BASE_URL. Open the Ollama app on your Mac."
fi

uv run python -m engine.run &
engine=$!

(cd vendor/osiris && exec npm run dev -- -H 0.0.0.0 -p 3000) &
ui=$!

trap 'kill $engine $ui 2>/dev/null || true' INT TERM
# If either dies, stop the other so the container restarts both.
wait -n $engine $ui
kill $engine $ui 2>/dev/null || true
exit 1
