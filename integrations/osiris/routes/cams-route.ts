import { NextRequest, NextResponse } from 'next/server';

/**
 * OSIRIS — public camera directory (free, no keys), loaded ON DEMAND by region.
 * Each source is registered with a bounding box; the map asks for a viewport (`?bbox=`)
 * or a point (`?near=`) and only the sources overlapping that area are fetched — so
 * the network scales to any number of cameras without ever loading them all at once
 * (which is also why the big state feeds no longer starve each other under load).
 *
 *   GET /api/cams?registry=1                 → lightweight source list (id/name/region/bbox)
 *   GET /api/cams?bbox=west,south,east,north → cameras in that viewport (map layer)
 *   GET /api/cams?near=lat,lng&radius_km&limit → nearest cameras to a point
 *   GET /api/cams?source=fl511               → one whole source
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

async function caltrans(): Promise<Cam[]> {
  const districts = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11', 'd12'];
  const out: Cam[] = [];
  const batches = await Promise.all(districts.map((d) =>
    j(`https://cwwp2.dot.ca.gov/data/${d}/cctv/cctvStatus${d.toUpperCase()}.json`)));
  batches.forEach((data, i) => {
    for (const row of data?.data || []) {
      const c = row?.cctv;
      const loc = c?.location, img = c?.imageData;
      const lat = parseFloat(loc?.latitude), lng = parseFloat(loc?.longitude);
      const still = img?.static?.currentImageURL;
      if (!isFinite(lat) || !isFinite(lng) || !still) continue;
      out.push({
        id: `ca-${districts[i]}-${c.index}`,
        name: (loc.locationName || '').replace(/^TV\d+\s*--\s*/, ''),
        place: loc.nearbyPlace ? `${loc.nearbyPlace}, CA` : 'California',
        lat, lng, img: still,
        video: img?.streamingVideoURL || undefined,
        src: 'Caltrans',
      });
    }
  });
  return out;
}

// Newer CARS "ONE" API (Ontario/Alberta): /api/v2/get/cameras with image Views inline.
async function castleRock(base: string, src: string, region: string): Promise<Cam[]> {
  const data = await j(`${base}/api/v2/get/cameras?format=json`);
  const out: Cam[] = [];
  for (const c of data || []) {
    const view = (c.Views || []).find((v: any) => v.Status === 'Enabled') || (c.Views || [])[0];
    if (!view?.Url || c.Latitude == null) continue;
    out.push({
      id: `${src.toLowerCase()}-${c.Id}`,
      name: c.Location || c.Roadway || `Camera ${c.Id}`,
      place: region, lat: c.Latitude, lng: c.Longitude,
      img: view.Url, src,
    });
  }
  return out;
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

async function tfl(): Promise<Cam[]> {
  const data = await j('https://api.tfl.gov.uk/Place/Type/JamCam');
  const out: Cam[] = [];
  for (const c of data || []) {
    const img = (c.additionalProperties || []).find((p: any) => p.key === 'imageUrl')?.value;
    const video = (c.additionalProperties || []).find((p: any) => p.key === 'videoUrl')?.value;
    if (!img || c.lat == null) continue;
    out.push({
      id: `tfl-${c.id}`, name: (c.commonName || '').replace(/^JamCams?\s*[-–]?\s*/i, ''),
      place: 'London, UK', lat: c.lat, lng: c.lon, img, video: video || undefined, src: 'TfL',
    });
  }
  return out;
}

async function nzta(): Promise<Cam[]> {
  const data = await j('https://trafficnz.info/service/traffic/rest/4/cameras/all');
  const out: Cam[] = [];
  for (const c of data?.response?.camera || []) {
    if (c.latitude == null || !c.imageUrl) continue;
    const img = String(c.imageUrl).startsWith('http') ? c.imageUrl : `https://trafficnz.info${c.imageUrl}`;
    out.push({
      id: `nz-${c.id}`, name: c.description || c.name || `Camera ${c.id}`,
      place: `${c.region || 'New Zealand'}`, lat: c.latitude, lng: c.longitude, img, src: 'NZTA',
    });
  }
  return out;
}

// Source registry: each region loads only when the map looks at it. bbox = [west, south, east, north]
type Source = { id: string; name: string; region: string; bbox: [number, number, number, number]; load: () => Promise<Cam[]> };
const cr = (host: string, src: string, region: string) => () => castleRockMap(host, src, region);
const SOURCES: Source[] = [
  { id: 'caltrans', name: 'Caltrans', region: 'California', bbox: [-124.5, 32.5, -114, 42], load: caltrans },
  { id: 'ontario', name: 'Ontario 511', region: 'Ontario', bbox: [-95.2, 41.6, -74.3, 56.9], load: () => castleRock('https://511on.ca', 'Ontario511', 'Ontario, CA') },
  { id: 'alberta', name: 'Alberta 511', region: 'Alberta', bbox: [-120, 48.9, -110, 60], load: () => castleRock('https://511.alberta.ca', 'Alberta511', 'Alberta, CA') },
  { id: 'deldot', name: 'DelDOT', region: 'Delaware', bbox: [-75.8, 38.4, -75, 39.9], load: deldot },
  { id: 'nyc', name: 'NYC TMC', region: 'New York City', bbox: [-74.3, 40.4, -73.6, 40.95], load: nyc },
  { id: 'tfl', name: 'London TfL', region: 'London, UK', bbox: [-0.55, 51.28, 0.34, 51.72], load: tfl },
  { id: 'nzta', name: 'New Zealand NZTA', region: 'New Zealand', bbox: [166, -47.4, 179, -34], load: nzta },
  { id: 'fl511', name: 'Florida 511', region: 'Florida', bbox: [-87.7, 24.4, -80, 31.1], load: cr('fl511.com', 'FL511', 'Florida') },
  { id: 'ga511', name: 'Georgia 511', region: 'Georgia', bbox: [-85.7, 30.3, -80.8, 35.1], load: cr('511ga.org', 'GA511', 'Georgia') },
  { id: 'ny511', name: 'New York 511', region: 'New York', bbox: [-79.8, 40.4, -71.8, 45.1], load: cr('511ny.org', 'NY511', 'New York') },
  { id: 'pa511', name: 'Pennsylvania 511', region: 'Pennsylvania', bbox: [-80.6, 39.7, -74.6, 42.4], load: cr('511pa.com', 'PA511', 'Pennsylvania') },
  { id: 'wi511', name: 'Wisconsin 511', region: 'Wisconsin', bbox: [-92.9, 42.4, -86.8, 47.4], load: cr('511wi.gov', 'WI511', 'Wisconsin') },
  { id: 'la511', name: 'Louisiana 511', region: 'Louisiana', bbox: [-94.1, 28.9, -88.8, 33.1], load: cr('511la.org', 'LA511', 'Louisiana') },
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

  // Default (no params): load every reachable source. Interim compatibility for the map
  // until it requests by viewport — the CARS state feeds return empty here for now (they
  // fail through Next's server fetch, see notes), so this is the ~4.7k direct-JSON set.
  const cams = (await Promise.all(SOURCES.map(loadSource))).flat();
  return NextResponse.json({ count: cams.length, cams });
}
