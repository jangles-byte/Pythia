import { NextResponse } from 'next/server';
import { byIso2 } from '@/lib/pythiaCentroids';

/**
 * OSIRIS — internet outages (IODA / Georgia Tech Internet Intelligence, free, no key).
 * Country-level connectivity blackouts over the last 24h. An internet going dark
 * is often the first visible signal of a coup, shutdown, or infrastructure failure.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const until = Math.floor(Date.now() / 1000);
    const from = until - 86_400;
    const url = `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?entityType=country&from=${from}&until=${until}&limit=20`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ outages: [], error: `ioda ${res.status}` });
    const data = await res.json();

    const rows = Array.isArray(data?.data) ? data.data : [];
    const outages = rows
      .map((r: any) => {
        const iso2 = r?.entity?.code;
        const c = byIso2(iso2);
        return {
          country: r?.entity?.name || iso2 || 'Unknown',
          iso2,
          score: Math.round(r?.scores?.overall || 0),
          events: r?.event_cnt || 0,
          lat: c ? c[1] : null,
          lng: c ? c[0] : null,
        };
      })
      .filter((o: any) => o.score > 0)
      .sort((a: any, b: any) => b.score - a.score);
    return NextResponse.json({ outages, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ outages: [], error: String(e) });
  }
}
