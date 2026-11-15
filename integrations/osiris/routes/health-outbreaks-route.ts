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
      // WHO titles are free-form: "Ebola virus disease - Uganda" but also
      // "Ebola virus disease – Democratic Republic of the Congo" and "Cholera, Haiti".
      // Requiring an exact " - " silently dropped every en/em-dash and comma title.
      const parts = title.split(/\s+[-\u2013\u2014]\s+|\s*,\s*/).filter((p: string) => p.trim());
      if (parts.length < 2) continue;
      const disease = parts.slice(0, -1).join(', ').trim();
      const country = parts[parts.length - 1].trim();
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
