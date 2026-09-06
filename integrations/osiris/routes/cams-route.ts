import { NextRequest, NextResponse } from 'next/server';

/**
 * PYTHIA — the public cameras Osiris does not carry, loaded ON DEMAND by region.
 *
 * Osiris upstream owns the world: `/api/cctv` is ~30k cameras across 45 regional
 * sources (Caltrans, TfL, Canada, the southern tier, Spain, Thailand, Taiwan, Hong
 * Kong, OpenCCTV Asia…). This route is no longer a second copy of that — it carries
 * only the agencies upstream has no fetcher for, so the two compose instead of
 * fetching the same cameras twice:
 *
 *   NYC TMC · DelDOT · 511 for New York, Pennsylvania, Wisconsin, Idaho, Alaska
 *   and New England.
 *
 * Each source is registered with a bounding box; the map asks for a viewport
 * (`?bbox=`) or a point (`?near=`) and only the sources overlapping that area are
 * fetched — so the network scales without ever loading them all at once.
 *
 *   GET /api/cams?registry=1                 → lightweight source list (id/name/region/bbox)
 *   GET /api/cams?bbox=west,south,east,north → cameras in that viewport (map layer)
 *   GET /api/cams?near=lat,lng&radius_km&limit → nearest cameras to a point
 *   GET /api/cams?source=ny511               → one whole source
 */
export const dynamic = 'force-dynamic';

type Cam = { id: string; name: string; place?: string; lat: number; lng: number; img?: string; video?: string; src: string };

const TTL = 10 * 60_000;

async function j(url: string, timeout = 15000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(timeout), cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (PYTHIA-oracle; camera aggregator)', 'Accept': 'application/json,*/*' },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Older CARS/511 map UI: positions from /map/mapIcons/Cameras (item2[]), JPEG from /map/Cctv/{id}.
async function castleRockMap(host: string, src: string, region: string): Promise<Cam[]> {
  const data = await j(`https://${host}/map/mapIcons/Cameras`, 20000);
  const out: Cam[] = [];
  for (const c of (data?.item2 || [])) {
    // location is [lat, lng] — usually already an array, occasionally a JSON string
    const loc = Array.isArray(c.location) ? c.location
      : (() => { try { return JSON.parse(c.location); } catch { return null; } })();
    if (!Array.isArray(loc) || loc.length < 2) continue;
    const lat = Number(loc[0]), lng = Number(loc[1]);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    out.push({
      id: `${src.toLowerCase()}-${c.itemId}`,
      name: c.title || `${region} cam ${c.itemId}`,
      place: region, lat, lng,
      img: `https://${host}/map/Cctv/${c.itemId}`, src,
    });
  }
  return out;
}

async function deldot(): Promise<Cam[]> {
  const data = await j('https://tmc.deldot.gov/json/videocamera.json');
  const out: Cam[] = [];
  for (const c of data?.videoCameras || []) {
    const lat = c.latitude ?? c.lat, lng = c.longitude ?? c.lon ?? c.lng;
    if (lat == null || lng == null || c.enabled === false) continue;
    out.push({
      id: `de-${c.id}`, name: c.title || c.id, place: 'Delaware',
      lat, lng, video: c.urls?.m3u8s || c.urls?.m3u8 || undefined, src: 'DelDOT',
    });
  }
  return out;
}

async function nyc(): Promise<Cam[]> {
  const data = await j('https://webcams.nyctmc.org/api/cameras');
  return (data || [])
    .filter((c: any) => c.latitude != null && String(c.isOnline) === 'true')
    .map((c: any) => ({
      id: `nyc-${c.id}`, name: c.name, place: `${c.area || 'NYC'}, NY`,
      lat: c.latitude, lng: c.longitude, img: c.imageUrl, src: 'NYC TMC',
    }));
}

// Source registry: each region loads only when the map looks at it. bbox = [west, south, east, north]
type Source = { id: string; name: string; region: string; bbox: [number, number, number, number]; load: () => Promise<Cam[]> };
const cr = (host: string, src: string, region: string) => () => castleRockMap(host, src, region);
const SOURCES: Source[] = [
  { id: 'nyc', name: 'NYC TMC', region: 'New York City', bbox: [-74.3, 40.4, -73.6, 40.95], load: nyc },
  { id: 'deldot', name: 'DelDOT', region: 'Delaware', bbox: [-75.8, 38.4, -75, 39.9], load: deldot },
  { id: 'ny511', name: 'New York 511', region: 'New York', bbox: [-79.8, 40.4, -71.8, 45.1], load: cr('511ny.org', 'NY511', 'New York') },
  { id: 'pa511', name: 'Pennsylvania 511', region: 'Pennsylvania', bbox: [-80.6, 39.7, -74.6, 42.4], load: cr('511pa.com', 'PA511', 'Pennsylvania') },
  { id: 'wi511', name: 'Wisconsin 511', region: 'Wisconsin', bbox: [-92.9, 42.4, -86.8, 47.4], load: cr('511wi.gov', 'WI511', 'Wisconsin') },
  { id: 'id511', name: 'Idaho 511', region: 'Idaho', bbox: [-117.3, 41.9, -111, 49.1], load: cr('511.idaho.gov', 'ID511', 'Idaho') },
  { id: 'ak511', name: 'Alaska 511', region: 'Alaska', bbox: [-170, 51, -129, 72], load: cr('511.alaska.gov', 'AK511', 'Alaska') },
  { id: 'ne511', name: 'New England 511', region: 'New England', bbox: [-73.5, 40.9, -66.9, 47.5], load: cr('newengland511.org', 'NewEngland511', 'New England') },
];

const scache = new Map<string, { ts: number; cams: Cam[] }>();
async function loadSource(s: Source): Promise<Cam[]> {
  const c = scache.get(s.id);
  if (c && Date.now() - c.ts < TTL) return c.cams;
  const cams = await s.load().catch(() => [] as Cam[]);
  if (cams.length) scache.set(s.id, { ts: Date.now(), cams });
  return scache.get(s.id)?.cams || cams;
}
const bboxHit = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, d = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * d) / 2) ** 2
    + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lng2 - lng1) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  if (p.get('registry') != null) {
    return NextResponse.json({
      sources: SOURCES.map((s) => ({ id: s.id, name: s.name, region: s.region, bbox: s.bbox, cached: scache.get(s.id)?.cams.length ?? null })),
    });
  }

  const sourceId = p.get('source');
  if (sourceId) {
    const s = SOURCES.find((x) => x.id === sourceId);
    if (!s) return NextResponse.json({ error: 'unknown source' }, { status: 404 });
    const cams = await loadSource(s);
    return NextResponse.json({ count: cams.length, cams });
  }

  const near = p.get('near');
  if (near) {
    const [lat, lng] = near.split(',').map(parseFloat);
    if (!isFinite(lat) || !isFinite(lng)) return NextResponse.json({ error: 'near=lat,lng' }, { status: 400 });
    const radius = parseFloat(p.get('radius_km') || '120');
    const limit = Math.min(48, parseInt(p.get('limit') || '12', 10));
    const buf = radius / 85 + 1;
    const q = [lng - buf, lat - buf, lng + buf, lat + buf];
    const hits = SOURCES.filter((s) => bboxHit(s.bbox, q));
    const cams = (await Promise.all(hits.map(loadSource))).flat();
    const nearby = cams
      .map((c) => ({ ...c, distance_km: Math.round(haversine(lat, lng, c.lat, c.lng) * 10) / 10 }))
      .filter((c) => c.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);
    return NextResponse.json({ count: nearby.length, cams: nearby });
  }

  const bbox = p.get('bbox');
  if (bbox) {
    const q = bbox.split(',').map(Number);
    if (q.length !== 4 || q.some((n) => !isFinite(n))) return NextResponse.json({ error: 'bbox=west,south,east,north' }, { status: 400 });
    const hits = SOURCES.filter((s) => bboxHit(s.bbox, q));
    const cams = (await Promise.all(hits.map(loadSource))).flat()
      .filter((c) => c.lng >= q[0] && c.lng <= q[2] && c.lat >= q[1] && c.lat <= q[3]);
    return NextResponse.json({ count: cams.length, cams, sources: hits.map((s) => s.id) });
  }

  // Default (no params): load every source. Kept for callers that want the whole
  // supplementary set in one go; the map itself asks by viewport.
  const cams = (await Promise.all(SOURCES.map(loadSource))).flat();
  return NextResponse.json({ count: cams.length, cams });
}
