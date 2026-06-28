import { NextResponse } from 'next/server';
import { byIso3 } from '@/lib/countryCentroids';

export const dynamic = 'force-dynamic';

/**
 * Cost-of-living stress — consumer-price inflation (annual %) by country.
 * World Bank Open Data (FP.CPI.TOTL.ZG), free / NO API key.
 */
export async function GET() {
  try {
    const r = await fetch(
      'https://api.worldbank.org/v2/country/all/indicator/FP.CPI.TOTL.ZG?format=json&per_page=400&mrnev=1',
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
      if (!c) continue;                                  // skips World Bank aggregates (regions/income groups)
      const inflation = Math.round(v * 10) / 10;
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: c },
        properties: { country: x.country?.value, inflation, year: x.date, label: `${x.country?.value}: ${inflation}% inflation (${x.date})` },
      });
    }
    feats.sort((a, b) => b.properties.inflation - a.properties.inflation);
    const summary = feats.slice(0, 8).map((f) => `${f.properties.country} ${f.properties.inflation}%`).join(', ');
    return NextResponse.json(
      { type: 'FeatureCollection', features: feats, summary, count: feats.length },
      { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'World Bank fetch failed' });
  }
}
