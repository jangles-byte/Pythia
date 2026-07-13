import { NextResponse } from 'next/server';

/**
 * OSIRIS — Public-health early warning (free, no key). CDC's National Wastewater
 * Surveillance System (NWSS) measures SARS-CoV-2 in sewersheds — it leads clinical
 * case reports by ~1–2 weeks because people shed virus before they test. We read the
 * latest reporting window and rank jurisdictions by viral activity (percentile vs
 * each site's own history) and 15-day trend. The window's date is surfaced verbatim.
 * GET /api/wastewater
 */
export const dynamic = 'force-dynamic';

const DATASET = 'https://data.cdc.gov/resource/2ew6-ywp6.json';

type Region = { jurisdiction: string; percentile: number; risingPct: number; sites: number };

let cache: { ts: number; body: any } | null = null;
const TTL = 6 * 60 * 60_000; // 6h — CDC updates the series at most weekly

async function build() {
  const url = `${DATASET}?$select=wwtp_jurisdiction,date_end,percentile,ptc_15d&$order=date_end%20DESC&$limit=4000`;
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!r.ok) throw new Error('cdc ' + r.status);
  const rows: any[] = await r.json();
  if (!rows.length) return { asOf: '', national: null, regions: [], ts: Date.now() };

  const asOf = rows[0].date_end?.slice(0, 10) || '';
  // keep the freshest reporting batch (within 8 days of the newest sample)
  const cutoff = new Date(asOf).getTime() - 8 * 86_400_000;
  const recent = rows.filter(x => x.date_end && new Date(x.date_end).getTime() >= cutoff && x.percentile != null);

  // The raw fields are noisy: `percentile` occasionally exceeds its 0–100 definition and
  // `ptc_15d` explodes to millions of % when a site's baseline is ~0. So clamp percentile
  // to [0,100] and express trend as the *share of sites rising* — robust to those outliers.
  const validP = (v: string) => { const p = parseFloat(v); return !isNaN(p) && p >= 0 && p <= 100 ? p : null; };
  const agg = new Map<string, { p: number[]; up: number; tot: number }>();
  for (const x of recent) {
    const j = x.wwtp_jurisdiction; if (!j) continue;
    if (!agg.has(j)) agg.set(j, { p: [], up: 0, tot: 0 });
    const g = agg.get(j)!;
    const p = validP(x.percentile); if (p != null) g.p.push(p);
    const t = parseFloat(x.ptc_15d); if (!isNaN(t)) { g.tot++; if (t > 0) g.up++; }
  }
  const mean = (a: number[]) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  const regions: Region[] = [...agg.entries()]
    .map(([jurisdiction, g]) => ({
      jurisdiction,
      percentile: Math.round(mean(g.p) * 10) / 10,
      risingPct: g.tot ? Math.round((g.up / g.tot) * 100) : 0,
      sites: g.p.length,
    }))
    .filter(r => r.sites >= 2)
    .sort((a, b) => b.percentile - a.percentile);

  const allP = recent.map(x => validP(x.percentile)).filter((v): v is number => v != null);
  const allT = recent.map(x => parseFloat(x.ptc_15d)).filter(v => !isNaN(v));
  const national = {
    percentile: Math.round(mean(allP) * 10) / 10,
    risingPct: allT.length ? Math.round((allT.filter(v => v > 0).length / allT.length) * 100) : 0,
    sites: allP.length,
  };
  return { asOf, national, regions: regions.slice(0, 15), ts: Date.now() };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const body = await build();
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), national: null, regions: [] }, { status: 502 });
  }
}
