import { NextResponse } from 'next/server';
import { byIso3 } from '@/lib/pythiaCentroids';

export const dynamic = 'force-dynamic';

/**
 * Extreme poverty — population below $2.15/day (%), by country.
 * World Bank Open Data (SI.POV.DDAY), free / NO API key.
 * Coverage is sparse (countries report in different years).
 */
export async function GET() {
  try {
    const r = await fetch(
      'https://api.worldbank.org/v2/country/all/indicator/SI.POV.DDAY?format=json&per_page=400&mrnev=1',
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
      if (!c) continue;
      const poverty = Math.round(v * 10) / 10;
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: c },
        properties: { country: x.country?.value, poverty, year: x.date, label: `${x.country?.value}: ${poverty}% in extreme poverty (${x.date})` },
      });
    }
    feats.sort((a, b) => b.properties.poverty - a.properties.poverty);
    const summary = feats.slice(0, 8).map((f) => `${f.properties.country} ${f.properties.poverty}%`).join(', ');
    return NextResponse.json(
      { type: 'FeatureCollection', features: feats, summary, count: feats.length },
      { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'World Bank fetch failed' });
  }
}
