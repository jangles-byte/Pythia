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
| `SplashScreen.tsx` | `src/components/SplashScreen.tsx` — the halftone opening: a full-screen dot grid where dots grow in place to form a 3D eye with a rotating globe iris (continents, blink, glint); PYTHIA wordmark resolves beneath |
| `SignalRules.tsx` | `src/components/SignalRules.tsx` — the "tap me on the shoulder when…" rule builder (quake ≥ M / market move ±% / VIX level / forecast ≥ prob / keyword event) at the top of the Live Alerts panel; drives `/api/engine/alerts` |
| `SignalNotifier.tsx` | `src/components/SignalNotifier.tsx` — invisible always-mounted poller: turns fired rules + Morning Briefs (`/api/engine/alerts/feed`) into browser notifications. Rendered next to the tickers in `page.tsx` |
| `BriefPanel.tsx` | `src/components/BriefPanel.tsx` — the Morning Brief in the deck (sunrise button): latest digest, write-it-now, daily schedule (time + on/off). Imported by `PythiaPanel.tsx` |
| `TickerWindow.tsx` | `src/components/TickerWindow.tsx` — the floating always-on-top ticker window (opened from the tool strip): watchlist rows with sparklines, add/remove synced with the Watch tab. Rendered via the `'ticker'` FloatingWindow kind in `page.tsx` |
| `PatchPanel.tsx` | `src/components/PatchPanel.tsx` — My Patch (tool-strip pin button): set name/lat/lng/radius (localStorage), see only the events + forecasts inside it, click to fly |
| `lib/shareCard.ts` | `src/lib/shareCard.ts` — canvas share-card renderer (1200×630 branded PNG download); buttons live in `DeliberationModal` + `BriefPanel` |
| `tv-page.tsx` | `src/app/tv/page.tsx` — PYTHIA **Display Mode** (ambient kiosk): a slow equatorial spinning globe (`<OsirisMap>` with empty data + `spin.rotate` + `flyToLocation` zoom 1.5) behind live cards that **fade in/out at random** in the four corners + top/bottom banners — street cams, GOES weather, headlines, markets, storms, quakes, live TV news (embeddable feeds), and oracle forecasts. Scheduler staggers spawns (≤5 concurrent, one video max), no priority/ordering |
| `routes/kev-route.ts` | `src/app/api/kev/route.ts` — CISA Known Exploited Vulnerabilities (no key): newest actively-exploited CVEs, ransomware-flagged |
| `routes/faa-route.ts` | `src/app/api/faa-status/route.ts` — FAA airspace status (no key): ground stops / delay programs / closures at major US airports, geocoded |
| `RadarStrip.tsx` | `src/components/RadarStrip.tsx` — always-on radar chips in the deck: the highest-salience live event per domain, click to fly there. Imported by `PythiaPanel.tsx` |
| `HeadlineTicker.tsx` | `src/components/HeadlineTicker.tsx` — bottom world-headline ticker |
| `MarketTicker.tsx` | `src/components/MarketTicker.tsx` — rolling market ticker (indices · futures · crypto · FX + the engine watchlist) stacked above the headline ticker; keyless quotes via `/api/quotes`, hover to pause. Rendered next to `<HeadlineTicker/>` in `page.tsx` |
| `routes/engine-proxy-route.ts` | `src/app/api/engine/[...path]/route.ts` — same-origin proxy to the engine |
| `CamsNearby.tsx` | `src/components/CamsNearby.tsx` — "cameras near this location" modal: nearest public cams as an auto-refreshing still grid, click to enlarge. Opened from `LiveAlerts` (cams link) + `DeliberationModal` (Cams near). Uses `/api/cams?near=` |
| `SatelliteView.tsx` | `src/components/SatelliteView.tsx` — live NOAA GOES imagery window — 14 views (East/West CONUS + full-disk, regional sectors ne/se/taw/psw/hi, mesoscale M1/M2, and IR/AirMass/Sandwich bands), 2-min refresh. Rendered via the `'satellite'` FloatingWindow kind in `page.tsx` |
| `routes/cams-route.ts` | `src/app/api/cams/route.ts` — public camera directory (no keys): Caltrans (12 CA districts) + NYC TMC + London TfL + Ontario/Alberta 511 + DelDOT + NZ NZTA, ~4,000 cams normalized to `{name,lat,lng,img,video,src}`. `?near=lat,lng&radius_km=&limit=` returns nearest. Merged into the map's CCTV layer in `page.tsx` |
| `FilingsWindow.tsx` | `src/components/FilingsWindow.tsx` — the floating **SEC filings tape** (opened from the tool strip, Landmark icon): two tabs — **INSIDER** (Form 4 buy/sell/grant/exercise rows with company, ticker, insider, $ value; all/buys/sells filter) and **8-K** (material events) — across all public companies, click a row to open the filing on SEC.gov. Auto-refreshes on the route's cache cadence. Rendered via the `'filings'` FloatingWindow kind in `page.tsx` |
| `routes/edgar-route.ts` | `src/app/api/edgar/route.ts` — SEC EDGAR firehose (no key; **a contact email in the User-Agent is required or SEC 403s**): parses the `getcurrent` atom feeds for Form 4 + 8-K, dedupes each filing (listed twice — filer & issuer CIK) by its 18-digit accession folder, and enriches the ~20 newest Form 4s by fetching `form4.xml` for issuer/ticker/insider/transaction-code/shares/value (summed per transaction block). 150s cache |
| `ContractsWindow.tsx` | `src/components/ContractsWindow.tsx` — the floating **federal-money tape** (tool strip, Coins icon): **AWARDED** tab (top-100 USASpending contract awards) + **OPEN** tab (the *full* posted Grants.gov pool, ~1.3k). A **search box** filters recipient/agency/opportunity, and rows are grouped into **collapsible agency sections** (awarded sorted by total $, open by count; sticky headers; expand/collapse-all; sections auto-open while searching). Every row links out (`rel=noopener`, mousedown `stopPropagation` so the window drag never eats the click). Rendered via the `'contracts'` FloatingWindow kind in `page.tsx` |
| `routes/usaspending-route.ts` | `src/app/api/usaspending/route.ts` — federal money (no key): AWARDED = USASpending `spending_by_award` (top contracts, last 45d, links to `/award/{id}`); OPEN = Grants.gov `search2` posted opportunities. 30-min cache |
| `routes/kalshi-route.ts` | `src/app/api/kalshi/route.ts` — Kalshi regulated event-contract odds (public read, no key): `events?with_nested_markets` filtered to signal categories (drops sports/entertainment); yes-price (`*_dollars`) = crowd probability, ranked by `volume_24h_fp`. Third odds anchor alongside Polymarket/Manifold. 120s cache |
| `routes/grid-route.ts` | `src/app/api/grid/route.ts` — energy & power grid (no key): GB National Grid ESO carbon-intensity + generation mix, and CAISO `outlook/current/fuelsource.csv` fuel mix + demand; normalized to renewable/fossil/clean %. 5-min cache |
| `routes/wastewater-route.ts` | `src/app/api/wastewater/route.ts` — CDC NWSS wastewater early warning (Socrata `2ew6-ywp6`, no key): latest reporting window ranked by viral-activity percentile + share of sites rising; percentile clamped to 0–100 and trend as share-rising (raw `ptc_15d` explodes on ~0 baselines). Reporting date surfaced verbatim. 6h cache |
| `routes/climate-route.ts` | `src/app/api/climate/route.ts` — climate dials (no key): NOAA CPC ONI/ENSO ascii (El Niño/La Niña phase + trend) and US Drought Monitor CONUS coverage (D0–D4). 6h cache |
| `routes/geohazards-route.ts` | `src/app/api/geohazards/route.ts` — volcanoes + tsunamis (no key): USGS elevated volcano alert levels, **coordinates joined from the Smithsonian GVP WFS by volcano number** (USGS omits them), plus NOAA Tsunami Warning Center message feeds (National + Pacific atom). 5-min cache |
| `routes/ofac-route.ts` | `src/app/api/ofac/route.ts` — OFAC sanctions actions (no key): scrapes Treasury's `recent-actions` page for dated designations / de-listings / general licenses, classified by kind. Hourly cache |
| `routes/hackernews-route.ts` | `src/app/api/hackernews/route.ts` — Hacker News front page (Algolia HN Search API, no key): top stories by points — a tech-attention pulse. 5-min cache |
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
- `src/app/api/conflicts/route.ts` — **Stale-while-revalidate (2026-07):** GDELT enforces ~1 req/5s so a live conflict fetch takes 20–90s; the route used to run that on every request and time out on every engine cycle. Now it answers **instantly** from a module cache (static known-zones fallback on the first hit) and refreshes the live GDELT enrichment in the background at most once per 8 min (`buildBody` / `refresh` / `cache`).
- `src/components/OsirisMap.tsx` — **Spin yields to the user (2026-07):** the `rotate`-mode spin effect now binds `mousedown/touchstart/dragstart/wheel` → pause and `mouseup/touchend/dragend/zoomend/rotateend/pitchend` → resume-after-500ms, and the per-frame `setCenter` is skipped while `interacting` is true. So grabbing the globe stops the auto-spin instantly and it resumes a half-second after release (drag-inertia settles first). Listeners are cleaned up in the effect's return.
- `src/app/page.tsx` — **Floating windows + Display Mode (2026-07):** the `Win` kind union gains `'filings'` and `'contracts'` (with their icons/sizes/render branches → `<FilingsWindow/>` / `<ContractsWindow/>`), and the right tool strip gains **Filings** (Landmark), **Contracts** (Coins), and **Display Mode** (MonitorPlay → `window.open('/tv')`) buttons. Import `FilingsWindow`, `ContractsWindow`, and the `Landmark, Coins, MonitorPlay` lucide icons.
- `src/app/page.tsx` — **3D altitude:** `orbits3d` in `activeLayers` (**default true**), a Rocket tool-strip button toggling it, and `orbits3d` added to the satellite + flights fetch gates so the data loads when it's on.
  **Boot defaults (2026-07):** every layer in `activeLayers` defaults **on** except `terrain_3d` (heavy 3D buildings/terrain, stays off); globe `spin` defaults to `{ mode: 'rotate', speed: 3 }` (gentle auto-spin). The spin control is the **leftmost** map-view control — a 3-way segmented toggle (**Off · Spin · Snap**; snap = 'smart' jump-to-events) with the speed slider floated above it. The old Rocket tool-strip button for 3D altitude was removed (it's the SPACE-tab toggle now). Initial map zoom is **2.4** (wide 'just above the satellites' view); IP-geolocate flies to the user's region at that same zoom instead of zooming to street level.
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
- `src/components/OsirisMap.tsx` — **3D altitude layer (2026-07):** two `geojson` sources
  `alt-sats` + `alt-air` and matching `fill-extrusion` layers (`alt-sats-ext`/`alt-air-ext`)
  that raise satellites & aircraft off the globe. A `useEffect` keyed on `activeLayers.orbits3d`
  builds small octagonal chips whose `fill-extrusion-base` is set AT the object's real altitude
  (and `-height` = base + ~16km), so the dots **float off the surface with no line down and no
  forced camera tilt**. Satellites: `alt`km × 1000, clamped 6,000km so GEO stays on-screen while
  LEO is near-true; aircraft: `alt` is **meters**, × ~22 exaggeration to lift the thin air layer
  below LEO; satellites downsampled to ~2,200. Click handlers on both layers show name + altitude.
  `setVis(['alt-sats-ext','alt-air-ext'], orbits3d)`.
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
- `src/components/LayerPanel.tsx` — an **Off Earth / On Earth** pill toggle on the SPACE group's title line (flips `orbits3d`) controls how satellites are drawn — floating at real altitude vs flat on the surface — rather than being a separate layer row;
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
