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
| `CreditsModal.tsx` | `src/components/CreditsModal.tsx` — credits |
| `FloatingWindow.tsx` | `src/components/FloatingWindow.tsx` — movable/resizable window shell |
| `ChatBox.tsx` | `src/components/ChatBox.tsx` — chat with the oracle |
| `SplashScreen.tsx` | `src/components/SplashScreen.tsx` — fish-around-the-eye load screen |
| `HeadlineTicker.tsx` | `src/components/HeadlineTicker.tsx` — bottom world-headline ticker |
| `routes/engine-proxy-route.ts` | `src/app/api/engine/[...path]/route.ts` — same-origin proxy to the engine |
| `routes/polymarket-route.ts` | `src/app/api/polymarket/route.ts` — Polymarket crowd odds |
| `routes/nws-alerts-route.ts` | `src/app/api/nws-alerts/route.ts` — NWS storm/flood polygon zones |
| `routes/frontlines-route.ts` | `src/app/api/frontlines/route.ts` — Ukraine territory control (DeepStateMap, no key) |

## Edits to existing Osiris files (high level)
- `src/app/page.tsx` — render `<PythiaStatus/>`, the floating windows, `<CreditsModal/>`;
  a right-toolbar with Layers/Chat/Markets/Alerts/PYTHIA(Eye)/Search buttons; globe-spin
  control by the 2D/Sat toggles; route news `onWatchFeed` to floating windows; pass
  `onLocate` to `PythiaPanel`; default the left Layers bar off (it opens as a right slideout).
- `src/components/OsirisMap.tsx` — `nws-alerts` + `frontlines` polygon sources with
  `nws-fill`/`nws-outline` and `frontline-fill`/`frontline-line` layers; a `spin` prop
  (rotate/smart); globe pitch set to 0 (no tilt).
- `src/components/LayerPanel.tsx` — added "Storm / Flood Zones", "Conflict / War Zones"
  and "War Front / Territory" toggles; removed the SDK group and the theme toggle.
- `src/components/HeadlineTicker.tsx` rendered in `page.tsx`; mobile bottom-nav gains an
  ALERTS tab.
- `src/app/layout.tsx` + `public/manifest.json` — PYTHIA name/icons (home-screen).

All UI talks to the engine only through `/api/engine/*`, which forwards to
`PYTHIA_ENGINE_URL` (default `http://localhost:8088`).
