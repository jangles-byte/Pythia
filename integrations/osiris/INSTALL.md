# Osiris integration overlay

PYTHIA is the engine in this repo **plus** a thin overlay for the
[Osiris](https://github.com/simplifaisoul/osiris) dashboard, which provides the live
globe + world feeds. These are the source files for the overlay (kept in sync with a
working install). Osiris itself is upstream — clone it separately, then apply this.

## New files to copy into your Osiris checkout
| File here | Goes to |
|---|---|
| `PanelModal.tsx` | `src/components/PanelModal.tsx` — the one big centered popup shell every dashboard panel opens in (backdrop + header + × + Esc); replaced the old edge slideouts |
| `PythiaPanel.tsx` | `src/components/PythiaPanel.tsx` — the oracle / predictions deck (renders inside `PanelModal` via its `embedded` prop; labeled toolbar, track-record stat row, 2-col forecast grid) |
| `DeliberationModal.tsx` | `src/components/DeliberationModal.tsx` — swarm deliberation popup (gauge + per-agent votes) |
| `PythiaStatus.tsx` | `src/components/PythiaStatus.tsx` — top-right status + model picker |
| `SwarmConfig.tsx` | `src/components/SwarmConfig.tsx` — per-persona swarm model picker (opened from the deck's hexagon button) |
| `WhatIfPanel.tsx` | `src/components/WhatIfPanel.tsx` — the Hypothetical field (opened from the deck's flask button): ask "what if…", check which personas deliberate, see narrative + knock-on forecasts. Imported by `PythiaPanel.tsx`, so no `page.tsx` change needed |
| `CouncilChamber.tsx` | `src/components/CouncilChamber.tsx` — watch the deliberation live (deck's gavel button, auto-opens when a pass deliberates): a vote matrix that fills in voice-by-voice from `/state`'s `deliberation` field; click a cell to read that voice's argument. Imported by `PythiaPanel.tsx` |
| `ForecastCalendar.tsx` | `src/components/ForecastCalendar.tsx` — month calendar (deck's calendar button): every open forecast lands on the day its window closes, colored by horizon; click a day for its docket, click a forecast for the deliberation modal. Imported by `PythiaPanel.tsx` |
| `ScorecardPanel.tsx` | `src/components/ScorecardPanel.tsx` — track record panel (opened from the deck's target button): Brier + hit rate, calibration chart, per-horizon/persona/model tables, recent verdicts |
| `LiveAlerts.tsx` | `src/components/LiveAlerts.tsx` — live alerts list (news / quakes / 20+ live TV feeds). Content-only: the old built-in collapse/maximize chrome is gone — it renders inside `PanelModal` (desktop) or the mobile sheet |
| `CreditsModal.tsx` | `src/components/CreditsModal.tsx` — credits |
| `FloatingWindow.tsx` | `src/components/FloatingWindow.tsx` — movable/resizable window shell |
| `ChatBox.tsx` | `src/components/ChatBox.tsx` — chat with the oracle, or put one council persona on the line (speaker dropdown above the input; sends `persona` to POST /chat, answered in that voice by that persona's model) |
| `SplashScreen.tsx` | `src/components/SplashScreen.tsx` — fish-around-the-eye load screen |
| `HeadlineTicker.tsx` | `src/components/HeadlineTicker.tsx` — bottom world-headline ticker |
| `MarketTicker.tsx` | `src/components/MarketTicker.tsx` — rolling market ticker (indices · futures · crypto · FX + the engine watchlist) stacked above the headline ticker; keyless quotes via `/api/quotes`, hover to pause. Rendered next to `<HeadlineTicker/>` in `page.tsx` |
| `routes/engine-proxy-route.ts` | `src/app/api/engine/[...path]/route.ts` — same-origin proxy to the engine |
| `routes/quotes-route.ts` | `src/app/api/quotes/route.ts` — arbitrary symbol quotes (Yahoo chart API, no key): `?symbols=AAPL,CL=F,BTC-USD` → price, day change %, intraday sparkline; 60s per-symbol cache. Feeds the market ticker + Watch tab |
| `routes/polymarket-route.ts` | `src/app/api/polymarket/route.ts` — Polymarket crowd odds |
| `routes/futures-route.ts` | `src/app/api/futures/route.ts` — futures + term structure (Yahoo chart API, no key): oil, gas, gold, grains, equity futures, VIX; ~6-month curve read (contango/backwardation); geo-anchored to supply regions |
| `routes/gdacs-alerts-route.ts` | `src/app/api/gdacs-alerts/route.ts` — GDACS disaster alerts (UN, no key): Red/Orange/Green severity + coords (bbox-center fallback for polygon episodes) |
| `routes/hurricanes-route.ts` | `src/app/api/hurricanes/route.ts` — NHC active storms + forecast-cone GeoJSON (no key) |
| `routes/flood-outlook-route.ts` | `src/app/api/flood-outlook/route.ts` — 30-day flood outlook for 22 major basins (Open-Meteo GloFAS, no key): forecast discharge vs recent median |
| `routes/wiki-attention-route.ts` | `src/app/api/wiki-attention/route.ts` — Wikipedia attention spikes (Wikimedia pageviews, no key) |
| `routes/manifold-route.ts` | `src/app/api/manifold/route.ts` — Manifold Markets crowd odds (no key; Metaculus dropped — its API now needs a token) |
| `routes/ioda-route.ts` | `src/app/api/ioda/route.ts` — country-level internet outages, last 24h (IODA / Georgia Tech, no key) |
| `routes/nws-alerts-route.ts` | `src/app/api/nws-alerts/route.ts` — NWS storm/flood polygon zones |
| `routes/frontlines-route.ts` | `src/app/api/frontlines/route.ts` — Ukraine territory control (DeepStateMap, no key) |
| `routes/displacement-route.ts` | `src/app/api/displacement/route.ts` — forced displacement / refugees (UNHCR, no key) |
| `routes/economy-route.ts` | `src/app/api/economy/route.ts` — cost-of-living inflation (World Bank, no key) |
| `routes/censorship-route.ts` | `src/app/api/censorship/route.ts` — internet censorship anomalies (OONI, no key) |
| `routes/health-outbreaks-route.ts` | `src/app/api/health-outbreaks/route.ts` — disease outbreaks (WHO, no key) |
| `routes/unrest-route.ts` | `src/app/api/unrest/route.ts` — civil unrest / protests (GDELT events, no key, no deps) |
| `routes/food-security-route.ts` | `src/app/api/food-security/route.ts` — food insecurity (WFP HungerMap, no key) |
| `routes/unemployment-route.ts` | `src/app/api/unemployment/route.ts` — unemployment (World Bank, no key) |
| `routes/gdp-growth-route.ts` | `src/app/api/gdp-growth/route.ts` — GDP growth (World Bank, no key) |
| `routes/poverty-route.ts` | `src/app/api/poverty/route.ts` — extreme poverty (World Bank, no key) |
| `lib/countryCentroids.ts` | `src/lib/countryCentroids.ts` — shared ISO3/ISO2/name → centroid for country layers |

## Edits to existing Osiris files (high level)
- `src/app/page.tsx` — render `<PythiaStatus/>`, the floating windows, `<CreditsModal/>`;
  a right-toolbar with Layers/Chat/Markets/Alerts/PYTHIA(Eye)/Search buttons; globe-spin
  control + a **light/dark theme toggle** (Sun) by the 2D/Sat toggles, persisted to
  localStorage as `pythia-theme` (`'core'|'light'`); route news `onWatchFeed` to floating
  windows; pass `onLocate` to `PythiaPanel`; default the left Layers bar off.
  **Big popups (2026-07):** Layers, Markets, Alerts and the PYTHIA deck open in
  `<PanelModal>` (import it) instead of the old `absolute right-12 w-80` slideouts —
  deck at width 1040 with `<PythiaPanel embedded …>`, Markets/Alerts at 820, Layers at
  720; `onLocate`/fly-to also calls `openOnly(null)` so the modal gets out of the way;
  `showPythia` defaults to **false** (a modal shouldn't cover the globe on boot).
  **Forecast rings:** poll `/api/engine/predictions` (once on load + every 30s) into
  `data.pythia_predictions`, and add `predictions: true` / `predictions_all: false`
  to `activeLayers`.
  **Hurricanes + flood:** `hurricanes: true` / `flood: true` in `activeLayers`, with
  layer-aware fetches of `/api/hurricanes` → `data.hurricanes` and `/api/flood-outlook`
  → `data.flood`.
- `src/app/globals.css` — `--font-body` is **Inter** (the whole UI reads like a product);
  the dot-matrix **Doto** stays only on `--font-display` (brand logotype / display accents);
  a `--horizon-year: #7E97E8` steel-blue token so the year horizon (and the Skeptic) read
  as a category, not a disabled grey; `@keyframes pythia-sweep` + `.pythia-progress`
  (the slim indeterminate sweep under the deck toolbar while the oracle works);
  a `body.theme-light` block (soft-Apple whites/greys, frosted glass) + `.pythia-ticker-bg`.
  The top-right HUD strip's `SYS:` badge reads LIVE/DEGRADED/SYNCING and treats
  "any data landed" (`dataVersion > 0`) as live, since not every fetch path sets
  `backendStatus`.
- `src/app/layout.tsx` — load the Doto + JetBrains Mono Google Fonts.
- `src/components/OsirisMap.tsx` — `nws-alerts` + `frontlines` polygon sources with
  `nws-fill`/`nws-outline` and `frontline-fill`/`frontline-line` layers; a `displacement`
  source + `displacement-circles` layer (sized by people displaced); social `economy`/
  `censorship`/`health`/`unrest`/`food`/`unemployment`/`gdp`/`poverty` circle layers;
  a `spin` prop; pitch 0; **light theme → CARTO Positron basemap** (dark-matter otherwise,
  switched via the `key={theme}` remount).
  **Forecast rings:** a `pythia-preds` source (added last, so the future renders on top)
  with `pred-glow`/`pred-ring`/`pred-core`/`pred-label` layers — ring radius scales with
  probability, color by horizon (24h red · week violet · month cyan · year grey), label is
  the probability %; a rAF loop pulses ring/glow opacity; click a ring for a popup with the
  statement, reasoning, location and a swarm-split warning. Features come from
  `data.pythia_predictions`, filtered to 24h+week ("next 7 days") unless
  `activeLayers.predictions_all` is on.
  **Hurricanes + flood:** `hurricanes` + `flood` geojson sources; NHC cones as dashed
  red `hurr-cone-fill`/`hurr-cone-line` polygons with `hurr-center`/`hurr-label` storm
  points, and `flood-circles` sized/shaded by the GloFAS risk ratio (≥1.5 shown);
  click popups for both.
- `src/components/LayerPanel.tsx` — added "Storm / Flood Zones", "Conflict / War Zones"
  and "War Front / Territory" toggles; a new SOCIAL group of 9 keyless layers (Displacement,
  Disease Outbreaks, Inflation, Censorship, Civil Unrest, Food Insecurity, Unemployment,
  GDP Growth, Extreme Poverty); plus Recon Balloons, Radiation Monitors, News Intel toggles
  (every map layer now has a toggle); removed the SDK group and the theme toggle.
  **Forecast rings:** an ORACLE / "PYTHIA FORECAST" group at the top with
  "Forecast Rings (7 Days)" (`predictions`) and "+ Month / Year Rings" (`predictions_all`).
  **Hazards:** "Hurricane Cones (NHC)" (`hurricanes`) and "Flood Outlook (30d)" (`flood`)
  in the HAZARD group.
- `src/components/HeadlineTicker.tsx` rendered in `page.tsx`; mobile bottom-nav gains an
  ALERTS tab.
- `src/app/layout.tsx` + `public/manifest.json` — PYTHIA name/icons (home-screen).
- `public/pythia-logo.png` — the header mark (top-left, rendered by `page.tsx`). Generate it
  with `python3 scripts/gen-header-logo.py` from the repo root (512px halftone-eye variant
  with a chunkier dot grid so it reads at 44px); the full-size brand mark is `logo.svg` /
  `logo.png` at the repo root (`scripts/gen-logo-svg.py` / `gen-logo-png.py`).
- `src/app/api/markets/route.ts` — dropped the fake browser `User-Agent` from both Yahoo
  fetchers: Yahoo 429s "browser" UAs that arrive without cookies, so the route was silently
  living on its static-estimate fallbacks. A plain server-side fetch passes. (The new
  `futures` route does the same.)
- `src/components/MarketsPanel.tsx` — fully replaced (copy `MarketsPanel.tsx` from here
  over the upstream file). Content-only now: the built-in collapse/maximize header is gone
  (it renders inside `PanelModal` / the mobile sheet); segmented section tabs; 2-col ticker
  grid; an **ODDS** tab with crowd probabilities from Polymarket (real money) + Manifold,
  sorted by volume, each a clickable row with an animated YES% bar and source/volume
  (fetches `/api/polymarket` + `/api/manifold` directly, refreshing every 3 min); and a
  **WATCH** tab (the default): the engine-persisted watchlist (add/remove, sparkline,
  price + day move per row via `/api/quotes`) plus **PYTHIA's Watch** — tickers the
  oracle's live forecasts touch (`GET /api/engine/watch`), each with the forecast,
  horizon and probability that flagged it.

All UI talks to the engine only through `/api/engine/*`, which forwards to
`PYTHIA_ENGINE_URL` (default `http://localhost:8088`).
