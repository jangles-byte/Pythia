import { NextResponse } from 'next/server';

/**
 * OSIRIS — Planetary vital signs (free, no key): atmospheric CO₂ (NOAA Mauna Loa
 * global trend) and global surface temperature anomaly (NASA GISTEMP). Slow-moving
 * "chronic health" indicators for the planet. GET /api/planet-vitals
 */
export const dynamic = 'force-dynamic';

let cache: { ts: number; body: any } | null = null;
const TTL = 6 * 60 * 60_000; // 6h — these update daily/monthly
const H = { 'User-Agent': 'Mozilla/5.0 (PYTHIA-oracle research)' };  // NASA/NOAA 403 without a UA

async function co2() {
  try {
    const txt = await fetch('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_trend_gl.txt',
      { headers: H, signal: AbortSignal.timeout(10000), cache: 'no-store' }).then(r => r.text());
    const rows = txt.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      .map(l => l.split(/\s+/)).filter(c => c.length >= 5);
    if (rows.length < 2) return null;
    const last = rows[rows.length - 1];
    const trend = parseFloat(last[4]);               // seasonally-adjusted trend ppm
    const date = `${last[0]}-${String(last[1]).padStart(2, '0')}-${String(last[2]).padStart(2, '0')}`;
    // ~1 year ago for the annual rise
    const yearAgo = rows[Math.max(0, rows.length - 366)];
    const yoy = yearAgo ? Math.round((trend - parseFloat(yearAgo[4])) * 10) / 10 : null;
    return { ppm: Math.round(trend * 100) / 100, date, yoy };
  } catch { return null; }
}

async function temp() {
  try {
    const csv = await fetch('https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv',
      { headers: H, signal: AbortSignal.timeout(10000), cache: 'no-store' }).then(r => r.text());
    const rows = csv.split('\n').map(l => l.split(',')).filter(c => /^\d{4}$/.test(c[0]));
    if (!rows.length) return null;
    const r = rows[rows.length - 1];                 // latest year row
    const year = r[0];
    let anomaly: number | null = null, monthIdx = 0;
    for (let m = 1; m <= 12; m++) {                  // last non-*** monthly value
      const v = parseFloat(r[m]);
      if (!isNaN(v)) { anomaly = v; monthIdx = m; }
    }
    if (anomaly == null) return null;
    return { anomaly, month: `${year}-${String(monthIdx).padStart(2, '0')}` };
  } catch { return null; }
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const [c, t] = await Promise.all([co2(), temp()]);
    const body = { co2: c, temp: t, ts: Date.now() };
    if (c || t) cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ co2: null, temp: null, error: String(e) }, { status: 200 });
  }
}
