#!/usr/bin/env bash
# Applies Pythia's Osiris overlay (integrations/osiris) to vendor/osiris.
#  1. Copies the overlay's own files (components, lib, API routes, /tv page) into place,
#     using the file map in integrations/osiris/INSTALL.md. Re-run safe: they are overwritten.
#  2. Applies .devcontainer/osiris-overlay.patch: the edits to Osiris's own files
#     (page.tsx etc.), which INSTALL.md only describes in prose. Skipped if already applied.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=integrations/osiris
DST=vendor/osiris

# Components: every top-level .tsx except the /tv page.
for f in "$SRC"/*.tsx; do
  name="$(basename "$f")"
  [ "$name" = tv-page.tsx ] && continue
  cp "$f" "$DST/src/components/$name"
done

mkdir -p "$DST/src/lib" "$DST/src/app/tv"
cp "$SRC"/lib/*.ts "$DST/src/lib/"
cp "$SRC/tv-page.tsx" "$DST/src/app/tv/page.tsx"

# API routes: destination from INSTALL.md's table, else src/app/api/<name>/route.ts.
for f in "$SRC"/routes/*-route.ts; do
  name="$(basename "$f")"
  dest="$(grep -oE "^\| \`routes/$name\` \| \`[^\`]+\`" "$SRC/INSTALL.md" | sed -E 's/.*\| `([^`]+)`$/\1/' || true)"
  [ -n "$dest" ] || dest="src/app/api/${name%-route.ts}/route.ts"
  mkdir -p "$DST/$(dirname "$dest")"
  cp "$f" "$DST/$dest"
done

PATCH="$PWD/.devcontainer/osiris-overlay.patch"
if [ -f "$PATCH" ]; then
  if git -C "$DST" apply --reverse --check "$PATCH" 2>/dev/null; then
    echo "[overlay] patch already applied"
  else
    git -C "$DST" apply "$PATCH"
    echo "[overlay] patch applied"
  fi
fi
echo "[overlay] done"
