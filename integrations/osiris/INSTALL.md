# Osiris integration overlay

PYTHIA is the engine in this repo **plus** a thin overlay for the
[Osiris](https://github.com/simplifaisoul/osiris) dashboard, which provides the live
globe + world feeds. These are the source files for the overlay (kept in sync with a
working install). Osiris itself is upstream — clone it separately, then apply this.

## New files to copy into your Osiris checkout
| File here | Goes to |
|---|---|
| `PythiaPanel.tsx` | `src/components/PythiaPanel.tsx` — the oracle / predictions deck |
| `DeliberationModal.tsx` | `src/components/DeliberationModal.tsx` — swarm deliberation popup (gauge + per-agent votes) |
| `PythiaStatus.tsx` | `src/components/PythiaStatus.tsx` — top-right status + model picker |
| `SwarmConfig.tsx` | `src/components/SwarmConfig.tsx` — per-persona swarm model picker (opened from the deck's hexagon button) |
| `CreditsModal.tsx` | `src/components/CreditsModal.tsx` — credits |
| `FloatingWindow.tsx` | `src/components/FloatingWindow.tsx` — movable/resizable window shell |
| `ChatBox.tsx` | `src/components/ChatBox.tsx` — chat with the oracle |
| `SplashScreen.tsx` | `src/components/SplashScreen.tsx` — fish-around-the-eye load screen |
| `HeadlineTicker.tsx` | `src/components/HeadlineTicker.tsx` — bottom world-headline ticker |
| `routes/engine-proxy-route.ts` | `src/app/api/engine/[...path]/route.ts` — same-origin proxy to the engine |
| `routes/polymarket-route.ts` | `src/app/api/polymarket/route.ts` — Polymarket crowd odds |
| `routes/futures-route.ts` | `src/app/api/futures/route.ts` — futures + term structure (Yahoo chart API, no key): oil, gas, gold, grains, equity futures, VIX; ~6-month curve read (contango/backwardation); geo-anchored to supply regions |
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
  **Forecast rings:** poll `/api/engine/predictions` (once on load + every 30s) into
  `data.pythia_predictions`, and add `predictions: true` / `predictions_all: false`
  to `activeLayers`.
- `src/app/globals.css` — **Doto** dot-matrix display/body font (`--font-display`/`--font-body`);
  a `body.theme-light` block (soft-Apple whites/greys, frosted glass) + `.pythia-ticker-bg`.
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
- `src/components/LayerPanel.tsx` — added "Storm / Flood Zones", "Conflict / War Zones"
  and "War Front / Territory" toggles; a new SOCIAL group of 9 keyless layers (Displacement,
  Disease Outbreaks, Inflation, Censorship, Civil Unrest, Food Insecurity, Unemployment,
  GDP Growth, Extreme Poverty); plus Recon Balloons, Radiation Monitors, News Intel toggles
  (every map layer now has a toggle); removed the SDK group and the theme toggle.
  **Forecast rings:** an ORACLE / "PYTHIA FORECAST" group at the top with
  "Forecast Rings (7 Days)" (`predictions`) and "+ Month / Year Rings" (`predictions_all`).
- `src/components/HeadlineTicker.tsx` rendered in `page.tsx`; mobile bottom-nav gains an
  ALERTS tab.
- `src/app/layout.tsx` + `public/manifest.json` — PYTHIA name/icons (home-screen).
- `src/app/api/markets/route.ts` — dropped the fake browser `User-Agent` from both Yahoo
  fetchers: Yahoo 429s "browser" UAs that arrive without cookies, so the route was silently
  living on its static-estimate fallbacks. A plain server-side fetch passes. (The new
  `futures` route does the same.)

All UI talks to the engine only through `/api/engine/*`, which forwards to
`PYTHIA_ENGINE_URL` (default `http://localhost:8088`).
