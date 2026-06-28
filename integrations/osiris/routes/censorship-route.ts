import { NextResponse } from 'next/server';
import { byIso2 } from '@/lib/countryCentroids';

export const dynamic = 'force-dynamic';

/**
 * Internet censorship / network interference — OONI measurement anomalies
 * (blocking, throttling, shutdowns) by country. OONI API, free / NO API key.
 * Note: anomaly counts include measurement noise; treat as signal, not proof.
 */
export async function GET() {
  try {
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const r = await fetch(
      `https://api.ooni.org/api/v1/aggregation?since=${since}&axis_x=probe_cc&anomaly=true`,
      { signal: AbortSignal.timeout(20000) },
    );
    if (!r.ok) return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'OONI unavailable' });
    const j = await r.json();
    const rows: any[] = j?.result || [];
    const feats: any[] = [];
    for (const x of rows) {
      const n = x?.anomaly_count || 0;
      if (n < 2000) continue;                      // cut low-signal noise
      const c = byIso2(x?.probe_cc);
      if (!c) continue;
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: c },
        properties: { cc: x.probe_cc, anomalies: n, label: `${x.probe_cc}: ${n.toLocaleString()} network anomalies (14d)` },
      });
    }
    feats.sort((a, b) => b.properties.anomalies - a.properties.anomalies);
    const top = feats.slice(0, 40);
    const summary = top.slice(0, 8).map((f) => `${f.properties.cc} ${(f.properties.anomalies / 1000).toFixed(0)}k`).join(', ');
    return NextResponse.json(
      { type: 'FeatureCollection', features: top, summary, count: top.length },
      { headers: { 'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=21600' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'OONI fetch failed' });
  }
}
