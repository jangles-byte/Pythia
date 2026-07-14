import { NextResponse } from 'next/server';

/**
 * OSIRIS — FAA national airspace status (free, no key).
 * Ground stops, ground delay programs, and airport closures from
 * nasstatus.faa.gov — the first visible symptom of storms, outages, and
 * security events for travel + logistics.
 */
export const dynamic = 'force-dynamic';

const URL = 'https://nasstatus.faa.gov/api/airport-status-information';

// major-airport coordinates so events land on the globe
const AIRPORTS: Record<string, [number, number, string]> = {
  ATL: [33.64, -84.43, 'Atlanta'], LAX: [33.94, -118.41, 'Los Angeles'], ORD: [41.98, -87.9, 'Chicago O\'Hare'],
  DFW: [32.9, -97.04, 'Dallas–Fort Worth'], DEN: [39.86, -104.67, 'Denver'], JFK: [40.64, -73.78, 'New York JFK'],
  SFO: [37.62, -122.38, 'San Francisco'], SEA: [47.45, -122.31, 'Seattle'], LAS: [36.08, -115.15, 'Las Vegas'],
  MCO: [28.43, -81.31, 'Orlando'], EWR: [40.69, -74.17, 'Newark'], MIA: [25.79, -80.29, 'Miami'],
  PHX: [33.44, -112.01, 'Phoenix'], IAH: [29.98, -95.34, 'Houston'], BOS: [42.36, -71.01, 'Boston'],
  MSP: [44.88, -93.22, 'Minneapolis'], DTW: [42.21, -83.35, 'Detroit'], FLL: [26.07, -80.15, 'Fort Lauderdale'],
  LGA: [40.78, -73.87, 'New York LaGuardia'], PHL: [39.87, -75.24, 'Philadelphia'], CLT: [35.21, -80.94, 'Charlotte'],
  DCA: [38.85, -77.04, 'Washington National'], IAD: [38.94, -77.46, 'Washington Dulles'], BWI: [39.18, -76.67, 'Baltimore'],
  SLC: [40.79, -111.98, 'Salt Lake City'], SAN: [32.73, -117.19, 'San Diego'], TPA: [27.98, -82.53, 'Tampa'],
};

let cache: { ts: number; body: Record<string, unknown> } | null = null;
const TTL = 5 * 60_000;

// The FAA endpoint returns XML; pull the airport-event blocks with light regex —
// enough structure for "which airport, what kind of pain, why".
function parse(xml: string) {
  const out: { airport: string; city: string; type: string; reason: string; lat?: number; lng?: number }[] = [];
  const push = (id: string, type: string, reason: string) => {
    const ap = AIRPORTS[id];
    out.push({ airport: id, city: ap?.[2] || id, type, reason: reason.trim().slice(0, 160), lat: ap?.[0], lng: ap?.[1] });
  };
  for (const m of xml.matchAll(/<Ground_Stop>[\s\S]*?<ARPT>(\w+)<\/ARPT>[\s\S]*?<Reason>([\s\S]*?)<\/Reason>[\s\S]*?<\/Ground_Stop>/g)) push(m[1], 'ground stop', m[2]);
  for (const m of xml.matchAll(/<Ground_Delay>[\s\S]*?<ARPT>(\w+)<\/ARPT>[\s\S]*?<Reason>([\s\S]*?)<\/Reason>[\s\S]*?<\/Ground_Delay>/g)) push(m[1], 'ground delay', m[2]);
  for (const m of xml.matchAll(/<Airport_Closure>[\s\S]*?<ARPT>(\w+)<\/ARPT>[\s\S]*?<Reason>([\s\S]*?)<\/Reason>[\s\S]*?<\/Airport_Closure>/g)) push(m[1], 'closure', m[2]);
  for (const m of xml.matchAll(/<Delay_type>[\s\S]*?<ARPT>(\w+)<\/ARPT>[\s\S]*?<Reason>([\s\S]*?)<\/Reason>[\s\S]*?<\/Delay_type>/g)) {
    if (!out.some((o) => o.airport === m[1])) push(m[1], 'delays', m[2]);
  }
  return out;
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!res.ok) throw new Error(`FAA ${res.status}`);
    const events = parse(await res.text());
    const body = { events, ts: Date.now() };
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), events: [] }, { status: 200 });
  }
}
