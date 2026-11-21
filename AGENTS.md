# Pythia

- Read [CLAUDE.md](CLAUDE.md) for what this is, the layout, commands, and dev container conventions.
- Work on a branch. This is a fork: push to `origin` only; `upstream` (`jangles-byte/Pythia`) is fetch-only.
- Edit Osiris UI files in `integrations/osiris/`, not `vendor/osiris/` (it is regenerated on every container open). Edits to Osiris's own files go through `.devcontainer/osiris-overlay.patch`.
- Don't install dependencies on the Mac: `uv sync` and `npm` run inside the container.
- Keep `.env` and `.devcontainer/.env` private. Never read or commit them.
- The `pythia` MCP server (`.codex/config.toml`, `.mcp.json`) gives live world state and forecasts; the `app` container must be running.
