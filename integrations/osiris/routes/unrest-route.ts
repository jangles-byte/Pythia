import { NextResponse } from 'next/server';
import zlib from 'node:zlib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Civil unrest / protests — GDELT 2.0 Events (free / NO API key).
 * Aggregates the last few hours of 15-minute exports, keeps CAMEO root code 14
 * (PROTEST), and plots by each event's ActionGeo coordinates. Zip is inflated
 * with Node's built-in zlib (no dependency).
 */

// Minimal single-entry ZIP reader via the central directory.
function unzipFirst(buf: Buffer): Buffer | null {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) return null;
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) return null;
  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const localOff = buf.readUInt32LE(cd + 42);
  if (buf.readUInt32LE(localOff) !== 0x04034b50) return null;
  const nameLen = buf.readUInt16LE(localOff + 26);
  const extraLen = buf.readUInt16LE(localOff + 28);
  const start = localOff + 30 + nameLen + extraLen;
  const comp = buf.subarray(start, start + compSize);
  return method === 8 ? zlib.inflateRawSync(comp) : method === 0 ? Buffer.from(comp) : null;
}

// the 16-file aggregation is expensive — compute at most once per cache window so
// the engine's per-feed timeout (and repeat callers) hit warm data instantly.
let CACHE: { ts: number; body: any } | null = null;
const TTL = 15 * 60 * 1000;

export async function GET() {
  if (CACHE && Date.now() - CACHE.ts < TTL) return NextResponse.json(CACHE.body);
  try {
    const lu = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', { signal: AbortSignal.timeout(12000) });
    if (!lu.ok) return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'GDELT unavailable' });
    const stamp = (await lu.text()).match(/(\d{14})\.export\.CSV\.zip/)?.[1];
    if (!stamp) return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'no export stamp' });

    const base = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(8, 10), +stamp.slice(10, 12));
    const p = (n: number) => String(n).padStart(2, '0');
    const urls = Array.from({ length: 16 }, (_, k) => {       // last 16 files = ~4 hours
      const t = new Date(base - k * 15 * 60000);
      return `http://data.gdeltproject.org/gdeltv2/${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}00.export.CSV.zip`;
    });

    const bufs = await Promise.allSettled(
      urls.map((u) => fetch(u, { signal: AbortSignal.timeout(15000) }).then((r) => (r.ok ? r.arrayBuffer() : null))),
    );
    const agg = new Map<string, any>();
    for (const b of bufs) {
      if (b.status !== 'fulfilled' || !b.value) continue;
      let csv: Buffer | null;
      try { csv = unzipFirst(Buffer.from(b.value)); } catch { continue; }
      if (!csv) continue;
      for (const row of csv.toString('utf8').split('\n')) {
        const f = row.split('\t');
        if (f.length < 61 || f[28] !== '14') continue;        // CAMEO root 14 = PROTEST
        const lat = parseFloat(f[56]), lng = parseFloat(f[57]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const place = f[52] || 'Unknown';
        const articles = parseInt(f[33], 10) || 0;
        const cur = agg.get(place);
        if (cur) { cur.articles += articles; cur.events += 1; }
        else agg.set(place, { place, lat, lng, articles, events: 1, url: f[60] || '' });
      }
    }
    const rows = [...agg.values()].sort((a, b) => b.articles - a.articles).slice(0, 70);
    const features = rows.map((r) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { place: r.place, events: r.events, articles: r.articles, url: r.url, label: `Protest activity — ${r.place} (${r.events})` },
    }));
    const summary = rows.slice(0, 8).map((r) => r.place.split(',')[0]).join(', ');
    const body = { type: 'FeatureCollection', features, summary, count: features.length };
    CACHE = { ts: Date.now(), body };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } });
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'GDELT fetch failed' });
  }
}
