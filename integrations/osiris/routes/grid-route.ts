import { NextResponse } from 'next/server';

/**
 * OSIRIS — Energy & power grid (free, no key). Grid stress and the generation mix
 * are leading indicators: a grid leaning hard on fossil peakers signals demand
 * stress (heat/cold), while a renewable-heavy, low-carbon grid signals slack.
 *   • GB (National Grid ESO) — live carbon intensity + full generation mix
 *   • California (CAISO) — live fuel mix + renewable share (best-effort; keyless)
 * GET /api/grid
 */
export const dynamic = 'force-dynamic';

type Grid = {
  region: string; intensity: number | null; index: string;
  renewablePct: number; fossilPct: number; cleanPct: number;
  demandMW: number | null; mix: Record<string, number>;
};

let cache: { ts: number; body: any } | null = null;
const TTL = 5 * 60_000;

const RENEW = new Set(['wind', 'solar', 'hydro', 'biomass', 'geothermal']);
const FOSSIL = new Set(['gas', 'coal', 'oil', 'other']);
const CLEAN = new Set(['wind', 'solar', 'hydro', 'nuclear', 'biomass', 'geothermal']);

const pctBy = (mix: Record<string, number>, set: Set<string>) =>
  Math.round(Object.entries(mix).reduce((s, [k, v]) => s + (set.has(k) ? v : 0), 0));

async function gb(): Promise<Grid | null> {
  try {
    const [gen, inten] = await Promise.all([
      fetch('https://api.carbonintensity.org.uk/generation', { signal: AbortSignal.timeout(10000), cache: 'no-store' }).then(r => r.json()),
      fetch('https://api.carbonintensity.org.uk/intensity', { signal: AbortSignal.timeout(10000), cache: 'no-store' }).then(r => r.json()),
    ]);
    const mix: Record<string, number> = {};
    for (const x of (gen?.data?.generationmix || [])) mix[x.fuel] = x.perc;
    const it = inten?.data?.[0]?.intensity || {};
    return {
      region: 'Great Britain', intensity: it.actual ?? it.forecast ?? null, index: it.index || '',
      renewablePct: pctBy(mix, RENEW), fossilPct: pctBy(mix, FOSSIL), cleanPct: pctBy(mix, CLEAN),
      demandMW: null, mix,
    };
  } catch { return null; }
}

async function caiso(): Promise<Grid | null> {
  try {
    // CAISO "Today's Outlook" current fuel mix — public CSV, keyless
    const r = await fetch('https://www.caiso.com/outlook/current/fuelsource.csv', { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!r.ok) return null;
    const rows = (await r.text()).trim().split('\n').map(l => l.split(','));
    const head = rows[0].map(h => h.trim().toLowerCase());
    // last row with real numbers = latest 5-min interval
    let last: string[] | null = null;
    for (let i = rows.length - 1; i > 0; i--) { if (rows[i].some(c => c && !isNaN(Number(c)))) { last = rows[i]; break; } }
    if (!last) return null;
    const val = (name: string) => { const j = head.indexOf(name); return j >= 0 ? Number(last![j]) || 0 : 0; };
    // CAISO columns: Solar, Wind, Geothermal, Biomass, Biogas, Small hydro, Coal, Nuclear, Natural gas, Large hydro, Batteries, Imports, Other
    const mixMW: Record<string, number> = {
      solar: val('solar'), wind: val('wind'), geothermal: val('geothermal'),
      biomass: val('biomass') + val('biogas'), hydro: val('small hydro') + val('large hydro'),
      nuclear: val('nuclear'), gas: val('natural gas'), coal: val('coal'), other: val('other') + val('imports'),
    };
    const total = Object.values(mixMW).reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const mix: Record<string, number> = {};
    for (const [k, v] of Object.entries(mixMW)) mix[k] = Math.round((Math.max(0, v) / total) * 1000) / 10;
    return {
      region: 'California (CAISO)', intensity: null, index: '',
      renewablePct: pctBy(mix, RENEW), fossilPct: pctBy(mix, FOSSIL), cleanPct: pctBy(mix, CLEAN),
      demandMW: Math.round(total), mix,
    };
  } catch { return null; }
}

async function build() {
  const grids = (await Promise.all([gb(), caiso()])).filter(Boolean) as Grid[];
  return { grids, ts: Date.now() };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const body = await build();
    if (body.grids.length) cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), grids: [] }, { status: 502 });
  }
}
