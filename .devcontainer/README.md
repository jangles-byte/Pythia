# Pythia dev container

Runs Pythia in Docker so nothing but Docker Desktop and Ollama touches the Mac.

## Open it

In VS Code: **Reopen in Container**. Or from a terminal:

```bash
.devcontainer/compose up -d
```

Then open **http://localhost:3010** (use `localhost`: Next's dev server rejects `127.0.0.1`).
Press **PYTHIA** at the bottom for the oracle deck, or **ASK** to chat. The engine API and
its docs are at http://localhost:8088/docs.

## What runs where

| Where | What |
|---|---|
| `app` container | Pythia engine (`:8088`) + Osiris globe UI (`:3000`, published as `:3010`) |
| `deps` container (one-shot) | `uv sync`, clones Osiris into `vendor/osiris`, applies the overlay, `npm ci` |
| Your Mac | Ollama only. Docker on macOS can't use the GPU, so the model stays on the host and the container calls `host.docker.internal:11434` |

Ports are bound to `127.0.0.1`, so Pythia isn't reachable from your network.

## The Osiris overlay

Pythia ships its UI as an overlay for [Osiris](https://github.com/simplifaisoul/osiris).
`apply-overlay.sh` copies the overlay's components and API routes into `vendor/osiris`, then
applies `osiris-overlay.patch`. INSTALL.md describes far more edits to Osiris's own files than
the overlay ships as code, so the patch wires up only part of them:

- a bottom bar with **PYTHIA** (oracle deck), **ASK** (chat) and the status/model picker
- the Global Health Score badge, and browser notifications for signal rules
- a tile-proxy fix (Carto rejects Osiris's old custom User-Agent)

Not wired up: forecast rings on the globe, the new map layers, the market/headline tickers,
and the Filings/Contracts/Signals windows. The engine still ingests every feed.

Osiris is pinned to `OSIRIS_REF` (in `.env`), the last commit before Pythia's own last
commit. To change the patch, edit files in `vendor/osiris`, then:

```bash
git -C vendor/osiris diff -- src/app/page.tsx src/app/api/proxy-tiles/route.ts > .devcontainer/osiris-overlay.patch
```

## Settings

`.devcontainer/.env` (created from `.env.example` on first open) sets the ports, the model
(`LLM_MODEL`, any name from `ollama list`) and any engine setting from the repo's
`.env.example`. After changing it:

```bash
.devcontainer/compose up -d app
```

Logs: `.devcontainer/compose logs -f app`.
