

https://github.com/user-attachments/assets/8374d329-41e0-4074-80ac-79e442927319


<div align="center">

# PYTHIA

### Watch the world. Predict what happens next.

PYTHIA fuses two open-source projects — **[MiroFish](https://github.com/666ghj/MiroFish)**, a swarm-intelligence prediction engine, and **[Osiris](https://github.com/simplifaisoul/osiris)**, a live global-intelligence globe — into a single machine that ingests everything happening on Earth in real time and forecasts the future across the next **24 hours, week, month, and year**.

It runs **entirely on your own hardware**. No cloud, no API keys, no cost.

> **Building an agent?** Point it at PYTHIA and it gains **eyes on the whole planet** — one live, machine-readable view of everything happening on Earth (conflict, disasters, markets, displacement, disease, unrest, cyber) plus forecasts and reasoning, to inform decisions and add real-world context to whatever it does. → **[For agents ↓](#for-agents--give-your-agent-eyes-on-the-planet)**

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

## Recently added

A wave of features turning PYTHIA from "watch the world" into a tool you keep open all day — all still **local & keyless**:

- 🏦 **Regulatory & capital-flow feeds** — the intelligence layer nobody fuses into a free oracle, all keyless:
  - **SEC filings tape** (floating, placeable window) — live insider trades (Form 4: buy/sell/grant with company, ticker, $ value) + material events (8-K) across *all* public companies. The oracle ingests the high-conviction slice: insider **buys** and **$1M+ sells** become world-events, so a cluster-buy can move a forecast.
  - **Federal money** (floating window) — **awarded** federal contracts (USASpending) and **open** funding opportunities (Grants.gov), with links.
  - **Kalshi** — CFTC-regulated event-contract odds, a third real-money forecast anchor alongside Polymarket + Manifold.
  - **Energy & power grid** — live carbon intensity + generation mix (GB National Grid, California CAISO); a fossil-heavy, high-intensity grid is a demand-stress tell.
  - **Public-health early warning** — CDC wastewater surveillance (leads clinical cases ~1–2 weeks), ranked by viral activity and trend.
  - **Climate dials** — NOAA ENSO / Oceanic Niño Index (El Niño / La Niña) + US Drought Monitor coverage.
- 🖥 **Display Mode** — one click drops PYTHIA into the full-screen `/tv` kiosk (auto-rotating forecast / signals / brief / market boards) for a wall display or second monitor.
- 🌀 **Spin yields to your hand** — the auto-rotating globe now pauses the instant you grab it so you can look around freely, and resumes a half-second after you let go.
- 🛰 **3D altitude** — satellites and aircraft lift off the globe to their *real* elevation as floating dots (live TLE / ADS-B altitude). On by default; toggle **Off Earth / On Earth** from the satellites tab.
- 📹 **Cameras** — click **Cams near** on any event or forecast to pull the nearest of **4,000+ public cameras** (Caltrans, NYC, London, Ontario, Alberta, Delaware, NZ) into a live grid, plus a **14-view NOAA GOES** satellite window.
- 🔔 **Signal rules + notifications** — "tap me when a quake ≥ M6 hits / oil moves ±3% / VIX > 25 / a forecast crosses 85% / a keyword appears." Fires to the Signals feed, browser notifications, and webhooks.
- ☀ **Morning Brief** — a daily, on-schedule oracle digest: overnight developments, what resolves today, watchlist moves, what to watch.
- 📈 **Markets** — a rolling ticker, a **Watch tab** (your symbols with sparklines) and **PYTHIA's Watch** (the tickers the oracle's *own* forecasts touch, with the why), a floating always-on-top ticker window, and vastly expanded symbol lists.
- ⚖ **Council Chamber** — watch the swarm deliberate live, vote-by-vote, and read each persona's argument; **persona chat** puts any specialist on the line in its own voice.
- 📉 **Drift charts** — a sparkline on every forecast showing how its probability moved across passes; hard swings flagged.
- 📅 **Calendar** · 📺 **`/tv` kiosk mode** · 📍 **My Patch** (pin your region) · 🖼 **share cards** (branded PNG of any forecast or brief).
- 🌐 **Earlier feeds** — CISA KEV (actively-exploited CVEs), FAA airspace status (ground stops/delays), plus futures/term-structure, IODA outages, Wikipedia attention, and NOAA space weather. **Everything is free and keyless — now ~40 live feeds, 39 of them fused into the oracle.**

## What PYTHIA does

- **Forecasts the future** from the live world, grouped by horizon, each prediction carrying a probability, its reasoning, and a location — **click one and the globe flies there.**
- **Draws the future on the globe** — every located forecast becomes a pulsing **forecast ring** (sized by probability, colored by horizon) so the map shows the *next 7 days*, not just the present. Click a ring to read the prophecy; flip on month/year rings from the ORACLE layer group. **Hurricane forecast cones** (NHC) and a **30-day flood outlook** (Copernicus GloFAS river-discharge forecasts for 22 major basins) draw nature's own futures alongside.
- **Keeps score in public** — every forecast goes on the record the moment it's made (`runs/ledger.jsonl`). When its horizon expires an LLM judge grades it against the archived world. The deck's **track-record panel** (the target button) shows the running **Brier score, hit rate, a calibration chart, and recent verdicts** — per horizon, per swarm persona, *and per local model* (a live model bake-off). Forecasts that persist across passes show their **momentum** (▲▼ probability drift).
- **Learns from its record** — the swarm's consensus is **Brier-weighted**: once a persona has enough resolved forecasts, its vote counts for more (or less) based on how right it has actually been.
- **Answers "what if?"** — the deck's **Hypothetical field** (or `POST /whatif`, or `/whatif …` in chat): the oracle injects your scenario into the live world, forecasts the knock-on effects, and the council personas *you check* deliberate on them. Ephemeral — counterfactuals never touch the track record.
- **Lets you watch the argument** — the **Council Chamber** (gavel button) opens itself whenever a deliberation goes live: a vote matrix fills in voice-by-voice as each persona finishes arguing, and clicking any cell shows that voice's argument verbatim.
- **Puts the future on a calendar** — every open forecast lands on the day its window closes; click a day for its docket, click a forecast for the deliberation.
- **Rolls the tape** — a **market ticker** (indices · futures · crypto · FX + your watchlist) scrolls above the world-headline strip, priced keylessly.
- **Watches your tickers — and picks its own** — the Markets panel's **Watch tab** holds your watchlist (anything Yahoo prices: `AAPL`, `CL=F`, `BTC-USD`, `EURUSD=X`) with sparklines and day moves, and **PYTHIA's Watch** cross-references the oracle's *own live forecasts* to the tickers they touch — defense on conflict forecasts, nat-gas on hurricane cones, grains on drought — each pick carrying the forecast, horizon and probability behind it.
- **Taps you on the shoulder** — **signal rules**: "alert me when… an earthquake ≥ M6 hits / CL=F moves ±3% / the VIX crosses 25 / a forecast lands above 85% / any event matches my keywords." The engine evaluates every minute; hits land in the Signals feed, your **browser notifications**, and every webhook.
- **Writes your Morning Brief** — once a day at your hour (or on demand), the oracle writes a 60-second digest: what changed overnight, which forecasts resolve today, how the watchlist moved, and what to watch. Saved to `runs/briefs/`, surfaced in the deck, pushed to notifications + webhooks.
- **Runs a radar** — an always-on strip of the strangest thing happening in each domain right now; click a chip and the globe flies there.
- **Shows its drift** — every forecast card carries a sparkline of how its probability moved across passes (watch the oracle change its mind); hard swings get flagged.
- **Goes on the wall** — `/tv` is kiosk mode: full-screen auto-rotating boards (forecasts → signals → brief → markets) with the tickers pinned, built for a spare monitor running 24/7.
- **Knows your beat** — **My Patch** pins a region (center + radius) and filters events + forecasts to it.
- **Floats your tickers** — a movable, always-on-top ticker window (like the chat) with your watchlist; agents reading `/agent/view` get the watchlist as flagged **priority context**, not background noise.
- **Makes receipts** — one click renders any forecast (or the Morning Brief) as a branded share-card PNG.
- **Lifts the sky into 3D** — a **3D altitude** toggle raises satellites and aircraft off the globe as **floating dots at their real elevation** (LEO/MEO/GEO near-true scale from live TLE altitude, GEO clamped to stay on-screen; aircraft altitude — meters in the feed — exaggerated so the thin air layer is visible but still sits below the satellites). Pure MapLibre `fill-extrusion` (base set at altitude, so the dots float with no lines to the surface and your camera angle is left untouched) — no extra 3D engine. Click a dot for its name + altitude.
- **Pulls the cameras** — click **cams** on any event or **Cams near** on any forecast and PYTHIA finds the nearest public cameras (**4,000+** from Caltrans (all 12 CA districts), NYC, London, Ontario, Alberta, Delaware, NZ…) in an auto-refreshing still grid — the view nobody else has. Plus a **live NOAA GOES satellite** window: **14 views** — East & West CONUS/full-disk, regional sectors (Northeast, Southeast, Tropical Atlantic, US West, Hawaii), the roaming mesoscale sectors NOAA trains on active storms, and alternate bands (Infrared for night, AirMass, Sandwich). All keyless.
- **Pushes, not just serves** — register a **webhook** and the engine POSTs you high-probability forecasts after each pass, fresh high-salience world events as they appear, and every fired signal rule.
- **Deliberates as a swarm** — a council of four specialist agents (Strategist · Economist · Naturalist · Skeptic) re-scores every forecast through its own lens. PYTHIA surfaces their **consensus *and* their dissent**, flagging the forecasts where the swarm splits.
- **Answers questions** — a chat that can see *every* live source and its own forecasts at once. A speaker dropdown puts **any council persona on the line** — the Skeptic answers in the Skeptic's voice, via the Skeptic's own model.
- **Watches everything** — world news, conflict zones, **live Ukraine territory control / war fronts** (DeepStateMap), NWS storm & flood polygons, EONET disasters, wildfires, earthquakes, cyber threats, infrastructure, **global markets** (oil, indices, commodities, crypto), **futures & term structure** (WTI/Brent/gas/gold/grains/equity futures + the VIX, with a ~6-month contango/backwardation read — the market's own forecast, geo-anchored to the supply regions that drive it), and **Polymarket + Manifold** crowd odds — plus the **SEC EDGAR** tape (insider trades & 8-Ks across all public companies), **CISA KEV** (actively-exploited CVEs), **FAA airspace status** (ground stops & delays at major US airports), **GDACS disaster alerts** (Red/Orange/Green), **NHC hurricanes**, the **GloFAS flood outlook**, **internet outages** (IODA — a country going dark is often the first coup signal), **space weather** (NOAA SWPC), **Wikipedia attention spikes** (what humanity suddenly cares about), and a full **social & humanitarian** layer set: displacement/refugees, disease outbreaks, civil unrest, food insecurity, inflation, unemployment, GDP, extreme poverty, and internet censorship. **Every source is free and keyless.**
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

**Give each persona its own brain.** The hexagon button on the deck opens the swarm model picker — assign any installed Ollama model per persona (a big model for the Strategist, a fast one for the Skeptic…). Every vote in the deliberation is tagged with the model that cast it, picks survive engine restarts (`runs/swarm_models.json`), and you can seed them from `.env`: `SWARM_MODELS=Strategist=llama3.1:70b,Skeptic=qwen3:8b`. Since the ledger records each vote's model, the `/scorecard` per-persona Brier scores double as a live **model bake-off** on real-world forecasting. And the record feeds back: consensus is **Brier-weighted**, so a persona that keeps being right gets a louder vote (clamped — no voice ever dominates or vanishes).

## Everything it watches — free & keyless

PYTHIA fuses dozens of live, no-key feeds into a single world-state. Toggle any of them on the globe; the oracle ingests them **all**, regardless of what's visible.

![Threat network](screenshots/threat-network.png)

- **Conflict & security** — armed-conflict events (GDELT), live Ukraine territory control & war fronts (DeepStateMap), civil unrest & protests, cyber-threat / malware networks, **CISA KEV** (CVEs being actively exploited right now), GPS jamming, critical & nuclear infrastructure.
- **Natural hazards** — earthquakes (USGS), NWS storm & flood warning polygons, EONET disasters, wildfires (FIRMS), **NHC hurricanes** + **GloFAS flood outlook**, **NOAA space weather**, severe weather, radiation monitors.
- **Markets & money** — oil, indices, commodities, crypto, FX, **futures & term structure** (contango/backwardation), **Polymarket + Manifold + Kalshi** crowd odds as forecasting anchors, the **SEC EDGAR** tape (insider Form 4 buys/sells + 8-K events, all public companies — insider *buying* is a rare, high-conviction tell the oracle weights), and **federal money** (awarded contracts via USASpending + open opportunities via Grants.gov).
- **Energy & climate** — live **power-grid** carbon intensity + generation mix (GB National Grid, California CAISO — a fossil-heavy, high-intensity grid signals demand stress), **ENSO / Oceanic Niño Index** (El Niño / La Niña), and the **US Drought Monitor**.
- **Social & humanitarian** — forced displacement & refugees (UNHCR), disease outbreaks (WHO), **CDC wastewater early warning** (leads clinical cases ~1–2 weeks), food insecurity (WFP HungerMap), inflation, unemployment, GDP growth & extreme poverty (World Bank), internet censorship (OONI), **country-level internet outages** (IODA), **Wikipedia attention spikes**.
- **Movement & eyes** — flights (commercial / private / military) and satellites (**raise-able to real 3D altitude**), maritime traffic & chokepoints, **FAA airspace status** (ground stops/delays), surveillance balloons, live news streams, and **4,000+ public traffic/agency cameras** (Caltrans, NYC, London, Ontario, Alberta, Delaware, NZ) + **live NOAA GOES satellite imagery**.

No API keys. No accounts. No cost.

## How a forecast is made

1. **Sense** — the engine pulls every live feed concurrently and fuses them into one world brief, refreshed continuously by a lightweight sensing loop.
2. **Draft** — the local LLM reads the brief and drafts concrete, *located* predictions across four horizons (24h · week · month · year), each with a probability and reasoning.
3. **Deliberate** — the persona swarm re-scores every forecast; consensus, dissent, and splits are computed.
4. **Surface** — predictions land on the deck and the globe; click one to fly there and read the full deliberation.
5. **Serve** — the entire world-view is exposed over the Agent API (and an MCP server) for your own tools to consume.
6. **Keep score** — every forecast is persisted; once its horizon expires an LLM judge grades it against the archived world, and the Brier scorecard updates — overall, per horizon, and per swarm persona.

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
| `POST /chat` | `{ "message": "…", "history": [], "persona": "Skeptic"? }` | `{answer, persona}` — ask anything; grounded in every live feed + current forecasts. Pass `persona` to get one council specialist, in its voice, via its own model |
| `GET /personas` | — | the council roster — each persona's name + lens (drives the what-if checkboxes and the chat speaker picker) |
| `POST /model` | `{ "model": "name" }` | switch the oracle's model at runtime |
| `GET /models` | — | installed Ollama models + the current one |
| `GET /swarm/models` | — | swarm personas, per-persona model overrides, the default model, and the models available |
| `POST /swarm/model` | `{ "persona": "Skeptic", "model": "qwen3:8b" }` | give one persona its own model (empty `model` = back to the main one); persisted across restarts |
| `POST /loop` | `{ "enabled": true }` | toggle continuous auto-forecasting |
| `GET /drift` | — | probability drift per live forecast — `{id: {points: [{ts, p}], delta}}`, similarity-matched through the ledger |
| `GET /scorecard` | — | **the track record** — Brier score, hit rate, per-horizon / per-persona / **per-model** accuracy, calibration bins, recent resolutions |
| `POST /scorecard/resolve` | — | grade any due forecasts now (instead of waiting for the hourly judge) |
| `POST /whatif` | `{ "scenario": "…", "personas": ["Strategist", "Skeptic"]? }` | counterfactual forecast — `{scenario, narrative, predictions, personas}`; the listed personas deliberate the knock-ons; ephemeral, never ledgered |
| `GET /watch` | — | **the market watch** — `watchlist` (your symbols) + `pythia_watch`: tickers the oracle's live forecasts touch, each with `{symbol, theme, why, horizon, probability}` |
| `POST /watchlist` · `DELETE /watchlist/{symbol}` | `{ "symbol": "CL=F" }` | manage the watchlist (Yahoo-style symbols; persisted in `runs/watchlist.json`) |
| `GET /alerts` · `POST /alerts` · `DELETE /alerts/{id}` | `{ "kind": "quake"\|"market"\|"vix"\|"forecast"\|"event", "name", "params": {…} }` | **signal rules** — evaluated every minute against the live world; params per kind: quake `{min_magnitude}`, market `{symbol, move_percent}`, vix `{level}`, forecast `{min_probability, horizon?, keywords?}`, event `{keywords, domain?, min_salience}` |
| `GET /alerts/feed` | `since` (ms), `limit` | fired signals + Morning Briefs — what the UI polls for browser notifications |
| `GET /brief` · `POST /brief/run` · `POST /brief/config` | `{ "time": "07:30", "enabled": true }` | **the Morning Brief** — latest text + history + schedule; `run` writes one now |
| `GET /webhooks` · `POST /webhooks` · `DELETE /webhooks?url=` | `{ "url", "min_probability": 0.7, "min_salience": 0.85 }` | outbound push — the engine POSTs `{kind: "forecasts"\|"events"\|"alerts", …}` when thresholds are crossed or a signal rule fires |
| `GET /docs` · `GET /openapi.json` | — | interactive Swagger UI + the full **OpenAPI spec** (self-discovery) |

### Object shapes
- **Event** — `{ title, summary, category, source, lat, lng, salience (0–1), ts (epoch ms), url }`
- **Prediction** — `{ statement, horizon, probability (0–1), reasoning, location, lat, lng, base_probability, split, agents: [{ name, probability, note }] }`

### MCP server — plug PYTHIA straight into your agent

The whole Agent API is also exposed as an **MCP server** (stdio), so Claude Code, Claude
Desktop, or any MCP client gets PYTHIA as native tools — `world_brief`, `get_events`,
`get_predictions`, `predict_now`, `ask_oracle`, `what_if`, `get_scorecard`,
`get_market_watch` (the tickers the oracle's live forecasts touch, with the forecast
behind each):



https://github.com/user-attachments/assets/b5d5c488-9043-4a3d-95ac-f39f2d000918



```bash
# Claude Code (engine must be running):
claude mcp add pythia -- uv --directory /path/to/Pythia run python -m engine.mcp
```

Any other MCP client: `{ "command": "uv", "args": ["--directory", "/path/to/Pythia", "run", "python", "-m", "engine.mcp"] }`.
Point it at a non-default engine with `PYTHIA_ENGINE_URL`.

### Recipes
```bash
# High-salience conflict events only, top 20, with coordinates
curl 'http://localhost:8088/agent/events?domain=conflict&min_salience=0.7&limit=20'

# This-week forecasts the oracle is at least 60% confident on
curl 'http://localhost:8088/predictions?horizon=week&min_probability=0.6'

# Ground a question in the live world
curl -X POST http://localhost:8088/chat -H 'content-type: application/json' \
     -d '{"message":"What is most likely to escalate in the next 24 hours, and where?"}'

# Which tickers do the oracle's live forecasts touch, and why?
curl http://localhost:8088/watch

# Tap me when oil moves 3% — or any quake ≥ M6
curl -X POST http://localhost:8088/alerts -H 'content-type: application/json' \
     -d '{"kind":"market","name":"Oil ±3%","params":{"symbol":"CL=F","move_percent":3}}'
curl -X POST http://localhost:8088/alerts -H 'content-type: application/json' \
     -d '{"kind":"quake","name":"Big quakes","params":{"min_magnitude":6}}'

# Write today's Morning Brief right now
curl -X POST http://localhost:8088/brief/run

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
| `engine/` | The PYTHIA oracle — FastAPI. Pulls + fuses every feed (`osiris_intake`, `world_state`), runs the forecast and chat (`oracle`), deliberates with the persona council (`swarm`), keeps the track record (`ledger` — persist → judge → Brier), serves the API (`server`) and the MCP bridge (`mcp`). |
| `integrations/osiris/` | The overlay applied to an Osiris checkout — the predictions deck, chat, floating windows, map overlays, and API routes. See its `INSTALL.md`. |
| `run-all.sh` · `PYTHIA.app` | One-tap launchers. |

**Engine API** (`:8088`): `/agent/view` · `/agent/events` · `/predictions` · `/predict` · `/chat` · `/world` · `/scorecard` · `/state` (+ SSE `/state/stream`) · `/runs` · `/models` · `/model` · `/loop` · `/links` · `/config` · `/health` · `/docs` + `/openapi.json`. Full reference, parameters, and recipes are in **[For agents](#for-agents--give-your-agent-eyes-on-the-planet)**.

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
