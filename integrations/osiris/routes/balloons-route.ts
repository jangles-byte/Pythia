import { NextResponse } from 'next/server';

/**
 * OSIRIS — Weather balloons / radiosondes (SondeHub, free, no key).
 * Live radiosonde telemetry from the amateur SondeHub network — the balloons that
 * carry the world's upper-air observations. GET /api/balloons
 * (Do NOT set Accept-Encoding — SondeHub gzips the body and undici auto-decompresses;
 *  a manual header would leave r.json() reading compressed bytes.)
 */
export const dynamic = 'force-dynamic';

type Balloon = {
  callsign: string; lat: number; lng: number; altitude: number; speed: number;
  verticalRate: number; temperature: number; type: string; status: string; color: string;
};

let cache: { ts: number; body: any } | null = null;
const TTL = 120_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const d = await fetch('https://api.v2.sondehub.org/sondes/telemetry?duration=1h',
      { signal: AbortSignal.timeout(14000), cache: 'no-store' }).then(r => r.json());
    const balloons: Balloon[] = [];
    for (const serial of Object.keys(d || {})) {
      const frames = d[serial];
      const times = Object.keys(frames || {});
      if (!times.length) continue;
      const f = frames[times.sort()[times.length - 1]];   // latest frame for this sonde
      if (typeof f?.lat !== 'number' || typeof f?.lon !== 'number') continue;
      const vv = Number(f.vel_v) || 0;
      const status = vv > 0.5 ? 'ascending' : vv < -0.5 ? 'descending' : 'float';
      balloons.push({
        callsign: f.serial || serial,
        lat: f.lat, lng: f.lon,
        altitude: Math.round(f.alt || 0),
        speed: Math.round((Number(f.vel_h) || 0) * 3.6),   // m/s → km/h
        verticalRate: Math.round(vv * 10) / 10,
        temperature: f.temp != null ? Math.round(f.temp) : 0,
        type: (f.type || 'radiosonde').toString(),
        status,
        color: status === 'ascending' ? '#00E676' : status === 'descending' ? '#FF9500' : '#80DEEA',
      });
    }
    const body = { balloons, total: balloons.length, timestamp: new Date().toISOString() };
    if (balloons.length) cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ balloons: [], total: 0, error: String(e) }, { status: 200 });
  }
}
