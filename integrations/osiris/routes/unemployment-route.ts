import { NextResponse } from 'next/server';
import { byIso3 } from '@/lib/pythiaCentroids';

export const dynamic = 'force-dynamic';

/**
 * Unemployment — total unemployment (% of labor force) by country.
 * World Bank Open Data (SL.UEM.TOTL.ZS), free / NO API key.
 */
export async function GET() {
  try {
    const r = await fetch(
      'https://api.worldbank.org/v2/country/all/indicator/SL.UEM.TOTL.ZS?format=json&per_page=400&mrnev=1',
      { signal: AbortSignal.timeout(15000) },
    );
    if (!r.ok) return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'World Bank unavailable' });
    const j = await r.json();
    const rows: any[] = Array.isArray(j) && j[1] ? j[1] : [];
    const feats: any[] = [];
    for (const x of rows) {
      const v = x?.value, iso3 = x?.countryiso3code;
      if (v == null || !iso3) continue;
      const c = byIso3(iso3);
      if (!c) continue;                                  // skips aggregates
      const unemployment = Math.round(v * 10) / 10;
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: c },
        properties: { country: x.country?.value, unemployment, year: x.date, label: `${x.country?.value}: ${unemployment}% unemployment (${x.date})` },
      });
    }
    feats.sort((a, b) => b.properties.unemployment - a.properties.unemployment);
    const summary = feats.slice(0, 8).map((f) => `${f.properties.country} ${f.properties.unemployment}%`).join(', ');
    return NextResponse.json(
      { type: 'FeatureCollection', features: feats, summary, count: feats.length },
      { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'World Bank fetch failed' });
  }
}
