import { NextResponse } from 'next/server';

/**
 * OSIRIS — Climate state (free, no key). Two slow-moving dials that steer seasons of
 * weather, crops, and commodity prices:
 *   • ENSO — NOAA CPC Oceanic Niño Index (El Niño / La Niña / Neutral) + trend
 *   • US Drought Monitor — CONUS coverage by severity (D0–D4)
 * GET /api/climate
 */
export const dynamic = 'force-dynamic';

let cache: { ts: number; body: any } | null = null;
const TTL = 6 * 60 * 60_000; // 6h — these update weekly/monthly

function phase(oni: number): string {
  if (oni >= 1.5) return 'Strong El Niño';
  if (oni >= 0.5) return 'El Niño';
  if (oni <= -1.5) return 'Strong La Niña';
  if (oni <= -0.5) return 'La Niña';
  return 'Neutral';
}

async function enso() {
  try {
    const txt = await fetch('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
      { signal: AbortSignal.timeout(10000), cache: 'no-store' }).then(r => r.text());
    const rows = txt.trim().split('\n').map(l => l.trim().split(/\s+/)).filter(c => c.length >= 4 && c[0] !== 'SEAS');
    if (rows.length < 2) return null;
    const last = rows[rows.length - 1], prev = rows[rows.length - 2];
    const oni = parseFloat(last[3]), prevOni = parseFloat(prev[3]);
    return { season: `${last[0]} ${last[1]}`, oni, phase: phase(oni), trend: Math.round((oni - prevOni) * 100) / 100 };
  } catch { return null; }
}

async function drought() {
  try {
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    const end = new Date(), start = new Date(Date.now() - 21 * 86_400_000);
    const url = `https://usdmdataservices.unl.edu/api/USStatistics/GetDroughtSeverityStatisticsByAreaPercent`
      + `?aoi=us&startdate=${fmt(start)}&enddate=${fmt(end)}&statisticsType=1`;
    const rows: any[] = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000), cache: 'no-store' }).then(r => r.json());
    if (!Array.isArray(rows) || !rows.length) return null;
    rows.sort((a, b) => new Date(b.mapDate).getTime() - new Date(a.mapDate).getTime());
    const r = rows[0];
    const n = (v: any) => Math.round((Number(v) || 0) * 10) / 10;
    // d0 is cumulative "D0 or worse"; d2 is "D2 or worse" (severe+)
    return {
      asOf: (r.validEnd || r.mapDate || '').slice(0, 10),
      anyDrought: n(r.d0), severePlus: n(r.d2), extremePlus: n(r.d3), exceptional: n(r.d4),
    };
  } catch { return null; }
}

async function build() {
  const [e, d] = await Promise.all([enso(), drought()]);
  return { enso: e, drought: d, ts: Date.now() };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const body = await build();
    if (body.enso || body.drought) cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), enso: null, drought: null }, { status: 502 });
  }
}
