import { NextResponse } from 'next/server';

/**
 * OSIRIS — Radiation monitors (Safecast, free, no key).
 * The world's largest open radiation dataset — citizen + fixed sensors reporting
 * ambient dose. We take the most recent reading per device and normalize to nSv/h.
 * GET /api/radiation
 */
export const dynamic = 'force-dynamic';

type Station = { name: string; city: string; country: string; reading: number; status: string; network: string; lat: number; lng: number };

let cache: { ts: number; body: any } | null = null;
const TTL = 5 * 60_000;

// Safecast devices report CPM; the LND7317 tube runs ~334 CPM per µSv/h (~3 nSv/h per CPM).
function toNSv(value: number, unit: string): number {
  const u = (unit || '').toLowerCase();
  if (u.includes('nsv')) return value;
  if (u.includes('usv') || u.includes('µsv')) return value * 1000;
  return value * 3;   // cpm (default)
}
const statusFor = (nsv: number) => (nsv >= 1000 ? 'DANGER' : nsv >= 300 ? 'WARNING' : 'NORMAL');

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const rows: any[] = await fetch('https://api.safecast.org/measurements.json?order=created_at+desc&per_page=100',
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(14000), cache: 'no-store' }).then(r => r.json());
    const seen = new Set<string>();
    const stations: Station[] = [];
    for (const m of (Array.isArray(rows) ? rows : [])) {
      const lat = Number(m.latitude), lng = Number(m.longitude);
      if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) continue;
      const key = String(m.device_id || `${lat.toFixed(3)},${lng.toFixed(3)}`);
      if (seen.has(key)) continue;                     // latest reading per device only
      seen.add(key);
      const nsv = Math.round(toNSv(Number(m.value) || 0, m.unit));
      stations.push({
        name: m.location_name || (m.device_id ? `Safecast #${m.device_id}` : 'Safecast sensor'),
        city: '', country: '',
        reading: nsv, status: statusFor(nsv), network: 'Safecast',
        lat, lng,
      });
      if (stations.length >= 60) break;
    }
    const body = { stations, total: stations.length, timestamp: new Date().toISOString() };
    if (stations.length) cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ stations: [], total: 0, error: String(e) }, { status: 200 });
  }
}
