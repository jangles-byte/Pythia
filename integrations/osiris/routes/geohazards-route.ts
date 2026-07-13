import { NextResponse } from 'next/server';

/**
 * OSIRIS — Volcanoes + tsunamis (free, no key). The natural-hazard gap:
 *   • Volcanoes — USGS elevated alert levels (US observatories), coordinates joined
 *     from the Smithsonian GVP volcano database by volcano number.
 *   • Tsunamis — NOAA Tsunami Warning Center message feeds (National + Pacific).
 * GET /api/geohazards
 */
export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (PYTHIA-oracle research; pythia@localhost)';

type Volcano = { name: string; lat: number | null; lng: number | null; color: string; level: string; observatory: string; sent: string; url: string };
type Tsunami = { title: string; level: string; issued: string; url: string };

let cache: { ts: number; body: any } | null = null;
const TTL = 5 * 60_000;

async function volcanoes(): Promise<Volcano[]> {
  const list: any[] = await fetch('https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes',
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000), cache: 'no-store' }).then(r => r.json());
  if (!Array.isArray(list) || !list.length) return [];
  // coordinates aren't in the USGS payload — join them from Smithsonian GVP by volcano number
  const vnums = [...new Set(list.map(v => v.vnum).filter(Boolean))];
  const coords = new Map<string, [number, number]>();
  try {
    const cql = encodeURIComponent(`Volcano_Number IN (${vnums.join(',')})`);
    const g = await fetch(`https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&CQL_FILTER=${cql}`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000), cache: 'no-store' }).then(r => r.json());
    for (const f of (g.features || [])) {
      const vn = String(f.properties?.Volcano_Number ?? '');
      const c = f.geometry?.coordinates;
      if (vn && c) coords.set(vn, [c[0], c[1]]);
    }
  } catch { /* coords optional */ }
  return list.map((v: any): Volcano => {
    const c = coords.get(String(v.vnum));
    return {
      name: v.volcano_name || 'Volcano',
      lng: c ? c[0] : null, lat: c ? c[1] : null,
      color: (v.color_code || '').toUpperCase(),
      level: (v.alert_level || '').toUpperCase(),
      observatory: (v.obs_abbr || '').toUpperCase(),
      sent: (v.sent_utc || '').slice(0, 16),
      url: `https://volcanoes.usgs.gov/volcanoes/${(v.volcano_name || '').toLowerCase().replace(/\s+/g, '_')}/`,
    };
  });
}

async function tsunamis(): Promise<Tsunami[]> {
  const feeds = ['https://www.tsunami.gov/events/xml/PAAQAtom.xml', 'https://www.tsunami.gov/events/xml/PHEBAtom.xml'];
  const out: Tsunami[] = [];
  const seen = new Set<string>();
  for (const url of feeds) {
    try {
      const xml = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000), cache: 'no-store' }).then(r => r.text());
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const e = m[1];
        const title = (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        const updated = e.match(/<updated>([^<]+)<\/updated>/)?.[1] || '';
        const link = e.match(/<link[^>]*href="([^"]+)"/)?.[1] || 'https://www.tsunami.gov';
        if (!title || seen.has(title)) continue;
        seen.add(title);
        const t = title.toLowerCase();
        const level = t.includes('warning') ? 'WARNING' : t.includes('advisory') ? 'ADVISORY'
          : t.includes('watch') ? 'WATCH' : 'INFORMATION';
        out.push({ title, level, issued: updated.slice(0, 16), url: link });
      }
    } catch { /* one center may be down */ }
  }
  return out.slice(0, 12);
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const [v, t] = await Promise.allSettled([volcanoes(), tsunamis()]);
    const body = {
      volcanoes: v.status === 'fulfilled' ? v.value : [],
      tsunamis: t.status === 'fulfilled' ? t.value : [],
      ts: Date.now(),
    };
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), volcanoes: [], tsunamis: [] }, { status: 502 });
  }
}
