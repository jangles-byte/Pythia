<div align="center">

# 🔮 PYTHIA

### Watch the world. Predict what happens next.

PYTHIA fuses two open-source projects — **[MiroFish](https://github.com/666ghj/MiroFish)**, a swarm-intelligence prediction engine, and **[Osiris](https://github.com/simplifaisoul/osiris)**, a live global-intelligence globe — into a single machine that ingests everything happening on Earth in real time and forecasts the future across the next **24 hours, week, month, and year**.

It runs **entirely on your own hardware**. No cloud, no API keys, no cost.

> **Building an agent?** Point it at PYTHIA and it gains **eyes on the whole planet** — one live, machine-readable view of everything happening on Earth (conflict, disasters, markets, displacement, disease, unrest, cyber) plus forecasts and reasoning, to inform decisions and add real-world context to whatever it does. → **[For agents ↓](#for-agents--give-your-agent-eyes-on-the-planet)**

![PYTHIA — the cockpit](screenshots/cockpit.png)

</div>

---

## The idea

The world broadcasts its future constantly — in the news, in conflict movements, in seismographs, storms, cyber chatter, and the bets people place. The problem has never been a lack of signal; it's that no one can watch all of it at once and reason across it.

PYTHIA does. It is an **oracle**: a single surface that takes in the entire live state of the planet and tells you, plainly, what is most likely to happen and where — with a probability and the reasoning behind it.

- **Osiris** is the *eyes* — a real-time globe streaming 30+ live feeds.
- **MiroFish** is the *mind* — a prediction engine that models how the world reacts to events.
- A **local LLM** is the *voice* — it reads the assembled world-state and speaks the forecast.

```
            OSIRIS  ──── live world feeds ────►   PYTHIA ENGINE   ──── world brief ────►   MiroFish / local LLM
        (the live globe)                          (fusion + API)                              (the oracle)
   news · conflict · weather · seismic                  │                                          │
   cyber · infrastructure · market odds                 ▼                                          ▼
                                              predictions · chat · map overlays  ◄──── forecasts (24h · week · month · year)
```

## Built on MiroFish + Osiris

**[MiroFish](https://github.com/666ghj/MiroFish)** — *a simple, universal swarm-intelligence engine for predicting anything.* MiroFish builds a high-fidelity parallel world of autonomous agents that react to seed events and simulates how the situation unfolds. PYTHIA is built around MiroFish's prediction-engine model: it uses MiroFish's configured model as the oracle and is designed to drive MiroFish's full multi-agent OASIS swarm when a [Zep](https://www.getzep.com/) memory key is configured. Out of the box, PYTHIA runs the same model locally for instant, free forecasts — and ships its **own local swarm**: a council of specialist personas that deliberate every prediction and surface their consensus *and* their dissent, bringing the swarm-intelligence idea to life with zero cloud dependencies.

**[Osiris](https://github.com/simplifaisoul/osiris)** — *a real-time global intelligence dashboard.* Osiris provides the live 3D globe and the feed layer PYTHIA watches: breaking news, GDELT geopolitics, armed conflict, NWS storm/flood warning zones, EONET disasters, wildfires, earthquakes, cyber threats, critical infrastructure, and more — plus **Polymarket** crowd probabilities as forecasting anchors.

## What PYTHIA does

- **Forecasts the future** from the live world, grouped by horizon, each prediction carrying a probability, its reasoning, and a location — **click one and the globe flies there.**
- **Deliberates as a swarm** — a council of four specialist agents (Strategist · Economist · Naturalist · Skeptic) re-scores every forecast through its own lens. PYTHIA surfaces their **consensus *and* their dissent**, flagging the forecasts where the swarm splits.
- **Answers questions** — a chat that can see *every* live source and its own forecasts at once.
- **Watches everything** — world news, conflict zones, **live Ukraine territory control / war fronts** (DeepStateMap), NWS storm & flood polygons, EONET disasters, wildfires, earthquakes, cyber threats, infrastructure, **global markets** (oil, indices, commodities, crypto), and **Polymarket** crowd odds — plus a full **social & humanitarian** layer set: displacement/refugees, disease outbreaks, civil unrest, food insecurity, inflation, unemployment, GDP, extreme poverty, and internet censorship. **Every source is free and keyless.**
- **Surfaces headlines** — big breaking-news ticker along the bottom; risk overlays drawn as outlined zones on the map.
- **Is a cockpit, not a page** — pull up news feeds and chat as movable, resizable windows around a spinning globe (manual or event-snapping spin), and watch the world go on.
- **Picks its own brain** — switch between any model installed in [Ollama](https://ollama.com) from the UI.
- **Looks how you like** — a soft **light mode** (Apple-style whites & greys, frosted glass) or the deep-dark oracle theme, a dot-matrix display font, and a toggle for every live layer. *Hide a layer from the map and the oracle still watches it* — visibility is cosmetic; the engine ingests every feed regardless.
- **Opens its eyes to your agents** — a clean machine-readable API exposes the whole world view (see below).

## The swarm — consensus *and* dissent

Every forecast is re-judged by a council of four specialist agents, each reasoning through its own lens. PYTHIA shows you not just the number, but *how the room voted* — and where it splits.

![Swarm deliberation](screenshots/deliberation.png)

| Agent | Lens |
|---|---|
| **Strategist** | geopolitics, armed conflict, diplomacy, state actors |
| **Economist** | markets, energy, commodities, the macro economy |
| **Naturalist** | disasters, seismic activity, severe weather, climate, public health |
| **Skeptic** | base rates & the null hypothesis — the calibration brake on hype |

Click any prediction to open its deliberation: a **consensus gauge**, an **agreement spectrum** showing where each agent landed, every agent's vote and its one-to-two-sentence argument, and the shift from the oracle's first guess to the swarm consensus. Sharp disagreement is flagged as a **split**. It all runs locally on your Ollama model — no Zep, no cloud.

## Everything it watches — free & keyless

PYTHIA fuses dozens of live, no-key feeds into a single world-state. Toggle any of them on the globe; the oracle ingests them **all**, regardless of what's visible.

![Threat network](screenshots/threat-network.png)

- **Conflict & security** — armed-conflict events (GDELT), live Ukraine territory control & war fronts (DeepStateMap), civil unrest & protests, cyber-threat / malware networks, GPS jamming, critical & nuclear infrastructure.
- **Natural hazards** — earthquakes (USGS), NWS storm & flood warning polygons, EONET disasters, wildfires (FIRMS), severe weather, radiation monitors.
- **Markets** — oil, indices, commodities, crypto, and **Polymarket** crowd odds as forecasting anchors.
- **Social & humanitarian** — forced displacement & refugees (UNHCR), disease outbreaks (WHO), food insecurity (WFP HungerMap), inflation, unemployment, GDP growth & extreme poverty (World Bank), internet censorship (OONI).
- **Movement & eyes** — flights (commercial / private / military), satellites, maritime traffic & chokepoints, surveillance balloons, live news streams & CCTV.

No API keys. No accounts. No cost.

## How a forecast is made

1. **Sense** — the engine pulls every live feed concurrently and fuses them into one world brief, refreshed continuously by a lightweight sensing loop.
2. **Draft** — the local LLM reads the brief and drafts concrete, *located* predictions across four horizons (24h · week · month · year), each with a probability and reasoning.
3. **Deliberate** — the persona swarm re-scores every forecast; consensus, dissent, and splits are computed.
4. **Surface** — predictions land on the deck and the globe; click one to fly there and read the full deliberation.
5. **Serve** — the entire world-view is exposed over the Agent API for your own tools to consume.

## For agents — give your agent eyes on the planet

Most agents are blind to the real world. PYTHIA fixes that: run it once and your agent gets a single, always-current view of **what's happening on Earth right now** — armed conflict, disasters, markets, displacement, disease, unrest, cyber activity — plus PYTHIA's own forecasts and reasoning. Use it to **inform decisions, add real-world context, ground answers, or trigger behavior when the world changes.**

Everything is local HTTP + JSON on **`http://localhost:8088`**. No keys, no SDK, no rate limits, CORS open.

### Install & run (one time)

**Prerequisites**
- [Ollama](https://ollama.com) running, with a chat model pulled — `ollama pull llama3.1` (any model works).
- A [Osiris](https://github.com/simplifaisoul/osiris) checkout with the PYTHIA overlay applied — see [`integrations/osiris/INSTALL.md`](integrations/osiris/INSTALL.md).
- Python 3.11+ and [uv](https://docs.astral.sh/uv/).

**Start the stack** — the live globe (`:3000`) + the agent API (`:8088`):
```bash
git clone https://github.com/jangles-byte/Pythia && cd Pythia
cp .env.example .env          # sensible defaults — no keys needed
./run-all.sh                  # starts Osiris + the engine and opens the UI
```
Your agent only ever talks to the engine: **`http://localhost:8088`**. The UI is optional — close it and the engine keeps sensing the world. Confirm it's up:
```bash
curl http://localhost:8088/health
curl http://localhost:8088/links     # {engine, osiris, oracle} all true once ready
```

### The one call most agents want
```bash
curl http://localhost:8088/agent/view
```
One JSON payload = your agent's situational awareness: a prose **summary** of the world, every live **event grouped by domain** (with coordinates), the active **domains**, and the current **predictions**.

### Full API reference

| Method & path | Query / body | Returns |
|---|---|---|
| `GET /health` | — | service status + active config |
| `GET /config` | — | Osiris URL, model, horizons, refresh intervals |
| `GET /links` | — | liveness — `engine`/`osiris`/`oracle` booleans, current `model`, `generating`, `loop`, `prediction_count` |
| `GET /agent/view` | — | **the whole world in one payload** — `summary`, `domains`, `events_by_domain` (lat/lng), `event_count`, `predictions`, `live_stream` |
| `GET /agent/events` | `domain`, `source`, `min_salience`, `since` (ms), `limit` | live events, most-salient first, + `domains_available` for discovery |
| `GET /predictions` | `horizon` (`24h`\|`week`\|`month`\|`year`), `min_probability` | forecasts (each with its swarm `agents`, `split`, `base_probability`) + the world brief + valid `horizons` |
| `GET /world` | — | the assembled world brief — prose `text`, `domains`, `event_count` |
| `GET /runs` | — | the last 20 oracle passes (stage, trigger, timing) |
| `GET /state` | — | full state snapshot — predictions + world + runs + flags |
| `GET /state/stream` | — | **SSE** — a snapshot, then live deltas as the world changes |
| `POST /predict` | — | trigger a fresh forecast now → `{status}` |
| `POST /chat` | `{ "message": "…", "history": [] }` | `{answer}` — ask anything; grounded in every live feed + current forecasts |
| `POST /model` | `{ "model": "name" }` | switch the oracle's model at runtime |
| `GET /models` | — | installed Ollama models + the current one |
| `POST /loop` | `{ "enabled": true }` | toggle continuous auto-forecasting |
| `GET /docs` · `GET /openapi.json` | — | interactive Swagger UI + the full **OpenAPI spec** (self-discovery) |

### Object shapes
- **Event** — `{ title, summary, category, source, lat, lng, salience (0–1), ts (epoch ms), url }`
- **Prediction** — `{ statement, horizon, probability (0–1), reasoning, location, lat, lng, base_probability, split, agents: [{ name, probability, note }] }`

### Recipes
```bash
# High-salience conflict events only, top 20, with coordinates
curl 'http://localhost:8088/agent/events?domain=conflict&min_salience=0.7&limit=20'

# This-week forecasts the oracle is at least 60% confident on
curl 'http://localhost:8088/predictions?horizon=week&min_probability=0.6'

# Ground a question in the live world
curl -X POST http://localhost:8088/chat -H 'content-type: application/json' \
     -d '{"message":"What is most likely to escalate in the next 24 hours, and where?"}'

# React in real time — stream world changes
curl -N http://localhost:8088/state/stream

# Force a fresh read of the planet, then fetch the result
curl -X POST http://localhost:8088/predict && sleep 40 && curl http://localhost:8088/agent/view

# Switch to a bigger brain for deeper reasoning
curl -X POST http://localhost:8088/model -H 'content-type: application/json' -d '{"model":"llama3.1:70b"}'
```

### Notes for agents
- **Visibility ≠ availability** — UI layer toggles only affect the map; the engine senses *every* feed regardless, so the API always returns the full world.
- **Discover, don't guess** — `/agent/events` returns `domains_available`, `/predictions` returns `horizons`, `/models` lists models, and `/openapi.json` describes the entire API.
- **Always fresh** — a background sensing loop refreshes the world brief continuously; turn on `/loop` to keep forecasts re-running too.

## Quickstart

**Requirements:** [Ollama](https://ollama.com) with a model pulled (`ollama pull llama3.1`), a checkout of [Osiris](https://github.com/simplifaisoul/osiris) with the overlay applied (`integrations/osiris/INSTALL.md`), and Python 3.11+ with [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env     # sensible defaults; no keys needed
./run-all.sh             # starts the globe (:3000) + the engine (:8088) and opens it
```

…or double-click **`PYTHIA.app`** on macOS. Then open the oracle deck (the Eye) and press **PREDICT**.

## Architecture

| Part | Role |
|---|---|
| `engine/` | The PYTHIA oracle — FastAPI. Pulls + fuses every feed (`osiris_intake`, `world_state`), runs the forecast and chat (`oracle`), deliberates with the persona council (`swarm`), serves the API (`server`). |
| `integrations/osiris/` | The overlay applied to an Osiris checkout — the predictions deck, chat, floating windows, map overlays, and API routes. See its `INSTALL.md`. |
| `run-all.sh` · `PYTHIA.app` | One-tap launchers. |

**Engine API** (`:8088`): `/agent/view` · `/agent/events` · `/predictions` · `/predict` · `/chat` · `/world` · `/state` (+ SSE `/state/stream`) · `/runs` · `/models` · `/model` · `/loop` · `/links` · `/config` · `/health` · `/docs` + `/openapi.json`. Full reference, parameters, and recipes are in **[For agents](#for-agents--give-your-agent-eyes-on-the-planet)**.

## Configuration (`.env`)

Time horizons, predictions per horizon, refresh cadence, and the model are all configurable. Leave the `LLM_*` lines blank to reuse MiroFish's configured local model, or set `LLM_MODEL=llama3.1`.

## Credits

PYTHIA stands entirely on the work of these projects — please star them:

- **[MiroFish](https://github.com/666ghj/MiroFish)** by [@666ghj](https://github.com/666ghj) — the swarm-intelligence prediction engine.
- **[Osiris](https://github.com/simplifaisoul/osiris)** by [@simplifaisoul](https://github.com/simplifaisoul) — the live intelligence globe.
- **[Ollama](https://ollama.com)** — local LLM runtime.

Osiris and MiroFish are *not* redistributed here; PYTHIA is the engine plus an overlay you apply to your own checkouts.

## License

[MIT](LICENSE).
