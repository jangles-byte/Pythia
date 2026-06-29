---
name: pythia
description: >-
  Use PYTHIA to see the live state of the whole planet and read its forecasts of
  what happens next. Invoke this skill WHENEVER the task needs real-world,
  up-to-the-minute context or a prediction about the future — e.g. armed
  conflict, wars, geopolitics, disasters, earthquakes, storms/floods, wildfires,
  markets (oil, stocks, commodities, crypto, Polymarket odds), cyber threats,
  displacement/refugees, disease outbreaks, civil unrest, food insecurity, or any
  "what is happening right now / what is likely to happen / where" question.
  PYTHIA is a local HTTP service at http://localhost:8088 — no keys, no SDK.
---

# PYTHIA — eyes on the planet + forecasts

PYTHIA is a local service that ingests everything happening on Earth in real time
(news, conflict, weather, seismic, markets, cyber, humanitarian feeds, and more)
and forecasts what happens next across four horizons: **24h, week, month, year**.

You talk to it over plain HTTP + JSON. **Everything lives at one address:**

```
http://localhost:8088
```

No API key. No SDK. No auth header. Just `curl` (or any HTTP client).

---

## ⭐ THE GOLDEN RULE — start here every time

When you need to know what's going on in the world, or what's likely to happen,
make THIS one call first:

```bash
curl -s http://localhost:8088/agent/view
```

That single JSON payload is your situational awareness. It contains:

| Field | What it is |
|---|---|
| `summary` | a prose brief of the whole world right now |
| `events_by_domain` | every live event grouped by domain, each with `lat`/`lng` |
| `domains` | the active domains and how many events each has |
| `event_count` | how many live events are loaded |
| `predictions` | PYTHIA's current forecasts (see shape below) |
| `model` | which local model is currently the oracle |
| `generated_at` | epoch-ms timestamp of the last oracle pass |
| `live_stream` | path to the SSE stream (`/state/stream`) for live updates |

**90% of the time, `/agent/view` is the only call you need.** Read it, then answer
the user from it. Only reach for the other endpoints below when you need something
more specific (a filter, a fresh forecast, or to ask a question).

---

## Before you trust the data — one quick check

If you're not sure the service is up, run:

```bash
curl -s http://localhost:8088/health     # → {"status":"ok", ...} means it's alive
curl -s http://localhost:8088/links      # → engine/osiris/oracle booleans + counts
```

- `/health` returns `{"status":"ok", ...}` when the engine is running.
- `/links` tells you whether the data feeds (`osiris`) and the model (`oracle`) are
  connected, plus `prediction_count` and whether it's currently `generating`.

If `/health` does not respond at all, PYTHIA isn't running. **Do not guess world
facts — tell the user PYTHIA appears to be offline at `http://localhost:8088`.**

---

## Full endpoint reference

All paths are under `http://localhost:8088`.

| Method & path | Query / body | Returns |
|---|---|---|
| `GET /agent/view` | — | **the whole world in one payload** (see Golden Rule) |
| `GET /agent/events` | `domain`, `source`, `min_salience`, `since` (epoch ms), `limit` | live events, most-salient first, + `domains_available` |
| `GET /predictions` | `horizon`, `min_probability` | forecasts + valid `horizons` + the world brief |
| `POST /predict` | — (no body) | triggers a fresh forecast → `{"status":"started"}` |
| `POST /chat` | `{"message":"…","history":[]}` | `{"answer":"…"}` — grounded in every live feed + forecasts |
| `GET /world` | — | the assembled world brief (prose `text`, `domains`, counts) |
| `GET /state` | — | full snapshot — predictions + world + runs + flags |
| `GET /state/stream` | — | **SSE** stream: a snapshot, then live deltas |
| `GET /runs` | — | the last 20 oracle passes (stage, trigger, timing) |
| `GET /models` | — | installed local models + the current one |
| `POST /model` | `{"model":"name"}` | switch the oracle's model |
| `POST /loop` | `{"enabled":true}` | toggle continuous auto-forecasting |
| `GET /config` | — | model, horizons, refresh intervals, Osiris URL |
| `GET /health` | — | service status |
| `GET /links` | — | liveness booleans + counts |
| `GET /docs`, `GET /openapi.json` | — | Swagger UI + full machine-readable spec |

---

## Object shapes (so you parse the JSON correctly)

**Event** (from `/agent/events`):
```json
{
  "title": "…", "summary": "…", "category": "conflict",
  "source": "gdelt", "lat": 50.4, "lng": 30.5,
  "salience": 0.0_to_1.0, "ts": 1719600000000, "url": "https://…"
}
```
> In `/agent/view` the events are grouped under `events_by_domain` and carry
> `title, summary, source, lat, lng, salience, ts` (the domain is the group key).

**Prediction** (from `/agent/view` and `/predictions`):
```json
{
  "statement": "…what may happen…",
  "horizon": "24h | week | month | year",
  "probability": 0.0_to_1.0,
  "reasoning": "…why…",
  "location": "Strait of Hormuz", "lat": 26.5, "lng": 56.2,
  "base_probability": 0.0_to_1.0,
  "split": false,
  "agents": [
    {"name": "Strategist", "probability": 0.0_to_1.0, "note": "…"},
    {"name": "Economist",  "probability": 0.0_to_1.0, "note": "…"},
    {"name": "Naturalist", "probability": 0.0_to_1.0, "note": "…"},
    {"name": "Skeptic",    "probability": 0.0_to_1.0, "note": "…"}
  ]
}
```

**The swarm:** every prediction is re-judged by four specialist agents —
**Strategist** (geopolitics/conflict), **Economist** (markets/macro),
**Naturalist** (disasters/weather/health), **Skeptic** (base rates / reality
check). `probability` is the consensus; `base_probability` was the oracle's first
guess; `split: true` means the agents disagreed sharply — surface that as
genuine uncertainty.

---

## ‼️ CRITICAL — things that trip agents up (read these)

1. **All probabilities and salience are 0–1, NOT percentages.** `0.7` means 70%.
   Multiply by 100 only when showing a human.
2. **`POST /predict` is asynchronous.** It returns `{"status":"started"}`
   immediately and the forecast keeps running in the background. It does **not**
   return predictions. A full pass takes roughly **30–60 seconds**. To get fresh
   results: trigger it, wait, *then* read `/agent/view` or `/predictions`. Do not
   read instantly and report "no predictions."
3. **You usually do NOT need `/predict`.** PYTHIA already forecasts on its own and
   keeps a live world brief refreshed continuously. Just read `/agent/view`.
   Only call `/predict` when the user explicitly wants a brand-new forecast *now*.
4. **Visibility ≠ availability.** The map UI has layer toggles, but the engine
   senses *every* feed regardless. The API always returns the full world — never
   tell the user a domain is missing just because it isn't on the globe.
5. **Discover, don't guess.** `/agent/events` returns `domains_available`,
   `/predictions` returns the valid `horizons`, `/models` lists models. Read those
   instead of inventing domain or horizon names.
6. **Valid horizons are exactly:** `24h`, `week`, `month`, `year`. Nothing else.
7. **Don't fabricate.** If PYTHIA is offline or a field is empty, say so. Never
   invent world events or probabilities. The whole point of this skill is to
   ground answers in real data.
8. **POST bodies are JSON** — always send `-H 'content-type: application/json'`.

---

## Copy-paste recipes

```bash
# 1. The default move: full world view (use this first, almost always)
curl -s http://localhost:8088/agent/view

# 2. Only high-salience conflict events, top 20, with coordinates
curl -s 'http://localhost:8088/agent/events?domain=conflict&min_salience=0.7&limit=20'

# 3. This-week forecasts the oracle is at least 60% confident on
curl -s 'http://localhost:8088/predictions?horizon=week&min_probability=0.6'

# 4. Ask PYTHIA a grounded question (it sees every live feed + its forecasts)
curl -s -X POST http://localhost:8088/chat \
  -H 'content-type: application/json' \
  -d '{"message":"What is most likely to escalate in the next 24 hours, and where?"}'

# 5. Force a brand-new forecast, wait for it, THEN read it
curl -s -X POST http://localhost:8088/predict     # → {"status":"started"}
sleep 45
curl -s http://localhost:8088/agent/view

# 6. What domains are even available right now? (discovery)
curl -s 'http://localhost:8088/agent/events?limit=1'   # read the "domains_available" array

# 7. Stream live changes as the world moves (Server-Sent Events)
curl -sN http://localhost:8088/state/stream

# 8. See / switch the oracle's brain
curl -s http://localhost:8088/models
curl -s -X POST http://localhost:8088/model -H 'content-type: application/json' -d '{"model":"llama3.1:70b"}'
```

---

## Decision guide — which call do I make?

- "What's happening in the world / give me context / what's the situation?"
  → **`GET /agent/view`**
- "What's likely to happen (next day/week/month/year)? What does it predict?"
  → **`GET /agent/view`** (read `predictions`) or **`GET /predictions?horizon=…`**
- "Only show me [conflict / disasters / markets / cyber / …] events."
  → **`GET /agent/events?domain=…`**
- "Answer this specific question about the world."
  → **`POST /chat`** with `{"message":"…"}`
- "Make a fresh prediction right now."
  → **`POST /predict`**, then wait ~45s, then **`GET /agent/view`**
- "React continuously as things change."
  → **`GET /state/stream`** (SSE)
- "Is PYTHIA even up?"
  → **`GET /health`** then **`GET /links`**

When in doubt: call `GET /agent/view`, read the `summary` and `predictions`, and
answer from that.

---

## How to present results to the user

- Lead with the prose `summary` for context, then the most relevant events
  (highest `salience`) and predictions (highest `probability`).
- Convert 0–1 values to percentages for humans (`0.72` → "72%").
- For a prediction, give the `statement`, the `probability`, the `horizon`, the
  `location`, and the `reasoning`. If `split` is true, note that the swarm
  disagreed (real uncertainty).
- Cite that this is from PYTHIA's live world model — it's grounded, not your guess.
