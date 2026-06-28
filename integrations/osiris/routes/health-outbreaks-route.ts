import { NextResponse } from 'next/server';
import { byName } from '@/lib/countryCentroids';

export const dynamic = 'force-dynamic';

/**
 * Disease outbreaks — WHO Disease Outbreak News (free / NO API key).
 * Titles read "Disease - Country"; we split off the country and plot it.
 */
export async function GET() {
  try {
    const url = 'https://www.who.int/api/news/diseaseoutbreaknews'
      + '?sf_culture=en&%24orderby=PublicationDateAndTime%20desc&%24top=50'
      + '&%24select=Title,PublicationDateAndTime';
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'WHO unavailable' });
    const j = await r.json();
    const items: any[] = j?.value || [];
    const feats: any[] = [];
    const summaryBits: string[] = [];
    for (const it of items) {
      const title: string = it?.Title || '';
      const idx = title.lastIndexOf(' - ');
      if (idx < 0) continue;
      const disease = title.slice(0, idx).trim();
      const country = title.slice(idx + 3).trim();
      if (summaryBits.length < 8) summaryBits.push(`${disease} (${country})`);
      const c = byName(country);                         // "Global"/"Multi-country" have no centroid -> oracle-only
      if (!c) continue;
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: c },
        properties: { disease, country, date: it.PublicationDateAndTime, label: `${disease} — ${country}` },
      });
    }
    return NextResponse.json(
      { type: 'FeatureCollection', features: feats, summary: summaryBits.join(', '), count: feats.length },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'WHO fetch failed' });
  }
}
