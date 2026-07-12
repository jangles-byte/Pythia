import { NextRequest, NextResponse } from 'next/server';

/**
 * OSIRIS — public camera directory (free, no keys).
 * Aggregates every verified open camera network into one normalized list:
 *   Caltrans (all 12 CA districts) · Ontario 511 · Alberta 511 · DelDOT ·
 *   NYC TMC · London TfL JamCams · New Zealand NZTA
 * ~4,000+ cameras: {id, name, place, lat, lng, img?, video?, src}.
 * img = refreshable still; video = HLS stream where the network offers one.
 *
 * GET /api/cams                 → the whole directory (for the map layer)
 * GET /api/cams?near=lat,lng&radius_km=80&limit=12 → nearest cams to a point
 */
export const dynamic = 'force-dynamic';

type Cam = { id: string; name: string; place?: string; lat: number; lng: number; img?: string; video?: string; src: string };

const TTL = 10 * 60_000;
let cache: { ts: number; cams: Cam[] } | null = null;

async function j(url: string, timeout = 15000): Promise<any | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout), cache: 'no-store' });
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

async function directory(): Promise<Cam[]> {
  if (cache && Date.now() - cache.ts < TTL) return cache.cams;
  const batches = await Promise.all([
    caltrans(),
    castleRock('https://511on.ca', 'Ontario511', 'Ontario, CA'),
    castleRock('https://511.alberta.ca', 'Alberta511', 'Alberta, CA'),
    deldot(), nyc(), tfl(), nzta(),
  ]);
  const cams = batches.flat();
  if (cams.length) cache = { ts: Date.now(), cams };
  return cache?.cams || cams;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, d = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * d) / 2) ** 2
    + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lng2 - lng1) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function GET(req: NextRequest) {
  const cams = await directory();
  const near = req.nextUrl.searchParams.get('near');
  if (near) {
    const [lat, lng] = near.split(',').map(parseFloat);
    if (!isFinite(lat) || !isFinite(lng)) return NextResponse.json({ error: 'near=lat,lng' }, { status: 400 });
    const radius = parseFloat(req.nextUrl.searchParams.get('radius_km') || '120');
    const limit = Math.min(48, parseInt(req.nextUrl.searchParams.get('limit') || '12', 10));
    const nearby = cams
      .map((c) => ({ ...c, distance_km: Math.round(haversine(lat, lng, c.lat, c.lng) * 10) / 10 }))
      .filter((c) => c.distance_km <= radius)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);
    return NextResponse.json({ count: nearby.length, cams: nearby });
  }
  return NextResponse.json({ count: cams.length, cams });
}
