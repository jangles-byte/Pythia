#!/usr/bin/env bash
# Starts Pythia's MCP server (stdio) for .mcp.json.
# Inside the dev container: runs it directly (PYTHIA_ENGINE_URL points at the app service).
# On the Mac: runs it inside the app container, so no Python packages land on the host.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f /.dockerenv ]; then
  exec uv run --quiet python -m engine.mcp
fi
exec .devcontainer/compose exec -T app uv run --quiet python -m engine.mcp
