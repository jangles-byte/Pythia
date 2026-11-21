#!/usr/bin/env bash
# Runs in the one-shot `deps` service on every open: Python deps for the engine, then an
# Osiris checkout in vendor/osiris with Pythia's overlay and its npm dependencies.
set -euo pipefail

cd "$(dirname "$0")/.."

uv sync

OSIRIS_REF="${OSIRIS_REF:-f3534cd}"
if [ ! -d vendor/osiris/.git ]; then
  # vendor/osiris already exists (it holds volume mount points), so clone into it in place.
  mkdir -p vendor/osiris
  git -C vendor/osiris init -q
  git -C vendor/osiris remote add origin https://github.com/simplifaisoul/osiris.git
  git -C vendor/osiris fetch -q origin
  git -C vendor/osiris checkout -q "$OSIRIS_REF"
fi

bash .devcontainer/apply-overlay.sh

cd vendor/osiris
# Reinstall only when the lockfile changed since the last install into the volume.
stamp=node_modules/.lock-hash
hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ "$(cat "$stamp" 2>/dev/null)" != "$hash" ]; then
  npm ci
  echo "$hash" > "$stamp"
fi
