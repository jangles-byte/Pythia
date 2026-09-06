import { NextResponse } from 'next/server';
import { byIso3 } from '@/lib/pythiaCentroids';

export const dynamic = 'force-dynamic';

/**
 * Food insecurity — people with insufficient food consumption, by country.
 * WFP HungerMap Live (free / NO API key). metrics.fcs.people = headcount.
 */
export async function GET() {
  try {
    let j: any = null;
    for (let i = 0; i < 2 && !j?.body?.countries; i++) {        // endpoint is occasionally flaky
      const r = await fetch('https://api.hungermapdata.org/v1/foodsecurity/country', { signal: AbortSignal.timeout(20000) });
      if (r.ok) j = await r.json();
    }
    const countries: any[] = j?.body?.countries || [];
    if (!countries.length) return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'HungerMap unavailable' });
    const feats: any[] = [];
    for (const c of countries) {
      const people = c?.metrics?.fcs?.people;
      const iso3 = c?.country?.iso3;
      if (!people || !iso3) continue;
      const coord = byIso3(iso3);
      if (!coord) continue;
      const prevalence = Math.round((c.metrics.fcs.prevalence || 0) * 100);
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: coord },
        properties: { country: c.country.name, people, prevalence, label: `${c.country.name}: ${(people / 1e6).toFixed(1)}M food-insecure (${prevalence}%)` },
      });
    }
    feats.sort((a, b) => b.properties.people - a.properties.people);
    const summary = feats.slice(0, 8).map((f) => `${f.properties.country} ${(f.properties.people / 1e6).toFixed(1)}M`).join(', ');
    return NextResponse.json(
      { type: 'FeatureCollection', features: feats, summary, count: feats.length },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'HungerMap fetch failed' });
  }
}
